import { AppError } from '@probe/shared/errors/app-error';
import type {
  CreateTestRunInput,
  UpdateTestResultInput,
} from '@probe/shared/schemas/test-runs';
import type { TestRunRepository } from '../../repositories/test-runs/repository';

export function createTestRunService(repository: TestRunRepository) {
  return {
    list(projectId: number) {
      return repository.list(projectId);
    },

    async create(input: CreateTestRunInput, userId: number) {
      if (input.testCaseVersionIds.length === 0) {
        throw new AppError('BAD_REQUEST', 'At least one test case must be selected');
      }

      return repository.withTransaction(async (transactionRepository) => {
        const versions = await transactionRepository.findVersions(
          input.testCaseVersionIds,
        );
        if (versions.length !== input.testCaseVersionIds.length) {
          throw new AppError(
            'NOT_FOUND',
            'One or more test case versions not found',
          );
        }

        const name =
          input.name ??
          new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        const run = await transactionRepository.createRun({
          projectId: input.projectId,
          name,
          description: input.description ?? null,
          executedById: userId,
        });
        const items = await transactionRepository.createItems(
          input.testCaseVersionIds.map((testCaseVersionId, orderIndex) => ({
            runId: run.id,
            testCaseVersionId,
            orderIndex,
          })),
        );
        await transactionRepository.createResults(
          input.testCaseVersionIds.map((testCaseVersionId) => ({
            runId: run.id,
            testCaseVersionId,
            status: 'not_run' as const,
          })),
        );
        return { ...run, items };
      });
    },

    async get(id: number) {
      const run = await repository.findRun(id);
      if (!run) {
        throw new AppError('NOT_FOUND', 'Test run not found');
      }
      return {
        ...run,
        stats: {
          total: run.results.length,
          passed: run.results.filter((result) => result.status === 'passed').length,
          failed: run.results.filter((result) => result.status === 'failed').length,
          skipped: run.results.filter((result) => result.status === 'skipped').length,
          blocked: run.results.filter((result) => result.status === 'blocked').length,
          notRun: run.results.filter((result) => result.status === 'not_run').length,
        },
      };
    },

    async updateResult(input: UpdateTestResultInput, userId: number) {
      const existing = await repository.findResult(
        input.runId,
        input.testCaseVersionId,
      );
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Test result not found');
      }
      return repository.updateResult(input.runId, input.testCaseVersionId, {
        status: input.status,
        notes: input.notes ?? null,
        executedById: userId,
        executedAt: new Date(),
        updatedAt: new Date(),
      });
    },

    async complete(id: number) {
      const run = await repository.complete(id);
      if (!run) {
        throw new AppError('NOT_FOUND', 'Test run not found');
      }
      return run;
    },

    async delete(id: number) {
      await repository.delete(id);
      return { success: true };
    },

    async getResult(runId: number, testCaseVersionId: number) {
      const result = await repository.findResultWithDetails(
        runId,
        testCaseVersionId,
      );
      if (!result) {
        throw new AppError('NOT_FOUND', 'Test result not found');
      }
      return result;
    },
  };
}
