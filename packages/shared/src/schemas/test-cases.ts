import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { testCases, testCaseVersions } from '@probe/db';
import { z } from 'zod';

const testCaseInsertSchema = createInsertSchema(testCases);
const testCaseVersionInsertSchema = createInsertSchema(testCaseVersions);

export const testStepSchema = z.object({
  action: z.string().trim().min(1).max(5_000),
  expectedResult: z.string().trim().max(5_000).optional(),
});

// Read old string[] rows as structured steps. New writes must use the canonical
// shape, which keeps manual execution and future automation on one contract.
export const storedTestStepsSchema = z
  .array(z.union([z.string(), testStepSchema]))
  .transform((steps) =>
    steps.map((step) => (typeof step === 'string' ? { action: step } : step)),
  );

export const testSpecSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(20_000).optional(),
  prerequisites: z.array(z.string().trim().min(1).max(5_000)).default([]),
  steps: z.array(testStepSchema).min(1),
  expectedResult: z.string().trim().min(1).max(20_000),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  tags: z.array(z.string().trim().min(1).max(100)).default([]),
});

export const testCaseSchema = createSelectSchema(testCases).pick({
  id: true,
  suiteId: true,
  currentVersionId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
});

export const testCaseVersionSchema = createSelectSchema(testCaseVersions)
  .pick({
    id: true,
    testCaseId: true,
    suiteVersionId: true,
    versionNumber: true,
    title: true,
    description: true,
    prerequisites: true,
    steps: true,
    expectedResult: true,
    priority: true,
    status: true,
    tags: true,
    createdById: true,
    createdAt: true,
  })
  .extend({
    prerequisites: z.array(z.string()),
    steps: storedTestStepsSchema,
    tags: z.array(z.string()),
  });

export const testCaseListItemSchema = testCaseSchema.extend({
  versions: z.array(testCaseVersionSchema),
  currentVersion: testCaseVersionSchema.optional(),
});

export const testCaseDetailSchema = testCaseSchema.extend({
  versions: z.array(testCaseVersionSchema),
  currentVersion: testCaseVersionSchema.optional(),
});

export const createdTestCaseSchema = testCaseSchema.extend({
  currentVersion: testCaseVersionSchema,
});

export const updatedTestCaseSchema = testCaseSchema.extend({
  newVersion: testCaseVersionSchema,
});

export const productTestCasesSchema = z.object({
  suiteId: z.number().int().positive(),
  suiteName: z.string(),
  testCases: z.array(testCaseListItemSchema),
});

export const listTestCasesInputSchema = z.object({
  suiteId: testCaseInsertSchema.shape.suiteId,
  versionId: testCaseVersionInsertSchema.shape.suiteVersionId.optional(),
});

export const listTestCasesByProductInputSchema = z.object({
  productId: z.number().int().positive(),
});

export const createTestCaseInputSchema = testSpecSchema.extend({
  suiteId: testCaseInsertSchema.shape.suiteId,
  status: z.enum(['draft', 'ready', 'deprecated']).default('draft'),
});

export const getTestCaseInputSchema = z.object({
  id: z.number().int().positive(),
  versionId: z.number().int().positive().optional(),
});

export const updateTestCaseInputSchema = testSpecSchema
  .extend({ status: z.enum(['draft', 'ready', 'deprecated']) })
  .partial()
  .extend({
    id: z.number().int().positive(),
  });

export const getTestCaseVersionsInputSchema = z.object({
  testCaseId: testCaseVersionInsertSchema.shape.testCaseId,
});

export const deleteTestCaseInputSchema = z.object({
  id: z.number().int().positive(),
});

export type TestStep = z.infer<typeof testStepSchema>;
export type TestSpec = z.infer<typeof testSpecSchema>;
export type CreateTestCaseInput = z.infer<typeof createTestCaseInputSchema>;
export type UpdateTestCaseInput = z.infer<typeof updateTestCaseInputSchema>;
