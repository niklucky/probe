import { describe, expect, test } from 'bun:test';
import {
  artifactMetadata,
  buildDockerArgs,
  classifyExecutionStatus,
  environmentHeaderRouteHandlerSource,
  redactSecrets,
  withEnvironmentCookieHook,
  withEnvironmentHeaderHook,
  type ExecutionPayload,
} from './executor';

type HeaderDefinition = { name: string; value: string; origin: string };
type RouteHandler = (
  route: {
    request(): { url(): string; headers(): Record<string, string> };
    continue(): Promise<void>;
    fetch(options: {
      headers: Record<string, string>;
      maxRedirects: number;
    }): Promise<object>;
    fulfill(options: { response: object }): Promise<void>;
    abort(code: string): Promise<void>;
  },
  definitions: HeaderDefinition[],
) => Promise<void>;

function compiledEnvironmentHeaderRouteHandler() {
  return new Function(
    `return (${environmentHeaderRouteHandlerSource});`,
  )() as RouteHandler;
}

const payload: ExecutionPayload = {
  id: 42,
  timeoutSeconds: 60,
  settings: {
    captureDiagnostics: false,
    captureVideo: false,
    applyEnvironmentCookies: true,
    applyEnvironmentHeaders: true,
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
      { values: {}, secretNames: [], cookies: [], headers: [] },
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
    expect(args).toContain('--label=probe.runner.managed=true');
    expect(args).toContain('--label=probe.execution.job=42');
    expect(args).toContain('CAPTURE_DIAGNOSTICS=off');
    expect(args.join(' ')).toContain('readonly');
  });

  test('passes explicit visual diagnostics consent to the execution image', () => {
    const { args } = buildDockerArgs(
      {
        ...payload,
        settings: { ...payload.settings, captureDiagnostics: true },
      },
      '/tmp/source.ts',
      '/tmp/artifacts',
      { values: {}, secretNames: [], cookies: [], headers: [] },
    );

    expect(args).toContain('CAPTURE_DIAGNOSTICS=on');
  });

  test('passes secret names without placing secret values in arguments', () => {
    const secretValue = ['fixture', 'value'].join('-');
    const { args } = buildDockerArgs(
      payload,
      '/tmp/source.ts',
      '/tmp/artifacts',
      {
        values: { TEST_PASSWORD: secretValue },
        secretNames: ['TEST_PASSWORD'],
        cookies: [],
        headers: [],
      },
    );
    expect(args).toContain('TEST_PASSWORD');
    expect(args.join(' ')).not.toContain(secretValue);
    expect(args).toContain('HAS_TEST_SECRETS=true');
  });

  test('passes resolved cookies by environment name and applies them before tests', () => {
    const cookieValue = 'private-cookie-value';
    const runtime = {
      values: {},
      secretNames: [],
      cookies: [
        {
          name: 'session_id',
          value: cookieValue,
          domain: 'staging.example.test',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Lax' as const,
        },
      ],
      headers: [],
    };
    const { args } = buildDockerArgs(
      payload,
      '/tmp/source.ts',
      '/tmp/artifacts',
      runtime,
    );
    expect(args).toContain('PROBE_ENVIRONMENT_COOKIES');
    expect(args).toContain('HAS_TEST_SECRETS=true');
    expect(args.join(' ')).not.toContain(cookieValue);
    const source = withEnvironmentCookieHook(
      `test('opens', async ({ page }) => page.goto('/'));`,
      true,
    );
    expect(source.indexOf('context.addCookies')).toBeLessThan(
      source.indexOf("page.goto('/')"),
    );
    expect(source).not.toContain(cookieValue);
  });

  test('passes resolved headers by environment name and installs a per-request origin check', () => {
    const headerValue = 'Bearer private-header-value';
    const runtime = {
      values: {},
      secretNames: [],
      cookies: [],
      headers: [
        {
          name: 'Authorization',
          value: headerValue,
          origin: 'https://staging.example.test',
        },
      ],
    };
    const { args } = buildDockerArgs(
      payload,
      '/tmp/source.ts',
      '/tmp/artifacts',
      runtime,
    );
    expect(args).toContain('PROBE_ENVIRONMENT_HEADERS');
    expect(args).toContain('HAS_TEST_SECRETS=true');
    expect(args.join(' ')).not.toContain(headerValue);
    const source = withEnvironmentHeaderHook(
      `test('opens', async ({ page }) => page.goto('/'));`,
      true,
    );
    expect(source).toContain("context.route('**/*'");
    expect(source).toContain('new URL(request.url()).origin');
    expect(source).toContain('header.origin === requestOrigin');
    expect(source).toContain('maxRedirects: 0');
    expect(source).toContain('route.fulfill({ response })');
    expect(source).not.toContain(headerValue);
  });

  test('executes the serialized route hook for each redirect origin', async () => {
    const handler = compiledEnvironmentHeaderRouteHandler();
    const definitions = [
      {
        name: 'Authorization',
        value: 'Bearer private-header-value',
        origin: 'https://staging.example.test',
      },
    ];
    const redirectResponse = { status: 302 };
    let fetchOptions:
      | { headers: Record<string, string>; maxRedirects: number }
      | undefined;
    let fulfilledResponse: object | undefined;
    await handler(
      {
        request: () => ({
          url: () => 'https://staging.example.test/start',
          headers: () => ({ authorization: 'old-value', accept: '*/*' }),
        }),
        continue: async () => {
          throw new Error('matching requests must not continue directly');
        },
        fetch: async (options) => {
          fetchOptions = options;
          return redirectResponse;
        },
        fulfill: async ({ response }) => {
          fulfilledResponse = response;
        },
        abort: async () => {},
      },
      definitions,
    );
    expect(fetchOptions).toEqual({
      headers: {
        accept: '*/*',
        Authorization: 'Bearer private-header-value',
      },
      maxRedirects: 0,
    });
    expect(fulfilledResponse).toBe(redirectResponse);

    let redirectedRequestContinued = false;
    await handler(
      {
        request: () => ({
          url: () => 'https://identity.example.test/login',
          headers: () => ({ accept: '*/*' }),
        }),
        continue: async () => {
          redirectedRequestContinued = true;
        },
        fetch: async () => {
          throw new Error('cross-origin redirects must not receive headers');
        },
        fulfill: async () => {},
        abort: async () => {},
      },
      definitions,
    );
    expect(redirectedRequestContinued).toBe(true);
  });

  test('aborts the routed request and preserves fetch failures', async () => {
    const handler = compiledEnvironmentHeaderRouteHandler();
    const networkError = new Error('DNS lookup failed');
    let abortCode: string | undefined;
    await expect(
      handler(
        {
          request: () => ({
            url: () => 'https://staging.example.test/start',
            headers: () => ({}),
          }),
          continue: async () => {},
          fetch: async () => {
            throw networkError;
          },
          fulfill: async () => {},
          abort: async (code) => {
            abortCode = code;
          },
        },
        [
          {
            name: 'Authorization',
            value: 'Bearer private-header-value',
            origin: 'https://staging.example.test',
          },
        ],
      ),
    ).rejects.toBe(networkError);
    expect(abortCode).toBe('failed');
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
    expect(redactSecrets('value=qa', { username: 'qa' })).toBe('value=qa');
    expect(redactSecrets('cookie=x', { 'cookie:0:short': 'x' })).toBe(
      'cookie=[REDACTED]',
    );
    expect(redactSecrets('header=x', { 'header:0:short': 'x' })).toBe(
      'header=[REDACTED]',
    );
  });

  test('does not apply secret artifact policy to non-secret runtime values', () => {
    const { args } = buildDockerArgs(
      payload,
      '/tmp/source.ts',
      '/tmp/artifacts',
      {
        values: { username: 'qa-user' },
        secretNames: [],
        cookies: [],
        headers: [],
      },
    );
    expect(args).toContain('username');
    expect(args).toContain('HAS_TEST_SECRETS=false');
  });

  test('rejects unsafe secret environment variable names', () => {
    expect(() =>
      buildDockerArgs(payload, '/tmp/source.ts', '/tmp/artifacts', {
        values: { 'BAD-NAME': 'secret' },
        secretNames: ['BAD-NAME'],
        cookies: [],
        headers: [],
      }),
    ).toThrow('Invalid test environment variable');
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
          { values: {}, secretNames: [], cookies: [], headers: [] },
        ),
      ).toThrow('dedicated egress-controlled Docker network');
    }
  });

  test('maps process outcomes to the public execution statuses', () => {
    const outcome = {
      infrastructureError: false,
      artifactLimitExceeded: false,
      cancelled: false,
      timedOut: false,
      exitCode: 0,
    };
    expect(classifyExecutionStatus(outcome)).toBe('passed');
    expect(classifyExecutionStatus({ ...outcome, exitCode: 1 })).toBe('failed');
    expect(classifyExecutionStatus({ ...outcome, timedOut: true })).toBe(
      'timed_out',
    );
    expect(classifyExecutionStatus({ ...outcome, cancelled: true })).toBe(
      'cancelled',
    );
    expect(classifyExecutionStatus({ ...outcome, exitCode: 125 })).toBe(
      'infrastructure_error',
    );
    expect(
      classifyExecutionStatus({ ...outcome, artifactLimitExceeded: true }),
    ).toBe('infrastructure_error');
  });

  test('assigns accurate MIME types to generated reports', () => {
    expect(artifactMetadata('/tmp/report.html')).toEqual({
      kind: 'log',
      mimeType: 'text/html',
    });
    expect(artifactMetadata('/tmp/results.json')).toEqual({
      kind: 'log',
      mimeType: 'application/json',
    });
  });
});
