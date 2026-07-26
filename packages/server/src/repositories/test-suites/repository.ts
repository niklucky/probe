import { db, desc, eq, testSuites, testSuiteVersions } from '@probe/db';

type Database = typeof db;

function bindTestSuiteRepository(database: Database) {
  return {
    list(productId: number) {
      return database.query.testSuites.findMany({
        where: eq(testSuites.productId, productId),
        with: {
          versions: {
            orderBy: desc(testSuiteVersions.versionNumber),
            limit: 1,
          },
        },
        orderBy: desc(testSuites.updatedAt),
      });
    },
    find(id: number) {
      return database.query.testSuites.findFirst({
        where: eq(testSuites.id, id),
        with: {
          versions: { orderBy: desc(testSuiteVersions.versionNumber) },
        },
      });
    },
    async createSuite(values: typeof testSuites.$inferInsert) {
      const [suite] = await database.insert(testSuites).values(values).returning();
      return suite;
    },
    async createVersion(values: typeof testSuiteVersions.$inferInsert) {
      const [version] = await database
        .insert(testSuiteVersions)
        .values(values)
        .returning();
      return version;
    },
    async updateSuite(
      id: number,
      values: Partial<typeof testSuites.$inferInsert>,
    ) {
      const [suite] = await database
        .update(testSuites)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(testSuites.id, id))
        .returning();
      return suite;
    },
    listVersions(suiteId: number) {
      return database.query.testSuiteVersions.findMany({
        where: eq(testSuiteVersions.suiteId, suiteId),
        orderBy: desc(testSuiteVersions.versionNumber),
      });
    },
    async delete(id: number) {
      await database.delete(testSuites).where(eq(testSuites.id, id));
    },
  };
}

export function createTestSuiteRepository(database: Database = db) {
  return {
    ...bindTestSuiteRepository(database),
    withTransaction<T>(
      operation: (
        transactionRepository: ReturnType<typeof bindTestSuiteRepository>,
      ) => Promise<T>,
    ) {
      return database.transaction((transaction) =>
        operation(bindTestSuiteRepository(transaction as unknown as Database)),
      );
    },
  };
}
