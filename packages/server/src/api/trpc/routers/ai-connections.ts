import {
  aiConnectionIdInputSchema,
  aiConnectionSchema,
  aiConnectionTestInputSchema,
  aiConnectionTestResultSchema,
  createAiConnectionInputSchema,
  updateAiConnectionInputSchema,
} from '@probe/shared/schemas/ai-connections';
import { z } from 'zod';
import { protectedProcedure, router } from '../../../trpc';

export const aiConnectionsRouter = router({
  list: protectedProcedure
    .output(z.array(aiConnectionSchema))
    .query(({ ctx }) => ctx.services.aiConnections.list(ctx.user)),
  create: protectedProcedure
    .input(createAiConnectionInputSchema)
    .output(aiConnectionSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.aiConnections.create(input, ctx.user),
    ),
  update: protectedProcedure
    .input(updateAiConnectionInputSchema)
    .output(aiConnectionSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.aiConnections.update(input, ctx.user),
    ),
  delete: protectedProcedure
    .input(aiConnectionIdInputSchema)
    .output(z.object({ success: z.literal(true) }))
    .mutation(({ ctx, input }) =>
      ctx.services.aiConnections.delete(input.id, ctx.user),
    ),
  test: protectedProcedure
    .input(aiConnectionTestInputSchema)
    .output(aiConnectionTestResultSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.aiConnections.test(input.id, ctx.user),
    ),
});
