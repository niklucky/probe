import {
  createTestRunInputSchema,
  getTestResultInputSchema,
  listTestRunsInputSchema,
  testRunIdInputSchema,
  updateTestResultInputSchema,
} from '@probe/shared/schemas/test-runs';
import { protectedProcedure, router } from '../../../trpc';

export const testRunsRouter = router({
  list: protectedProcedure
    .input(listTestRunsInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.testRuns.list(input.projectId, ctx.user.id),
    ),
  create: protectedProcedure
    .input(createTestRunInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.testRuns.create(input, ctx.user.id),
    ),
  get: protectedProcedure
    .input(testRunIdInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.testRuns.get(input.id, ctx.user.id),
    ),
  updateResult: protectedProcedure
    .input(updateTestResultInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.testRuns.updateResult(input, ctx.user.id),
    ),
  complete: protectedProcedure
    .input(testRunIdInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.testRuns.complete(input.id, ctx.user.id),
    ),
  delete: protectedProcedure
    .input(testRunIdInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.testRuns.delete(input.id, ctx.user.id),
    ),
  getResult: protectedProcedure
    .input(getTestResultInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.testRuns.getResult(
        input.runId,
        input.testCaseVersionId,
        ctx.user.id,
      ),
    ),
});
