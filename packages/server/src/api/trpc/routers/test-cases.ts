import {
  createTestCaseInputSchema,
  deleteTestCaseInputSchema,
  getTestCaseInputSchema,
  getTestCaseVersionsInputSchema,
  listTestCasesByProductInputSchema,
  listTestCasesInputSchema,
  updateTestCaseInputSchema,
} from '@probe/shared/schemas/test-cases';
import { protectedProcedure, router } from '../../../trpc';

export const testCasesRouter = router({
  list: protectedProcedure
    .input(listTestCasesInputSchema)
    .query(({ ctx, input }) => ctx.services.testCases.list(input)),

  listByProduct: protectedProcedure
    .input(listTestCasesByProductInputSchema)
    .query(({ ctx, input }) => ctx.services.testCases.listByProduct(input.productId)),

  create: protectedProcedure
    .input(createTestCaseInputSchema)
    .mutation(({ ctx, input }) => ctx.services.testCases.create(input, ctx.user.id)),

  get: protectedProcedure
    .input(getTestCaseInputSchema)
    .query(({ ctx, input }) => ctx.services.testCases.get(input.id)),

  update: protectedProcedure
    .input(updateTestCaseInputSchema)
    .mutation(({ ctx, input }) => ctx.services.testCases.update(input, ctx.user.id)),

  getVersions: protectedProcedure
    .input(getTestCaseVersionsInputSchema)
    .query(({ ctx, input }) => ctx.services.testCases.listVersions(input.testCaseId)),

  delete: protectedProcedure
    .input(deleteTestCaseInputSchema)
    .mutation(({ ctx, input }) => ctx.services.testCases.delete(input.id)),
});
