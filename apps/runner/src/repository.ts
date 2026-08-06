import {
  and,
  asc,
  automationExecutionArtifacts,
  automationExecutionJobs,
  db,
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
  },
  profile:
    | { environmentId: number; revision: number; enabled: boolean }
    | null
    | undefined,
) {
  return Boolean(
    profile?.enabled &&
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
  environmentId: number;
  environmentProfileId: number | null;
  environmentProfileRevision: number | null;
  environmentProfile?: {
    environmentId: number;
    revision: number;
    enabled: boolean;
  } | null;
  automation: { id: number; environmentId: number; status: string };
  repairAttempts?: Array<{
    candidateAutomationId: number;
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
      ),
    )
  );
}

export function createRunnerRepository(database: Database = db) {
  return {
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
