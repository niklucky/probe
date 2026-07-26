import {
  createProjectInputSchema,
  projectIdInputSchema,
  updateProjectInputSchema,
} from '@probe/shared/schemas/projects';
import { protectedProcedure, router } from '../../../trpc';

export const projectsRouter = router({
  list: protectedProcedure.query(({ ctx }) => ctx.services.projects.list(ctx.user.id)),

  create: protectedProcedure
    .input(createProjectInputSchema)
    .mutation(({ ctx, input }) => ctx.services.projects.create(input, ctx.user.id)),

  get: protectedProcedure
    .input(projectIdInputSchema)
    .query(({ ctx, input }) => ctx.services.projects.get(input.id, ctx.user.id)),

  update: protectedProcedure
    .input(updateProjectInputSchema)
    .mutation(({ ctx, input }) => ctx.services.projects.update(input, ctx.user.id)),

  delete: protectedProcedure
    .input(projectIdInputSchema)
    .mutation(({ ctx, input }) => ctx.services.projects.delete(input.id, ctx.user.id)),
});
