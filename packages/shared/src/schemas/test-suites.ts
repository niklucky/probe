import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { testSuites } from '@probe/db';
import { z } from 'zod';

const suiteInsertSchema = createInsertSchema(testSuites);

export const testSuiteSchema = createSelectSchema(testSuites).pick({
  id: true,
  productId: true,
  name: true,
  description: true,
  currentVersionId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
});
export const listTestSuitesInputSchema = z.object({
  productId: suiteInsertSchema.shape.productId,
});
export const testSuiteIdInputSchema = z.object({
  id: z.number().int().positive(),
});
export const createTestSuiteInputSchema = suiteInsertSchema.pick({
  productId: true,
  name: true,
  description: true,
});
export const updateTestSuiteInputSchema = suiteInsertSchema
  .pick({ name: true, description: true })
  .partial()
  .extend({ id: z.number().int().positive() });
export const getTestSuiteVersionsInputSchema = z.object({
  suiteId: z.number().int().positive(),
});
