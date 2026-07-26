import { AppError } from '@probe/shared/errors/app-error';
import type { createTestSuiteRepository } from '../../repositories/test-suites/repository';

type Repository = ReturnType<typeof createTestSuiteRepository>;

export function createTestSuiteService(repository: Repository) {
  return {
    list: (productId: number) => repository.list(productId),

    create(
      input: { productId: number; name: string; description?: string | null },
      userId: number,
    ) {
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

    async get(id: number) {
      const suite = await repository.find(id);
      if (!suite) throw new AppError('NOT_FOUND', 'Test suite not found');
      return suite;
    },

    update(
      input: { id: number; name?: string; description?: string | null },
      userId: number,
    ) {
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

    listVersions: (suiteId: number) => repository.listVersions(suiteId),
    async delete(id: number) {
      await repository.delete(id);
      return { success: true };
    },
  };
}
