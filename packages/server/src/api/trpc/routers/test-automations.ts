import {
  acceptTestAutomationInputSchema,
  generateTestAutomationInputSchema,
  listTestAutomationsInputSchema,
  testAutomationIdInputSchema,
  testAutomationSchema,
} from '@probe/shared/schemas/test-automations';
import { z } from 'zod';
import { protectedProcedure, router } from '../../../trpc';

export const testAutomationsRouter = router({
  generate: protectedProcedure
    .input(generateTestAutomationInputSchema)
    .output(testAutomationSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.testAutomations.generate(input, ctx.user.id),
    ),
  list: protectedProcedure
    .input(listTestAutomationsInputSchema)
    .output(z.array(testAutomationSchema))
    .query(({ ctx, input }) =>
      ctx.services.testAutomations.list(input.testCaseId, ctx.user.id),
    ),
  accept: protectedProcedure
    .input(acceptTestAutomationInputSchema)
    .output(testAutomationSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.testAutomations.accept(input.id, input.source, ctx.user.id),
    ),
  discard: protectedProcedure
    .input(testAutomationIdInputSchema)
    .output(z.object({ success: z.literal(true) }))
    .mutation(({ ctx, input }) =>
      ctx.services.testAutomations.discard(input.id, ctx.user.id),
    ),
});
