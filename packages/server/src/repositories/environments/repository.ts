import { and, db, environments, eq, isNull, products } from '@probe/db';

type Database = typeof db;

function bindEnvironmentRepository(database: Database) {
  const scopeWhere = (projectId: number, productId?: number | null) =>
    and(
      eq(environments.projectId, projectId),
      productId
        ? eq(environments.productId, productId)
        : isNull(environments.productId),
    );

  return {
    list(projectId: number, productId?: number) {
      return database.query.environments.findMany({
        where: scopeWhere(projectId, productId),
        orderBy: (table, { desc, asc }) => [
          desc(table.isDefault),
          asc(table.name),
        ],
      });
    },
    find(id: number) {
      return database.query.environments.findFirst({
        where: eq(environments.id, id),
      });
    },
    findProduct(id: number) {
      return database.query.products.findFirst({
        where: eq(products.id, id),
        columns: { id: true, projectId: true },
      });
    },
    async clearDefault(projectId: number, productId?: number | null) {
      await database
        .update(environments)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(scopeWhere(projectId, productId));
    },
    async create(values: typeof environments.$inferInsert) {
      const [environment] = await database
        .insert(environments)
        .values(values)
        .returning();
      return environment;
    },
    async update(
      id: number,
      values: Partial<typeof environments.$inferInsert>,
    ) {
      const [environment] = await database
        .update(environments)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(environments.id, id))
        .returning();
      return environment;
    },
    async delete(id: number) {
      const [environment] = await database
        .delete(environments)
        .where(eq(environments.id, id))
        .returning();
      return environment;
    },
  };
}

export function createEnvironmentRepository(database: Database = db) {
  return {
    ...bindEnvironmentRepository(database),
    withTransaction<T>(
      operation: (
        repository: ReturnType<typeof bindEnvironmentRepository>,
      ) => Promise<T>,
    ) {
      return database.transaction((transaction) =>
        operation(
          bindEnvironmentRepository(transaction as unknown as Database),
        ),
      );
    },
  };
}

export type EnvironmentRepository = ReturnType<
  typeof createEnvironmentRepository
>;
