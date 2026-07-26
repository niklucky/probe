import { aiAuthoringJobs } from '@probe/db';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { testSpecSchema } from './test-cases';

export const aiConnectionReferenceSchema = z
  .number()
  .int()
  .positive()
  .or(z.string().regex(/^env:[a-z0-9-]+$/));

export const requestAiTestCaseProposalInputSchema = z
  .object({
    operation: z.enum(['generate', 'improve']),
    suiteId: z.number().int().positive(),
    testCaseId: z.number().int().positive().optional(),
    description: z.string().trim().max(20_000).optional(),
    instruction: z.string().trim().max(10_000).optional(),
    environmentId: z.number().int().positive().optional(),
    connectionId: aiConnectionReferenceSchema.optional(),
  })
  .superRefine((input, context) => {
    if (input.operation === 'generate' && !input.description) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['description'],
        message: 'Describe what should be tested',
      });
    }
    if (input.operation === 'improve' && !input.testCaseId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['testCaseId'],
        message: 'Choose a test case to improve',
      });
    }
  });

export const acceptAiTestCaseProposalInputSchema = z.object({
  jobId: z.number().int().positive(),
  proposal: testSpecSchema,
});

export const discardAiTestCaseProposalInputSchema = z.object({
  jobId: z.number().int().positive(),
});

const aiAuthoringJobSelectSchema = createSelectSchema(aiAuthoringJobs);

export const aiTestCaseProposalSchema = aiAuthoringJobSelectSchema
  .pick({
    id: true,
    operation: true,
    status: true,
    suiteId: true,
    testCaseId: true,
    connectionRef: true,
    provider: true,
    model: true,
    promptVersion: true,
    latencyMs: true,
    inputTokens: true,
    outputTokens: true,
    totalTokens: true,
    createdAt: true,
  })
  .extend({
    proposal: testSpecSchema,
  });

export const acceptedAiTestCaseProposalSchema = z.object({
  jobId: z.number().int().positive(),
  testCaseId: z.number().int().positive(),
  versionId: z.number().int().positive(),
});

export type RequestAiTestCaseProposalInput = z.infer<
  typeof requestAiTestCaseProposalInputSchema
>;
export type AiConnectionReference = z.infer<typeof aiConnectionReferenceSchema>;
