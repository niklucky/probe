import {
  createEnvironmentInputSchema,
  environmentIdInputSchema,
  environmentSchema,
  listEnvironmentsInputSchema,
  updateEnvironmentInputSchema,
} from '@probe/shared/schemas/environments';
import { z } from 'zod';
import { protectedProcedure, router } from '../../../trpc';

export const environmentsRouter = router({
  list: protectedProcedure
    .input(listEnvironmentsInputSchema)
    .output(z.array(environmentSchema))
    .query(({ ctx, input }) =>
      ctx.services.environments.list(input, ctx.user.id),
    ),
  create: protectedProcedure
    .input(createEnvironmentInputSchema)
    .output(environmentSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.environments.create(input, ctx.user.id),
    ),
  update: protectedProcedure
    .input(updateEnvironmentInputSchema)
    .output(environmentSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.environments.update(input, ctx.user.id),
    ),
  delete: protectedProcedure
    .input(environmentIdInputSchema)
    .output(z.object({ success: z.literal(true) }))
    .mutation(({ ctx, input }) =>
      ctx.services.environments.delete(input.id, ctx.user.id),
    ),
});
