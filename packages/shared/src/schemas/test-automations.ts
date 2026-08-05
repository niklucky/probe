import { testAutomations } from '@probe/db';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { aiConnectionReferenceSchema } from './ai-authoring';

export const generateTestAutomationInputSchema = z.object({
  testCaseId: z.number().int().positive(),
  sourceTestCaseVersionId: z.number().int().positive(),
  environmentId: z.number().int().positive(),
  environmentProfileId: z.number().int().positive(),
  connectionId: aiConnectionReferenceSchema.optional(),
});

export const acceptTestAutomationInputSchema = z.object({
  id: z.number().int().positive(),
  source: z.string().trim().min(1).max(500_000),
});

export const testAutomationIdInputSchema = z.object({
  id: z.number().int().positive(),
});

export const listTestAutomationsInputSchema = z.object({
  testCaseId: z.number().int().positive(),
});

export const testAutomationSchema = createSelectSchema(testAutomations)
  .pick({
    id: true,
    testCaseId: true,
    sourceTestCaseVersionId: true,
    environmentId: true,
    environmentProfileId: true,
    environmentProfileName: true,
    environmentProfileRevision: true,
    versionNumber: true,
    framework: true,
    language: true,
    status: true,
    source: true,
    connectionRef: true,
    provider: true,
    model: true,
    promptVersion: true,
    latencyMs: true,
    inputTokens: true,
    outputTokens: true,
    totalTokens: true,
    validationError: true,
    createdById: true,
    acceptedById: true,
    createdAt: true,
    updatedAt: true,
    acceptedAt: true,
  })
  .extend({
    stale: z.boolean(),
    profileStale: z.boolean(),
    environmentName: z.string(),
    sourceVersionNumber: z.number().int().positive(),
  });

export type GenerateTestAutomationInput = z.infer<
  typeof generateTestAutomationInputSchema
>;
