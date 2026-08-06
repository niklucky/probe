import { describe, expect, test } from 'bun:test';
import { runBoundedToolLoop } from './tool-loop';

describe('bounded AI browser tool loop', () => {
  test('enforces the tool-call limit and aggregates usage', async () => {
    let calls = 0;
    const result = await runBoundedToolLoop(
      async <T>() => ({
        value: { operation: 'inspectPage' } as T,
        model: 'test-model',
        provider: 'openai-compatible' as const,
        usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
        latencyMs: 1,
      }),
      {
        prompt: 'explore',
        decisionSchema: {},
        maxToolCalls: 2,
        maxDurationMs: 10_000,
        maxTotalTokens: 100,
        parseCall: (value) => value as { operation: string },
        isFinished: () => false,
        async execute() {
          calls += 1;
          return { safe: true };
        },
      },
    );
    expect(result.finished).toBe(false);
    expect(result.turns).toHaveLength(2);
    expect(result.usage.totalTokens).toBe(6);
    expect(calls).toBe(2);
  });

  test('honors cancellation before provider or browser work', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runBoundedToolLoop(
        async () => {
          throw new Error('provider should not be called');
        },
        {
          prompt: 'explore',
          decisionSchema: {},
          maxToolCalls: 2,
          maxDurationMs: 10_000,
          maxTotalTokens: 100,
          signal: controller.signal,
          parseCall: (value) => value,
          isFinished: () => false,
          async execute() {},
        },
      ),
    ).rejects.toThrow('cancelled');
  });

  test('stops before browser work when the token budget is exceeded', async () => {
    let executed = false;
    await expect(
      runBoundedToolLoop(
        async <T>() => ({
          value: { operation: 'inspectPage' } as T,
          model: 'test-model',
          provider: 'openai' as const,
          usage: { inputTokens: 9, outputTokens: 2, totalTokens: 11 },
          latencyMs: 1,
        }),
        {
          prompt: 'explore',
          decisionSchema: {},
          maxToolCalls: 2,
          maxDurationMs: 10_000,
          maxTotalTokens: 10,
          parseCall: (value) => value,
          isFinished: () => false,
          async execute() {
            executed = true;
          },
        },
      ),
    ).rejects.toThrow('token budget');
    expect(executed).toBe(false);
  });
});
