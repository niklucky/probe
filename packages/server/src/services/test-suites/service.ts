import { AppError } from '@probe/shared/errors/app-error';
import type { createTestSuiteRepository } from '../../repositories/test-suites/repository';
import type { AuthorizationService } from '../authorization/service';

type Repository = ReturnType<typeof createTestSuiteRepository>;

export function createTestSuiteService(
  repository: Repository,
  authorization: AuthorizationService,
) {
  return {
    async list(productId: number, userId: number) {
      await authorization.require(
        userId,
        { type: 'product', id: productId },
        'read',
      );
      return repository.list(productId);
    },

    async create(
      input: { productId: number; name: string; description?: string | null },
      userId: number,
    ) {
      await authorization.require(
        userId,
        { type: 'product', id: input.productId },
        'author',
      );
      return repository.withTransaction(async (transactionRepository) => {
        const suite = await transactionRepository.createSuite({
          productId: input.productId,
          name: input.name,
          description: input.description ?? null,
          createdById: userId,
          currentVersionId: null,
        });
        const version = await transactionRepository.createVersion({
          suiteId: suite.id,
          versionNumber: 1,
          name: input.name,
          description: input.description ?? null,
          createdById: userId,
        });
        const updated = await transactionRepository.updateSuite(suite.id, {
          currentVersionId: version.id,
        });
        return updated;
      });
    },

    async get(id: number, userId: number) {
      await authorization.require(userId, { type: 'suite', id }, 'read');
      const suite = await repository.find(id);
      if (!suite) throw new AppError('NOT_FOUND', 'Test suite not found');
      return suite;
    },

    async update(
      input: { id: number; name?: string; description?: string | null },
      userId: number,
    ) {
      await authorization.require(
        userId,
        { type: 'suite', id: input.id },
        'author',
      );
      return repository.withTransaction(async (transactionRepository) => {
        const suite = await transactionRepository.find(input.id);
        if (!suite) throw new AppError('NOT_FOUND', 'Test suite not found');
        const latest = suite.versions[0];
        const version = await transactionRepository.createVersion({
          suiteId: input.id,
          versionNumber: latest ? latest.versionNumber + 1 : 1,
          name: input.name ?? latest?.name ?? '',
          description:
            input.description !== undefined
              ? input.description
              : latest?.description,
          createdById: userId,
        });
        const updated = await transactionRepository.updateSuite(input.id, {
          name: input.name ?? suite.name,
          description:
            input.description !== undefined
              ? input.description
              : suite.description,
          currentVersionId: version.id,
        });
        return { ...updated, newVersion: version };
      });
    },

    async listVersions(suiteId: number, userId: number) {
      await authorization.require(
        userId,
        { type: 'suite', id: suiteId },
        'read',
      );
      return repository.listVersions(suiteId);
    },
    async delete(id: number, userId: number) {
      await authorization.require(userId, { type: 'suite', id }, 'author');
      await repository.delete(id);
      return { success: true };
    },
  };
}
