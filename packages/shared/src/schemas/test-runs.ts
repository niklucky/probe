import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { testResults, testRuns } from '@probe/db';
import { z } from 'zod';

const testRunInsertSchema = createInsertSchema(testRuns);
const testResultInsertSchema = createInsertSchema(testResults);

export const testRunSchema = createSelectSchema(testRuns).pick({
  id: true,
  projectId: true,
  name: true,
  description: true,
  executedById: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
});

export const listTestRunsInputSchema = z.object({
  projectId: testRunInsertSchema.shape.projectId,
});

export const testRunIdInputSchema = z.object({
  id: z.number().int().positive(),
});

export const createTestRunInputSchema = testRunInsertSchema
  .pick({ projectId: true, name: true, description: true })
  .partial({ name: true, description: true })
  .extend({ testCaseVersionIds: z.array(z.number().int().positive()) });

export const updateTestResultInputSchema = z.object({
  runId: testResultInsertSchema.shape.runId,
  testCaseVersionId: testResultInsertSchema.shape.testCaseVersionId,
  status: z.enum(['passed', 'failed', 'skipped', 'blocked']),
  notes: z.string().optional(),
});

export const getTestResultInputSchema = z.object({
  runId: testResultInsertSchema.shape.runId,
  testCaseVersionId: testResultInsertSchema.shape.testCaseVersionId,
});

export type CreateTestRunInput = z.infer<typeof createTestRunInputSchema>;
export type UpdateTestResultInput = z.infer<typeof updateTestResultInputSchema>;
