import {
  and,
  db,
  desc,
  eq,
  testAutomations,
  testCases,
  testCaseVersions,
} from '@probe/db';

type Database = typeof db;

function bindRepository(database: Database) {
  return {
    findTestCase(id: number) {
      return database.query.testCases.findFirst({
        where: eq(testCases.id, id),
        with: { suite: { with: { product: true } } },
      });
    },
    findTestCaseVersion(id: number) {
      return database.query.testCaseVersions.findFirst({
        where: eq(testCaseVersions.id, id),
      });
    },
    find(id: number) {
      return database.query.testAutomations.findFirst({
        where: eq(testAutomations.id, id),
        with: {
          testCase: true,
          environment: true,
          sourceTestCaseVersion: true,
        },
      });
    },
    list(testCaseId: number) {
      return database.query.testAutomations.findMany({
        where: eq(testAutomations.testCaseId, testCaseId),
        with: { environment: true, sourceTestCaseVersion: true },
        orderBy: desc(testAutomations.versionNumber),
      });
    },
    async nextVersion(testCaseId: number) {
      const latest = await database.query.testAutomations.findFirst({
        where: and(
          eq(testAutomations.testCaseId, testCaseId),
          eq(testAutomations.framework, 'playwright'),
          eq(testAutomations.language, 'typescript'),
        ),
        orderBy: desc(testAutomations.versionNumber),
        columns: { versionNumber: true },
      });
      return (latest?.versionNumber ?? 0) + 1;
    },
    async create(values: typeof testAutomations.$inferInsert) {
      const [automation] = await database
        .insert(testAutomations)
        .values(values)
        .returning();
      return automation;
    },
    async accept(id: number, source: string, userId: number) {
      const [automation] = await database
        .update(testAutomations)
        .set({
          source,
          status: 'accepted',
          acceptedById: userId,
          acceptedAt: new Date(),
          updatedAt: new Date(),
          validationError: null,
        })
        .where(eq(testAutomations.id, id))
        .returning();
      return automation;
    },
    async discard(id: number) {
      const [automation] = await database
        .update(testAutomations)
        .set({ status: 'discarded', updatedAt: new Date() })
        .where(eq(testAutomations.id, id))
        .returning();
      return automation;
    },
  };
}

export function createTestAutomationRepository(database: Database = db) {
  return {
    ...bindRepository(database),
    withTransaction<T>(
      operation: (repository: ReturnType<typeof bindRepository>) => Promise<T>,
    ) {
      return database.transaction((transaction) =>
        operation(bindRepository(transaction as unknown as Database)),
      );
    },
  };
}

export type TestAutomationRepository = ReturnType<
  typeof createTestAutomationRepository
>;
