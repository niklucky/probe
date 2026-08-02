import { z } from 'zod';
import { aiConnectionReferenceSchema } from './ai-authoring';

export const automationRepairModeSchema = z.enum(['review', 'automatic']);

export const requestAutomationRepairInputSchema = z.object({
  executionId: z.number().int().positive(),
  mode: automationRepairModeSchema.default('review'),
  connectionId: aiConnectionReferenceSchema.optional(),
  limits: z
    .object({
      maxAttempts: z.number().int().min(1).max(5).default(2),
      maxTotalTokens: z.number().int().min(100).max(200_000).default(20_000),
      maxDurationSeconds: z.number().int().min(30).max(3600).default(600),
    })
    .default({}),
});

export const automationRepairSessionIdInputSchema = z.object({
  id: z.number().int().positive(),
});

export const executeAutomationRepairInputSchema = z.object({
  sessionId: z.number().int().positive(),
  attemptId: z.number().int().positive(),
});

export const listAutomationRepairsInputSchema = z.object({
  executionId: z.number().int().positive(),
});

export type RequestAutomationRepairInput = z.infer<
  typeof requestAutomationRepairInputSchema
>;
