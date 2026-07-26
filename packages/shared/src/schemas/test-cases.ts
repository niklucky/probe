import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { testCases, testCaseVersions } from '@probe/db';
import { z } from 'zod';

const testCaseInsertSchema = createInsertSchema(testCases);
const testCaseVersionInsertSchema = createInsertSchema(testCaseVersions);

export const testCaseSchema = createSelectSchema(testCases).pick({
  id: true,
  suiteId: true,
  currentVersionId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
});

export const testCaseVersionSchema = createSelectSchema(testCaseVersions).pick({
  id: true,
  testCaseId: true,
  suiteVersionId: true,
  versionNumber: true,
  title: true,
  description: true,
  steps: true,
  expectedResult: true,
  priority: true,
  status: true,
  tags: true,
  createdById: true,
  createdAt: true,
}).extend({
  steps: z.array(z.string()),
  tags: z.array(z.string()),
});

export const listTestCasesInputSchema = z.object({
  suiteId: testCaseInsertSchema.shape.suiteId,
  versionId: testCaseVersionInsertSchema.shape.suiteVersionId.optional(),
});

export const listTestCasesByProductInputSchema = z.object({
  productId: z.number().int(),
});

export const createTestCaseInputSchema = testCaseVersionInsertSchema
  .pick({
    title: true,
    description: true,
    steps: true,
    expectedResult: true,
    priority: true,
    tags: true,
  })
  .extend({
    suiteId: testCaseInsertSchema.shape.suiteId,
    steps: z.array(z.string()),
    priority: testCaseVersionInsertSchema.shape.priority.default('medium'),
    tags: z.array(z.string()).default([]),
  });

export const getTestCaseInputSchema = z.object({
  id: z.number().int().positive(),
  versionId: z.number().int().positive().optional(),
});

export const updateTestCaseInputSchema = testCaseVersionInsertSchema
  .pick({
    title: true,
    description: true,
    steps: true,
    expectedResult: true,
    priority: true,
    status: true,
    tags: true,
  })
  .partial()
  .extend({
    id: z.number().int().positive(),
    steps: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  });

export const getTestCaseVersionsInputSchema = z.object({
  testCaseId: testCaseVersionInsertSchema.shape.testCaseId,
});

export const deleteTestCaseInputSchema = z.object({
  id: z.number().int().positive(),
});

export type CreateTestCaseInput = z.infer<typeof createTestCaseInputSchema>;
export type UpdateTestCaseInput = z.infer<typeof updateTestCaseInputSchema>;
