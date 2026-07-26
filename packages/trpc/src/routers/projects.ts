import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { db, projects, eq, and } from '@probe/db';
import { TRPCError } from '@trpc/server';

export const projectsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userProjects = await db.query.projects.findMany({
      where: eq(projects.createdById, ctx.user.id),
      orderBy: (projects, { desc }) => [desc(projects.updatedAt)],
    });
    return userProjects;
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      website: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [project] = await db.insert(projects).values({
        name: input.name,
        description: input.description || null,
        website: input.website || null,
        createdById: ctx.user.id,
        logoUrl: null,
      }).returning();

      return project;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await db.query.projects.findFirst({
        where: and(
          eq(projects.id, input.id),
          eq(projects.createdById, ctx.user.id)
        ),
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      return project;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      website: z.string().optional(),
      logoUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      // Check ownership
      const existing = await db.query.projects.findFirst({
        where: and(
          eq(projects.id, id),
          eq(projects.createdById, ctx.user.id)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      const [project] = await db.update(projects)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id))
        .returning();

      return project;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Check ownership
      const existing = await db.query.projects.findFirst({
        where: and(
          eq(projects.id, input.id),
          eq(projects.createdById, ctx.user.id)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      await db.delete(projects).where(eq(projects.id, input.id));

      return { success: true };
    }),
});
