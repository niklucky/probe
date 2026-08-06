import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { BrowserToolCall, BrowserToolResult } from '@probe/shared';
import type { RuntimeEnvironment } from './executor';

export interface AuthoringRuntimePayload {
  id: number;
  baseUrl: string;
  testIdAttribute: string;
  timeoutSeconds: number;
  settings: {
    containerImage: string;
    cpuLimit: number;
    memoryMb: number;
    processLimit: number;
    networkPolicy: string;
  };
}

const runtimeSource = String.raw`
import { chromium, selectors } from 'playwright';
import readline from 'node:readline';

const baseUrl = new URL(process.env.BASE_URL);
const allowedOrigin = baseUrl.origin;
const testIdAttribute = process.env.TEST_ID_ATTRIBUTE || 'data-testid';
selectors.setTestIdAttribute(testIdAttribute);
const cookies = JSON.parse(process.env.PROBE_ENVIRONMENT_COOKIES || '[]');
const headers = JSON.parse(process.env.PROBE_ENVIRONMENT_HEADERS || '[]');
const secretNames = JSON.parse(process.env.PROBE_SECRET_NAMES || '[]');
const secretValues = [
  ...secretNames.map((name) => process.env[name]).filter(Boolean),
  ...cookies.map((cookie) => cookie.value).filter(Boolean),
  ...headers.map((header) => header.value).filter(Boolean),
].sort((left, right) => right.length - left.length);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
if (cookies.length) await context.addCookies(cookies);
await context.route('**/*', async (route) => {
  const request = route.request();
  const origin = new URL(request.url()).origin;
  if (request.isNavigationRequest() && origin !== allowedOrigin) {
    await route.abort('blockedbyclient');
    return;
  }
  const matching = headers.filter((header) => header.origin === origin);
  if (!matching.length) return route.continue();
  const nextHeaders = { ...request.headers() };
  for (const header of matching) nextHeaders[header.name] = header.value;
  const response = await route.fetch({ headers: nextHeaders, maxRedirects: 0 });
  await route.fulfill({ response });
});
const page = await context.newPage();
page.on('framenavigated', async (frame) => {
  if (frame !== page.mainFrame()) return;
  const url = frame.url();
  if (url && url !== 'about:blank' && new URL(url).origin !== allowedOrigin) {
    await page.goto(baseUrl.href).catch(() => undefined);
  }
});

function safeText(value, max = 500) {
  if (typeof value !== 'string') return null;
  let normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  for (const secret of secretValues) normalized = normalized.split(secret).join('[REDACTED]');
  if (/(?:password|passwd|secret|token|api[-_ ]?key|authorization|cookie|session|credential)/i.test(normalized)) return '[REDACTED]';
  return normalized.slice(0, max);
}

async function snapshot() {
  const elements = await page.locator('a,button,input,select,textarea,[role],[contenteditable="true"]').evaluateAll(
    (nodes, configuredTestId) => nodes.slice(0, 120).map((element, index) => {
      const input = element instanceof HTMLInputElement ? element : null;
      const label = 'labels' in element && element.labels?.length
        ? Array.from(element.labels).map((item) => item.textContent || '').join(' ')
        : null;
      const role = element.getAttribute('role') || ({ A: 'link', BUTTON: 'button', SELECT: 'combobox', TEXTAREA: 'textbox' })[element.tagName] || (input ? (input.type === 'checkbox' ? 'checkbox' : input.type === 'radio' ? 'radio' : 'textbox') : null);
      const ariaName = element.getAttribute('aria-label') || element.getAttribute('title');
      const editable = Boolean(input || element instanceof HTMLTextAreaElement || element.getAttribute('contenteditable') === 'true');
      const text = editable ? '' : (element.textContent || '');
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        ref: 'e' + (index + 1),
        tag: element.tagName.toLowerCase(),
        role,
        name: ariaName || label || text,
        label,
        placeholder: element.getAttribute('placeholder'),
        inputType: input?.type || null,
        inputName: element.getAttribute('name'),
        id: element.id || null,
        testId: element.getAttribute(configuredTestId),
        href: element instanceof HTMLAnchorElement ? element.href : null,
        nearbyText: editable ? (label || ariaName) : (element.parentElement?.textContent || null),
        visible: style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0,
        enabled: !('disabled' in element) || !element.disabled,
        selected: 'selected' in element ? Boolean(element.selected) : false,
        checked: 'checked' in element ? Boolean(element.checked) : null,
      };
    }),
    testIdAttribute,
  );
  return {
    url: page.url(),
    title: safeText(await page.title(), 500) || '',
    elements: elements.map((element) => ({
      ...element,
      name: safeText(element.name, 300),
      label: safeText(element.label, 300),
      placeholder: safeText(element.placeholder, 300),
      inputName: safeText(element.inputName, 200),
      id: safeText(element.id, 200),
      testId: safeText(element.testId, 300),
      href: element.href ? (() => {
        try {
          const url = new URL(element.href);
          return url.origin + url.pathname;
        } catch {
          return null;
        }
      })() : null,
      nearbyText: safeText(element.nearbyText, 300),
    })),
    truncated: elements.length >= 120,
  };
}

function locator(definition) {
  if (definition.kind === 'testId') return page.getByTestId(definition.value);
  if (definition.kind === 'role') return page.getByRole(definition.value, definition.name ? { name: definition.name } : undefined);
  if (definition.kind === 'label') return page.getByLabel(definition.value);
  if (definition.kind === 'placeholder') return page.getByPlaceholder(definition.value);
  return page.getByText(definition.value, { exact: true });
}

async function execute(call) {
  if (call.operation === 'openPage') {
    const target = new URL(call.path || '/', baseUrl);
    if (target.origin !== allowedOrigin) throw new Error('Navigation outside the approved environment origin was blocked');
    await page.goto(target.href, { waitUntil: 'domcontentloaded' });
  } else if (call.operation === 'inspectPage') {
    // Snapshot below is the operation.
  } else if (call.operation === 'click') {
    await locator(call.locator).click();
  } else if (call.operation === 'fill') {
    if (/(?:password|secret|token|credential)/i.test(call.text)) throw new Error('Sensitive-looking literal text is not allowed');
    await locator(call.locator).fill(call.text);
  } else if (call.operation === 'fillFromEnvironment') {
    const value = process.env[call.variableName];
    if (value === undefined) throw new Error('Requested environment variable is unavailable');
    await locator(call.locator).fill(value);
  } else if (call.operation === 'selectOption') {
    await locator(call.locator).selectOption(call.value);
  } else if (call.operation === 'press') {
    await page.keyboard.press(call.key);
  }
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  return snapshot();
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  try {
    const call = JSON.parse(line);
    const state = await execute(call);
    process.stdout.write(JSON.stringify({ ok: true, snapshot: state }) + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({ ok: false, error: String(error?.message || error).slice(0, 500), snapshot: await snapshot().catch(() => undefined) }) + '\n');
  }
}
await browser.close();
`;

