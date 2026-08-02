import { defineConfig } from '@playwright/test';

const baseURL = new URL(process.env.BASE_URL ?? '');
const hasSecrets = process.env.HAS_TEST_SECRETS === 'true';

export default defineConfig({
  testDir: '/workspace/tests',
  timeout: Number(process.env.JOB_TIMEOUT_MS ?? 300_000),
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  reporter: [['line']],
  outputDir: '/artifacts/results',
  use: {
    baseURL: baseURL.toString(),
    // Browser artifacts can contain DOM/input values. Suppress visual/trace
    // capture whenever runtime secrets are present rather than risk disclosure.
    trace: hasSecrets ? 'off' : 'retain-on-failure',
    screenshot: hasSecrets ? 'off' : 'only-on-failure',
    video:
      !hasSecrets && process.env.CAPTURE_VIDEO === 'on'
        ? 'retain-on-failure'
        : 'off',
  },
});
