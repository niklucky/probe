export const AUTOMATION_REPAIR_PROMPT_VERSION = 'playwright-repair-v1';

export const automationRepairJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    source: { type: 'string', minLength: 1, maxLength: 500_000 },
    explanation: { type: 'string', minLength: 1, maxLength: 4_000 },
  },
  required: ['source', 'explanation'],
} satisfies Record<string, unknown>;

export const automationRepairSystemPrompt = [
  'You repair Playwright TypeScript automation using only the supplied sanitized evidence.',
  'Return a complete candidate test file and a concise explanation of the bounded automation-only change.',
  'Do not weaken assertions, remove required test behavior, add arbitrary waits, or change the application or manual specification.',
  'Never include credentials, cookies, tokens, page dumps, or Markdown fences.',
  'A passing repaired test shows only that this automation ran successfully; it does not prove the application is correct.',
].join(' ');

export function automationRepairPrompt(evidence: Record<string, unknown>) {
  return [
    `Sanitized repair evidence:\n${JSON.stringify(evidence)}`,
    'Propose the smallest deterministic repair for the classified automation failure.',
  ].join('\n\n');
}
