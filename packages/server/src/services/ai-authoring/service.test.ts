import { describe, expect, test } from 'bun:test';
import { AppError } from '@probe/shared/errors/app-error';
import { createAiAuthoringService, sanitizeAuthoringText } from './service';

const validSpec = {
  title: 'Reset password',
  description: 'A user resets their password',
  prerequisites: ['A registered user'],
  steps: [
    {
      action: 'Request a password reset',
      expectedResult: 'A reset link is sent',
    },
  ],
  expectedResult: 'The new password can be used to sign in',
  priority: 'high' as const,
  tags: ['auth'],
};

function providerResult(value: unknown) {
  return {
    value,
    provider: 'openai-compatible' as const,
    model: 'local-model',
    latencyMs: 12,
    usage: {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    },
  };
}

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: 41,
    operation: 'generate' as const,
    status: 'completed' as const,
    suiteId: 7,
    testCaseId: null,
    connectionRef: 'env:local',
    provider: 'openai-compatible' as const,
    model: 'local-model',
    promptVersion: 'test-case-authoring-v1',
    inputSnapshot: {},
    outputSnapshot: validSpec,
    latencyMs: 12,
    inputTokens: 10,
    outputTokens: 20,
    totalTokens: 30,
    errorCode: null,
    errorMessage: null,
    createdById: 2,
    acceptedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    acceptedAt: null,
    ...overrides,
  };
}

describe('AI test-case authoring', () => {
  test('validates and repairs structured output at most once', async () => {
    const outputs = [{ title: '' }, validSpec];
    const calls: unknown[] = [];
    const completed: unknown[] = [];
    const service = createAiAuthoringService(
      {
        async create() {
          return job({ status: 'running' });
        },
        async complete(_id: number, values: unknown) {
          completed.push(values);
          return job(values as Record<string, unknown>);
        },
      } as never,
      { async require() {} } as never,
      {
        async getAdapter() {
          return {
            connectionRef: 'env:local',
            adapter: {
              async generateStructured(request: unknown) {
                calls.push(request);
                return providerResult(outputs.shift());
              },
            },
          };
        },
      } as never,
      {} as never,
      {} as never,
    );

    const result = await service.request(
      {
        operation: 'generate',
        suiteId: 7,
        description: 'Reset a password',
      },
      2,
    );

    expect(calls).toHaveLength(2);
    expect(
      calls.every(
        (request) =>
          !Object.prototype.hasOwnProperty.call(request, 'temperature'),
      ),
    ).toBe(true);
    expect(result.proposal).toEqual(validSpec);
    expect(completed).toHaveLength(1);
  });

  test('rejects output after the single repair attempt', async () => {
    let calls = 0;
    const failures: Array<[string, string]> = [];
    const service = createAiAuthoringService(
      {
        async create() {
          return job({ status: 'running' });
        },
        async fail(_id: number, code: string, message: string) {
          failures.push([code, message]);
          return job({ status: 'failed' });
        },
      } as never,
      { async require() {} } as never,
      {
        async getAdapter() {
          return {
            connectionRef: 'env:local',
            adapter: {
              async generateStructured() {
                calls += 1;
                return providerResult({ title: '' });
              },
            },
          };
        },
      } as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.request(
        {
          operation: 'generate',
          suiteId: 7,
          description: 'Reset a password',
        },
        2,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(calls).toBe(2);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.[0]).toBe('INVALID_RESPONSE');
  });

  test('accepts a validated proposal through normal versioning as the actor', async () => {
    const createCalls: unknown[][] = [];
    const acceptedBy: number[] = [];
    const service = createAiAuthoringService(
      {
        async find() {
          return job();
        },
        async accept(_id: number, userId: number) {
          acceptedBy.push(userId);
          return job({ status: 'accepted', acceptedById: userId });
        },
      } as never,
      { async require() {} } as never,
      {} as never,
      {
        async create(input: unknown, userId: number) {
          createCalls.push([input, userId]);
          return { id: 55, currentVersion: { id: 89 } };
        },
      } as never,
      {} as never,
    );

    const result = await service.accept(41, validSpec, 9);

    expect(result).toEqual({ jobId: 41, testCaseId: 55, versionId: 89 });
    expect(createCalls[0]?.[1]).toBe(9);
    expect(acceptedBy).toEqual([9]);
  });

  test('checks author authorization before accepting', async () => {
    let createCalls = 0;
    const service = createAiAuthoringService(
      {
        async find() {
          return job();
        },
      } as never,
      {
        async require() {
          throw new AppError('NOT_FOUND', 'Resource not found');
        },
      } as never,
      {} as never,
      {
        async create() {
          createCalls += 1;
        },
      } as never,
      {} as never,
    );

    await expect(service.accept(41, validSpec, 3)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(createCalls).toBe(0);
  });

  test('discard only changes proposal state', async () => {
    let discarded = 0;
    let versionWrites = 0;
    const service = createAiAuthoringService(
      {
        async find() {
          return job();
        },
        async discard() {
          discarded += 1;
          return job({ status: 'discarded' });
        },
      } as never,
      { async require() {} } as never,
      {} as never,
      {
        async create() {
          versionWrites += 1;
        },
        async update() {
          versionWrites += 1;
        },
      } as never,
      {} as never,
    );

    expect(await service.discard(41, 2)).toEqual({ success: true });
    expect(discarded).toBe(1);
    expect(versionWrites).toBe(0);
  });

  test('redacts likely credentials before prompts and snapshots', () => {
    const fakeApiKey = ['sk', 'redaction', 'fixture'].join('-');
    const sanitized = sanitizeAuthoringText(
      `authorization: Bearer abcdefghijkl api_key=${fakeApiKey}`,
    );
    expect(sanitized).not.toContain('abcdefghijkl');
    expect(sanitized).not.toContain(fakeApiKey);
    expect(sanitized).toContain('[REDACTED]');
  });
});
