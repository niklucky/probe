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
    .query(({ ctx, input }) => ctx.services.products.list(input.projectId)),
  get: protectedProcedure
    .input(productIdInputSchema)
    .query(({ ctx, input }) => ctx.services.products.get(input.id)),
  create: protectedProcedure
    .input(createProductInputSchema)
    .mutation(({ ctx, input }) => ctx.services.products.create(input)),
  update: protectedProcedure
    .input(updateProductInputSchema)
    .mutation(({ ctx, input }) => {
      const { id, ...updates } = input;
      return ctx.services.products.update(id, updates);
    }),
  delete: protectedProcedure
    .input(productIdInputSchema)
    .mutation(({ ctx, input }) => ctx.services.products.delete(input.id)),
});
