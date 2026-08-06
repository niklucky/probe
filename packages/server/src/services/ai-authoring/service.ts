import {
  AiProviderError,
  sanitizeProviderMessage,
  type StructuredGenerationResult,
} from '@probe/ai';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '@probe/shared/errors/app-error';
import type { RequestAiTestCaseProposalInput } from '@probe/shared/schemas/ai-authoring';
import {
  testSpecSchema,
  type TestSpec,
} from '@probe/shared/schemas/test-cases';
import type { AiAuthoringRepository } from '../../repositories/ai-authoring/repository';
import type { AuthorizationService } from '../authorization/service';
import type { AiConnectionService } from '../ai-connections/service';
import type { TestCaseService } from '../test-cases/service';
import type { EnvironmentService } from '../environments/service';
import {
  authoringSystemPrompt,
  generationPrompt,
  improvementPrompt,
  repairPrompt,
  TEST_CASE_PROMPT_VERSION,
  testSpecJsonSchema,
} from './prompts';

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/-]{8,}=*/gi, 'Bearer [REDACTED]'],
  [
    /\b(authorization|api[-_ ]?key|access[-_ ]?token|password|secret|cookie)\b\s*[:=]\s*[^\s,;]+/gi,
    '$1=[REDACTED]',
  ],
  [/\bsk-[A-Za-z0-9_-]{8,}\b/gi, '[REDACTED]'],
];

export function sanitizeAuthoringText(value: string) {
  return SECRET_PATTERNS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  );
}

function sanitizeSnapshot<T>(value: T): T {
  if (typeof value === 'string') {
    return sanitizeAuthoringText(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeSnapshot) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeSnapshot(item)]),
    ) as T;
  }
  return value;
}

function validationIssues(error: {
  issues: Array<{ path: Array<string | number>; message: string }>;
}) {
  return error.issues.map(
    (issue) => `${issue.path.join('.') || 'response'}: ${issue.message}`,
  );
}

function providerFailure(error: unknown) {
  if (error instanceof AiProviderError) {
    return {
      code: error.code,
      message: sanitizeProviderMessage(error),
    };
  }
  return {
    code: 'AUTHORING_FAILED',
    message: sanitizeProviderMessage(error),
  };
}

