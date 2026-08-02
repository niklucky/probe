import {
  automationRepairSessionIdInputSchema,
  executeAutomationRepairInputSchema,
  listAutomationRepairsInputSchema,
  requestAutomationRepairInputSchema,
} from '@probe/shared/schemas/automation-repairs';
import { protectedProcedure, router } from '../../../trpc';

export const automationRepairsRouter = router({
  request: protectedProcedure
    .input(requestAutomationRepairInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.automationRepairs.request(input, ctx.user.id),
    ),
  continue: protectedProcedure
    .input(automationRepairSessionIdInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.automationRepairs.continue(input.id, ctx.user.id),
    ),
  execute: protectedProcedure
    .input(executeAutomationRepairInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.automationRepairs.execute(
        input.sessionId,
        input.attemptId,
        ctx.user.id,
      ),
    ),
  get: protectedProcedure
    .input(automationRepairSessionIdInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.automationRepairs.get(input.id, ctx.user.id),
    ),
  list: protectedProcedure
    .input(listAutomationRepairsInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.automationRepairs.list(input.executionId, ctx.user.id),
    ),
});
