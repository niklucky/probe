import {
  and,
  asc,
  automationExecutionArtifacts,
  automationExecutionJobs,
  browserAuthoringSessions,
  aiConnections,
  testAutomations,
  db,
  desc,
  environmentCookies,
  environmentHeaders,
  environmentProfileVariables,
  environmentProfileCookies,
  environmentProfileHeaders,
  environmentProfiles,
  environmentVariables,
  eq,
  inArray,
  lt,
  lte,
  sql,
} from '@probe/db';

type Database = typeof db;
type Status = typeof automationExecutionJobs.$inferSelect.status;

export function isCurrentEnvironmentProfileSnapshot(
  snapshot: {
    environmentId: number;
    environmentProfileRevision: number | null;
    startingState?: 'profile_authentication' | 'signed_out';
  },
  profile:
    | {
        environmentId: number;
        revision: number;
        enabled: boolean;
        isAnonymous?: boolean;
        authenticationStatus?: 'ready' | 'needs_verification' | 'expired';
      }
    | null
    | undefined,
) {
  return Boolean(
    profile?.enabled &&
    (snapshot.startingState !== 'profile_authentication' ||
      profile.isAnonymous ||
      profile.authenticationStatus === 'ready') &&
    profile.environmentId === snapshot.environmentId &&
    profile.revision === snapshot.environmentProfileRevision,
  );
}

export function staleRecoveryValues(job: {
  attempt: number;
  maxAttempts: number;
  claimedAt: Date | null;
  startedAt: Date | null;
}) {
  const terminal = job.attempt >= job.maxAttempts;
  return {
    status: terminal ? ('infrastructure_error' as const) : ('queued' as const),
    workerId: null,
    claimedAt: terminal ? job.claimedAt : null,
    startedAt: terminal ? job.startedAt : null,
    heartbeatAt: null,
    completedAt: terminal ? new Date() : null,
    errorCode: terminal ? 'WORKER_ABANDONED' : null,
    errorMessage: terminal
      ? 'Runner stopped responding and retry limit was reached'
      : null,
    updatedAt: new Date(),
  };
}

export function isRunnableExecutionSnapshot(payload: {
  id?: number;
  environmentId: number;
  environmentProfileId: number | null;
  environmentProfileRevision: number | null;
  startingState?: 'profile_authentication' | 'signed_out';
  environmentProfile?: {
    environmentId: number;
    revision: number;
    enabled: boolean;
    isAnonymous?: boolean;
    authenticationStatus?: 'ready' | 'needs_verification' | 'expired';
  } | null;
  automation: { id: number; environmentId: number; status: string };
  repairAttempts?: Array<{
    candidateAutomationId: number;
    status: string;
  }>;
  browserAuthoringSessions?: Array<{
    generatedAutomationId: number | null;
    validationExecutionId: number | null;
    status: string;
  }>;
}) {
  if (payload.automation.environmentId !== payload.environmentId) return false;
  if (
    !payload.environmentProfileId ||
    !payload.environmentProfile ||
    !isCurrentEnvironmentProfileSnapshot(payload, payload.environmentProfile)
  ) {
    return false;
  }
  if (payload.automation.status === 'accepted') return true;
  return (
    payload.automation.status === 'generated' &&
    Boolean(
      payload.repairAttempts?.some(
        (attempt) =>
          attempt.candidateAutomationId === payload.automation.id &&
          attempt.status === 'running',
      ) ||
      payload.browserAuthoringSessions?.some(
        (session) =>
          session.generatedAutomationId === payload.automation.id &&
          (payload.id === undefined ||
            session.validationExecutionId === payload.id) &&
          session.status === 'validating',
      ),
    )
  );
}

