import {
  and,
  db,
  environmentCookies,
  environmentVariables,
  environments,
  eq,
  isNull,
  products,
} from '@probe/db';

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
    listCookies(environmentId: number) {
      return database.query.environmentCookies.findMany({
        where: eq(environmentCookies.environmentId, environmentId),
        orderBy: (table, { asc }) => [asc(table.name), asc(table.path)],
      });
    },
    findCookie(id: number) {
      return database.query.environmentCookies.findFirst({
        where: eq(environmentCookies.id, id),
      });
    },
    async createCookie(values: typeof environmentCookies.$inferInsert) {
      const [cookie] = await database
        .insert(environmentCookies)
        .values(values)
        .returning();
      return cookie;
    },
    async updateCookie(
      id: number,
      values: Partial<typeof environmentCookies.$inferInsert>,
    ) {
      const [cookie] = await database
        .update(environmentCookies)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(environmentCookies.id, id))
        .returning();
      return cookie;
    },
    async deleteCookie(id: number) {
      const [cookie] = await database
        .delete(environmentCookies)
        .where(eq(environmentCookies.id, id))
        .returning();
      return cookie;
    },
    listVariables(environmentId: number) {
      return database.query.environmentVariables.findMany({
        where: eq(environmentVariables.environmentId, environmentId),
        orderBy: (table, { asc }) => [asc(table.key)],
      });
    },
    findVariable(id: number) {
      return database.query.environmentVariables.findFirst({
        where: eq(environmentVariables.id, id),
      });
    },
    findVariableByKey(environmentId: number, key: string) {
      return database.query.environmentVariables.findFirst({
        where: and(
          eq(environmentVariables.environmentId, environmentId),
          eq(environmentVariables.key, key),
        ),
      });
    },
    async createVariable(values: typeof environmentVariables.$inferInsert) {
      const [variable] = await database
        .insert(environmentVariables)
        .values(values)
        .returning();
      return variable;
    },
    async updateVariable(
      id: number,
      values: Partial<typeof environmentVariables.$inferInsert>,
    ) {
      const [variable] = await database
        .update(environmentVariables)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(environmentVariables.id, id))
        .returning();
      return variable;
    },
    async deleteVariable(id: number) {
      const [variable] = await database
        .delete(environmentVariables)
        .where(eq(environmentVariables.id, id))
        .returning();
      return variable;
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
