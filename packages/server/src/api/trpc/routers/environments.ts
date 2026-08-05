import {
  createEnvironmentInputSchema,
  createEnvironmentCookieInputSchema,
  createEnvironmentVariableInputSchema,
  environmentIdInputSchema,
  environmentCookieIdInputSchema,
  environmentCookieSchema,
  environmentSchema,
  environmentVariableIdInputSchema,
  environmentVariableSchema,
  listEnvironmentVariablesInputSchema,
  listEnvironmentCookiesInputSchema,
  listEnvironmentsInputSchema,
  updateEnvironmentInputSchema,
  updateEnvironmentCookieInputSchema,
  updateEnvironmentVariableInputSchema,
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
  listVariables: protectedProcedure
    .input(listEnvironmentVariablesInputSchema)
    .output(z.array(environmentVariableSchema))
    .query(({ ctx, input }) =>
      ctx.services.environments.listVariables(input.environmentId, ctx.user.id),
    ),
  createVariable: protectedProcedure
    .input(createEnvironmentVariableInputSchema)
    .output(environmentVariableSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.environments.createVariable(input, ctx.user.id),
    ),
  updateVariable: protectedProcedure
    .input(updateEnvironmentVariableInputSchema)
    .output(environmentVariableSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.environments.updateVariable(input, ctx.user.id),
    ),
  deleteVariable: protectedProcedure
    .input(environmentVariableIdInputSchema)
    .output(z.object({ success: z.literal(true) }))
    .mutation(({ ctx, input }) =>
      ctx.services.environments.deleteVariable(input.id, ctx.user.id),
    ),
  listCookies: protectedProcedure
    .input(listEnvironmentCookiesInputSchema)
    .output(z.array(environmentCookieSchema))
    .query(({ ctx, input }) =>
      ctx.services.environments.listCookies(input.environmentId, ctx.user.id),
    ),
  createCookie: protectedProcedure
    .input(createEnvironmentCookieInputSchema)
    .output(environmentCookieSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.environments.createCookie(input, ctx.user.id),
    ),
  updateCookie: protectedProcedure
    .input(updateEnvironmentCookieInputSchema)
    .output(environmentCookieSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.environments.updateCookie(input, ctx.user.id),
    ),
  deleteCookie: protectedProcedure
    .input(environmentCookieIdInputSchema)
    .output(z.object({ success: z.literal(true) }))
    .mutation(({ ctx, input }) =>
      ctx.services.environments.deleteCookie(input.id, ctx.user.id),
    ),
});
