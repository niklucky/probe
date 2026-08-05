import { describe, expect, test } from 'bun:test';
import { AppError } from '@probe/shared/errors/app-error';
import {
  createTestAutomationService,
  validateAndFormatAutomationSource,
} from './service';

const sourceVersion = {
  id: 12,
  testCaseId: 5,
  suiteVersionId: 2,
  versionNumber: 3,
  title: 'Sign in',
  description: 'A user signs in',
  prerequisites: ['A registered user {{username}} with {{password}}'],
  steps: [
    {
      action: 'Enter {{username}} and {{password}}, then submit',
      expectedResult: 'The dashboard opens',
    },
  ],
  expectedResult: 'The user is signed in',
  priority: 'high' as const,
  status: 'ready' as const,
  tags: ['auth'],
  createdById: 1,
  createdAt: new Date(),
};

const testCase = {
  id: 5,
  suiteId: 7,
  currentVersionId: 12,
  createdById: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  suite: {
    id: 7,
    productId: 9,
    product: { id: 9, projectId: 4 },
  },
};

const environment = {
  id: 8,
  projectId: 4,
  productId: 9,
  name: 'Staging',
  type: 'staging' as const,
  baseUrl: 'https://staging.example.test',
  isDefault: true,
  createdById: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const generatedSource = `
import { test, expect } from '@playwright/test';

test('sign in', async ({ page }) => {
  await page.goto('https://staging.example.test');
  await page.getByLabel('Email').fill(process.env.username ?? '');
  await page.getByLabel('Password').fill(process.env.password ?? '');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});
`;

function automation(overrides: Record<string, unknown> = {}) {
  return {
    id: 20,
    testCaseId: 5,
    sourceTestCaseVersionId: 12,
    environmentId: 8,
    versionNumber: 1,
    framework: 'playwright' as const,
    language: 'typescript' as const,
    status: 'generated' as const,
    source: generatedSource,
    connectionRef: 'env:local',
    provider: 'openai-compatible' as const,
    model: 'local-model',
    promptVersion: 'playwright-typescript-v1',
    latencyMs: 10,
    inputTokens: 10,
    outputTokens: 20,
    totalTokens: 30,
    validationError: null,
    createdById: 2,
    acceptedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    acceptedAt: null,
    ...overrides,
  };
}

describe('Playwright automation generation', () => {
  test('links generation to the exact accepted version and environment', async () => {
    const writes: Array<Record<string, unknown>> = [];
    const requests: Array<Record<string, unknown>> = [];
    const repository = {
      async findTestCase() {
        return testCase;
      },
      async findTestCaseVersion() {
        return sourceVersion;
      },
      async nextVersion() {
        return 2;
      },
      async create(values: Record<string, unknown>) {
        writes.push(values);
        return automation({ ...values, id: 21 });
      },
      async withTransaction(operation: (repo: unknown) => Promise<unknown>) {
        return operation(repository);
      },
    };
    const service = createTestAutomationService(
      repository as never,
      {
        async require() {
          return { projectId: 4, role: 'qa' };
        },
      } as never,
      {
        async getAdapter() {
          return {
            connectionRef: 'env:local',
            adapter: {
              async generateStructured(request: Record<string, unknown>) {
                requests.push(request);
                return {
                  value: { source: generatedSource },
                  provider: 'openai-compatible',
                  model: 'local-model',
                  latencyMs: 10,
                  usage: {
                    inputTokens: 10,
                    outputTokens: 20,
                    totalTokens: 30,
                  },
                };
              },
            },
          };
        },
      } as never,
      {
        async get() {
          return environment;
        },
        async listVariableMetadata() {
          return [
            {
              key: 'username',
              description: 'QA login',
              isSecret: false,
              value: 'must-not-reach-provider',
            },
            {
              key: 'password',
              description: 'QA password',
              isSecret: true,
              value: 'super-private-fixture',
            },
          ];
        },
      } as never,
    );

    const result = await service.generate(
      {
        testCaseId: 5,
        sourceTestCaseVersionId: 12,
        environmentId: 8,
      },
      2,
    );

    expect(writes[0]).toMatchObject({
      sourceTestCaseVersionId: 12,
      environmentId: 8,
      versionNumber: 2,
      framework: 'playwright',
      language: 'typescript',
    });
    expect(result.stale).toBe(false);
    expect(result.source).toContain('getByRole');
    expect(requests[0]).not.toHaveProperty('temperature');
    const prompt = String(requests[0]?.prompt);
    expect(prompt).toContain('{{username}} => process.env.username');
    expect(prompt).toContain('"isSecret":true');
    expect(prompt).not.toContain('must-not-reach-provider');
    expect(prompt).not.toContain('super-private-fixture');
  });

  test('marks automation stale when the current manual version changes', async () => {
    const service = createTestAutomationService(
      {
        async findTestCase() {
          return { ...testCase, currentVersionId: 13 };
        },
        async list() {
          return [
            {
              ...automation({ status: 'accepted' }),
              environment,
              sourceTestCaseVersion: sourceVersion,
            },
          ];
        },
      } as never,
      { async require() {} } as never,
      {} as never,
      {
        async listVariableMetadata() {
          return [
            { key: 'username', description: null, isSecret: false },
            { key: 'password', description: null, isSecret: true },
          ];
        },
      } as never,
    );

    const [result] = await service.list(5, 2);
    expect(result?.stale).toBe(true);
  });

  test('formats valid source and rejects syntax errors and embedded secrets', async () => {
    const formatted = await validateAndFormatAutomationSource(
      `test("works",async({page})=>{await expect(page).toHaveURL(/ok/)})`,
    );
    expect(formatted).toContain("test('works'");

    await expect(
      validateAndFormatAutomationSource(`test('broken', async () => {`),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      validateAndFormatAutomationSource(
        `const password = "super-secret-password";`,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(
      validateAndFormatAutomationSource(`console.log(process.env.unknown)`, {
        allowed: ['username'],
      }),
    ).rejects.toThrow('missing from the selected environment: unknown');
    await expect(
      validateAndFormatAutomationSource(`console.log(process.env[key])`, {
        allowed: ['username'],
      }),
    ).rejects.toThrow('static process.env');
    await expect(
      validateAndFormatAutomationSource(`console.log('no credentials')`, {
        allowed: ['username'],
        required: ['username'],
      }),
    ).rejects.toThrow('required manual-test variables: username');
  });

  test('prevents generation when a manual placeholder is missing', async () => {
    let providerCalled = false;
    const service = createTestAutomationService(
      {
        async findTestCase() {
          return testCase;
        },
        async findTestCaseVersion() {
          return sourceVersion;
        },
      } as never,
      {
        async require() {
          return { projectId: 4 };
        },
      } as never,
      {
        async getAdapter() {
          providerCalled = true;
        },
      } as never,
      {
        async get() {
          return environment;
        },
        async listVariableMetadata() {
          return [{ key: 'username', description: null, isSecret: false }];
        },
      } as never,
    );

    await expect(
      service.generate(
        {
          testCaseId: 5,
          sourceTestCaseVersionId: 12,
          environmentId: 8,
        },
        2,
      ),
    ).rejects.toThrow('missing from the selected environment: password');
    expect(providerCalled).toBe(false);
  });

  test('validates edited source again before acceptance', async () => {
    let accepted = false;
    const service = createTestAutomationService(
      {
        async find() {
          return {
            ...automation(),
            testCase,
            environment,
            sourceTestCaseVersion: sourceVersion,
          };
        },
        async accept() {
          accepted = true;
        },
      } as never,
      { async require() {} } as never,
      {} as never,
      {
        async listVariableMetadata() {
          return [
            { key: 'username', description: null, isSecret: false },
            { key: 'password', description: null, isSecret: true },
          ];
        },
      } as never,
    );

    await expect(
      service.accept(20, `const apiKey = "embedded-secret-value";`, 2),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(accepted).toBe(false);
  });

  test('checks author authorization before acceptance', async () => {
    let accepted = false;
    const service = createTestAutomationService(
      {
        async find() {
          return {
            ...automation(),
            testCase,
            environment,
            sourceTestCaseVersion: sourceVersion,
          };
        },
        async accept() {
          accepted = true;
        },
      } as never,
      {
        async require() {
          throw new AppError('NOT_FOUND', 'Resource not found');
        },
      } as never,
      {} as never,
      {} as never,
    );

    await expect(service.accept(20, generatedSource, 3)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(accepted).toBe(false);
  });
});
