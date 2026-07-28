import {
  and,
  automationExecutionArtifacts,
  automationExecutionJobs,
  db,
  desc,
  eq,
  inArray,
  not,
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
      const now = new Date();
      const [job] = await database
        .update(automationExecutionJobs)
        .set({
          cancellationRequestedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(automationExecutionJobs.id, id),
            not(
              inArray(automationExecutionJobs.status, [
                'passed',
                'failed',
                'timed_out',
                'cancelled',
                'infrastructure_error',
              ]),
            ),
          ),
        )
        .returning();
      if (job && (job.status === 'queued' || job.status === 'claimed')) {
        const [cancelled] = await database
          .update(automationExecutionJobs)
          .set({ status: 'cancelled', completedAt: now, updatedAt: now })
          .where(
            and(
              eq(automationExecutionJobs.id, id),
              eq(automationExecutionJobs.status, job.status),
            ),
          )
          .returning();
        return cancelled ?? job;
      }
      return job;
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
