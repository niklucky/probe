import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { environmentVariables, environments } from '@probe/db';
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

export const environmentVariableKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(
    /^[A-Za-z_][A-Za-z0-9_]*$/,
    'Variable key must start with a letter or underscore and contain only letters, numbers, and underscores',
  );

const environmentVariableValueSchema = z.string().max(50_000);

export const environmentVariableSchema = createSelectSchema(
  environmentVariables,
)
  .pick({
    id: true,
    environmentId: true,
    key: true,
    isSecret: true,
    description: true,
    createdById: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    value: z.string().nullable(),
    valueStatus: z.enum(['available', 'secret', 'unreadable']),
  });

export const listEnvironmentVariablesInputSchema = z.object({
  environmentId: z.number().int().positive(),
});

export const createEnvironmentVariableInputSchema = z.object({
  environmentId: z.number().int().positive(),
  key: environmentVariableKeySchema,
  value: environmentVariableValueSchema,
  isSecret: z.boolean().default(false),
  description: z.string().trim().max(500).optional(),
});

export const updateEnvironmentVariableInputSchema = z.object({
  id: z.number().int().positive(),
  key: environmentVariableKeySchema.optional(),
  value: environmentVariableValueSchema.optional(),
  isSecret: z.boolean().optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

export const environmentVariableIdInputSchema = z.object({
  id: z.number().int().positive(),
});

const placeholderPattern = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

export function extractEnvironmentVariableReferences(value: string) {
  return [
    ...new Set(
      [...value.matchAll(placeholderPattern)].map((match) => match[1]!),
    ),
  ];
}

export type CreateEnvironmentInput = z.infer<
  typeof createEnvironmentInputSchema
>;
export type UpdateEnvironmentInput = z.infer<
  typeof updateEnvironmentInputSchema
>;
export type CreateEnvironmentVariableInput = z.infer<
  typeof createEnvironmentVariableInputSchema
>;
export type UpdateEnvironmentVariableInput = z.infer<
  typeof updateEnvironmentVariableInputSchema
>;
