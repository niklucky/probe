import {
  and,
  automationExecutionJobs,
  automationRepairAttempts,
  automationRepairSessions,
  db,
  desc,
  eq,
  inArray,
  sql,
  testAutomations,
} from '@probe/db';

type Database = typeof db;

function bindRepository(database: Database) {
  return {
    findExecution(id: number) {
      return database.query.automationExecutionJobs.findFirst({
        where: eq(automationExecutionJobs.id, id),
        with: {
          artifacts: true,
          environment: true,
          automation: {
            with: {
              testCase: { with: { suite: { with: { product: true } } } },
              sourceTestCaseVersion: true,
            },
          },
        },
      });
    },
    createSession(values: typeof automationRepairSessions.$inferInsert) {
      return database
        .insert(automationRepairSessions)
        .values(values)
        .returning()
        .then(([value]) => value!);
    },
    findSession(id: number) {
      return database.query.automationRepairSessions.findFirst({
        where: eq(automationRepairSessions.id, id),
        with: {
          sourceExecution: true,
          sourceAutomation: true,
          attempts: {
            with: { candidateAutomation: true, executionJob: true },
            orderBy: automationRepairAttempts.attemptNumber,
          },
        },
      });
    },
    list(executionId: number) {
      return database.query.automationRepairSessions.findMany({
        where: eq(automationRepairSessions.sourceExecutionId, executionId),
        with: {
          attempts: {
            with: { candidateAutomation: true, executionJob: true },
            orderBy: automationRepairAttempts.attemptNumber,
          },
        },
        orderBy: desc(automationRepairSessions.createdAt),
      });
    },
    listPendingAutomatic() {
      return database.query.automationRepairSessions.findMany({
        where: and(
          eq(automationRepairSessions.mode, 'automatic'),
          inArray(automationRepairSessions.status, ['active', 'running']),
        ),
        columns: { id: true, requestedById: true },
        limit: 25,
      });
    },
    async claimGeneration(id: number) {
      const [session] = await database
        .update(automationRepairSessions)
        .set({ status: 'running', updatedAt: new Date() })
        .where(
          and(
            eq(automationRepairSessions.id, id),
            eq(automationRepairSessions.status, 'active'),
          ),
        )
        .returning();
      return session;
    },
    async stopExpiredGeneration(now: Date) {
      return database
        .update(automationRepairSessions)
        .set({
          status: 'stopped',
          stopReason:
            'Generation did not finish before the session time budget',
          completedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(automationRepairSessions.status, 'running'),
            sql`${automationRepairSessions.createdAt} + (${automationRepairSessions.maxDurationMs} * interval '1 millisecond') <= ${now.toISOString()}`,
            sql`not exists (
              select 1 from ${automationRepairAttempts}
              where ${automationRepairAttempts.sessionId} = ${automationRepairSessions.id}
                and ${automationRepairAttempts.status} = 'running'
            )`,
          ),
        )
        .returning({ id: automationRepairSessions.id });
    },
    async createAttempt(
      sessionId: number,
      candidate: Omit<typeof testAutomations.$inferInsert, 'versionNumber'>,
      attempt: Omit<
        typeof automationRepairAttempts.$inferInsert,
        'sessionId' | 'candidateAutomationId' | 'attemptNumber'
      >,
      usedTokens: number,
      status: 'awaiting_review' | 'active',
    ) {
      return database.transaction(async (transaction) => {
        const [session] = await transaction
          .select()
          .from(automationRepairSessions)
          .where(eq(automationRepairSessions.id, sessionId))
          .limit(1)
          .for('update');
        if (!session) return undefined;
        const [latestAttempt] = await transaction
          .select({
            value: sql<number>`coalesce(max(${automationRepairAttempts.attemptNumber}), 0)`,
          })
          .from(automationRepairAttempts)
          .where(eq(automationRepairAttempts.sessionId, sessionId));
        const [latest] = await transaction
          .select({ versionNumber: testAutomations.versionNumber })
          .from(testAutomations)
          .where(
            and(
              eq(testAutomations.testCaseId, candidate.testCaseId),
              eq(testAutomations.framework, 'playwright'),
              eq(testAutomations.language, 'typescript'),
            ),
          )
          .orderBy(desc(testAutomations.versionNumber))
          .limit(1)
          .for('update');
        const [createdCandidate] = await transaction
          .insert(testAutomations)
          .values({
            ...candidate,
            versionNumber: (latest?.versionNumber ?? 0) + 1,
          })
          .returning();
        const [createdAttempt] = await transaction
          .insert(automationRepairAttempts)
          .values({
            ...attempt,
            sessionId,
            candidateAutomationId: createdCandidate!.id,
            attemptNumber: Number(latestAttempt?.value ?? 0) + 1,
          })
          .returning();
        await transaction
          .update(automationRepairSessions)
          .set({ usedTokens, status, updatedAt: new Date() })
          .where(eq(automationRepairSessions.id, sessionId));
        return { candidate: createdCandidate!, attempt: createdAttempt! };
      });
    },
    async queueAttempt(
      sessionId: number,
      attemptId: number,
      values: Omit<typeof automationExecutionJobs.$inferInsert, 'automationId'>,
    ) {
      return database.transaction(async (transaction) => {
        const [attempt] = await transaction
          .select()
          .from(automationRepairAttempts)
          .where(
            and(
              eq(automationRepairAttempts.id, attemptId),
              eq(automationRepairAttempts.sessionId, sessionId),
            ),
          )
          .limit(1)
          .for('update');
        if (
          !attempt ||
          attempt.status !== 'generated' ||
          attempt.executionJobId
        ) {
          return undefined;
        }
        const [job] = await transaction
          .insert(automationExecutionJobs)
          .values({ ...values, automationId: attempt.candidateAutomationId })
          .returning();
        await transaction
          .update(automationRepairAttempts)
          .set({
            status: 'running',
            executionJobId: job!.id,
            updatedAt: new Date(),
          })
          .where(eq(automationRepairAttempts.id, attempt.id));
        await transaction
          .update(automationRepairSessions)
          .set({ status: 'running', updatedAt: new Date() })
          .where(eq(automationRepairSessions.id, sessionId));
        return job;
      });
    },
    async updateAttemptStatus(attemptId: number, status: 'passed' | 'failed') {
      await database
        .update(automationRepairAttempts)
        .set({ status, updatedAt: new Date() })
        .where(eq(automationRepairAttempts.id, attemptId));
    },
    async updateSession(
      id: number,
      values: Partial<typeof automationRepairSessions.$inferInsert>,
    ) {
      const [session] = await database
        .update(automationRepairSessions)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(automationRepairSessions.id, id))
        .returning();
      return session;
    },
  };
}

export function createAutomationRepairRepository(database: Database = db) {
  return bindRepository(database);
}

export type AutomationRepairRepository = ReturnType<
  typeof createAutomationRepairRepository
>;
