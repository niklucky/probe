import { AppError } from '@probe/shared/errors/app-error';
import type { Client } from 'minio';
import type { createFileRepository } from '../../repositories/files/repository';
import type { AuthorizationService } from '../authorization/service';
import { serverEnv } from '../../env';
import { publicizeStorageUrl } from './public-url';

type Repository = ReturnType<typeof createFileRepository>;

export function createFileService(
  repository: Repository,
  storage: Client,
  bucketName: string,
  authorization: AuthorizationService,
) {
  const entityResource = (
    entityType: string,
    entityId: number,
  ): { type: 'caseVersion' | 'result'; id: number } => {
    if (entityType === 'test_case_version') {
      return { type: 'caseVersion', id: entityId };
    }
    if (entityType === 'test_result') {
      return { type: 'result', id: entityId };
    }
    throw new AppError('BAD_REQUEST', 'Unsupported file entity');
  };

  return {
    async getLegacyUploadUrl(filename: string) {
      const objectName = `uploads/${Date.now()}-${filename}`;
      try {
        return {
          uploadUrl: publicizeStorageUrl(
            await storage.presignedPutObject(
              bucketName,
              objectName,
              24 * 60 * 60,
            ),
            serverEnv.MINIO_PUBLIC_URL,
          ),
          publicUrl: `${serverEnv.MINIO_PUBLIC_URL}/${bucketName}/${objectName}`,
          objectName,
        };
      } catch {
        throw new AppError(
          'INTERNAL_SERVER_ERROR',
          'Failed to generate upload URL',
        );
      }
    },
    async getUploadUrl(
      userId: number,
      input:
        | { purpose: 'profile_avatar'; filename: string }
        | {
            purpose: 'attachment';
            filename: string;
            entityType: 'test_case_version' | 'test_result';
            entityId: number;
          },
    ) {
      if (input.purpose === 'attachment') {
        await authorization.require(
          userId,
          entityResource(input.entityType, input.entityId),
          input.entityType === 'test_case_version' ? 'author' : 'execute',
        );
      }
      const objectName = `${userId}/${Date.now()}_${input.filename}`;
      try {
        return {
          presignedUrl: publicizeStorageUrl(
            await storage.presignedPutObject(bucketName, objectName, 300),
            serverEnv.MINIO_PUBLIC_URL,
          ),
          objectName,
          publicUrl: `${serverEnv.MINIO_PUBLIC_URL}/${bucketName}/${objectName}`,
        };
      } catch {
        throw new AppError(
          'INTERNAL_SERVER_ERROR',
          'Failed to generate upload URL',
        );
      }
    },
    async save(
      input: Omit<Parameters<Repository['create']>[0], 'createdById'>,
      userId: number,
    ) {
      await authorization.require(
        userId,
        entityResource(input.entityType, input.entityId),
        input.entityType === 'test_case_version' ? 'author' : 'execute',
      );
      return repository.create({ ...input, createdById: userId });
    },
    async list(entityType: string, entityId: number, userId: number) {
      await authorization.require(
        userId,
        entityResource(entityType, entityId),
        'read',
      );
      return repository.list(entityType, entityId);
    },
    async delete(id: number, userId: number) {
      const file = await repository.find(id);
      if (!file) throw new AppError('NOT_FOUND', 'File not found');
      await authorization.require(
        userId,
        entityResource(file.entityType, file.entityId),
        file.entityType === 'test_case_version' ? 'author' : 'execute',
      );
      try {
        await storage.removeObject(bucketName, file.filename);
      } catch (error) {
        console.error('Failed to delete from MinIO:', error);
      }
      await repository.delete(id);
      return { success: true };
    },
    async getDownloadUrl(id: number, userId: number) {
      await authorization.require(userId, { type: 'file', id }, 'read');
      const file = await repository.find(id);
      if (!file) throw new AppError('NOT_FOUND', 'File not found');
      try {
        return {
          presignedUrl: publicizeStorageUrl(
            await storage.presignedGetObject(bucketName, file.filename, 300),
            serverEnv.MINIO_PUBLIC_URL,
          ),
        };
      } catch {
        throw new AppError(
          'INTERNAL_SERVER_ERROR',
          'Failed to generate download URL',
        );
      }
    },
  };
}
