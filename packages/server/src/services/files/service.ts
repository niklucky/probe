import { AppError } from '@probe/shared/errors/app-error';
import type { Client } from 'minio';
import type { createFileRepository } from '../../repositories/files/repository';

type Repository = ReturnType<typeof createFileRepository>;

export function createFileService(
  repository: Repository,
  storage: Client,
  bucketName: string,
) {
  return {
    async getLegacyUploadUrl(filename: string) {
      const objectName = `uploads/${Date.now()}-${filename}`;
      try {
        return {
          uploadUrl: await storage.presignedPutObject(
            bucketName,
            objectName,
            24 * 60 * 60,
          ),
          publicUrl: `${process.env.MINIO_PUBLIC_URL || 'http://localhost:11002'}/${bucketName}/${objectName}`,
          objectName,
        };
      } catch {
        throw new AppError(
          'INTERNAL_SERVER_ERROR',
          'Failed to generate upload URL',
        );
      }
    },
    async getUploadUrl(userId: number, filename: string) {
      const objectName = `${userId}/${Date.now()}_${filename}`;
      try {
        return {
          presignedUrl: await storage.presignedPutObject(
            bucketName,
            objectName,
            300,
          ),
          objectName,
          publicUrl: `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '11002'}/${bucketName}/${objectName}`,
        };
      } catch {
        throw new AppError(
          'INTERNAL_SERVER_ERROR',
          'Failed to generate upload URL',
        );
      }
    },
    save(
      input: Omit<Parameters<Repository['create']>[0], 'createdById'>,
      userId: number,
    ) {
      return repository.create({ ...input, createdById: userId });
    },
    list: (entityType: string, entityId: number) =>
      repository.list(entityType, entityId),
    async delete(id: number) {
      const file = await repository.find(id);
      if (!file) throw new AppError('NOT_FOUND', 'File not found');
      try {
        await storage.removeObject(bucketName, file.filename);
      } catch (error) {
        console.error('Failed to delete from MinIO:', error);
      }
      await repository.delete(id);
      return { success: true };
    },
    async getDownloadUrl(id: number) {
      const file = await repository.find(id);
      if (!file) throw new AppError('NOT_FOUND', 'File not found');
      try {
        return {
          presignedUrl: await storage.presignedGetObject(
            bucketName,
            file.filename,
            300,
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
