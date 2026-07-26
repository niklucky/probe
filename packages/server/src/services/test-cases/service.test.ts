import { describe, expect, test } from 'bun:test';
import { createTestCaseRepository } from '../../repositories/test-cases/repository';
import { createTestCaseService } from './service';

describe('test case service', () => {
  test('creates the case and initial version in one transaction', async () => {
    const calls: string[] = [];
    const baseRepository = createTestCaseRepository();
    const transactionRepository = {
      ...baseRepository,
      async findSuite() {
        calls.push('findSuite');
        return {
          id: 7,
          productId: 3,
          name: 'Regression',
          description: null,
          currentVersionId: 11,
          createdById: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
      async createCase() {
        calls.push('createCase');
        return {
          id: 13,
          suiteId: 7,
          currentVersionId: null,
          createdById: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
      async createVersion(
        values: Parameters<typeof baseRepository.createVersion>[0],
      ) {
        calls.push('createVersion');
        return {
          id: 17,
          testCaseId: values.testCaseId,
          suiteVersionId: values.suiteVersionId,
          versionNumber: values.versionNumber,
          title: values.title,
          description: values.description ?? null,
          prerequisites: values.prerequisites ?? [],
          steps: values.steps ?? [],
          expectedResult: values.expectedResult ?? '',
          priority: values.priority ?? 'medium',
          status: values.status ?? 'draft',
          tags: values.tags ?? [],
          createdById: values.createdById,
          createdAt: new Date(),
        };
      },
      async setCurrentVersion(id: number, currentVersionId: number) {
        calls.push('setCurrentVersion');
        return {
          id,
          suiteId: 7,
          currentVersionId,
          createdById: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    };
    const fakeRepository = {
      ...baseRepository,
      async withTransaction<T>(
        operation: (repository: typeof transactionRepository) => Promise<T>,
      ) {
        calls.push('transaction');
        return operation(transactionRepository);
      },
    };
    const authorization = {
      async require() {
        return { projectId: 1, role: 'qa' as const };
      },
    };

    const result = await createTestCaseService(
      fakeRepository,
      authorization as never,
    ).create(
      {
        suiteId: 7,
        title: 'Can log in',
        prerequisites: ['A registered account'],
        steps: [
          { action: 'Open login' },
          {
            action: 'Submit credentials',
            expectedResult: 'Dashboard is shown',
          },
        ],
        expectedResult: 'The user is authenticated',
        priority: 'high',
        status: 'ready',
        tags: ['auth'],
      },
      2,
    );

    expect(calls).toEqual([
      'transaction',
      'findSuite',
      'createCase',
      'createVersion',
      'setCurrentVersion',
    ]);
    expect(result.currentVersion.id).toBe(17);
    expect(result.currentVersion.suiteVersionId).toBe(11);
    expect(result.currentVersion.status).toBe('ready');
  });
});
