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
          deletedAt: null,
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
          deletedAt: null,
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
          environmentId: values.environmentId ?? null,
          environmentProfileId: values.environmentProfileId ?? null,
          environmentProfileName: values.environmentProfileName ?? null,
          environmentProfileRevision: values.environmentProfileRevision ?? null,
          startingState: values.startingState ?? null,
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
          deletedAt: null,
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

  test('soft deletes, restores, and permanently deletes a deleted case', async () => {
    const calls: string[] = [];
    const repository = {
      async softDelete() {
        calls.push('softDelete');
      },
      async restore() {
        calls.push('restore');
      },
      async findById() {
        calls.push('findById');
        return { deletedAt: new Date() };
      },
      async permanentlyDelete() {
        calls.push('permanentlyDelete');
      },
    };
    const authorization = {
      async require() {
        calls.push('authorize');
      },
    };
    const service = createTestCaseService(
      repository as never,
      authorization as never,
    );

    await service.delete(13, 2);
    await service.restore(13, 2);
    await service.permanentlyDelete(13, 2);

    expect(calls).toEqual([
      'authorize',
      'softDelete',
      'authorize',
      'restore',
      'authorize',
      'findById',
      'permanentlyDelete',
    ]);
  });

  test('refuses to permanently delete an active case', async () => {
    let permanentlyDeleted = false;
    const service = createTestCaseService(
      {
        async findById() {
          return { deletedAt: null };
        },
        async permanentlyDelete() {
          permanentlyDeleted = true;
        },
      } as never,
      { async require() {} } as never,
    );

    await expect(service.permanentlyDelete(13, 2)).rejects.toThrow(
      'Test case must be deleted before it can be permanently deleted',
    );
    expect(permanentlyDeleted).toBe(false);
  });
});