export function createAiAuthoringService(
  repository: AiAuthoringRepository,
  authorization: AuthorizationService,
  aiConnections: AiConnectionService,
  testCases: TestCaseService,
  environments: EnvironmentService,
) {
  async function generateValidated(
    adapter: Awaited<ReturnType<AiConnectionService['getAdapter']>>['adapter'],
    prompt: string,
  ): Promise<StructuredGenerationResult<TestSpec>> {
    let first: StructuredGenerationResult<unknown>;
    try {
      first = await adapter.generateStructured({
        system: authoringSystemPrompt,
        prompt,
        schema: testSpecJsonSchema,
        schemaName: 'test_case',
      });
    } catch (error) {
      if (
        !(error instanceof AiProviderError) ||
        error.code !== 'INVALID_RESPONSE' ||
        !error.structuredOutput
      ) {
        throw error;
      }
      const repaired = await adapter.generateStructured({
        system: authoringSystemPrompt,
        prompt: repairPrompt(sanitizeAuthoringText(error.structuredOutput), [
          'response: invalid JSON',
        ]),
        schema: testSpecJsonSchema,
        schemaName: 'test_case_repair',
      });
      const parsedRepair = testSpecSchema.safeParse(repaired.value);
      if (!parsedRepair.success) {
        throw new AiProviderError(
          'INVALID_RESPONSE',
          'AI provider could not produce a valid test case after one repair attempt',
        );
      }
      return { ...repaired, value: parsedRepair.data };
    }

    const parsed = testSpecSchema.safeParse(first.value);
    if (parsed.success) return { ...first, value: parsed.data };

    const repaired = await adapter.generateStructured({
      system: authoringSystemPrompt,
      prompt: repairPrompt(
        sanitizeSnapshot(first.value),
        validationIssues(parsed.error),
      ),
      schema: testSpecJsonSchema,
      schemaName: 'test_case_repair',
    });
    const parsedRepair = testSpecSchema.safeParse(repaired.value);
    if (!parsedRepair.success) {
      throw new AiProviderError(
        'INVALID_RESPONSE',
        'AI provider could not produce a valid test case after one repair attempt',
      );
    }
    return {
      ...repaired,
      value: parsedRepair.data,
      latencyMs: first.latencyMs + repaired.latencyMs,
      usage:
        first.usage && repaired.usage
          ? {
              inputTokens: first.usage.inputTokens + repaired.usage.inputTokens,
              outputTokens:
                first.usage.outputTokens + repaired.usage.outputTokens,
              totalTokens: first.usage.totalTokens + repaired.usage.totalTokens,
            }
          : repaired.usage,
    };
  }

  return {
    async request(input: RequestAiTestCaseProposalInput, userId: number) {
      await authorization.require(
        userId,
        {
          type: input.operation === 'improve' ? 'case' : 'suite',
          id:
            input.operation === 'improve'
              ? (input.testCaseId as number)
              : input.suiteId,
        },
        'author',
      );

      const environment = input.environmentId
        ? await environments.get(input.environmentId, userId)
        : undefined;
      if (environment) {
        const suiteProductId = await repository.findSuiteProductId(
          input.suiteId,
        );
        if (environment.productId !== suiteProductId) {
          throw new NotFoundError('Environment not found');
        }
      }
      const environmentContext = environment
        ? {
            id: environment.id,
            name: environment.name,
            type: environment.type,
            baseUrl: environment.baseUrl,
          }
        : undefined;

      let currentSpec: TestSpec | undefined;
      if (input.operation === 'improve') {
        const current = await testCases.get(input.testCaseId!, userId);
        if (current.suiteId !== input.suiteId || !current.currentVersion) {
          throw new NotFoundError('Test case not found');
        }
        const version = current.currentVersion;
        currentSpec = testSpecSchema.parse({
          title: version.title,
          description: version.description ?? undefined,
          prerequisites: version.prerequisites,
          steps: version.steps,
          expectedResult: version.expectedResult,
          priority: version.priority,
          tags: version.tags,
        });
      }

      const safeDescription = input.description
        ? sanitizeAuthoringText(input.description)
        : undefined;
      const safeInstruction = input.instruction
        ? sanitizeAuthoringText(input.instruction)
        : undefined;
      const inputSnapshot = sanitizeSnapshot({
        description: safeDescription,
        instruction: safeInstruction,
        environment: environmentContext,
        currentSpec,
      });
      const job = await repository.create({
        operation: input.operation,
        suiteId: input.suiteId,
        testCaseId: input.testCaseId ?? null,
        connectionRef: input.connectionId ? String(input.connectionId) : null,
        promptVersion: TEST_CASE_PROMPT_VERSION,
        inputSnapshot,
        createdById: userId,
      });

      try {
        const { adapter, connectionRef } = await aiConnections.getAdapter(
          'test-authoring',
          input.connectionId,
        );
        const result = await generateValidated(
          adapter,
          input.operation === 'generate'
            ? generationPrompt(safeDescription!, environmentContext)
            : improvementPrompt(
                currentSpec!,
                safeInstruction,
                environmentContext,
              ),
        );
        const proposal = sanitizeSnapshot(result.value);
        const completed = await repository.complete(job.id, {
          connectionRef,
          provider: result.provider,
          model: result.model,
          outputSnapshot: proposal,
          latencyMs: result.latencyMs,
          inputTokens: result.usage?.inputTokens ?? null,
          outputTokens: result.usage?.outputTokens ?? null,
          totalTokens: result.usage?.totalTokens ?? null,
        });
        return { ...completed, proposal };
      } catch (error) {
        const failure = providerFailure(error);
        await repository.fail(job.id, failure.code, failure.message);
        throw new BadRequestError(failure.message);
      }
    },

    async accept(jobId: number, proposal: TestSpec, userId: number) {
      const job = await repository.find(jobId);
      if (!job) throw new NotFoundError('AI proposal not found');
      await authorization.require(
        userId,
        { type: 'suite', id: job.suiteId },
        'author',
      );
      if (job.status !== 'completed') {
        throw new ConflictError('AI proposal is no longer available');
      }

      const validated = testSpecSchema.parse(proposal);
      if (job.operation === 'generate') {
        const created = await testCases.create(
          { suiteId: job.suiteId, status: 'draft', ...validated },
          userId,
        );
        await repository.accept(job.id, userId);
        return {
          jobId: job.id,
          testCaseId: created.id,
          versionId: created.currentVersion.id,
        };
      }
      if (!job.testCaseId) {
        throw new ConflictError('AI proposal has no target test case');
      }
      const updated = await testCases.update(
        { id: job.testCaseId, ...validated },
        userId,
      );
      await repository.accept(job.id, userId);
      return {
        jobId: job.id,
        testCaseId: job.testCaseId,
        versionId: updated.newVersion.id,
      };
    },

    async discard(jobId: number, userId: number) {
      const job = await repository.find(jobId);
      if (!job) throw new NotFoundError('AI proposal not found');
      await authorization.require(
        userId,
        { type: 'suite', id: job.suiteId },
        'author',
      );
      if (job.status !== 'completed') {
        throw new ConflictError('AI proposal is no longer available');
      }
      await repository.discard(jobId);
      return { success: true as const };
    },
  };
}

export type AiAuthoringService = ReturnType<typeof createAiAuthoringService>;
