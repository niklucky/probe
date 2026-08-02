import {
  and,
  automationExecutionArtifacts,
  automationExecutionJobs,
  db,
  desc,
  eq,
  testAutomations,
} from '@probe/db';

type Database = typeof db;

export function createAutomationExecutionRepository(database: Database = db) {
  return {
    findAutomation(id: number) {
      return database.query.testAutomations.findFirst({
        where: eq(testAutomations.id, id),
        with: {
          environment: true,
          testCase: { with: { suite: { with: { product: true } } } },
        },
      });
    },
    async create(values: typeof automationExecutionJobs.$inferInsert) {
      const [job] = await database
        .insert(automationExecutionJobs)
        .values(values)
        .returning();
      return job;
    },
    list(automationId: number) {
      return database.query.automationExecutionJobs.findMany({
        where: eq(automationExecutionJobs.automationId, automationId),
        with: { artifacts: true },
        orderBy: desc(automationExecutionJobs.createdAt),
      });
    },
    find(id: number) {
      return database.query.automationExecutionJobs.findFirst({
        where: eq(automationExecutionJobs.id, id),
        with: {
          automation: {
            columns: {
              id: true,
              versionNumber: true,
              sourceTestCaseVersionId: true,
            },
          },
          environment: {
            columns: { id: true, name: true, baseUrl: true },
          },
          artifacts: true,
        },
      });
    },
    async requestCancellation(id: number) {
      return database.transaction(async (transaction) => {
        const [job] = await transaction
          .select()
          .from(automationExecutionJobs)
          .where(eq(automationExecutionJobs.id, id))
          .limit(1)
          .for('update');
        if (
          !job ||
          [
            'passed',
            'failed',
            'timed_out',
            'cancelled',
            'infrastructure_error',
          ].includes(job.status)
        ) {
          return undefined;
        }

        const now = new Date();
        const [updated] = await transaction
          .update(automationExecutionJobs)
          .set(
            job.status === 'queued' || job.status === 'claimed'
              ? {
                  status: 'cancelled',
                  cancellationRequestedAt: now,
                  completedAt: now,
                  updatedAt: now,
                }
              : { cancellationRequestedAt: now, updatedAt: now },
          )
          .where(eq(automationExecutionJobs.id, id))
          .returning();
        return updated;
      });
    },
    findArtifact(id: number, jobId: number) {
      return database.query.automationExecutionArtifacts.findFirst({
        where: and(
          eq(automationExecutionArtifacts.id, id),
          eq(automationExecutionArtifacts.jobId, jobId),
        ),
      });
    },
  };
}

export type AutomationExecutionRepository = ReturnType<
  typeof createAutomationExecutionRepository
>;
