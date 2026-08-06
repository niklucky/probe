import { describe, expect, test } from 'bun:test';
import { createBrowserAuthoringService } from './service';

describe('browser authoring service', () => {
  test('queues a durable sanitized session against immutable revisions', async () => {
    const writes: Array<Record<string, unknown>> = [];
    const repository = {
      async findActive() {
        return undefined;
      },
      async create(values: Record<string, unknown>) {
        writes.push(values);
        return {
          id: 1,
          status: 'queued',
          phase: 'starting_browser',
          toolCallCount: 0,
          maxToolCalls: 16,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          latencyMs: null,
          generatedAutomationId: null,
          validationExecutionId: null,
          validationStatus: null,
          failureReason: null,
          cancellationRequestedAt: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...values,
        };
      },
    };
    const service = createBrowserAuthoringService(
      repository as never,
      {
        async findTestCase() {
          return {
            id: 5,
            suite: { productId: 9, product: { projectId: 4 } },
          };
        },
        async findTestCaseVersion() {
          return {
            id: 12,
            testCaseId: 5,
            versionNumber: 3,
            status: 'ready',
            title: 'Sign in',
            description: null,
            prerequisites: [],
            steps: [{ action: 'Fill {{PASSWORD}}' }],
            expectedResult: 'Dashboard opens',
            tags: [],
          };
        },
      } as never,
      { async require() {} } as never,
      {
        async getAdapter() {
          return { connectionRef: '7', adapter: {} };
        },
      } as never,
      {
        async get() {
          return { id: 8, productId: 9, name: 'Staging' };
        },
        async getEnabledProfile() {
          return { id: 6, name: 'QA', revision: 2 };
        },
      } as never,
    );

    const session = await service.start(
      {
        testCaseId: 5,
        sourceTestCaseVersionId: 12,
        environmentId: 8,
        environmentProfileId: 6,
        connectionId: 7,
      },
      2,
    );
    expect(session).toMatchObject({
      status: 'queued',
      environmentProfileRevision: 2,
      sourceVersionNumber: 3,
    });
    expect(writes[0]).toMatchObject({
      projectId: 4,
      sourceTestCaseVersionId: 12,
      connectionRef: '7',
    });
    expect(writes[0]).not.toHaveProperty('environmentVariables');
    expect(writes[0]).not.toHaveProperty('secrets');
  });

  test('gets, lists, and cancels sessions through authorization checks', async () => {
    const authorizationCalls: string[] = [];
    let cancelled = false;
    const session = {
      id: 1,
      projectId: 4,
      testCaseId: 5,
      status: 'exploring',
      environment: { name: 'Staging' },
      sourceTestCaseVersion: { versionNumber: 3 },
    };
    const repository = {
      async find() {
        return { ...session, status: cancelled ? 'cancelled' : session.status };
      },
      async list() {
        return [session];
      },
      async requestCancellation() {
        cancelled = true;
        return { ...session, cancellationRequestedAt: new Date() };
      },
    };
    const service = createBrowserAuthoringService(
      repository as never,
      {} as never,
      {
        async require() {
          authorizationCalls.push('case');
        },
        async requireProject() {
          authorizationCalls.push('project');
        },
      } as never,
      {} as never,
      {} as never,
    );

    expect(await service.get(1, 2)).toMatchObject({
      environmentName: 'Staging',
    });
    expect(await service.list(5, 2)).toHaveLength(1);
    expect(await service.cancel(1, 2)).toMatchObject({ status: 'cancelled' });
    expect(authorizationCalls).toEqual(['project', 'case', 'project']);
  });
});
