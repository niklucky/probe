import { describe, expect, test } from 'bun:test';
import { createAutomationExecutionService } from './service';

const automation = {
  id: 7,
  status: 'accepted' as const,
  environmentId: 9,
  environmentProfileId: 5,
  environmentProfileRevision: 2,
  source: 'console.log(process.env.username)',
  testCase: {
    suite: {
      product: { projectId: 3 },
    },
  },
};

const defaults = {
  version: 'runner-1',
  containerImage: 'probe-playwright-runner:1',
  cpuLimit: 1,
  memoryMb: 768,
  processLimit: 128,
  artifactLimitMb: 256,
  networkPolicy: 'probe-runner-egress',
};

describe('automation execution API service', () => {
  test('queues an immutable accepted automation snapshot without source or secrets', async () => {
    const writes: Array<Record<string, unknown>> = [];
    const service = createAutomationExecutionService(
      {
        async findAutomation() {
          return automation;
        },
        async create(values: Record<string, unknown>) {
          writes.push(values);
          return { id: 1, ...values };
        },
      } as never,
      {
        async requireProject() {
          return { projectId: 3, role: 'qa' };
        },
      } as never,
      {
        async getEnabledProfile() {
          return {
            id: 5,
            environmentId: 9,
            name: 'Authenticated User',
            revision: 2,
          };
        },
        async listProfileVariableMetadata() {
          return [{ key: 'username' }];
        },
      } as never,
      {} as never,
      'private-artifacts',
      defaults,
    );

    await service.queue(
      {
        automationId: 7,
        environmentProfileId: 5,
        timeoutSeconds: 120,
        captureVideo: true,
        applyEnvironmentCookies: false,
        applyEnvironmentHeaders: false,
      },
      4,
    );

    expect(writes[0]).toMatchObject({
      projectId: 3,
      automationId: 7,
      environmentId: 9,
      environmentProfileId: 5,
      environmentProfileName: 'Authenticated User',
      environmentProfileRevision: 2,
      requestedById: 4,
      timeoutSeconds: 120,
      settings: {
        runnerVersion: 'runner-1',
        containerImage: 'probe-playwright-runner:1',
        captureVideo: true,
        applyEnvironmentCookies: false,
        applyEnvironmentHeaders: false,
      },
    });
    expect(writes[0]).not.toHaveProperty('source');
    expect(JSON.stringify(writes[0])).not.toContain('secret');
  });

  test('rejects execution with a different or stale profile snapshot', async () => {
    let profileRevision = 2;
    const service = createAutomationExecutionService(
      {
        async findAutomation() {
          return automation;
        },
        async create() {
          throw new Error('must not queue');
        },
      } as never,
      { async requireProject() {} } as never,
      {
        async getEnabledProfile(id: number) {
          return {
            id,
            environmentId: 9,
            name: 'Authenticated User',
            revision: profileRevision,
          };
        },
      } as never,
      {} as never,
      'private-artifacts',
      defaults,
    );

    await expect(
      service.queue(
        {
          automationId: 7,
          environmentProfileId: 6,
          timeoutSeconds: 120,
          captureVideo: false,
          applyEnvironmentCookies: true,
          applyEnvironmentHeaders: true,
        },
        4,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    profileRevision = 3;
    await expect(
      service.queue(
        {
          automationId: 7,
          environmentProfileId: 5,
          timeoutSeconds: 120,
          captureVideo: false,
          applyEnvironmentCookies: true,
          applyEnvironmentHeaders: true,
        },
        4,
      ),
    ).rejects.toThrow('profile changed');
  });

  test('does not expose private object names in execution history', async () => {
    const service = createAutomationExecutionService(
      {
        async findAutomation() {
          return automation;
        },
        async list() {
          return [
            {
              id: 11,
              artifacts: [
                {
                  id: 12,
                  objectName: 'automation-executions/private-token/trace.zip',
                  originalName: 'trace.zip',
                  kind: 'trace',
                  expiresAt: new Date(Date.now() + 60_000),
                },
              ],
            },
          ];
        },
      } as never,
      { async requireProject() {} } as never,
      {} as never,
      {} as never,
      'private-artifacts',
      defaults,
    );

    const [job] = await service.list(7, 4);
    expect(job?.artifacts?.[0]).not.toHaveProperty('objectName');
    expect(JSON.stringify(job)).not.toContain('private-token');
  });
});
