import {
  db,
  desc,
  eq,
  testCases,
  testCaseVersions,
  testSuites,
  testSuiteVersions,
} from '@probe/db';

type Database = typeof db;

function bindTestCaseRepository(database: Database) {
  return {
    async listBySuiteVersion(suiteVersionId: number) {
      return await database.query.testCaseVersions.findMany({
        where: eq(testCaseVersions.suiteVersionId, suiteVersionId),
        with: { testCase: true },
        orderBy: desc(testCaseVersions.createdAt),
      });
    },

    async listCurrentBySuite(suiteId: number) {
      return await database.query.testCases.findMany({
        where: eq(testCases.suiteId, suiteId),
        with: {
          versions: {
            orderBy: desc(testCaseVersions.versionNumber),
            limit: 1,
          },
        },
      });
    },

    async listSuitesByProduct(productId: number) {
      return await database.query.testSuites.findMany({
        where: eq(testSuites.productId, productId),
      });
    },

    async findSuite(id: number) {
      return await database.query.testSuites.findFirst({
        where: eq(testSuites.id, id),
      });
    },

    findSuiteVersion(id: number) {
      return database.query.testSuiteVersions.findFirst({
        where: eq(testSuiteVersions.id, id),
        columns: { id: true, suiteId: true },
      });
    },

    async findById(id: number) {
      return await database.query.testCases.findFirst({
        where: eq(testCases.id, id),
        with: {
          versions: {
            orderBy: desc(testCaseVersions.versionNumber),
            with: { files: true },
          },
        },
      });
    },

    async findForUpdate(id: number) {
      return await database.query.testCases.findFirst({
        where: eq(testCases.id, id),
        with: {
          suite: true,
          versions: {
            orderBy: desc(testCaseVersions.versionNumber),
            limit: 1,
          },
        },
      });
    },

    async createCase(values: typeof testCases.$inferInsert) {
      const [testCase] = await database
        .insert(testCases)
        .values(values)
        .returning();
      return testCase;
    },

    async createVersion(values: typeof testCaseVersions.$inferInsert) {
      const [version] = await database
        .insert(testCaseVersions)
        .values(values)
        .returning();
      return version;
    },

    async setCurrentVersion(id: number, currentVersionId: number) {
      const [testCase] = await database
        .update(testCases)
        .set({ currentVersionId, updatedAt: new Date() })
        .where(eq(testCases.id, id))
        .returning();
      return testCase;
    },

    async listVersions(testCaseId: number) {
      return await database.query.testCaseVersions.findMany({
        where: eq(testCaseVersions.testCaseId, testCaseId),
        orderBy: desc(testCaseVersions.versionNumber),
      });
    },

    async delete(id: number) {
      await database.delete(testCases).where(eq(testCases.id, id));
    },
  };
}

export function createTestCaseRepository(database: Database = db) {
  return {
    ...bindTestCaseRepository(database),
    withTransaction<T>(
      operation: (
        transactionRepository: ReturnType<typeof bindTestCaseRepository>,
      ) => Promise<T>,
    ) {
      return database.transaction((transaction) =>
        operation(bindTestCaseRepository(transaction as unknown as Database)),
      );
    },
  };
}

export type TestCaseRepository = ReturnType<typeof createTestCaseRepository>;
