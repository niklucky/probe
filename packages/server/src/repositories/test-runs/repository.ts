import {
  and,
  db,
  desc,
  eq,
  inArray,
  testCaseVersions,
  testResults,
  testRunItems,
  testRuns,
} from '@probe/db';

type Database = typeof db;

function bindTestRunRepository(database: Database) {
  return {
    list(projectId: number) {
      return database.query.testRuns.findMany({
        where: eq(testRuns.projectId, projectId),
        orderBy: desc(testRuns.createdAt),
      });
    },

    findVersions(ids: number[]) {
      return database.query.testCaseVersions.findMany({
        where: inArray(testCaseVersions.id, ids),
      });
    },

    async createRun(values: typeof testRuns.$inferInsert) {
      const [run] = await database.insert(testRuns).values(values).returning();
      return run;
    },

    createItems(values: (typeof testRunItems.$inferInsert)[]) {
      return database.insert(testRunItems).values(values).returning();
    },

    async createResults(values: (typeof testResults.$inferInsert)[]) {
      await database.insert(testResults).values(values);
    },

    findRun(id: number) {
      return database.query.testRuns.findFirst({
        where: eq(testRuns.id, id),
        with: {
          items: {
            with: { testCaseVersion: { with: { testCase: true } } },
            orderBy: (items, { asc }) => [asc(items.orderIndex)],
          },
          results: {
            with: {
              testCaseVersion: true,
              executedBy: { columns: { id: true, name: true } },
              files: {
                with: {
                  createdBy: { columns: { id: true, name: true } },
                },
              },
            },
          },
        },
      });
    },

    findResult(runId: number, testCaseVersionId: number) {
      return database.query.testResults.findFirst({
        where: and(
          eq(testResults.runId, runId),
          eq(testResults.testCaseVersionId, testCaseVersionId),
        ),
      });
    },

    findResultWithDetails(runId: number, testCaseVersionId: number) {
      return database.query.testResults.findFirst({
        where: and(
          eq(testResults.runId, runId),
          eq(testResults.testCaseVersionId, testCaseVersionId),
        ),
        with: {
          testCaseVersion: { with: { testCase: true } },
          executedBy: { columns: { id: true, name: true } },
          files: {
            with: {
              createdBy: { columns: { id: true, name: true } },
            },
          },
        },
      });
    },

    async updateResult(
      runId: number,
      testCaseVersionId: number,
      values: Partial<typeof testResults.$inferInsert>,
    ) {
      const [result] = await database
        .update(testResults)
        .set(values)
        .where(
          and(
            eq(testResults.runId, runId),
            eq(testResults.testCaseVersionId, testCaseVersionId),
          ),
        )
        .returning();
      return result;
    },

    async complete(id: number) {
      const [run] = await database
        .update(testRuns)
        .set({ completedAt: new Date() })
        .where(eq(testRuns.id, id))
        .returning();
      return run;
    },

    async delete(id: number) {
      await database.delete(testRuns).where(eq(testRuns.id, id));
    },
  };
}

export function createTestRunRepository(database: Database = db) {
  return {
    ...bindTestRunRepository(database),
    withTransaction<T>(
      operation: (
        transactionRepository: ReturnType<typeof bindTestRunRepository>,
      ) => Promise<T>,
    ) {
      return database.transaction((transaction) =>
        operation(bindTestRunRepository(transaction as unknown as Database)),
      );
    },
  };
}

export type TestRunRepository = ReturnType<typeof createTestRunRepository>;
