import { describe, expect, test } from 'bun:test';
import {
  buildDockerArgs,
  redactSecrets,
  selectRuntimeSecrets,
  type ExecutionPayload,
} from './executor';

const payload: ExecutionPayload = {
  id: 42,
  timeoutSeconds: 60,
  settings: {
    captureVideo: false,
    containerImage: 'probe-playwright-runner:1',
    cpuLimit: 1,
    memoryMb: 512,
    processLimit: 64,
    artifactLimitMb: 256,
    networkPolicy: 'probe-runner-egress',
  },
  automation: { source: 'test("safe", async () => {})' },
  environment: { baseUrl: 'https://staging.example.test/app' },
};

describe('isolated execution command', () => {
  test('applies hard container limits and a dedicated network', () => {
    const { args } = buildDockerArgs(
      payload,
      '/tmp/source.ts',
      '/tmp/artifacts',
      {},
    );
    expect(args).toContain('--read-only');
    expect(args).toContain('--cap-drop=ALL');
    expect(args).toContain('--security-opt=no-new-privileges');
    expect(args).toContain('--cpus=1');
    expect(args).toContain('--memory=512m');
    expect(args).toContain('--memory-swap=512m');
    expect(args).toContain('--shm-size=256m');
    expect(args).toContain('--pids-limit=64');
    expect(args).toContain('--ulimit=fsize=268435456');
    expect(args).toContain('--network=probe-runner-egress');
    expect(args.join(' ')).toContain('readonly');
  });

  test('passes secret names without placing secret values in arguments', () => {
    const secretValue = ['fixture', 'value'].join('-');
    const { args } = buildDockerArgs(
      payload,
      '/tmp/source.ts',
      '/tmp/artifacts',
      { TEST_PASSWORD: secretValue },
    );
    expect(args).toContain('TEST_PASSWORD');
    expect(args.join(' ')).not.toContain(secretValue);
    expect(args).toContain('HAS_TEST_SECRETS=true');
  });

  test('redacts runtime secrets and common bearer credentials from logs', () => {
    const secretValue = ['fixture', 'value'].join('-');
    const bearerValue = 'fixture'.repeat(3);
    const output = redactSecrets(
      `password=${secretValue} Authorization: Bearer ${bearerValue}`,
      { TEST_PASSWORD: secretValue },
    );
    expect(output).not.toContain(secretValue);
    expect(output).not.toContain(bearerValue);
    expect(output).toContain('[REDACTED]');
  });

  test('only injects secrets explicitly referenced by the accepted source', () => {
    expect(
      selectRuntimeSecrets(
        "console.log(process.env.TEST_USER); use(process.env['TEST_PASSWORD'])",
        {
          TEST_USER: 'qa@example.test',
          TEST_PASSWORD: 'private',
          OTHER_PROJECT_TOKEN: 'must-not-be-injected',
        },
      ),
    ).toEqual({
      TEST_PASSWORD: 'private',
      TEST_USER: 'qa@example.test',
    });
  });

  test('rejects unsafe secret environment variable names', () => {
    expect(() =>
      buildDockerArgs(payload, '/tmp/source.ts', '/tmp/artifacts', {
        'BAD-NAME': 'secret',
      }),
    ).toThrow('Invalid test secret environment variable');
  });

  test('refuses Docker host, default bridge, and unconfigured network modes', () => {
    for (const networkPolicy of ['host', 'bridge', 'default', 'none']) {
      expect(() =>
        buildDockerArgs(
          {
            ...payload,
            settings: { ...payload.settings, networkPolicy },
          },
          '/tmp/source.ts',
          '/tmp/artifacts',
          {},
        ),
      ).toThrow('dedicated egress-controlled Docker network');
    }
  });
});
