import type { TestSpec } from '@probe/shared/schemas/test-cases';

export const TEST_CASE_PROMPT_VERSION = 'test-case-authoring-v1';

export const testSpecJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 500 },
    description: { type: 'string', maxLength: 20_000 },
    prerequisites: {
      type: 'array',
      items: { type: 'string', minLength: 1, maxLength: 5_000 },
    },
    steps: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string', minLength: 1, maxLength: 5_000 },
          expectedResult: { type: 'string', maxLength: 5_000 },
        },
        required: ['action'],
      },
    },
    expectedResult: { type: 'string', minLength: 1, maxLength: 20_000 },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'critical'],
    },
    tags: {
      type: 'array',
      items: { type: 'string', minLength: 1, maxLength: 100 },
    },
  },
  required: [
    'title',
    'description',
    'prerequisites',
    'steps',
    'expectedResult',
    'priority',
    'tags',
  ],
} satisfies Record<string, unknown>;

export const authoringSystemPrompt =
  'You are a senior QA test designer. Return only the requested structured test specification. Never add credentials, access tokens, passwords, cookies, or authorization headers; replace any such value with a neutral placeholder.';

export function generationPrompt(
  description: string,
  environment?: { name: string; type: string; baseUrl: string },
) {
  return [
    `Create a complete, precise manual test case from this description:\n\n${description}`,
    environment
      ? `Target environment (use as context; do not invent credentials):\n${JSON.stringify(
          environment,
        )}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function improvementPrompt(
  spec: TestSpec,
  instruction?: string,
  environment?: { name: string; type: string; baseUrl: string },
) {
  return [
    'Improve the following test case while preserving its intent.',
    instruction ? `User instruction:\n${instruction}` : '',
    environment
      ? `Target environment (use as context; do not invent credentials):\n${JSON.stringify(
          environment,
        )}`
      : '',
    `Current test case:\n${JSON.stringify(spec)}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function repairPrompt(invalidOutput: unknown, issues: string[]) {
  return [
    'Repair the previous response so it matches the required test specification schema.',
    `Validation issues:\n${issues.join('\n')}`,
    `Previous response:\n${
      typeof invalidOutput === 'string'
        ? invalidOutput
        : JSON.stringify(invalidOutput)
    }`,
    'Return only the corrected structured object.',
  ].join('\n\n');
}
