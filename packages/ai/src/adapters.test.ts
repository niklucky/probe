import { describe, expect, test } from 'bun:test';
import { createAiAdapter } from './adapters';

describe('AI provider adapters', () => {
  test('normalizes OpenAI-compatible structured generation', async () => {
    const requests: Array<string | URL | Request> = [];
    const requestBodies: unknown[] = [];
    const adapter = createAiAdapter(
      {
        provider: 'openai-compatible',
        endpoint: 'https://models.example/v1',
        model: 'local-model',
      },
      async (input, init) => {
        requests.push(input);
        requestBodies.push(JSON.parse(String(init?.body)));
        return Response.json({
          model: 'local-model',
          choices: [{ message: { content: '{"answer":42}' } }],
          usage: {
            prompt_tokens: 2,
            completion_tokens: 3,
            total_tokens: 5,
          },
        });
      },
    );

    const result = await adapter.generateStructured<{ answer: number }>({
      prompt: 'answer',
      schema: {
        type: 'object',
        properties: { answer: { type: 'number' } },
        required: ['answer'],
      },
    });

    expect(result.value).toEqual({ answer: 42 });
    expect(result.usage?.totalTokens).toBe(5);
    expect(String(requests[0])).toEndWith('/chat/completions');
    expect(requestBodies[0]).toMatchObject({
      response_format: { type: 'json_object' },
    });
  });

  test('normalizes provider authentication failures without secrets', async () => {
    const adapter = createAiAdapter(
      { provider: 'openai', model: 'gpt-test', apiKey: 'plain-secret-123' },
      async () =>
        Response.json(
          { error: { message: 'invalid plain-secret-123' } },
          { status: 401 },
        ),
    );

    await expect(adapter.testConnection()).rejects.toMatchObject({
      code: 'AUTHENTICATION_FAILED',
    });
    await expect(adapter.testConnection()).rejects.not.toThrow(
      'plain-secret-123',
    );
  });
});