export function createRunnerRepository(database: Database = db) {
  return {
    claimBrowserAuthoring(workerId: string) {
      return database.transaction(async (transaction) => {
        const [candidate] = await transaction
          .select()
          .from(browserAuthoringSessions)
          .where(eq(browserAuthoringSessions.status, 'queued'))
          .orderBy(asc(browserAuthoringSessions.createdAt))
          .limit(1)
          .for('update', { skipLocked: true });
        if (!candidate) return undefined;
        const now = new Date();
        const [claimed] = await transaction
          .update(browserAuthoringSessions)
          .set({
            status: 'exploring',
            phase: 'starting_browser',
            workerId,
            claimedAt: now,
            heartbeatAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(browserAuthoringSessions.id, candidate.id),
              eq(browserAuthoringSessions.status, 'queued'),
            ),
          )
          .returning();
        return claimed;
      });
    },
    getBrowserAuthoringPayload(id: number) {
      return database.query.browserAuthoringSessions.findFirst({
        where: eq(browserAuthoringSessions.id, id),
        with: {
          environment: true,
          environmentProfile: true,
          sourceTestCaseVersion: true,
          testCase: { with: { suite: { with: { product: true } } } },
        },
      });
    },
    findAiConnection(reference: string | null) {
      const id = Number(reference);
      if (!Number.isInteger(id) || id <= 0) return Promise.resolve(undefined);
      return database.query.aiConnections.findFirst({
        where: and(
          eq(aiConnections.id, id),
          eq(aiConnections.enabled, true),
          eq(aiConnections.scope, 'test-authoring'),
        ),
      });
    },
    async heartbeatBrowserAuthoring(
      id: number,
      workerId: string,
      phase: typeof browserAuthoringSessions.$inferSelect.phase,
    ) {
      const now = new Date();
      const [session] = await database
        .update(browserAuthoringSessions)
        .set({
          status:
            phase === 'generating_automation' ? 'generating' : 'exploring',
          phase,
          heartbeatAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(browserAuthoringSessions.id, id),
            eq(browserAuthoringSessions.workerId, workerId),
            inArray(browserAuthoringSessions.status, [
              'exploring',
              'generating',
            ]),
          ),
        )
        .returning({
          cancellationRequestedAt:
            browserAuthoringSessions.cancellationRequestedAt,
        });
      return session;
    },
    async recordBrowserAuthoringResult(
      id: number,
      workerId: string,
      result: Record<string, unknown>,
      observedTestIds: string[],
    ) {
      return database.transaction(async (transaction) => {
        const session =
          await transaction.query.browserAuthoringSessions.findFirst({
            where: and(
              eq(browserAuthoringSessions.id, id),
              eq(browserAuthoringSessions.workerId, workerId),
              inArray(browserAuthoringSessions.status, [
                'exploring',
                'generating',
              ]),
            ),
          });
        if (!session) return undefined;
        const snapshot =
          result.snapshot &&
          typeof result.snapshot === 'object' &&
          !Array.isArray(result.snapshot)
            ? (result.snapshot as Record<string, unknown>)
            : undefined;
        const [updated] = await transaction
          .update(browserAuthoringSessions)
          .set({
            transcript: [...session.transcript, result].slice(
              -session.maxToolCalls,
            ),
            observations: snapshot
              ? [...session.observations, snapshot].slice(-session.maxToolCalls)
              : session.observations,
            observedTestIds: [
              ...new Set([...session.observedTestIds, ...observedTestIds]),
            ].sort(),
            toolCallCount: Math.min(
              session.toolCallCount + 1,
              session.maxToolCalls,
            ),
            heartbeatAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(browserAuthoringSessions.id, id))
          .returning({
            cancellationRequestedAt:
              browserAuthoringSessions.cancellationRequestedAt,
          });
        return updated;
      });
    },
    async completeBrowserExploration(
      id: number,
      workerId: string,
      values: {
        observations: Array<Record<string, unknown>>;
        transcript: Array<Record<string, unknown>>;
        observedTestIds: string[];
        toolCallCount: number;
        provider: typeof browserAuthoringSessions.$inferInsert.provider;
        model: string;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        latencyMs: number;
        source: string;
        validationError: string | null;
        executionSettings: typeof automationExecutionJobs.$inferInsert.settings;
      },
    ) {
      return database.transaction(async (transaction) => {
        const session =
          await transaction.query.browserAuthoringSessions.findFirst({
            where: and(
              eq(browserAuthoringSessions.id, id),
              eq(browserAuthoringSessions.workerId, workerId),
              inArray(browserAuthoringSessions.status, [
                'exploring',
                'generating',
              ]),
            ),
          });
        if (!session) return undefined;
        // Serialize version allocation for this test case within PostgreSQL so
        // independent runner processes cannot choose the same next version.
        await transaction.execute(
          sql`select pg_advisory_xact_lock(${session.testCaseId})`,
        );
        const latest = await transaction.query.testAutomations.findFirst({
          where: and(
            eq(testAutomations.testCaseId, session.testCaseId),
            eq(testAutomations.framework, 'playwright'),
            eq(testAutomations.language, 'typescript'),
          ),
          orderBy: desc(testAutomations.versionNumber),
          columns: { versionNumber: true },
        });
        const [automation] = await transaction
          .insert(testAutomations)
          .values({
            testCaseId: session.testCaseId,
            sourceTestCaseVersionId: session.sourceTestCaseVersionId,
            environmentId: session.environmentId,
            environmentProfileId: session.environmentProfileId,
            environmentProfileName: session.environmentProfileName,
            environmentProfileRevision: session.environmentProfileRevision,
            versionNumber: (latest?.versionNumber ?? 0) + 1,
            framework: 'playwright',
            language: 'typescript',
            status: 'generated',
            source: values.source,
            connectionRef: session.connectionRef,
            provider: values.provider,
            model: values.model,
            promptVersion: session.promptVersion,
            latencyMs: values.latencyMs,
            inputTokens: values.inputTokens,
            outputTokens: values.outputTokens,
            totalTokens: values.totalTokens,
            validationError: values.validationError,
            createdById: session.requestedById,
          })
          .returning();
        const [execution] = await transaction
          .insert(automationExecutionJobs)
          .values({
            projectId: session.projectId,
            automationId: automation!.id,
            environmentId: session.environmentId,
            environmentProfileId: session.environmentProfileId,
            environmentProfileName: session.environmentProfileName,
            environmentProfileRevision: session.environmentProfileRevision,
            requestedById: session.requestedById,
            timeoutSeconds: Math.min(session.timeoutSeconds, 300),
            settings: values.executionSettings,
          })
          .returning();
        const [updated] = await transaction
          .update(browserAuthoringSessions)
          .set({
            status: 'validating',
            phase: 'validating_automation',
            observations: values.observations,
            transcript: values.transcript,
            observedTestIds: values.observedTestIds,
            toolCallCount: values.toolCallCount,
            provider: values.provider,
            model: values.model,
            inputTokens: values.inputTokens,
            outputTokens: values.outputTokens,
            totalTokens: values.totalTokens,
            latencyMs: values.latencyMs,
            generatedAutomationId: automation!.id,
            validationExecutionId: execution!.id,
            heartbeatAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(browserAuthoringSessions.id, id))
          .returning();
        return updated;
      });
    },
    async failBrowserAuthoring(
      id: number,
      workerId: string,
      status: 'failed' | 'cancelled' | 'timed_out',
      reason: string,
    ) {
      const now = new Date();
      const [session] = await database
        .update(browserAuthoringSessions)
        .set({
          status,
          ...(status === 'cancelled' ? {} : { phase: 'failed' as const }),
          failureReason: reason.slice(0, 1000),
          completedAt: now,
          heartbeatAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(browserAuthoringSessions.id, id),
            eq(browserAuthoringSessions.workerId, workerId),
          ),
        )
        .returning();
      return session;
    },
    async recoverStaleBrowserAuthoring(
      before: Date,
      cleanup: (sessionId: number) => Promise<void>,
    ) {
      const stale = await database
        .select()
        .from(browserAuthoringSessions)
        .where(
          and(
            inArray(browserAuthoringSessions.status, [
              'exploring',
              'generating',
            ]),
            lt(browserAuthoringSessions.heartbeatAt, before),
          ),
        );
      let recovered = 0;
      for (const session of stale) {
        const recoveryAt = new Date();
        const [claimed] = await database
          .update(browserAuthoringSessions)
          .set({
            workerId: null,
            heartbeatAt: recoveryAt,
            updatedAt: recoveryAt,
          })
          .where(
            and(
              eq(browserAuthoringSessions.id, session.id),
              eq(browserAuthoringSessions.heartbeatAt, session.heartbeatAt!),
              inArray(browserAuthoringSessions.status, [
                'exploring',
                'generating',
              ]),
            ),
          )
          .returning({ id: browserAuthoringSessions.id });
        if (!claimed) continue;
        await cleanup(session.id);
        const now = new Date();
        const [updated] = await database
          .update(browserAuthoringSessions)
          .set(
            session.cancellationRequestedAt
              ? {
                  status: 'cancelled',
                  failureReason:
                    'Browser authoring runner stopped after cancellation was requested',
                  completedAt: now,
                  heartbeatAt: null,
                  workerId: null,
                  updatedAt: now,
                }
              : {
                  status: 'queued',
                  phase: 'starting_browser',
                  heartbeatAt: null,
                  claimedAt: null,
                  workerId: null,
                  updatedAt: now,
                },
          )
          .where(
            and(
              eq(browserAuthoringSessions.id, session.id),
              eq(browserAuthoringSessions.heartbeatAt, recoveryAt),
              inArray(browserAuthoringSessions.status, [
                'exploring',
                'generating',
              ]),
            ),
          )
          .returning({ id: browserAuthoringSessions.id });
        if (updated) recovered += 1;
      }
      return recovered;
    },
    async finalizeBrowserAuthoringValidations() {
      const sessions = await database.query.browserAuthoringSessions.findMany({
        where: eq(browserAuthoringSessions.status, 'validating'),
        with: { validationExecution: true },
      });
      let updatedCount = 0;
      for (const session of sessions) {
        const execution = session.validationExecution;
        if (
          !execution ||
          ![
            'passed',
            'failed',
            'timed_out',
            'cancelled',
            'infrastructure_error',
          ].includes(execution.status)
        )
          continue;
        const passed = execution.status === 'passed';
        await database.transaction(async (transaction) => {
          if (session.generatedAutomationId && !passed) {
            await transaction
              .update(testAutomations)
              .set({
                validationError: (
                  execution.errorMessage || `Validation ${execution.status}`
                ).slice(0, 500),
                updatedAt: new Date(),
              })
              .where(eq(testAutomations.id, session.generatedAutomationId));
          }
          await transaction
            .update(browserAuthoringSessions)
            .set({
              status: 'completed',
              phase: 'complete',
              validationStatus: execution.status,
              failureReason: passed
                ? null
                : (
                    execution.errorMessage || `Validation ${execution.status}`
                  ).slice(0, 1000),
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(browserAuthoringSessions.id, session.id));
        });
        updatedCount += 1;
      }
      return updatedCount;
    },
    claim(workerId: string) {
      return database.transaction(async (transaction) => {
        const [candidate] = await transaction
          .select()
          .from(automationExecutionJobs)
          .where(eq(automationExecutionJobs.status, 'queued'))
          .orderBy(asc(automationExecutionJobs.createdAt))
          .limit(1)
          .for('update', { skipLocked: true });
        if (!candidate) return undefined;
        const now = new Date();
        const [claimed] = await transaction
          .update(automationExecutionJobs)
          .set({
            status: 'claimed',
            workerId,
            claimedAt: now,
            heartbeatAt: now,
            updatedAt: now,
            attempt: sql`${automationExecutionJobs.attempt} + 1`,
          })
          .where(
            and(
              eq(automationExecutionJobs.id, candidate.id),
              eq(automationExecutionJobs.status, 'queued'),
            ),
          )
          .returning();
        return claimed;
      });
    },
    getPayload(id: number) {
      return database.query.automationExecutionJobs.findFirst({
        where: eq(automationExecutionJobs.id, id),
        with: {
          automation: true,
          environment: true,
          environmentProfile: true,
          repairAttempts: true,
          browserAuthoringSessions: true,
        },
      });
    },
    getEnvironmentProfileSnapshot(id: number) {
      return database.query.environmentProfiles.findFirst({
        where: eq(environmentProfiles.id, id),
        columns: {
          environmentId: true,
          revision: true,
          enabled: true,
          isAnonymous: true,
          authenticationStatus: true,
        },
      });
    },
    async listEnvironmentVariables(profileId: number, keys: string[]) {
      if (!keys.length) return Promise.resolve([]);
      return database
        .select({
          key: environmentVariables.key,
          encryptedValue: environmentVariables.encryptedValue,
          isSecret: environmentVariables.isSecret,
        })
        .from(environmentProfileVariables)
        .innerJoin(
          environmentVariables,
          eq(environmentProfileVariables.variableId, environmentVariables.id),
        )
        .where(
          and(
            eq(environmentProfileVariables.profileId, profileId),
            inArray(environmentVariables.key, keys),
          ),
        )
        .orderBy(asc(environmentVariables.key));
    },
    async listEnvironmentCookies(profileId: number) {
      return database
        .select({
          name: environmentCookies.name,
          valueTemplate: environmentCookies.valueTemplate,
          domain: environmentCookies.domain,
          path: environmentCookies.path,
          httpOnly: environmentCookies.httpOnly,
          secure: environmentCookies.secure,
          sameSite: environmentCookies.sameSite,
          expiresAt: environmentCookies.expiresAt,
        })
        .from(environmentProfileCookies)
        .innerJoin(
          environmentCookies,
          eq(environmentProfileCookies.cookieId, environmentCookies.id),
        )
        .where(
          and(
            eq(environmentProfileCookies.profileId, profileId),
            eq(environmentCookies.enabled, true),
          ),
        )
        .orderBy(asc(environmentCookies.name), asc(environmentCookies.path));
    },
    async listEnvironmentHeaders(profileId: number) {
      return database
        .select({
          name: environmentHeaders.name,
          valueTemplate: environmentHeaders.valueTemplate,
          origin: environmentHeaders.origin,
        })
        .from(environmentProfileHeaders)
        .innerJoin(
          environmentHeaders,
          eq(environmentProfileHeaders.headerId, environmentHeaders.id),
        )
        .where(
          and(
            eq(environmentProfileHeaders.profileId, profileId),
            eq(environmentHeaders.enabled, true),
          ),
        )
        .orderBy(asc(environmentHeaders.name), asc(environmentHeaders.origin));
    },
    async start(id: number, workerId: string) {
      const now = new Date();
      const [job] = await database
        .update(automationExecutionJobs)
        .set({
          status: 'running',
          startedAt: now,
          heartbeatAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(automationExecutionJobs.id, id),
            eq(automationExecutionJobs.workerId, workerId),
            eq(automationExecutionJobs.status, 'claimed'),
          ),
        )
        .returning();
      return job;
    },
    async heartbeat(id: number, workerId: string) {
      const now = new Date();
      const [job] = await database
        .update(automationExecutionJobs)
        .set({ heartbeatAt: now, updatedAt: now })
        .where(
          and(
            eq(automationExecutionJobs.id, id),
            eq(automationExecutionJobs.workerId, workerId),
            eq(automationExecutionJobs.status, 'running'),
          ),
        )
        .returning({
          cancellationRequestedAt:
            automationExecutionJobs.cancellationRequestedAt,
        });
      return job;
    },
    async finish(
      id: number,
      workerId: string,
      values: {
        status: Extract<
          Status,
          | 'passed'
          | 'failed'
          | 'timed_out'
          | 'cancelled'
          | 'infrastructure_error'
        >;
        resultSummary?: {
          tests: number;
          passed: number;
          failed: number;
          durationMs: number;
        };
        errorCode?: string;
        errorMessage?: string;
        structuredLogs: Array<{
          at: string;
          level: string;
          message: string;
        }>;
      },
    ) {
      const now = new Date();
      const [job] = await database
        .update(automationExecutionJobs)
        .set({
          ...values,
          completedAt: now,
          heartbeatAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(automationExecutionJobs.id, id),
            eq(automationExecutionJobs.workerId, workerId),
            inArray(automationExecutionJobs.status, ['claimed', 'running']),
          ),
        )
        .returning();
      return job;
    },
    createArtifacts(
      values: Array<typeof automationExecutionArtifacts.$inferInsert>,
    ) {
      if (!values.length) return Promise.resolve([]);
      return database
        .insert(automationExecutionArtifacts)
        .values(values)
        .returning();
    },
    expiredArtifacts(now: Date) {
      return database.query.automationExecutionArtifacts.findMany({
        where: lte(automationExecutionArtifacts.expiresAt, now),
        limit: 100,
      });
    },
    async deleteArtifact(id: number) {
      await database
        .delete(automationExecutionArtifacts)
        .where(eq(automationExecutionArtifacts.id, id));
    },
    async recoverStale(
      before: Date,
      recoveryWorkerId = 'recovery',
      beforeRecover: (jobId: number) => Promise<void> = async () => undefined,
    ) {
      const stale = await database.query.automationExecutionJobs.findMany({
        where: and(
          inArray(automationExecutionJobs.status, ['claimed', 'running']),
          lt(automationExecutionJobs.heartbeatAt, before),
        ),
      });
      let recovered = 0;
      for (const job of stale) {
        const recoveryAt = new Date();
        const recoveryOwner = `${recoveryWorkerId}:recovery`;
        const [owned] = await database
          .update(automationExecutionJobs)
          .set({
            workerId: recoveryOwner,
            heartbeatAt: recoveryAt,
            updatedAt: recoveryAt,
          })
          .where(
            and(
              eq(automationExecutionJobs.id, job.id),
              eq(automationExecutionJobs.status, job.status),
              eq(automationExecutionJobs.heartbeatAt, job.heartbeatAt!),
            ),
          )
          .returning();
        if (!owned) continue;

        await beforeRecover(job.id);
        await database
          .update(automationExecutionJobs)
          .set(staleRecoveryValues(owned))
          .where(
            and(
              eq(automationExecutionJobs.id, owned.id),
              eq(automationExecutionJobs.workerId, recoveryOwner),
              eq(automationExecutionJobs.heartbeatAt, recoveryAt),
            ),
          );
        recovered += 1;
      }
      return recovered;
    },
  };
}

export type RunnerRepository = ReturnType<typeof createRunnerRepository>;
