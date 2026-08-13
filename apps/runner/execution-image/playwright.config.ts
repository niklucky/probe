import { defineConfig } from '@playwright/test';

const baseURL = new URL(process.env.BASE_URL ?? '');
const hasSecrets = process.env.HAS_TEST_SECRETS === 'true';
const captureDiagnostics = process.env.CAPTURE_DIAGNOSTICS === 'on';
const allowVisualArtifacts = !hasSecrets || captureDiagnostics;

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
    // capture with runtime secrets unless an author explicitly opts in.
    trace: allowVisualArtifacts ? 'retain-on-failure' : 'off',
    screenshot: allowVisualArtifacts ? 'only-on-failure' : 'off',
    video:
      allowVisualArtifacts && process.env.CAPTURE_VIDEO === 'on'
        ? 'retain-on-failure'
        : 'off',
  },
});
