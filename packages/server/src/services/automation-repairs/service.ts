import { createHash } from 'node:crypto';
import { AiProviderError, sanitizeProviderMessage } from '@probe/ai';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '@probe/shared/errors/app-error';
import type { RequestAutomationRepairInput } from '@probe/shared/schemas/automation-repairs';
import type { AutomationRepairRepository } from '../../repositories/automation-repairs/repository';
import type { AiConnectionService } from '../ai-connections/service';
import type { AuthorizationService } from '../authorization/service';
import type { RunnerDefaults } from '../automation-executions/service';
import { validateAndFormatAutomationSource } from '../test-automations/service';
import {
  AUTOMATION_REPAIR_PROMPT_VERSION,
  automationRepairJsonSchema,
  automationRepairPrompt,
  automationRepairSystemPrompt,
} from './prompts';

const TERMINAL_EXECUTIONS = new Set([
  'passed',
  'failed',
  'timed_out',
  'cancelled',
  'infrastructure_error',
]);

export type RepairClassification =
  'automation' | 'product' | 'timeout' | 'infrastructure' | 'unknown';

export function classifyRepairFailure(job: {
  status: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  structuredLogs?: Array<{ message: string }>;
}): { classification: RepairClassification; diagnosis: string } {
  if (job.status === 'infrastructure_error') {
    return {
      classification: 'infrastructure',
      diagnosis:
        'The runner reported an infrastructure failure; changing test code is not an appropriate repair.',
    };
  }
  const text = [
    job.errorCode,
    job.errorMessage,
    ...(job.structuredLogs ?? []).map(({ message }) => message),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
  if (job.status === 'timed_out' || /\b(test|execution) timeout\b/.test(text)) {
    return {
      classification: 'timeout',
      diagnosis:
        'The run exceeded its time budget without specific evidence of a repairable locator failure.',
    };
  }
  if (
    /locator|selector|strict mode violation|element (?:was )?not found|no node found|getby(?:role|text|label|testid)|waiting for .* element/.test(
      text,
    )
  ) {
    return {
      classification: 'automation',
      diagnosis:
        'The failure is likely in Playwright locator or automation code and is eligible for a bounded repair attempt.',
    };
  }
  if (
    /expected .* received|expect\(|assertion|http (?:status )?5\d\d|internal server error|application error|uncaught exception/.test(
      text,
    )
  ) {
    return {
      classification: 'product',
      diagnosis:
        'The evidence is more consistent with an application behavior or assertion failure; Probe will not rewrite the test to hide it.',
    };
  }
  return {
    classification: 'unknown',
    diagnosis:
      'There is not enough evidence to safely attribute this failure to automation code.',
  };
}

const SECRET_ASSIGNMENT =
  /\b(password|secret|api[-_]?key|access[-_]?token|refresh[-_]?token|cookie|authorization)\b\s*[:=]\s*([^\s,;]+)/gi;

export function redactRepairText(value: string, maxLength = 30_000) {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{4,}=*/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{4,}\b/gi, '[REDACTED]')
    .replace(SECRET_ASSIGNMENT, '$1=[REDACTED]')
    .replace(
      /([?&](?:token|key|secret|password|signature)=)[^&#\s]+/gi,
      '$1[REDACTED]',
    )
    .slice(0, maxLength);
}

function sanitizeEvidenceValue(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[TRUNCATED]';
  if (typeof value === 'string') return redactRepairText(value, 4_000);
  if (Array.isArray(value)) {
    return value
      .slice(0, 100)
      .map((item) => sanitizeEvidenceValue(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 100)
        .map(([key, item]) => [
          key,
          /password|secret|token|cookie|authorization|api[-_]?key/i.test(key)
            ? '[REDACTED]'
            : sanitizeEvidenceValue(item, depth + 1),
        ]),
    );
  }
  return value;
}

export function buildRepairEvidence(execution: {
  id: number;
  errorCode: string | null;
  errorMessage: string | null;
  structuredLogs: Array<{ at: string; level: string; message: string }>;
  artifacts: Array<{
    id: number;
    kind: string;
    originalName: string;
    mimeType: string;
    size: number;
  }>;
  environment: { id: number; name: string; baseUrl: string };
  automation: {
    id: number;
    source: string;
    sourceTestCaseVersion: Record<string, unknown>;
  };
}) {
  const logs = execution.structuredLogs.slice(-100).map((entry) => ({
    ...entry,
    message: redactRepairText(entry.message, 2_000),
  }));
  const pageStructure = logs
    .filter(({ message }) =>
      /aria|role=|locator|selector|dom|page structure/i.test(message),
    )
    .map(({ message }) => message)
    .join('\n')
    .slice(0, 8_000);
  return {
    sourceExecutionId: execution.id,
    sourceAutomationId: execution.automation.id,
    automationSource: redactRepairText(execution.automation.source, 500_000),
    manualTestSpecification: sanitizeEvidenceValue(
      execution.automation.sourceTestCaseVersion,
    ),
    environment: {
      id: execution.environment.id,
      name: execution.environment.name,
      baseUrl: new URL(execution.environment.baseUrl).origin,
    },
    playwrightError: redactRepairText(
      [execution.errorCode, execution.errorMessage].filter(Boolean).join(': '),
      4_000,
    ),
    logs,
    pageStructure,
    artifacts: execution.artifacts.map(
      ({ id, kind, originalName, mimeType, size }) => ({
        id,
        kind,
        originalName: redactRepairText(originalName, 500),
        mimeType,
        size,
      }),
    ),
  };
}

export function sourceDiff(before: string, after: string) {
  const left = before.split('\n');
  const right = after.split('\n');
  let prefix = 0;
  while (
    prefix < left.length &&
    prefix < right.length &&
    left[prefix] === right[prefix]
  )
    prefix++;
  let suffix = 0;
  while (
    suffix < left.length - prefix &&
    suffix < right.length - prefix &&
    left[left.length - 1 - suffix] === right[right.length - 1 - suffix]
  )
    suffix++;
  const removed = left.slice(prefix, left.length - suffix);
  const added = right.slice(prefix, right.length - suffix);
  return [
    '--- accepted-or-previous.spec.ts',
    '+++ repair-candidate.spec.ts',
    `@@ -${prefix + 1},${removed.length} +${prefix + 1},${added.length} @@`,
    ...removed.map((line) => `-${line}`),
    ...added.map((line) => `+${line}`),
  ].join('\n');
}

function fingerprint(source: string) {
  return createHash('sha256').update(source).digest('hex');
}

export function createAutomationRepairService(
  repository: AutomationRepairRepository,
  authorization: AuthorizationService,
  aiConnections: AiConnectionService,
  runner: RunnerDefaults,
) {
  async function syncSession(id: number) {
    const session = await repository.findSession(id);
    if (!session) return undefined;
    const latest = session.attempts[session.attempts.length - 1];
    const job = latest?.executionJob;
    if (
      !latest ||
      latest.status !== 'running' ||
      !job ||
      !TERMINAL_EXECUTIONS.has(job.status)
    ) {
      return session;
    }
    if (job.status === 'passed') {
      await repository.updateAttemptStatus(latest.id, 'passed');
      await repository.updateSession(id, {
        status: 'succeeded',
        stopReason: 'Repair candidate passed. Promotion remains explicit.',
        completedAt: new Date(),
      });
    } else {
      await repository.updateAttemptStatus(latest.id, 'failed');
      await repository.updateSession(id, { status: 'active' });
    }
    return repository.findSession(id);
  }

  function queueValues(
    session: NonNullable<Awaited<ReturnType<typeof repository.findSession>>>,
    userId: number,
  ) {
    return {
      projectId: session.projectId,
      environmentId: session.sourceExecution.environmentId,
      requestedById: userId,
      timeoutSeconds: session.sourceExecution.timeoutSeconds,
      settings: {
        browser: 'chromium' as const,
        captureVideo: session.sourceExecution.settings.captureVideo,
        runnerVersion: runner.version,
        containerImage: runner.containerImage,
        cpuLimit: runner.cpuLimit,
        memoryMb: runner.memoryMb,
        processLimit: runner.processLimit,
        artifactLimitMb: runner.artifactLimitMb,
        networkPolicy: runner.networkPolicy,
      },
    };
  }

  async function generateAttempt(sessionId: number, userId: number) {
    let session = await syncSession(sessionId);
    if (!session) throw new NotFoundError('Repair session not found');
    await authorization.requireProject(userId, session.projectId, 'execute');
    if (session.status !== 'active') {
      throw new ConflictError('Repair session has already stopped');
    }
    const elapsed = Date.now() - session.createdAt.getTime();
    if (
      session.attempts.length >= session.maxAttempts ||
      elapsed >= session.maxDurationMs
    ) {
      await repository.updateSession(session.id, {
        status: 'stopped',
        stopReason:
          session.attempts.length >= session.maxAttempts
            ? 'Attempt budget exhausted'
            : 'Time budget exhausted',
        completedAt: new Date(),
      });
      throw new ConflictError('Repair budget exhausted');
    }
    if (!(await repository.claimGeneration(session.id))) {
      throw new ConflictError('Repair session is already being processed');
    }
    session = (await repository.findSession(session.id))!;
    const latestAttempt = session.attempts[session.attempts.length - 1];
    const previous =
      latestAttempt?.candidateAutomation ?? session.sourceAutomation;
    const evidenceExecution = await repository.findExecution(
      latestAttempt?.executionJobId ?? session.sourceExecutionId,
    );
    if (!evidenceExecution) {
      await repository.updateSession(session.id, { status: 'active' });
      throw new NotFoundError('Repair evidence not found');
    }
    const evidence = buildRepairEvidence(
      evidenceExecution as Parameters<typeof buildRepairEvidence>[0],
    );
    try {
      const { adapter, connectionRef } = await aiConnections.getAdapter(
        'test-execution',
        session.connectionRef === null
          ? undefined
          : /^\d+$/.test(session.connectionRef)
            ? Number(session.connectionRef)
            : session.connectionRef,
      );
      const result = await adapter.generateStructured<{
        source: string;
        explanation: string;
      }>({
        system: automationRepairSystemPrompt,
        prompt: automationRepairPrompt(evidence),
        schema: automationRepairJsonSchema,
        schemaName: 'playwright_automation_repair',
      });
      if (
        !result.value ||
        typeof result.value.source !== 'string' ||
        typeof result.value.explanation !== 'string'
      ) {
        throw new BadRequestError(
          'AI provider returned an invalid repair proposal',
        );
      }
      const totalTokens = result.usage?.totalTokens ?? 0;
      const usedTokens = session.usedTokens + totalTokens;
      const tokenExhausted = usedTokens > session.maxTotalTokens;
      const durationExhausted =
        Date.now() - session.createdAt.getTime() >= session.maxDurationMs;
      let source: string;
      let validationError: string | null = null;
      try {
        source = await validateAndFormatAutomationSource(result.value.source);
      } catch (error) {
        source =
          result.value.source.trim() || '// Invalid empty repair candidate';
        validationError =
          error instanceof Error
            ? error.message.slice(0, 500)
            : 'Candidate validation failed';
      }
      const changeFingerprint = fingerprint(source);
      const repeated = session.attempts.some(
        (attempt) => attempt.changeFingerprint === changeFingerprint,
      );
      const ineffective = fingerprint(previous.source) === changeFingerprint;
      const rejected = Boolean(
        validationError ||
        repeated ||
        ineffective ||
        tokenExhausted ||
        durationExhausted,
      );
      const created = await repository.createAttempt(
        session.id,
        {
          testCaseId: previous.testCaseId,
          sourceTestCaseVersionId: previous.sourceTestCaseVersionId,
          environmentId: previous.environmentId,
          framework: 'playwright',
          language: 'typescript',
          status: validationError ? 'failed' : 'generated',
          source,
          connectionRef,
          provider: result.provider,
          model: result.model,
          promptVersion: AUTOMATION_REPAIR_PROMPT_VERSION,
          latencyMs: result.latencyMs,
          inputTokens: result.usage?.inputTokens ?? null,
          outputTokens: result.usage?.outputTokens ?? null,
          totalTokens: result.usage?.totalTokens ?? null,
          validationError,
          createdById: userId,
        },
        {
          status: rejected ? 'rejected' : 'generated',
          explanation: redactRepairText(result.value.explanation, 4_000),
          sourceDiff: sourceDiff(previous.source, source),
          changeFingerprint,
          evidenceSnapshot: evidence,
          provider: result.provider,
          model: result.model,
          promptVersion: AUTOMATION_REPAIR_PROMPT_VERSION,
          latencyMs: result.latencyMs,
          inputTokens: result.usage?.inputTokens ?? null,
          outputTokens: result.usage?.outputTokens ?? null,
          totalTokens: result.usage?.totalTokens ?? null,
        },
        usedTokens,
        rejected
          ? 'active'
          : session.mode === 'review'
            ? 'awaiting_review'
            : 'active',
      );
      if (!created)
        throw new ConflictError('Repair session is no longer available');
      if (rejected || validationError) {
        await repository.updateSession(session.id, {
          status: 'stopped',
          stopReason: tokenExhausted
            ? 'Token budget exhausted'
            : durationExhausted
              ? 'Time budget exhausted'
              : repeated
                ? 'Repeated equivalent change'
                : ineffective
                  ? 'Ineffective equivalent change'
                  : `Candidate validation failed: ${validationError}`,
          completedAt: new Date(),
        });
      } else if (session.mode === 'automatic') {
        await repository.queueAttempt(
          session.id,
          created.attempt.id,
          queueValues(session, userId),
        );
      }
      return (await repository.findSession(session.id))!;
    } catch (error) {
      if (error instanceof ConflictError) throw error;
      if (error instanceof BadRequestError) {
        await repository.updateSession(session.id, {
          status: 'stopped',
          stopReason: `Candidate validation failed: ${error.message}`,
          completedAt: new Date(),
        });
        throw error;
      }
      await repository.updateSession(session.id, { status: 'active' });
      if (error instanceof NotFoundError) throw error;
      if (error instanceof AiProviderError)
        throw new BadRequestError(sanitizeProviderMessage(error));
      throw error;
    }
  }

  return {
    async request(input: RequestAutomationRepairInput, userId: number) {
      const execution = await repository.findExecution(input.executionId);
      if (!execution) throw new NotFoundError('Execution not found');
      await authorization.requireProject(
        userId,
        execution.projectId,
        'execute',
      );
      if (
        execution.status !== 'failed' &&
        execution.status !== 'timed_out' &&
        execution.status !== 'infrastructure_error'
      ) {
        throw new ConflictError(
          'Only a finished failed execution can be repaired',
        );
      }
      const diagnosis = classifyRepairFailure(execution);
      const session = await repository.createSession({
        projectId: execution.projectId,
        sourceExecutionId: execution.id,
        sourceAutomationId: execution.automationId,
        requestedById: userId,
        mode: input.mode,
        classification: diagnosis.classification,
        diagnosis: diagnosis.diagnosis,
        status:
          diagnosis.classification === 'automation' ? 'active' : 'stopped',
        connectionRef:
          input.connectionId === undefined ? null : String(input.connectionId),
        maxAttempts: input.limits.maxAttempts,
        maxTotalTokens: input.limits.maxTotalTokens,
        maxDurationMs: input.limits.maxDurationSeconds * 1000,
        promptVersion: AUTOMATION_REPAIR_PROMPT_VERSION,
        stopReason:
          diagnosis.classification === 'automation'
            ? null
            : 'Failure classification is not safely repairable',
        completedAt:
          diagnosis.classification === 'automation' ? null : new Date(),
      });
      return diagnosis.classification === 'automation'
        ? generateAttempt(session.id, userId)
        : (await repository.findSession(session.id))!;
    },
    async continue(id: number, userId: number) {
      return generateAttempt(id, userId);
    },
    async execute(sessionId: number, attemptId: number, userId: number) {
      const session = await syncSession(sessionId);
      if (!session) throw new NotFoundError('Repair session not found');
      await authorization.requireProject(userId, session.projectId, 'execute');
      if (session.status !== 'awaiting_review')
        throw new ConflictError('Repair candidate is not awaiting review');
      const job = await repository.queueAttempt(
        sessionId,
        attemptId,
        queueValues(session, userId),
      );
      if (!job)
        throw new ConflictError('Repair candidate has already been executed');
      return job;
    },
    async get(id: number, userId: number) {
      const session = await syncSession(id);
      if (!session) throw new NotFoundError('Repair session not found');
      await authorization.requireProject(userId, session.projectId, 'read');
      return session;
    },
    async list(executionId: number, userId: number) {
      const execution = await repository.findExecution(executionId);
      if (!execution) throw new NotFoundError('Execution not found');
      await authorization.requireProject(userId, execution.projectId, 'read');
      const sessions = await repository.list(executionId);
      return Promise.all(sessions.map((session) => syncSession(session.id)));
    },
    async processPending() {
      const pending = await repository.listPendingAutomatic();
      for (const item of pending) {
        try {
          const session = await syncSession(item.id);
          if (session?.status === 'active') {
            await generateAttempt(session.id, item.requestedById);
          }
        } catch (error) {
          // A concurrent coordinator may have claimed the session. Other
          // failures remain visible on the durable session and API logs.
          if (!(error instanceof ConflictError))
            console.error('Automatic repair coordinator failed', error);
        }
      }
    },
  };
}

export type AutomationRepairService = ReturnType<
  typeof createAutomationRepairService
>;
