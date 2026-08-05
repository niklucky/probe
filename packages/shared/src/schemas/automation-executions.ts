import { z } from 'zod';

export const automationExecutionStatusSchema = z.enum([
  'queued',
  'claimed',
  'running',
  'passed',
  'failed',
  'timed_out',
  'cancelled',
  'infrastructure_error',
]);

export const queueAutomationExecutionInputSchema = z.object({
  automationId: z.number().int().positive(),
  environmentProfileId: z.number().int().positive(),
  timeoutSeconds: z.number().int().min(10).max(1800).default(300),
  captureVideo: z.boolean().default(false),
  applyEnvironmentCookies: z.boolean().default(true),
  applyEnvironmentHeaders: z.boolean().default(true),
});

export const listAutomationExecutionsInputSchema = z.object({
  automationId: z.number().int().positive(),
});

export const automationExecutionIdInputSchema = z.object({
  id: z.number().int().positive(),
});

export const automationExecutionArtifactInputSchema = z.object({
  jobId: z.number().int().positive(),
  artifactId: z.number().int().positive(),
});

export type QueueAutomationExecutionInput = z.infer<
  typeof queueAutomationExecutionInputSchema
>;
