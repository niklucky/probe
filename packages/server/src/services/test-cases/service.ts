import type {
  CreateTestCaseInput,
  UpdateTestCaseInput,
} from '@probe/shared/schemas/test-cases';
import { AppError } from '@probe/shared/errors/app-error';
import type { TestCaseRepository } from '../../repositories/test-cases/repository';
import type { AuthorizationService } from '../authorization/service';

const structuredSteps = (
  steps: Array<string | { action: string; expectedResult?: string }>,
) => steps.map((step) => (typeof step === 'string' ? { action: step } : step));

const normalizeVersion = <
  T extends {
    steps: Array<string | { action: string; expectedResult?: string }>;
  },
>(
  version: T,
): Omit<T, 'steps'> & {
  steps: Array<{ action: string; expectedResult?: string }>;
} => ({ ...version, steps: structuredSteps(version.steps) });

export function createTestCaseService(
  repository: TestCaseRepository,
  authorization: AuthorizationService,
) {
  return {
    async list(
      input: { suiteId: number; versionId?: number; deleted?: boolean },
      userId: number,
    ) {
      await authorization.require(
        userId,
        { type: 'suite', id: input.suiteId },
        'read',
      );
      if (input.versionId) {
        const suiteVersion = await repository.findSuiteVersion(input.versionId);
        if (!suiteVersion || suiteVersion.suiteId !== input.suiteId) {
          throw new AppError('NOT_FOUND', 'Suite version not found');
        }
        const versions = await repository.listBySuiteVersion(input.versionId);
        return versions
          .filter(({ testCase }) =>
            input.deleted
              ? testCase.deletedAt !== null
              : testCase.deletedAt === null,
          )
          .map(({ testCase, ...version }) => ({
            ...testCase,
            versions: [normalizeVersion(version)],
            currentVersion: normalizeVersion(version),
          }));
      }

      const testCases = await repository.listCurrentBySuite(
        input.suiteId,
        input.deleted,
      );
      return testCases.map((testCase) => ({
        ...testCase,
        versions: testCase.versions.map(normalizeVersion),
        currentVersion: testCase.versions[0]
          ? normalizeVersion(testCase.versions[0])
          : undefined,
      }));
    },

    async listByProduct(productId: number, userId: number) {
      await authorization.require(
        userId,
        { type: 'product', id: productId },
        'read',
      );
      const suites = await repository.listSuitesByProduct(productId);
      if (suites.length === 0) {
        throw new AppError(
          'NOT_FOUND',
          'No test suites found for this product',
        );
      }

      return Promise.all(
        suites.map(async (suite) => {
          const testCases = await repository.listCurrentBySuite(suite.id);
          return {
            suiteId: suite.id,
            suiteName: suite.name,
            testCases: testCases.map((testCase) => ({
              ...testCase,
              versions: testCase.versions.map(normalizeVersion),
              currentVersion: testCase.versions[0]
                ? normalizeVersion(testCase.versions[0])
                : undefined,
            })),
          };
        }),
      );
    },

    async create(input: CreateTestCaseInput, userId: number) {
      await authorization.require(
        userId,
        { type: 'suite', id: input.suiteId },
        'author',
      );
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
          prerequisites: input.prerequisites,
          steps: input.steps,
          expectedResult: input.expectedResult,
          priority: input.priority,
          status: input.status,
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

    async get(id: number, userId: number, versionId?: number) {
      await authorization.require(userId, { type: 'case', id }, 'read');
      const testCase = await repository.findById(id);
      if (!testCase) {
        throw new AppError('NOT_FOUND', 'Test case not found');
      }
      const versions = testCase.versions.map(normalizeVersion);
      if (versionId && !versions.some((version) => version.id === versionId)) {
        throw new AppError('NOT_FOUND', 'Test case version not found');
      }
      return {
        ...testCase,
        versions,
        currentVersion:
          versions.find((version) => version.id === versionId) ?? versions[0],
      };
    },

    async update(input: UpdateTestCaseInput, userId: number) {
      await authorization.require(
        userId,
        { type: 'case', id: input.id },
        'author',
      );
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
            input.description !== undefined
              ? input.description
              : latest?.description,
          prerequisites: input.prerequisites ?? latest?.prerequisites ?? [],
          steps: input.steps ?? latest?.steps ?? [],
          expectedResult:
            input.expectedResult !== undefined
              ? input.expectedResult
              : (latest?.expectedResult ?? ''),
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

    async listVersions(testCaseId: number, userId: number) {
      await authorization.require(
        userId,
        { type: 'case', id: testCaseId },
        'read',
      );
      return (await repository.listVersions(testCaseId)).map(normalizeVersion);
    },

    async delete(id: number, userId: number) {
      await authorization.require(userId, { type: 'case', id }, 'author');
      await repository.softDelete(id);
      return { success: true };
    },

    async restore(id: number, userId: number) {
      await authorization.require(userId, { type: 'case', id }, 'author');
      await repository.restore(id);
      return { success: true };
    },

    async permanentlyDelete(id: number, userId: number) {
      await authorization.require(userId, { type: 'case', id }, 'author');
      const testCase = await repository.findById(id);
      if (!testCase) {
        throw new AppError('NOT_FOUND', 'Test case not found');
      }
      if (!testCase.deletedAt) {
        throw new AppError(
          'BAD_REQUEST',
          'Test case must be deleted before it can be permanently deleted',
        );
      }
      await repository.permanentlyDelete(id);
      return { success: true };
    },
  };
}

export type TestCaseService = ReturnType<typeof createTestCaseService>;
