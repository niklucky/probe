import { spawn } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

export interface ExecutionPayload {
  id: number;
  timeoutSeconds: number;
  settings: {
    captureVideo: boolean;
    applyEnvironmentCookies: boolean;
    containerImage: string;
    cpuLimit: number;
    memoryMb: number;
    processLimit: number;
    artifactLimitMb: number;
    networkPolicy: string;
  };
  automation: { source: string };
  environment: { baseUrl: string };
}

export interface ExecutionResult {
  status:
    'passed' | 'failed' | 'timed_out' | 'cancelled' | 'infrastructure_error';
  summary: {
    tests: number;
    passed: number;
    failed: number;
    durationMs: number;
  };
  errorCode?: string;
  errorMessage?: string;
  logs: Array<{ at: string; level: string; message: string }>;
  artifactDirectory: string;
  cleanup: () => Promise<void>;
}

export interface RuntimeEnvironment {
  values: Record<string, string>;
  secretNames: string[];
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
    expires?: number;
  }>;
}

interface ExecutionOutcome {
  infrastructureError: boolean;
  artifactLimitExceeded: boolean;
  cancelled: boolean;
  timedOut: boolean;
  exitCode: number;
}

const MAX_LOG_BYTES = 512_000;

export function classifyExecutionStatus({
  infrastructureError,
  artifactLimitExceeded,
  cancelled,
  timedOut,
  exitCode,
}: ExecutionOutcome): ExecutionResult['status'] {
  if (
    infrastructureError ||
    artifactLimitExceeded ||
    [125, 126, 127].includes(exitCode)
  ) {
    return 'infrastructure_error';
  }
  if (cancelled) return 'cancelled';
  if (timedOut) return 'timed_out';
  return exitCode === 0 ? 'passed' : 'failed';
}

export function redactSecrets(value: string, secrets: Record<string, string>) {
  let sanitized = value;
  for (const [name, secret] of Object.entries(secrets).sort(
    (left, right) => right[1].length - left[1].length,
  )) {
    if (secret && (secret.length >= 3 || name.startsWith('cookie:')))
      sanitized = sanitized.split(secret).join('[REDACTED]');
  }
  return sanitized
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{8,}=*/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/gi, '[REDACTED]');
}

export function buildDockerArgs(
  payload: ExecutionPayload,
  sourcePath: string,
  artifactDirectory: string,
  runtimeEnvironment: RuntimeEnvironment,
) {
  for (const name of runtimeEnvironment.secretNames) {
    if (!(name in runtimeEnvironment.values)) {
      throw new Error(`Missing injected secret environment variable: ${name}`);
    }
  }
  if (
    ['host', 'bridge', 'default', 'none'].includes(
      payload.settings.networkPolicy,
    )
  ) {
    throw new Error(
      'Execution requires a dedicated egress-controlled Docker network',
    );
  }
  const containerName = `probe-execution-${payload.id}`;
  const args = [
    'run',
    '--rm',
    '--name',
    containerName,
    '--label=probe.runner.managed=true',
    `--label=probe.execution.job=${payload.id}`,
    '--read-only',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    `--cpus=${payload.settings.cpuLimit}`,
    `--memory=${payload.settings.memoryMb}m`,
    `--memory-swap=${payload.settings.memoryMb}m`,
    '--shm-size=256m',
    `--pids-limit=${payload.settings.processLimit}`,
    // OCI RLIMIT_FSIZE values are bytes (shell `ulimit -f` displays blocks).
    `--ulimit=fsize=${payload.settings.artifactLimitMb * 1024 * 1024}`,
    `--network=${payload.settings.networkPolicy}`,
    '--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=256m',
    `--mount=type=bind,src=${resolve(sourcePath)},dst=/workspace/tests/automation.spec.ts,readonly`,
    `--mount=type=bind,src=${resolve(artifactDirectory)},dst=/artifacts`,
    '--env',
    `BASE_URL=${approvedTarget(payload.environment.baseUrl)}`,
    '--env',
    `CAPTURE_VIDEO=${payload.settings.captureVideo ? 'on' : 'off'}`,
    '--env',
    `JOB_TIMEOUT_MS=${payload.timeoutSeconds * 1000}`,
    '--env',
    `HAS_TEST_SECRETS=${runtimeEnvironment.secretNames.length || runtimeEnvironment.cookies.length ? 'true' : 'false'}`,
  ];
  if (runtimeEnvironment.cookies.length) {
    // The value is inherited from the runner process and never appears in the
    // Docker command, queue data, generated source, or persisted results.
    args.push('--env', 'PROBE_ENVIRONMENT_COOKIES');
  }
  for (const name of Object.keys(runtimeEnvironment.values).sort()) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new Error(`Invalid test environment variable: ${name}`);
    }
    // Docker reads the value from the runner environment. It never appears in
    // process arguments, source, queue records, or result data.
    args.push('--env', name);
  }
  args.push(payload.settings.containerImage);
  return { containerName, args };
}

