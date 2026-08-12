import {
  createEnvironmentInputSchema,
  createEnvironmentCookieInputSchema,
  createEnvironmentHeaderInputSchema,
  createEnvironmentVariableInputSchema,
  createEnvironmentProfileInputSchema,
  captureEnvironmentProfileSessionInputSchema,
  environmentIdInputSchema,
  environmentCookieIdInputSchema,
  environmentCookieSchema,
  environmentHeaderIdInputSchema,
  environmentHeaderSchema,
  environmentSchema,
  environmentVariableIdInputSchema,
  environmentVariableSchema,
  environmentProfileIdInputSchema,
  environmentProfileSchema,
  listEnvironmentVariablesInputSchema,
  listEnvironmentCookiesInputSchema,
  listEnvironmentHeadersInputSchema,
  listEnvironmentsInputSchema,
  listEnvironmentProfilesInputSchema,
  updateEnvironmentInputSchema,
  updateEnvironmentCookieInputSchema,
  updateEnvironmentHeaderInputSchema,
  updateEnvironmentVariableInputSchema,
  updateEnvironmentProfileInputSchema,
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
  listProfiles: protectedProcedure
    .input(listEnvironmentProfilesInputSchema)
    .output(z.array(environmentProfileSchema))
    .query(({ ctx, input }) =>
      ctx.services.environments.listProfiles(input.environmentId, ctx.user.id),
    ),
  createProfile: protectedProcedure
    .input(createEnvironmentProfileInputSchema)
    .output(environmentProfileSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.environments.createProfile(input, ctx.user.id),
    ),
  updateProfile: protectedProcedure
    .input(updateEnvironmentProfileInputSchema)
    .output(environmentProfileSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.environments.updateProfile(input, ctx.user.id),
    ),
  captureProfileSession: protectedProcedure
    .input(captureEnvironmentProfileSessionInputSchema)
    .output(environmentProfileSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.environments.captureProfileSession(input, ctx.user.id),
    ),
  deleteProfile: protectedProcedure
    .input(environmentProfileIdInputSchema)
    .output(z.object({ success: z.literal(true) }))
    .mutation(({ ctx, input }) =>
      ctx.services.environments.deleteProfile(input.id, ctx.user.id),
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
  listHeaders: protectedProcedure
    .input(listEnvironmentHeadersInputSchema)
    .output(z.array(environmentHeaderSchema))
    .query(({ ctx, input }) =>
      ctx.services.environments.listHeaders(input.environmentId, ctx.user.id),
    ),
  createHeader: protectedProcedure
    .input(createEnvironmentHeaderInputSchema)
    .output(environmentHeaderSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.environments.createHeader(input, ctx.user.id),
    ),
  updateHeader: protectedProcedure
    .input(updateEnvironmentHeaderInputSchema)
    .output(environmentHeaderSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.environments.updateHeader(input, ctx.user.id),
    ),
  deleteHeader: protectedProcedure
    .input(environmentHeaderIdInputSchema)
    .output(z.object({ success: z.literal(true) }))
    .mutation(({ ctx, input }) =>
      ctx.services.environments.deleteHeader(input.id, ctx.user.id),
    ),
});
