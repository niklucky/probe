import { z } from 'zod';
import { aiConnectionReferenceSchema } from './ai-authoring';

export const browserAuthoringStatusSchema = z.enum([
  'queued',
  'exploring',
  'generating',
  'validating',
  'completed',
  'failed',
  'cancelled',
  'timed_out',
]);

export const browserAuthoringPhaseSchema = z.enum([
  'starting_browser',
  'inspecting_page',
  'exploring_manual_steps',
  'generating_automation',
  'validating_automation',
  'complete',
  'failed',
]);

export const semanticElementSchema = z.object({
  ref: z.string().max(64),
  tag: z.string().max(40),
  role: z.string().max(80).nullable(),
  name: z.string().max(300).nullable(),
  label: z.string().max(300).nullable(),
  placeholder: z.string().max(300).nullable(),
  inputType: z.string().max(80).nullable(),
  inputName: z.string().max(200).nullable(),
  id: z.string().max(200).nullable(),
  testId: z.string().max(300).nullable(),
  href: z.string().max(2_048).nullable(),
  nearbyText: z.string().max(500).nullable(),
  visible: z.boolean(),
  enabled: z.boolean(),
  selected: z.boolean(),
  checked: z.boolean().nullable(),
});

export const semanticPageSnapshotSchema = z.object({
  url: z.string().url().max(2_048),
  title: z.string().max(500),
  elements: z.array(semanticElementSchema).max(250),
  truncated: z.boolean(),
});

export const browserLocatorSchema = z.object({
  kind: z.enum(['testId', 'role', 'label', 'placeholder', 'text']),
  value: z.string().trim().min(1).max(500),
  name: z.string().trim().max(500).nullable().optional(),
});

export const browserToolCallSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('openPage'), path: z.string().max(2_048) }),
  z.object({ operation: z.literal('inspectPage') }),
  z.object({ operation: z.literal('click'), locator: browserLocatorSchema }),
  z.object({
    operation: z.literal('fill'),
    locator: browserLocatorSchema,
    text: z.string().max(2_000),
  }),
  z.object({
    operation: z.literal('fillFromEnvironment'),
    locator: browserLocatorSchema,
    variableName: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  }),
  z.object({
    operation: z.literal('selectOption'),
    locator: browserLocatorSchema,
    value: z.string().max(1_000),
  }),
  z.object({
    operation: z.literal('press'),
    key: z.string().trim().min(1).max(100),
  }),
  z.object({ operation: z.literal('finishExploration') }),
]);

export const browserToolResultSchema = z.object({
  call: browserToolCallSchema,
  ok: z.boolean(),
  snapshot: semanticPageSnapshotSchema.optional(),
  error: z.string().max(500).optional(),
});

export const browserExplorationDecisionSchema = z.object({
  reasoning: z.string().max(1_000),
  call: browserToolCallSchema,
});

export const startBrowserAuthoringInputSchema = z.object({
  testCaseId: z.number().int().positive(),
  sourceTestCaseVersionId: z.number().int().positive(),
  environmentId: z.number().int().positive(),
  environmentProfileId: z.number().int().positive(),
  connectionId: aiConnectionReferenceSchema.optional(),
});

export const browserAuthoringIdInputSchema = z.object({
  id: z.number().int().positive(),
});

export const listBrowserAuthoringInputSchema = z.object({
  testCaseId: z.number().int().positive(),
});

export const browserAuthoringSessionSchema = z.object({
  id: z.number().int().positive(),
  testCaseId: z.number().int().positive(),
  sourceTestCaseVersionId: z.number().int().positive(),
  sourceVersionNumber: z.number().int().positive(),
  environmentId: z.number().int().positive(),
  environmentName: z.string(),
  environmentProfileId: z.number().int().positive(),
  environmentProfileName: z.string(),
  environmentProfileRevision: z.number().int().positive(),
  status: browserAuthoringStatusSchema,
  phase: browserAuthoringPhaseSchema,
  toolCallCount: z.number().int().nonnegative(),
  maxToolCalls: z.number().int().positive(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  totalTokens: z.number().int().nonnegative().nullable(),
  latencyMs: z.number().int().nonnegative().nullable(),
  generatedAutomationId: z.number().int().positive().nullable(),
  validationExecutionId: z.number().int().positive().nullable(),
  validationStatus: z.string().nullable(),
  failureReason: z.string().nullable(),
  cancellationRequestedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
});

export type BrowserToolCall = z.infer<typeof browserToolCallSchema>;
export type BrowserToolResult = z.infer<typeof browserToolResultSchema>;
export type SemanticPageSnapshot = z.infer<typeof semanticPageSnapshotSchema>;
export type StartBrowserAuthoringInput = z.infer<
  typeof startBrowserAuthoringInputSchema
>;
export type BrowserAuthoringSession = z.infer<
  typeof browserAuthoringSessionSchema
>;
