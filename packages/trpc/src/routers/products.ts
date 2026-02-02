import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { db, products, eq, and } from '@signal/db';
import { TRPCError } from '@trpc/server';

export const productsRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const projectProducts = await db.query.products.findMany({
        where: eq(products.projectId, input.projectId),
        orderBy: (products, { asc }) => [asc(products.name)],
      });
      return projectProducts;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const product = await db.query.products.findFirst({
        where: eq(products.id, input.id),
      });

      if (!product) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Product not found',
        });
      }

      return product;
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      name: z.string().min(1),
      type: z.enum(['website', 'mobile_app', 'server', 'api', 'desktop_app', 'other']),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const [product] = await db.insert(products).values({
        projectId: input.projectId,
        name: input.name,
        type: input.type,
        description: input.description || null,
      }).returning();

      return product;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      type: z.enum(['website', 'mobile_app', 'server', 'api', 'desktop_app', 'other']).optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;

      const [product] = await db.update(products)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id))
        .returning();

      if (!product) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Product not found',
        });
      }

      return product;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const [product] = await db.delete(products)
        .where(eq(products.id, input.id))
        .returning();

      if (!product) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Product not found',
        });
      }

      return { success: true };
    }),
});
