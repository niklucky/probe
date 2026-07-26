import {
  createTestCaseInputSchema,
  deleteTestCaseInputSchema,
  getTestCaseInputSchema,
  getTestCaseVersionsInputSchema,
  listTestCasesByProductInputSchema,
  listTestCasesInputSchema,
  updateTestCaseInputSchema,
  testCaseListItemSchema,
  testCaseDetailSchema,
  testCaseVersionSchema,
  createdTestCaseSchema,
  updatedTestCaseSchema,
  productTestCasesSchema,
} from '@probe/shared/schemas/test-cases';
import { z } from 'zod';
import { protectedProcedure, router } from '../../../trpc';

export const testCasesRouter = router({
  list: protectedProcedure
    .input(listTestCasesInputSchema)
    .output(z.array(testCaseListItemSchema))
    .query(({ ctx, input }) => ctx.services.testCases.list(input, ctx.user.id)),

  listByProduct: protectedProcedure
    .input(listTestCasesByProductInputSchema)
    .output(z.array(productTestCasesSchema))
    .query(({ ctx, input }) =>
      ctx.services.testCases.listByProduct(input.productId, ctx.user.id),
    ),

  create: protectedProcedure
    .input(createTestCaseInputSchema)
    .output(createdTestCaseSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.testCases.create(input, ctx.user.id),
    ),

  get: protectedProcedure
    .input(getTestCaseInputSchema)
    .output(testCaseDetailSchema)
    .query(({ ctx, input }) =>
      ctx.services.testCases.get(input.id, ctx.user.id, input.versionId),
    ),

  update: protectedProcedure
    .input(updateTestCaseInputSchema)
    .output(updatedTestCaseSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.testCases.update(input, ctx.user.id),
    ),

  getVersions: protectedProcedure
    .input(getTestCaseVersionsInputSchema)
    .output(z.array(testCaseVersionSchema))
    .query(({ ctx, input }) =>
      ctx.services.testCases.listVersions(input.testCaseId, ctx.user.id),
    ),

  delete: protectedProcedure
    .input(deleteTestCaseInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.services.testCases.delete(input.id, ctx.user.id),
    ),
});
