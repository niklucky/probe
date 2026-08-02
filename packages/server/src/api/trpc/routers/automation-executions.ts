import {
  automationExecutionArtifactInputSchema,
  automationExecutionIdInputSchema,
  listAutomationExecutionsInputSchema,
  queueAutomationExecutionInputSchema,
} from '@probe/shared/schemas/automation-executions';
import { protectedProcedure, router } from '../../../trpc';

export const automationExecutionsRouter = router({
  queue: protectedProcedure
    .input(queueAutomationExecutionInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.automationExecutions.queue(input, ctx.user.id),
    ),
  list: protectedProcedure
    .input(listAutomationExecutionsInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.automationExecutions.list(input.automationId, ctx.user.id),
    ),
  get: protectedProcedure
    .input(automationExecutionIdInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.automationExecutions.get(input.id, ctx.user.id),
    ),
  cancel: protectedProcedure
    .input(automationExecutionIdInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.automationExecutions.cancel(input.id, ctx.user.id),
    ),
  artifactUrl: protectedProcedure
    .input(automationExecutionArtifactInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.automationExecutions.getArtifactUrl(
        input.jobId,
        input.artifactId,
        ctx.user.id,
      ),
    ),
});