export function buildAuthoringDockerArgs(
  payload: AuthoringRuntimePayload,
  runtimePath: string,
  runtimeEnvironment: RuntimeEnvironment,
) {
  if (
    ['host', 'bridge', 'default', 'none'].includes(
      payload.settings.networkPolicy,
    )
  ) {
    throw new Error(
      'Browser authoring requires a dedicated egress-controlled Docker network',
    );
  }
  const containerName = `probe-authoring-${payload.id}`;
  const args = [
    'run',
    '--rm',
    '-i',
    '--name',
    containerName,
    '--label=probe.runner.managed=true',
    `--label=probe.browser-authoring.session=${payload.id}`,
    '--read-only',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    `--cpus=${payload.settings.cpuLimit}`,
    `--memory=${payload.settings.memoryMb}m`,
    `--memory-swap=${payload.settings.memoryMb}m`,
    '--shm-size=256m',
    `--pids-limit=${payload.settings.processLimit}`,
    `--network=${payload.settings.networkPolicy}`,
    '--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=256m',
    `--mount=type=bind,src=${resolve(runtimePath)},dst=/workspace/browser-authoring.mjs,readonly`,
    '--env',
    `BASE_URL=${new URL(payload.baseUrl).href}`,
    '--env',
    `TEST_ID_ATTRIBUTE=${payload.testIdAttribute}`,
  ];
  if (runtimeEnvironment.cookies.length)
    args.push('--env', 'PROBE_ENVIRONMENT_COOKIES');
  if (runtimeEnvironment.headers.length)
    args.push('--env', 'PROBE_ENVIRONMENT_HEADERS');
  if (
    runtimeEnvironment.secretNames.length ||
    runtimeEnvironment.cookies.length ||
    runtimeEnvironment.headers.length
  )
    args.push('--env', 'PROBE_SECRET_NAMES');
  for (const name of Object.keys(runtimeEnvironment.values).sort()) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
      throw new Error(`Invalid environment variable: ${name}`);
    args.push('--env', name);
  }
  args.push(
    '--entrypoint=node',
    payload.settings.containerImage,
    '/workspace/browser-authoring.mjs',
  );
  return { args, containerName };
}