export function withEnvironmentCookieHook(source: string, hasCookies: boolean) {
  if (!hasCookies) return source;
  return `import { test as __probeCookieTest } from '@playwright/test';
__probeCookieTest.beforeEach(async ({ context }) => {
  const cookies = JSON.parse(process.env.PROBE_ENVIRONMENT_COOKIES ?? '[]');
  await context.addCookies(cookies);
});
${source}`;
}

function approvedTarget(value: string) {
  const target = new URL(value);
  if (
    !['http:', 'https:'].includes(target.protocol) ||
    target.username ||
    target.password
  ) {
    throw new Error('Execution environment target is not an approved HTTP URL');
  }
  return target.toString();
}

function runCommand(command: string, args: string[]) {
  return new Promise<number>((resolveExit, reject) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', (code) => resolveExit(code ?? 1));
  });
}

export async function cleanupAbandonedExecution(jobId: number) {
  await runCommand('docker', [
    'rm',
    '--force',
    `probe-execution-${jobId}`,
  ]).catch(() => undefined);
  const prefix = `probe-run-${jobId}-`;
  const entries = await readdir(tmpdir(), { withFileTypes: true }).catch(
    () => [],
  );
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
      .map((entry) =>
        rm(join(tmpdir(), entry.name), { recursive: true, force: true }).catch(
          () => undefined,
        ),
      ),
  );
}

