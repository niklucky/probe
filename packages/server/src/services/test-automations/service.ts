import { AiProviderError, sanitizeProviderMessage } from '@probe/ai';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '@probe/shared/errors/app-error';
import type { GenerateTestAutomationInput } from '@probe/shared/schemas/test-automations';
import { extractEnvironmentVariableReferencesFromValue } from '@probe/shared/schemas/environments';
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

export interface AutomationEnvironmentValidation {
  allowed: Iterable<string>;
  required?: Iterable<string>;
}

export function extractAutomationEnvironmentReferences(source: string) {
  const sourceFile = ts.createSourceFile(
    'automation.spec.ts',
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );
  const references = new Set<string>();
  let hasDynamicReference = false;
  const isProcessEnv = (node: ts.Node) =>
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'process' &&
    node.name.text === 'env';
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAccessExpression(node) && isProcessEnv(node.expression)) {
      references.add(node.name.text);
    } else if (
      ts.isElementAccessExpression(node) &&
      isProcessEnv(node.expression)
    ) {
      const argument = node.argumentExpression;
      if (argument && ts.isStringLiteralLike(argument)) {
        references.add(argument.text);
      } else {
        hasDynamicReference = true;
      }
    } else if (isProcessEnv(node)) {
      const parent = node.parent;
      if (!(
        (ts.isPropertyAccessExpression(parent) ||
          ts.isElementAccessExpression(parent)) &&
        parent.expression === node
      )) {
        hasDynamicReference = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { references: [...references], hasDynamicReference };
}

export async function validateAndFormatAutomationSource(
  source: string,
  environment?: AutomationEnvironmentValidation,
) {
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

  if (environment) {
    const { references, hasDynamicReference } =
      extractAutomationEnvironmentReferences(cleaned);
    if (hasDynamicReference) {
      throw new BadRequestError(
        'Automation source must use static process.env.NAME or process.env["NAME"] references',
      );
    }
    const allowed = new Set([...environment.allowed, 'BASE_URL']);
    const unknown = references.filter((name) => !allowed.has(name));
    if (unknown.length) {
      throw new BadRequestError(
        `Automation references variables missing from the selected environment: ${unknown.join(', ')}`,
      );
    }
    const referenced = new Set(references);
    const missing = [...(environment.required ?? [])].filter(
      (name) => !referenced.has(name),
    );
    if (missing.length) {
      throw new BadRequestError(
        `Automation does not reference required manual-test variables: ${missing.join(', ')}`,
      );
    }
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

      const specification = {
        title: sourceVersion.title,
        description: sourceVersion.description,
        prerequisites: sourceVersion.prerequisites,
        steps: sourceVersion.steps,
        expectedResult: sourceVersion.expectedResult,
        tags: sourceVersion.tags,
      };
      const requiredVariables =
        extractEnvironmentVariableReferencesFromValue(specification);
      const variableMetadata = await environments.listVariableMetadata(
        environment.id,
        userId,
      );
      const availableVariables = new Set(
        variableMetadata.map(({ key }) => key),
      );
      const missingVariables = requiredVariables.filter(
        (key) => !availableVariables.has(key),
      );
      if (missingVariables.length) {
        throw new BadRequestError(
          `Manual test references variables missing from the selected environment: ${missingVariables.join(', ')}`,
        );
      }
      const referencedMetadata = requiredVariables.map((key) => {
        const { description, isSecret } = variableMetadata.find(
          (variable) => variable.key === key,
        )!;
        return { key, description, isSecret };
      });

      try {
        const { adapter, connectionRef } = await aiConnections.getAdapter(
          'test-authoring',
          input.connectionId,
        );
        const result = await adapter.generateStructured<{
          source: string;
        }>({
          system: automationSystemPrompt,
          prompt: automationPrompt(
            specification,
            environment,
            referencedMetadata,
          ),
          schema: automationSourceJsonSchema,
          schemaName: 'playwright_typescript_automation',
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
          { allowed: availableVariables, required: requiredVariables },
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
      const variableMetadata = await environments.listVariableMetadata(
        automation.environmentId,
        userId,
      );
      const requiredVariables = extractEnvironmentVariableReferencesFromValue({
        title: automation.sourceTestCaseVersion.title,
        description: automation.sourceTestCaseVersion.description,
        prerequisites: automation.sourceTestCaseVersion.prerequisites,
        steps: automation.sourceTestCaseVersion.steps,
        expectedResult: automation.sourceTestCaseVersion.expectedResult,
        tags: automation.sourceTestCaseVersion.tags,
      });
      const formatted = await validateAndFormatAutomationSource(source, {
        allowed: variableMetadata.map(({ key }) => key),
        required: requiredVariables,
      });
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
