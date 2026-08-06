import {
  browserAuthoringSessions,
  db,
  desc,
  eq,
  and,
  notInArray,
} from '@probe/db';

type Database = typeof db;

export function createBrowserAuthoringRepository(database: Database = db) {
  const withPublicRelations = {
    environment: { columns: { name: true } },
    sourceTestCaseVersion: { columns: { versionNumber: true } },
  } as const;
  return {
    async create(values: typeof browserAuthoringSessions.$inferInsert) {
      const [session] = await database
        .insert(browserAuthoringSessions)
        .values(values)
        .returning();
      return session;
    },
    find(id: number) {
      return database.query.browserAuthoringSessions.findFirst({
        where: eq(browserAuthoringSessions.id, id),
        with: withPublicRelations,
      });
    },
    list(testCaseId: number) {
      return database.query.browserAuthoringSessions.findMany({
        where: eq(browserAuthoringSessions.testCaseId, testCaseId),
        with: withPublicRelations,
        orderBy: desc(browserAuthoringSessions.createdAt),
      });
    },
    findActive(testCaseId: number) {
      return database.query.browserAuthoringSessions.findFirst({
        where: and(
          eq(browserAuthoringSessions.testCaseId, testCaseId),
          notInArray(browserAuthoringSessions.status, [
            'completed',
            'failed',
            'cancelled',
            'timed_out',
          ]),
        ),
      });
    },
    async requestCancellation(id: number) {
      return database.transaction(async (transaction) => {
        const [session] = await transaction
          .select()
          .from(browserAuthoringSessions)
          .where(eq(browserAuthoringSessions.id, id))
          .limit(1)
          .for('update');
        if (
          !session ||
          ['completed', 'failed', 'cancelled', 'timed_out'].includes(
            session.status,
          )
        ) {
          return undefined;
        }
        const now = new Date();
        const [updated] = await transaction
          .update(browserAuthoringSessions)
          .set(
            session.status === 'queued'
              ? {
                  status: 'cancelled',
                  phase: 'starting_browser',
                  cancellationRequestedAt: now,
                  completedAt: now,
                  updatedAt: now,
                }
              : { cancellationRequestedAt: now, updatedAt: now },
          )
          .where(eq(browserAuthoringSessions.id, id))
          .returning();
        return updated;
      });
    },
  };
}

export type BrowserAuthoringRepository = ReturnType<
  typeof createBrowserAuthoringRepository
>;
