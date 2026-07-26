import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { environments } from '@probe/db';
import { z } from 'zod';

const environmentInsertSchema = createInsertSchema(environments);

const baseUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2_048)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  }, 'Base URL must use HTTP or HTTPS')
  .refine((value) => {
    const url = new URL(value);
    return !url.username && !url.password;
  }, 'Base URL must not contain credentials');

export const environmentSchema = createSelectSchema(environments).pick({
  id: true,
  projectId: true,
  productId: true,
  name: true,
  type: true,
  baseUrl: true,
  isDefault: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
});

export const listEnvironmentsInputSchema = z.object({
  projectId: z.number().int().positive(),
  productId: z.number().int().positive().optional(),
});

export const createEnvironmentInputSchema = environmentInsertSchema
  .pick({
    projectId: true,
    productId: true,
    name: true,
    type: true,
    isDefault: true,
  })
  .extend({
    name: z.string().trim().min(1).max(255),
    baseUrl: baseUrlSchema,
    productId: z.number().int().positive().optional(),
    isDefault: z.boolean().default(false),
  });

export const updateEnvironmentInputSchema = createEnvironmentInputSchema
  .omit({ projectId: true })
  .partial()
  .extend({ id: z.number().int().positive() });

export const environmentIdInputSchema = z.object({
  id: z.number().int().positive(),
});

export type CreateEnvironmentInput = z.infer<
  typeof createEnvironmentInputSchema
>;
export type UpdateEnvironmentInput = z.infer<
  typeof updateEnvironmentInputSchema
>;
