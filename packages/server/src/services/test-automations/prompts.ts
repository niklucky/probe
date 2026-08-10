export const TEST_AUTOMATION_PROMPT_VERSION = 'playwright-typescript-v3';

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
  'For every manual-test placeholder, use exactly the supplied deterministic process.env reference. Never copy a variable value into source.',
  'Never invent process.env references. Obvious synthetic inputs for an explicitly negative authentication test are not real credentials and may be embedded only when the prompt says the anonymous profile has no variable mappings.',
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
  profile: { name: string; isAnonymous: boolean },
  variables: Array<{
    key: string;
    description: string | null;
    isSecret: boolean;
  }>,
) {
  return [
    `Target environment:\n${JSON.stringify({ name: environment.name, type: environment.type, baseUrl: environment.baseUrl })}`,
    `Selected browser profile:\n${JSON.stringify({ name: profile.name, anonymous: profile.isAnonymous })}`,
    `Referenced environment variable metadata (values are intentionally omitted):\n${JSON.stringify(variables)}`,
    `Required placeholder mappings:\n${variables
      .map(({ key }) => `{{${key}}} => process.env.${key}`)
      .join('\n')}`,
    profile.isAnonymous && variables.length === 0
      ? "Anonymous profile guidance: no credential values or environment mappings are available or required. If this specification explicitly tests invalid authentication, fill inline with the synthetic literals 'invalid-user' and 'definitely-wrong-value'. Do not create INVALID_USERNAME, INVALID_PASSWORD, or any other process.env reference, and do not assign these literals to credential-named constants."
      : 'Use only the environment-variable mappings listed above.',
    `Canonical accepted manual test specification:\n${JSON.stringify(spec)}`,
    'Generate deterministic, readable automation for only this specification.',
  ].join('\n\n');
}
