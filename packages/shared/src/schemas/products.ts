import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { products } from '@probe/db';
import { z } from 'zod';

const productInsertSchema = createInsertSchema(products);

export const productSchema = createSelectSchema(products).pick({
  id: true,
  projectId: true,
  name: true,
  type: true,
  description: true,
  createdAt: true,
  updatedAt: true,
});
export const listProductsInputSchema = z.object({
  projectId: productInsertSchema.shape.projectId,
});
export const productIdInputSchema = z.object({ id: z.number().int().positive() });
export const createProductInputSchema = productInsertSchema.pick({
  projectId: true,
  name: true,
  type: true,
  description: true,
});
export const updateProductInputSchema = productInsertSchema
  .pick({ name: true, type: true, description: true })
  .partial()
  .extend({ id: z.number().int().positive() });
