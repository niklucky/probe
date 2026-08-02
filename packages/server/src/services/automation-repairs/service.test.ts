import { describe, expect, test } from 'bun:test';
import { ConflictError, NotFoundError } from '@probe/shared/errors/app-error';
import {
  buildRepairEvidence,
  classifyRepairFailure,
  createAutomationRepairService,
  redactRepairText,
} from './service';

const originalSource = `import { test, expect } from '@playwright/test';
test('sign in', async ({ page }) => {
  await page.goto(process.env.BASE_URL!);
  await expect(page.locator('.old-login')).toBeVisible();
});`;

const repairedSource = `import { test, expect } from '@playwright/test';
test('sign in', async ({ page }) => {
  await page.goto(process.env.BASE_URL!);
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});`;

function execution(id = 41, automationSource = originalSource) {
  return {
    id,
    projectId: 3,
    automationId: id === 41 ? 7 : 8,
    environmentId: 9,
    status: 'failed',
    timeoutSeconds: 120,
    settings: { captureVideo: false },
    errorCode: 'PLAYWRIGHT_FAILED',
    errorMessage:
      'locator(".old-login") resolved to no element password=hunter2',
    structuredLogs: [
      {
        at: '2026-08-03T00:00:00.000Z',
        level: 'error',
        message: 'waiting for selector .old-login Bearer top-secret-token',
      },
    ],
    artifacts: [
      {
        id: 5,
        kind: 'trace',
        objectName: 'private/secret-object-name.zip',
        originalName: 'trace.zip',
        mimeType: 'application/zip',
        size: 123,
        expiresAt: new Date(Date.now() + 10_000),
        createdAt: new Date(),
        jobId: id,
      },
    ],
    environment: {
      id: 9,
      name: 'Staging',
      baseUrl: 'https://example.test/login?token=private',
    },
    automation: {
      id: id === 41 ? 7 : 8,
      testCaseId: 11,
      sourceTestCaseVersionId: 12,
      environmentId: 9,
      source: automationSource,
      sourceTestCaseVersion: {
        id: 12,
        title: 'Sign in',
        description: null,
        prerequisites: [],
        steps: ['Open sign in'],
        expectedResult: 'Signed in',
      },
    },
  };
}

function harness(
  options: {
    output?: string;
    totalTokens?: number;
    unauthorized?: boolean;
  } = {},
) {
  let session: any;
  let sessionId = 1;
  let attemptId = 1;
  let candidateId = 20;
  const executions = new Map<number, any>([[41, execution()]]);
  const attemptWrites: any[] = [];
  const queued: any[] = [];
  let authorized = 0;
  const repository = {
    async findExecution(id: number) {
      return executions.get(id);
    },
    async createSession(values: any) {
      session = {
        id: sessionId++,
        ...values,
        usedTokens: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceExecution: executions.get(values.sourceExecutionId),
        sourceAutomation: executions.get(values.sourceExecutionId).automation,
        attempts: [],
      };
      return session;
    },
    async findSession(id: number) {
      return session?.id === id ? session : undefined;
    },
    async list() {
      return session ? [session] : [];
    },
    async listPendingAutomatic() {
      return session?.mode === 'automatic' ? [session] : [];
    },
    async claimGeneration() {
      if (session.status !== 'active') return undefined;
      session.status = 'running';
      return session;
    },
    async createAttempt(
      _sessionId: number,
      candidateValues: any,
      attemptValues: any,
      usedTokens: number,
      status: string,
    ) {
      const candidate = {
        id: candidateId++,
        versionNumber: session.attempts.length + 2,
        ...candidateValues,
      };
      const attempt = {
        id: attemptId++,
        sessionId: session.id,
        attemptNumber: session.attempts.length + 1,
        candidateAutomationId: candidate.id,
        executionJobId: null,
        ...attemptValues,
        candidateAutomation: candidate,
        executionJob: null,
      };
      session.attempts.push(attempt);
      session.usedTokens = usedTokens;
      session.status = status;
      attemptWrites.push(attempt);
      return { candidate, attempt };
    },
    async queueAttempt(_sessionId: number, id: number, values: any) {
      const attempt = session.attempts.find((item: any) => item.id === id);
      const job = {
        id: 100 + id,
        automationId: attempt.candidateAutomationId,
        status: 'queued',
        ...values,
      };
      attempt.status = 'running';
      attempt.executionJobId = job.id;
      attempt.executionJob = job;
      session.status = 'running';
      executions.set(
        job.id,
        execution(job.id, attempt.candidateAutomation.source),
      );
      queued.push(job);
      return job;
    },
    async updateAttemptStatus(id: number, status: string) {
      session.attempts.find((item: any) => item.id === id).status = status;
    },
    async updateSession(_id: number, values: any) {
      Object.assign(session, values);
      return session;
    },
  };
  const service = createAutomationRepairService(
    repository as never,
    {
      async requireProject() {
        if (options.unauthorized) throw new NotFoundError('Resource not found');
        authorized++;
        return { projectId: 3, role: 'qa' };
      },
    } as never,
    {
      async getAdapter() {
        return {
          connectionRef: 'env:test-execution',
          adapter: {
            async generateStructured() {
              return {
                value: {
                  source: options.output ?? repairedSource,
                  explanation:
                    'Replace the stale CSS locator with an accessible role locator.',
                },
                provider: 'openai' as const,
                model: 'repair-model',
                latencyMs: 25,
                usage: {
                  inputTokens: 100,
                  outputTokens: 50,
                  totalTokens: options.totalTokens ?? 150,
                },
              };
            },
          },
        };
      },
    } as never,
    {
      version: '1',
      containerImage: 'runner:1',
      cpuLimit: 1,
      memoryMb: 768,
      processLimit: 128,
      artifactLimitMb: 256,
      networkPolicy: 'controlled-egress',
    },
  );
  return {
    service,
    repository,
    executions,
    attemptWrites,
    queued,
    getSession: () => session,
    getAuthorized: () => authorized,
  };
}

