import type {
  CreateTestCaseInput,
  UpdateTestCaseInput,
} from '@probe/shared/schemas/test-cases';
import { AppError } from '@probe/shared/errors/app-error';
import type { TestCaseRepository } from '../../repositories/test-cases/repository';

export function createTestCaseService(repository: TestCaseRepository) {
  return {
    async list(input: { suiteId: number; versionId?: number }) {
      if (input.versionId) {
        const versions = await repository.listBySuiteVersion(input.versionId);
        return versions.map(({ testCase, ...version }) => ({
          ...testCase,
          versions: [version],
          currentVersion: version,
        }));
      }

      const testCases = await repository.listCurrentBySuite(input.suiteId);
      return testCases.map((testCase) => ({
        ...testCase,
        currentVersion: testCase.versions[0],
      }));
    },

    async listByProduct(productId: number) {
      const suites = await repository.listSuitesByProduct(productId);
      if (suites.length === 0) {
        throw new AppError('NOT_FOUND', 'No test suites found for this product');
      }

      return Promise.all(
        suites.map(async (suite) => {
          const testCases = await repository.listCurrentBySuite(suite.id);
          return {
            suiteId: suite.id,
            suiteName: suite.name,
            testCases: testCases.map((testCase) => ({
              ...testCase,
              currentVersion: testCase.versions[0],
            })),
          };
        }),
      );
    },

    async create(input: CreateTestCaseInput, userId: number) {
      return repository.withTransaction(async (transactionRepository) => {
        const suite = await transactionRepository.findSuite(input.suiteId);
        if (!suite) {
          throw new AppError('NOT_FOUND', 'Test suite not found');
        }
        if (!suite.currentVersionId) {
          throw new AppError('BAD_REQUEST', 'Suite has no current version');
        }

        const testCase = await transactionRepository.createCase({
          suiteId: input.suiteId,
          createdById: userId,
          currentVersionId: null,
        });
        const version = await transactionRepository.createVersion({
          testCaseId: testCase.id,
          suiteVersionId: suite.currentVersionId,
          versionNumber: 1,
          title: input.title,
          description: input.description ?? null,
          steps: input.steps,
          expectedResult: input.expectedResult ?? null,
          priority: input.priority,
          status: 'draft',
          tags: input.tags,
          createdById: userId,
        });
        const updated = await transactionRepository.setCurrentVersion(
          testCase.id,
          version.id,
        );

        return { ...updated, currentVersion: version };
      });
    },

    async get(id: number) {
      const testCase = await repository.findById(id);
      if (!testCase) {
        throw new AppError('NOT_FOUND', 'Test case not found');
      }
      return testCase;
    },

    async update(input: UpdateTestCaseInput, userId: number) {
      return repository.withTransaction(async (transactionRepository) => {
        const testCase = await transactionRepository.findForUpdate(input.id);
        if (!testCase) {
          throw new AppError('NOT_FOUND', 'Test case not found');
        }
        if (!testCase.suite.currentVersionId) {
          throw new AppError('BAD_REQUEST', 'Suite has no current version');
        }

        const latest = testCase.versions[0];
        const version = await transactionRepository.createVersion({
          testCaseId: input.id,
          suiteVersionId: testCase.suite.currentVersionId,
          versionNumber: latest ? latest.versionNumber + 1 : 1,
          title: input.title ?? latest?.title ?? '',
          description:
            input.description !== undefined ? input.description : latest?.description,
          steps: input.steps ?? latest?.steps ?? [],
          expectedResult:
            input.expectedResult !== undefined
              ? input.expectedResult
              : latest?.expectedResult,
          priority: input.priority ?? latest?.priority ?? 'medium',
          status: input.status ?? latest?.status ?? 'draft',
          tags: input.tags ?? latest?.tags ?? [],
          createdById: userId,
        });
        const updated = await transactionRepository.setCurrentVersion(
          input.id,
          version.id,
        );
        return { ...updated, newVersion: version };
      });
    },

    listVersions(testCaseId: number) {
      return repository.listVersions(testCaseId);
    },

    async delete(id: number) {
      await repository.delete(id);
      return { success: true };
    },
  };
}

export type TestCaseService = ReturnType<typeof createTestCaseService>;
