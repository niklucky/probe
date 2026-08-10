import { describe, expect, test } from 'bun:test';
import { automationPrompt } from './prompts';

describe('Playwright automation prompts', () => {
  test('uses synthetic inline invalid login data for an anonymous profile', () => {
    const prompt = automationPrompt(
      {
        title: 'Reject invalid login',
        description: null,
        prerequisites: [],
        steps: [{ action: 'Enter deliberately invalid credentials' }],
        expectedResult: 'Login is rejected',
      },
      {
        name: 'Development',
        type: 'development',
        baseUrl: 'https://example.test',
      },
      { name: 'Anonymous', isAnonymous: true },
      [],
    );

    expect(prompt).toContain("'invalid-user'");
    expect(prompt).toContain("'definitely-wrong-value'");
    expect(prompt).toContain('Do not create INVALID_USERNAME');
  });
});