const request = {
  executionId: 41,
  mode: 'review' as const,
  limits: {
    maxAttempts: 2,
    maxTotalTokens: 20_000,
    maxDurationSeconds: 600,
  },
};

describe('bounded automation repair', () => {
  test('classifies failures before AI and refuses non-repairable product failures', async () => {
    expect(
      classifyRepairFailure({
        status: 'failed',
        errorMessage: 'Expected 200 received 500 Internal Server Error',
      }).classification,
    ).toBe('product');
    const state = harness();
    const productFailure = execution();
    productFailure.errorMessage =
      'Expected enabled received disabled assertion';
    productFailure.structuredLogs = [];
    state.executions.set(41, productFailure);
    const result = await state.service.request(request, 4);
    expect(result.status).toBe('stopped');
    expect(result.attempts).toHaveLength(0);
  });

  test('requires execute authorization before creating repair history', async () => {
    const state = harness({ unauthorized: true });
    await expect(state.service.request(request, 99)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(state.getSession()).toBeUndefined();
    expect(state.attemptWrites).toHaveLength(0);
  });

  test('redacts secrets, caps page data, and excludes private artifact object names', () => {
    const evidence = buildRepairEvidence(execution() as never);
    const serialized = JSON.stringify(evidence);
    expect(redactRepairText('apiKey=abcd1234 Bearer token-value')).toBe(
      'apiKey=[REDACTED] Bearer [REDACTED]',
    );
    expect(serialized).not.toContain('hunter2');
    expect(serialized).not.toContain('top-secret-token');
    expect(serialized).not.toContain('secret-object-name');
    expect((evidence.pageStructure as string).length).toBeLessThanOrEqual(
      8_000,
    );
  });

  test('creates an immutable audited candidate and queues it only in automatic mode', async () => {
    const state = harness();
    const result = await state.service.request(
      { ...request, mode: 'automatic' },
      4,
    );
    expect(state.getAuthorized()).toBeGreaterThan(0);
    expect(result.sourceAutomation.source).toBe(originalSource);
    expect(result.attempts[0].candidateAutomation.source).toContain(
      "getByRole('button'",
    );
    expect(result.attempts[0].sourceDiff).toContain('+  await expect');
    expect(state.attemptWrites[0].evidenceSnapshot).toBeDefined();
    expect(state.attemptWrites[0].promptVersion).toBe('playwright-repair-v1');
    expect(state.queued).toHaveLength(1);
    expect(state.queued[0].automationId).toBe(
      result.attempts[0].candidateAutomationId,
    );
  });

  test('stops on token budget exhaustion without executing a candidate', async () => {
    const state = harness({ totalTokens: 500 });
    const result = await state.service.request(
      {
        ...request,
        limits: { ...request.limits, maxTotalTokens: 100 },
      },
      4,
    );
    expect(result.status).toBe('stopped');
    expect(result.stopReason).toBe('Token budget exhausted');
    expect(result.attempts[0]!.status).toBe('rejected');
    expect(state.queued).toHaveLength(0);
  });

  test('stops when the configured attempt count is exhausted', async () => {
    const state = harness();
    const started = await state.service.request(
      {
        ...request,
        limits: { ...request.limits, maxAttempts: 1 },
      },
      4,
    );
    started.status = 'active';
    started.attempts[0]!.status = 'failed';
    await expect(state.service.continue(started.id, 4)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(state.getSession().stopReason).toBe('Attempt budget exhausted');
  });

  test('records and stops a repeated equivalent repair', async () => {
    const state = harness();
    await state.service.request(request, 4);
    const session = state.getSession();
    const first = session.attempts[0];
    first.status = 'failed';
    first.executionJobId = 42;
    first.executionJob = { id: 42, status: 'failed' };
    session.status = 'active';
    state.executions.set(42, execution(42, repairedSource));
    const result = await state.service.continue(session.id, 4);
    expect(result.status).toBe('stopped');
    expect(result.stopReason).toBe('Repeated equivalent change');
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[1].status).toBe('rejected');
  });

  test('marks a successful candidate but leaves promotion explicit', async () => {
    const state = harness();
    const started = await state.service.request(
      { ...request, mode: 'automatic' },
      4,
    );
    started.attempts[0]!.executionJob!.status = 'passed';
    const result = await state.service.get(started.id, 4);
    expect(result.status).toBe('succeeded');
    expect(result.attempts[0]!.status).toBe('passed');
    expect(result.sourceAutomation.source).toBe(originalSource);
    expect(result.attempts[0]!.candidateAutomation.status).toBe('generated');
  });
});