export async function executeInContainer(
  payload: ExecutionPayload,
  runtimeEnvironment: RuntimeEnvironment,
  hooks: {
    heartbeat: () => Promise<boolean>;
  },
): Promise<ExecutionResult> {
  const directory = await mkdtemp(join(tmpdir(), `probe-run-${payload.id}-`));
  const artifactDirectory = join(directory, 'artifacts');
  await mkdir(artifactDirectory);
  await chmod(directory, 0o755);
  await chmod(artifactDirectory, 0o777);
  await writeFile(join(artifactDirectory, '.keep'), '');
  const sourcePath = join(directory, 'automation.spec.ts');
  // The bind mount is read-only; world-readability lets the image's
  // unprivileged pwuser read a file owned by the host runner on Linux.
  await writeFile(
    sourcePath,
    withEnvironmentCookieHook(
      payload.automation.source,
      runtimeEnvironment.cookies.length > 0,
    ),
    { mode: 0o444 },
  );
  const { containerName, args } = buildDockerArgs(
    payload,
    sourcePath,
    artifactDirectory,
    runtimeEnvironment,
  );
  const secrets = Object.fromEntries([
    ...runtimeEnvironment.secretNames.map(
      (name) => [name, runtimeEnvironment.values[name]!] as const,
    ),
    ...runtimeEnvironment.cookies.map(
      (cookie, index) =>
        [`cookie:${index}:${cookie.name}`, cookie.value] as const,
    ),
  ]);

  const startedAt = Date.now();
  let outputBytes = 0;
  const outputChunks: Array<{ at: string; value: Buffer }> = [];
  let timedOut = false;
  let cancelled = false;
  let artifactLimitExceeded = false;
  let infrastructureError: Error | undefined;
  let child: ReturnType<typeof spawn> | undefined;
  const stop = async () => {
    if (!child || child.exitCode !== null) return;
    await runCommand('docker', ['stop', '--time=2', containerName]).catch(
      () => undefined,
    );
  };

  try {
    child = spawn('docker', args, {
      env: {
        ...process.env,
        ...runtimeEnvironment.values,
        ...(runtimeEnvironment.cookies.length
          ? {
              PROBE_ENVIRONMENT_COOKIES: JSON.stringify(
                runtimeEnvironment.cookies,
              ),
            }
          : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const append = (chunk: Buffer) => {
      const remaining = MAX_LOG_BYTES - outputBytes;
      if (remaining <= 0) return;
      const value = Buffer.from(chunk).subarray(0, remaining);
      outputChunks.push({ at: new Date().toISOString(), value });
      outputBytes += value.byteLength;
    };
    child.stdout?.on('data', append);
    child.stderr?.on('data', append);
    child.once('error', (error) => {
      infrastructureError = error;
    });

    let monitorRunning = false;
    let monitorTask: Promise<void> = Promise.resolve();
    const monitor = setInterval(() => {
      if (monitorRunning || timedOut || cancelled || artifactLimitExceeded) {
        return;
      }
      monitorRunning = true;
      monitorTask = (async () => {
        try {
          if (Date.now() - startedAt >= payload.timeoutSeconds * 1000) {
            timedOut = true;
            await stop();
            return;
          }
          if (
            (await directorySize(artifactDirectory)) >
            payload.settings.artifactLimitMb * 1024 * 1024
          ) {
            artifactLimitExceeded = true;
            await stop();
            return;
          }
          if (await hooks.heartbeat()) {
            cancelled = true;
            await stop();
          }
        } catch (error) {
          infrastructureError =
            error instanceof Error
              ? error
              : new Error('Execution monitor failed');
          await stop();
        } finally {
          monitorRunning = false;
        }
      })();
    }, 2000);
    const exitCode = await new Promise<number>((resolveExit) => {
      let settled = false;
      const settle = (code: number) => {
        if (settled) return;
        settled = true;
        resolveExit(code);
      };
      child?.once('exit', (code) => settle(code ?? 1));
      child?.once('error', () => settle(127));
    });
    clearInterval(monitor);
    await monitorTask;

    const sanitized = redactSecrets(
      Buffer.concat(outputChunks.map(({ value }) => value)).toString('utf8'),
      secrets,
    );
    const durationMs = Date.now() - startedAt;
    const status = classifyExecutionStatus({
      infrastructureError: Boolean(infrastructureError),
      artifactLimitExceeded,
      cancelled,
      timedOut,
      exitCode,
    });
    const errorCode =
      status === 'infrastructure_error'
        ? artifactLimitExceeded
          ? 'ARTIFACT_LIMIT_EXCEEDED'
          : 'CONTAINER_START_FAILED'
        : status === 'timed_out'
          ? 'EXECUTION_TIMEOUT'
          : status === 'cancelled'
            ? 'EXECUTION_CANCELLED'
            : status === 'failed'
              ? 'PLAYWRIGHT_FAILED'
              : undefined;
    return {
      status,
      summary: {
        tests: 1,
        passed: status === 'passed' ? 1 : 0,
        failed: status === 'failed' ? 1 : 0,
        durationMs,
      },
      errorCode,
      errorMessage:
        status === 'passed'
          ? undefined
          : artifactLimitExceeded
            ? `Artifact output exceeded ${payload.settings.artifactLimitMb} MB`
            : sanitized.slice(-1000) ||
              (infrastructureError
                ? redactSecrets(infrastructureError.message, secrets)
                : undefined),
      logs: outputChunks
        .flatMap(({ at, value }) =>
          redactSecrets(value.toString('utf8'), secrets)
            .split('\n')
            .filter(Boolean)
            .map((message) => ({ at, level: 'info', message })),
        )
        .slice(-200),
      artifactDirectory,
      cleanup: () => rm(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    await stop();
    const message = redactSecrets(
      error instanceof Error ? error.message : 'Runner infrastructure error',
      secrets,
    );
    return {
      status: 'infrastructure_error',
      summary: {
        tests: 0,
        passed: 0,
        failed: 0,
        durationMs: Date.now() - startedAt,
      },
      errorCode: 'RUNNER_INFRASTRUCTURE_ERROR',
      errorMessage: message,
      logs: [{ at: new Date().toISOString(), level: 'error', message }],
      artifactDirectory,
      cleanup: () => rm(directory, { recursive: true, force: true }),
    };
  }
}

export async function listArtifactFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return listArtifactFiles(path);
      return entry.isFile() ? [path] : [];
    }),
  );
  return nested.flat();
}

async function directorySize(directory: string): Promise<number> {
  let size = 0;
  for (const path of await listArtifactFiles(directory)) {
    try {
      size += (await stat(path)).size;
    } catch (error) {
      if (!(
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      )) {
        throw error;
      }
    }
  }
  return size;
}

export function artifactMetadata(path: string) {
  const name = basename(path);
  if (name === '.keep') return undefined;
  if (name.endsWith('.zip')) {
    return { kind: 'trace' as const, mimeType: 'application/zip' };
  }
  if (name.endsWith('.webm')) {
    return { kind: 'video' as const, mimeType: 'video/webm' };
  }
  if (name.endsWith('.png')) {
    return { kind: 'screenshot' as const, mimeType: 'image/png' };
  }
  if (name.endsWith('.html')) {
    return { kind: 'log' as const, mimeType: 'text/html' };
  }
  if (name.endsWith('.json')) {
    return { kind: 'log' as const, mimeType: 'application/json' };
  }
  return { kind: 'log' as const, mimeType: 'text/plain' };
}

export { stat };
