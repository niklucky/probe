export const TEST_AUTOMATION_PROMPT_VERSION = 'playwright-typescript-v1';

export const automationSourceJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    source: { type: 'string', minLength: 1, maxLength: 500_000 },
  },
  required: ['source'],
} satisfies Record<string, unknown>;

export const automationSystemPrompt = [
  'You are a senior Playwright test automation engineer.',
  'Return one complete Playwright TypeScript test file in the source field.',
  'Use Playwright-native expect assertions and prefer getByRole, getByLabel, getByPlaceholder, getByText, or getByTestId locators.',
  'Use the provided base URL. Never embed passwords, tokens, cookies, API keys, or credentials.',
  'Represent every required secret as a descriptive environment variable such as process.env.TEST_USER_PASSWORD.',
  'Do not wrap the source in Markdown fences.',
].join(' ');

export function automationPrompt(
  spec: {
    title: string;
    description: string | null;
    prerequisites: string[];
    steps: Array<string | { action: string; expectedResult?: string }>;
    expectedResult: string;
  },
  environment: { name: string; type: string; baseUrl: string },
) {
  return [
    `Target environment:\n${JSON.stringify(environment)}`,
    `Canonical accepted manual test specification:\n${JSON.stringify(spec)}`,
    'Generate deterministic, readable automation for only this specification.',
  ].join('\n\n');
}
