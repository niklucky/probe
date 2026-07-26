import { z } from 'zod';

export const aiProviders = [
  'openai',
  'anthropic',
  'openai-compatible',
] as const;
export const aiConnectionScopes = [
  'general',
  'test-authoring',
  'test-execution',
] as const;

export const aiProviderSchema = z.enum(aiProviders);
export const aiConnectionScopeSchema = z.enum(aiConnectionScopes);

const headerNameSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/);

export const aiConnectionSecretInputSchema = z.object({
  apiKey: z.string().max(4096).optional(),
  headers: z.record(headerNameSchema, z.string().max(8192)).optional(),
});

const aiConnectionValuesSchema = z.object({
  name: z.string().trim().min(1).max(255),
  provider: aiProviderSchema,
  endpoint: z.string().url().max(2048).nullable().optional(),
  model: z.string().trim().min(1).max(255),
  capabilities: z.array(z.string().trim().min(1).max(100)).max(32).default([]),
  scope: aiConnectionScopeSchema.default('general'),
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  secrets: aiConnectionSecretInputSchema.optional(),
});

export const createAiConnectionInputSchema = aiConnectionValuesSchema;
export const updateAiConnectionInputSchema = aiConnectionValuesSchema
  .partial()
  .extend({ id: z.number().int().positive() });
export const aiConnectionIdInputSchema = z.object({
  id: z.number().int().positive(),
});
export const aiConnectionTestInputSchema = z.object({
  id: z
    .number()
    .int()
    .positive()
    .or(z.string().regex(/^env:\d+$|^env:(openai|anthropic)$/)),
});
export const aiConnectionScopeInputSchema = z.object({
  scope: aiConnectionScopeSchema,
});

export const aiConnectionSchema = z.object({
  id: z.number().int().positive().or(z.string().min(1)),
  source: z.enum(['database', 'environment']),
  name: z.string(),
  provider: aiProviderSchema,
  endpoint: z.string().nullable(),
  model: z.string(),
  capabilities: z.array(z.string()),
  scope: aiConnectionScopeSchema,
  enabled: z.boolean(),
  isDefault: z.boolean(),
  hasCredentials: z.boolean(),
  createdById: z.number().int().positive().nullable(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

export const aiConnectionTestResultSchema = z.object({
  ok: z.literal(true),
  model: z.string(),
  modelAvailable: z.boolean(),
  latencyMs: z.number().nonnegative(),
  capabilities: z.array(z.string()),
});

export type CreateAiConnectionInput = z.infer<
  typeof createAiConnectionInputSchema
>;
export type UpdateAiConnectionInput = z.infer<
  typeof updateAiConnectionInputSchema
>;
export type AiConnectionScope = z.infer<typeof aiConnectionScopeSchema>;
