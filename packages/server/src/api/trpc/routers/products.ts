import {
  createProductInputSchema,
  listProductsInputSchema,
  productIdInputSchema,
  updateProductInputSchema,
} from '@probe/shared/schemas/products';
import { protectedProcedure, router } from '../../../trpc';

export const productsRouter = router({
  list: protectedProcedure
    .input(listProductsInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.products.list(input.projectId, ctx.user.id),
    ),
  get: protectedProcedure
    .input(productIdInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.products.get(input.id, ctx.user.id),
    ),
  create: protectedProcedure
    .input(createProductInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.products.create(input, ctx.user.id),
    ),
  update: protectedProcedure
    .input(updateProductInputSchema)
    .mutation(({ ctx, input }) => {
      const { id, ...updates } = input;
      return ctx.services.products.update(id, updates, ctx.user.id);
    }),
  delete: protectedProcedure
    .input(productIdInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.products.delete(input.id, ctx.user.id),
    ),
});
