import { AiProviderError, sanitizeProviderMessage } from '@probe/ai';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '@probe/shared/errors/app-error';
import type { GenerateTestAutomationInput } from '@probe/shared/schemas/test-automations';
import { format } from 'prettier';
import ts from 'typescript';
import type { TestAutomationRepository } from '../../repositories/test-automations/repository';
import type { AuthorizationService } from '../authorization/service';
import type { AiConnectionService } from '../ai-connections/service';
import type { EnvironmentService } from '../environments/service';
import {
  automationPrompt,
  automationSourceJsonSchema,
  automationSystemPrompt,
  TEST_AUTOMATION_PROMPT_VERSION,
} from './prompts';

const SOURCE_SECRET_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/-]{8,}=*/i,
  /\bsk-[A-Za-z0-9_-]{8,}\b/i,
  /\b(?:password|secret|api[-_]?key|access[-_]?token|cookie)\b\s*[:=]\s*['"`](?!\s*(?:process\.env|\$\{))[^'"`]{4,}['"`]/i,
];

function cleanGeneratedSource(source: string) {
  return source
    .trim()
    .replace(/^```(?:typescript|ts)?\s*/i, '')
    .replace(/\s*```$/, '');
}

export async function validateAndFormatAutomationSource(source: string) {
  const cleaned = cleanGeneratedSource(source);
  if (!cleaned) throw new BadRequestError('Generated source is empty');
  if (SOURCE_SECRET_PATTERNS.some((pattern) => pattern.test(cleaned))) {
    throw new BadRequestError(
      'Automation source contains a likely embedded secret; use a named environment variable placeholder',
    );
  }

  const result = ts.transpileModule(cleaned, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      strict: true,
    },
    fileName: 'automation.spec.ts',
    reportDiagnostics: true,
  });
  const syntaxErrors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (syntaxErrors.length) {
    const message = ts.flattenDiagnosticMessageText(
      syntaxErrors[0]?.messageText ?? 'Invalid TypeScript',
      '\n',
    );
    throw new BadRequestError(`Invalid TypeScript: ${message}`);
  }

  return format(cleaned, {
    parser: 'typescript',
    singleQuote: true,
    trailingComma: 'all',
  });
}

function publicAutomation<
  T extends {
    sourceTestCaseVersionId: number;
    testCase?: { currentVersionId: number | null };
    environment?: { name: string };
    sourceTestCaseVersion?: { versionNumber: number };
  },
>(automation: T) {
  return {
    ...automation,
    stale:
      automation.testCase?.currentVersionId !==
      automation.sourceTestCaseVersionId,
    environmentName: automation.environment?.name ?? '',
    sourceVersionNumber: automation.sourceTestCaseVersion?.versionNumber ?? 0,
  };
}

export function createTestAutomationService(
  repository: TestAutomationRepository,
  authorization: AuthorizationService,
  aiConnections: AiConnectionService,
  environments: EnvironmentService,
) {
  return {
    async generate(input: GenerateTestAutomationInput, userId: number) {
      const access = await authorization.require(
        userId,
        { type: 'case', id: input.testCaseId },
        'author',
      );
      const testCase = await repository.findTestCase(input.testCaseId);
      const sourceVersion = await repository.findTestCaseVersion(
        input.sourceTestCaseVersionId,
      );
      if (
        !testCase ||
        !sourceVersion ||
        sourceVersion.testCaseId !== testCase.id
      ) {
        throw new NotFoundError('Accepted test-case version not found');
      }
      if (sourceVersion.status !== 'ready') {
        throw new ConflictError(
          'Only a ready test-case version can be automated',
        );
      }

      const environment = await environments.get(input.environmentId, userId);
      if (
        environment.projectId !== access.projectId ||
        (environment.productId &&
          environment.productId !== testCase.suite.productId)
      ) {
        throw new NotFoundError('Environment not found');
      }

      try {
        const { adapter, connectionRef } = await aiConnections.getAdapter(
          'test-authoring',
          input.connectionId,
        );
        const result = await adapter.generateStructured<{
          source: string;
        }>({
          system: automationSystemPrompt,
          prompt: automationPrompt(sourceVersion, environment),
          schema: automationSourceJsonSchema,
          schemaName: 'playwright_typescript_automation',
          temperature: 0.1,
        });
        if (
          !result.value ||
          typeof result.value !== 'object' ||
          typeof result.value.source !== 'string'
        ) {
          throw new BadRequestError(
            'AI provider returned an invalid automation proposal',
          );
        }
        const source = await validateAndFormatAutomationSource(
          result.value.source,
        );
        const automation = await repository.withTransaction(
          async (transactionRepository) => {
            const versionNumber = await transactionRepository.nextVersion(
              testCase.id,
            );
            return transactionRepository.create({
              testCaseId: testCase.id,
              sourceTestCaseVersionId: sourceVersion.id,
              environmentId: environment.id,
              versionNumber,
              framework: 'playwright',
              language: 'typescript',
              status: 'generated',
              source,
              connectionRef,
              provider: result.provider,
              model: result.model,
              promptVersion: TEST_AUTOMATION_PROMPT_VERSION,
              latencyMs: result.latencyMs,
              inputTokens: result.usage?.inputTokens ?? null,
              outputTokens: result.usage?.outputTokens ?? null,
              totalTokens: result.usage?.totalTokens ?? null,
              createdById: userId,
            });
          },
        );
        return publicAutomation({
          ...automation,
          testCase,
          environment,
          sourceTestCaseVersion: sourceVersion,
        });
      } catch (error) {
        if (
          error instanceof BadRequestError ||
          error instanceof ConflictError ||
          error instanceof NotFoundError
        ) {
          throw error;
        }
        if (error instanceof AiProviderError) {
          throw new BadRequestError(sanitizeProviderMessage(error));
        }
        throw error;
      }
    },

    async list(testCaseId: number, userId: number) {
      await authorization.require(
        userId,
        { type: 'case', id: testCaseId },
        'read',
      );
      const testCase = await repository.findTestCase(testCaseId);
      if (!testCase) throw new NotFoundError('Test case not found');
      return (await repository.list(testCaseId)).map((automation) =>
        publicAutomation({ ...automation, testCase }),
      );
    },

    async accept(id: number, source: string, userId: number) {
      const automation = await repository.find(id);
      if (!automation) throw new NotFoundError('Automation proposal not found');
      await authorization.require(
        userId,
        { type: 'case', id: automation.testCaseId },
        'author',
      );
      if (automation.status !== 'generated') {
        throw new ConflictError('Automation proposal is no longer available');
      }
      const formatted = await validateAndFormatAutomationSource(source);
      const accepted = await repository.accept(id, formatted, userId);
      return publicAutomation({
        ...accepted,
        testCase: automation.testCase,
        environment: automation.environment,
        sourceTestCaseVersion: automation.sourceTestCaseVersion,
      });
    },

    async discard(id: number, userId: number) {
      const automation = await repository.find(id);
      if (!automation) throw new NotFoundError('Automation proposal not found');
      await authorization.require(
        userId,
        { type: 'case', id: automation.testCaseId },
        'author',
      );
      if (automation.status !== 'generated') {
        throw new ConflictError('Automation proposal is no longer available');
      }
      await repository.discard(id);
      return { success: true as const };
    },
  };
}

export type TestAutomationService = ReturnType<
  typeof createTestAutomationService
>;
