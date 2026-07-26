import {
  createTestSuiteInputSchema,
  getTestSuiteVersionsInputSchema,
  listTestSuitesInputSchema,
  testSuiteIdInputSchema,
  updateTestSuiteInputSchema,
} from '@probe/shared/schemas/test-suites';
import { protectedProcedure, router } from '../../../trpc';

export const testSuitesRouter = router({
  list: protectedProcedure
    .input(listTestSuitesInputSchema)
    .query(({ ctx, input }) => ctx.services.testSuites.list(input.productId)),
  create: protectedProcedure
    .input(createTestSuiteInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.testSuites.create(input, ctx.user.id),
    ),
  get: protectedProcedure
    .input(testSuiteIdInputSchema)
    .query(({ ctx, input }) => ctx.services.testSuites.get(input.id)),
  update: protectedProcedure
    .input(updateTestSuiteInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.testSuites.update(input, ctx.user.id),
    ),
  getVersions: protectedProcedure
    .input(getTestSuiteVersionsInputSchema)
    .query(({ ctx, input }) => ctx.services.testSuites.listVersions(input.suiteId)),
  delete: protectedProcedure
    .input(testSuiteIdInputSchema)
    .mutation(({ ctx, input }) => ctx.services.testSuites.delete(input.id)),
});
