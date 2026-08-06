import { describe, expect, test } from 'bun:test';
import { buildAuthoringDockerArgs } from './browser-authoring-runtime';

describe('isolated browser authoring runtime', () => {
  test('uses the disposable runner boundary and keeps secrets out of arguments', () => {
    const secret = 'private-password-value';
    const { args } = buildAuthoringDockerArgs(
      {
        id: 30,
        baseUrl: 'https://staging.example.test',
        testIdAttribute: 'data-qa',
        timeoutSeconds: 300,
        settings: {
          containerImage: 'probe-playwright-runner:1',
          cpuLimit: 1,
          memoryMb: 768,
          processLimit: 128,
          networkPolicy: 'probe-runner-egress',
        },
      },
      '/tmp/browser-authoring.mjs',
      {
        values: { TEST_PASSWORD: secret },
        secretNames: ['TEST_PASSWORD'],
        cookies: [],
        headers: [],
      },
    );
    expect(args).toContain('--read-only');
    expect(args).toContain('--cap-drop=ALL');
    expect(args).toContain('--security-opt=no-new-privileges');
    expect(args).toContain('--network=probe-runner-egress');
    expect(args).toContain('--entrypoint=node');
    expect(args).toContain('TEST_PASSWORD');
    expect(args).toContain('PROBE_SECRET_NAMES');
    expect(args.join(' ')).not.toContain(secret);
  });

  test('rejects unrestricted Docker networks', () => {
    expect(() =>
      buildAuthoringDockerArgs(
        {
          id: 30,
          baseUrl: 'https://staging.example.test',
          testIdAttribute: 'data-testid',
          timeoutSeconds: 300,
          settings: {
            containerImage: 'runner:1',
            cpuLimit: 1,
            memoryMb: 512,
            processLimit: 64,
            networkPolicy: 'bridge',
          },
        },
        '/tmp/browser-authoring.mjs',
        { values: {}, secretNames: [], cookies: [], headers: [] },
      ),
    ).toThrow('dedicated egress-controlled');
  });

  test('rejects non-HTTP and credential-bearing base URLs', () => {
    const payload = {
      id: 30,
      baseUrl: 'file:///etc/passwd',
      testIdAttribute: 'data-testid',
      timeoutSeconds: 300,
      settings: {
        containerImage: 'runner:1',
        cpuLimit: 1,
        memoryMb: 512,
        processLimit: 64,
        networkPolicy: 'probe-runner-egress',
      },
    };
    expect(() =>
      buildAuthoringDockerArgs(payload, '/tmp/browser-authoring.mjs', {
        values: {},
        secretNames: [],
        cookies: [],
        headers: [],
      }),
    ).toThrow('approved HTTP URL');
    expect(() =>
      buildAuthoringDockerArgs(
        { ...payload, baseUrl: 'https://user:pass@example.test' },
        '/tmp/browser-authoring.mjs',
        { values: {}, secretNames: [], cookies: [], headers: [] },
      ),
    ).toThrow('approved HTTP URL');
  });
});
