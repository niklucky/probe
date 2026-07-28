import {
  and,
  asc,
  automationExecutionArtifacts,
  automationExecutionJobs,
  db,
  eq,
  inArray,
  sql,
} from '@probe/db';

type Database = typeof db;
type Status = typeof automationExecutionJobs.$inferSelect.status;

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
        with: { automation: true, environment: true },
      });
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
        where: sql`${automationExecutionArtifacts.expiresAt} <= ${now}`,
        limit: 100,
      });
    },
    async deleteArtifact(id: number) {
      await database
        .delete(automationExecutionArtifacts)
        .where(eq(automationExecutionArtifacts.id, id));
    },
    async recoverStale(before: Date) {
      const stale = await database.query.automationExecutionJobs.findMany({
        where: and(
          inArray(automationExecutionJobs.status, ['claimed', 'running']),
          sql`${automationExecutionJobs.heartbeatAt} < ${before}`,
        ),
      });
      for (const job of stale) {
        await database
          .update(automationExecutionJobs)
          .set(staleRecoveryValues(job))
          .where(
            and(
              eq(automationExecutionJobs.id, job.id),
              eq(automationExecutionJobs.status, job.status),
              eq(automationExecutionJobs.heartbeatAt, job.heartbeatAt!),
            ),
          );
      }
      return stale.length;
    },
  };
}

export type RunnerRepository = ReturnType<typeof createRunnerRepository>;
