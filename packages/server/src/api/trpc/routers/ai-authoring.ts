import {
  acceptAiTestCaseProposalInputSchema,
  acceptedAiTestCaseProposalSchema,
  aiTestCaseProposalSchema,
  discardAiTestCaseProposalInputSchema,
  requestAiTestCaseProposalInputSchema,
} from '@probe/shared/schemas/ai-authoring';
import { z } from 'zod';
import { protectedProcedure, router } from '../../../trpc';

export const aiAuthoringRouter = router({
  request: protectedProcedure
    .input(requestAiTestCaseProposalInputSchema)
    .output(aiTestCaseProposalSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.aiAuthoring.request(input, ctx.user.id),
    ),
  accept: protectedProcedure
    .input(acceptAiTestCaseProposalInputSchema)
    .output(acceptedAiTestCaseProposalSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.aiAuthoring.accept(input.jobId, input.proposal, ctx.user.id),
    ),
  discard: protectedProcedure
    .input(discardAiTestCaseProposalInputSchema)
    .output(z.object({ success: z.literal(true) }))
    .mutation(({ ctx, input }) =>
      ctx.services.aiAuthoring.discard(input.jobId, ctx.user.id),
    ),
});