export async function startAuthoringBrowser(
  payload: AuthoringRuntimePayload,
  runtimeEnvironment: RuntimeEnvironment,
) {
  const workspace = await mkdtemp(join(tmpdir(), 'probe-browser-authoring-'));
  await mkdir(workspace, { recursive: true });
  const runtimePath = join(workspace, 'browser-authoring.mjs');
  await writeFile(runtimePath, runtimeSource, { mode: 0o600 });
  const { args, containerName } = buildAuthoringDockerArgs(
    payload,
    runtimePath,
    runtimeEnvironment,
  );
  const child = spawn('docker', args, {
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
      ...(runtimeEnvironment.headers.length
        ? {
            PROBE_ENVIRONMENT_HEADERS: JSON.stringify(
              runtimeEnvironment.headers,
            ),
          }
        : {}),
      ...(runtimeEnvironment.secretNames.length ||
      runtimeEnvironment.cookies.length ||
      runtimeEnvironment.headers.length
        ? { PROBE_SECRET_NAMES: JSON.stringify(runtimeEnvironment.secretNames) }
        : {}),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  type RuntimeToolResult = Omit<BrowserToolResult, 'call'>;
  const pending: Array<{
    resolve(value: RuntimeToolResult): void;
    reject(error: Error): void;
  }> = [];
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk;
    for (;;) {
      const newline = stdout.indexOf('\n');
      if (newline < 0) break;
      const line = stdout.slice(0, newline);
      stdout = stdout.slice(newline + 1);
      const next = pending.shift();
      if (!next) continue;
      try {
        next.resolve(JSON.parse(line));
      } catch {
        next.reject(new Error('Browser returned invalid semantic state'));
      }
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderr = (stderr + chunk).slice(-2000);
  });
  child.once('exit', (code) => {
    const error = new Error(`Browser container exited (${code}): ${stderr}`);
    for (let next = pending.shift(); next; next = pending.shift()) {
      next.reject(error);
    }
  });
  const execute = async (call: BrowserToolCall) => {
    if (child.exitCode !== null) {
      throw new Error(
        `Browser container is not running (exit ${child.exitCode}): ${stderr}`,
      );
    }
    const response = new Promise<RuntimeToolResult>(
      (resolveResponse, rejectResponse) =>
        pending.push({ resolve: resolveResponse, reject: rejectResponse }),
    );
    child.stdin.write(`${JSON.stringify(call)}\n`);
    return response;
  };
  const close = async () => {
    child.stdin.end();
    if (child.exitCode === null) {
      await Promise.race([
        new Promise((resolveExit) => child.once('exit', resolveExit)),
        new Promise((resolveTimeout) => setTimeout(resolveTimeout, 3000)),
      ]);
    }
    if (child.exitCode === null) {
      await new Promise<void>((resolveStop) => {
        const stop = spawn('docker', ['stop', '--time=2', containerName]);
        stop.once('exit', () => resolveStop());
      });
    }
    await rm(workspace, { recursive: true, force: true });
  };
  return { execute, close };
}
