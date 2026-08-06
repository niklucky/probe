import {
  and,
  db,
  environmentCookies,
  environmentHeaders,
  environmentProfileCookies,
  environmentProfileHeaders,
  environmentProfiles,
  environmentProfileVariables,
  environmentVariables,
  environments,
  eq,
  isNull,
  inArray,
  products,
  sql,
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
    listProfiles(environmentId: number) {
      return database.query.environmentProfiles.findMany({
        where: eq(environmentProfiles.environmentId, environmentId),
        with: {
          variables: { columns: { variableId: true } },
          cookies: { columns: { cookieId: true } },
          headers: { columns: { headerId: true } },
        },
        orderBy: (table, { desc, asc }) => [
          desc(table.isAnonymous),
          asc(table.name),
        ],
      });
    },
    findProfile(id: number) {
      return database.query.environmentProfiles.findFirst({
        where: eq(environmentProfiles.id, id),
        with: {
          variables: { columns: { variableId: true } },
          cookies: { columns: { cookieId: true } },
          headers: { columns: { headerId: true } },
        },
      });
    },
    async createProfile(
      values: typeof environmentProfiles.$inferInsert,
      bindings: {
        variableIds: number[];
        cookieIds: number[];
        headerIds: number[];
      },
    ) {
      const [profile] = await database
        .insert(environmentProfiles)
        .values(values)
        .returning();
      if (bindings.variableIds.length) {
        await database.insert(environmentProfileVariables).values(
          bindings.variableIds.map((variableId) => ({
            profileId: profile!.id,
            variableId,
          })),
        );
      }
      if (bindings.cookieIds.length) {
        await database.insert(environmentProfileCookies).values(
          bindings.cookieIds.map((cookieId) => ({
            profileId: profile!.id,
            cookieId,
          })),
        );
      }
      if (bindings.headerIds.length) {
        await database.insert(environmentProfileHeaders).values(
          bindings.headerIds.map((headerId) => ({
            profileId: profile!.id,
            headerId,
          })),
        );
      }
      return profile!;
    },
    async updateProfile(
      id: number,
      values: Partial<typeof environmentProfiles.$inferInsert>,
      bindings?: {
        variableIds: number[];
        cookieIds: number[];
        headerIds: number[];
      },
    ) {
      if (bindings) {
        await database
          .delete(environmentProfileVariables)
          .where(eq(environmentProfileVariables.profileId, id));
        await database
          .delete(environmentProfileCookies)
          .where(eq(environmentProfileCookies.profileId, id));
        await database
          .delete(environmentProfileHeaders)
          .where(eq(environmentProfileHeaders.profileId, id));
        if (bindings.variableIds.length) {
          await database.insert(environmentProfileVariables).values(
            bindings.variableIds.map((variableId) => ({
              profileId: id,
              variableId,
            })),
          );
        }
        if (bindings.cookieIds.length) {
          await database.insert(environmentProfileCookies).values(
            bindings.cookieIds.map((cookieId) => ({
              profileId: id,
              cookieId,
            })),
          );
        }
        if (bindings.headerIds.length) {
          await database.insert(environmentProfileHeaders).values(
            bindings.headerIds.map((headerId) => ({
              profileId: id,
              headerId,
            })),
          );
        }
      }
      const bumpsRevision = bindings !== undefined || values.name !== undefined;
      const [profile] = await database
        .update(environmentProfiles)
        .set({
          ...values,
          ...(bumpsRevision
            ? { revision: sql`${environmentProfiles.revision} + 1` }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(environmentProfiles.id, id))
        .returning();
      return profile;
    },
    async deleteProfile(id: number) {
      const [profile] = await database
        .delete(environmentProfiles)
        .where(eq(environmentProfiles.id, id))
        .returning();
      return profile;
    },
    async bumpProfilesForBinding(
      kind: 'variable' | 'cookie' | 'header',
      bindingId: number,
    ) {
      const table =
        kind === 'variable'
          ? environmentProfileVariables
          : kind === 'cookie'
            ? environmentProfileCookies
            : environmentProfileHeaders;
      const column =
        kind === 'variable'
          ? environmentProfileVariables.variableId
          : kind === 'cookie'
            ? environmentProfileCookies.cookieId
            : environmentProfileHeaders.headerId;
      const rows = await database
        .select({ profileId: table.profileId })
        .from(table)
        .where(eq(column, bindingId));
      const profileIds = [...new Set(rows.map(({ profileId }) => profileId))];
      if (!profileIds.length) return;
      await database
        .update(environmentProfiles)
        .set({
          revision: sql`${environmentProfiles.revision} + 1`,
          updatedAt: new Date(),
        })
        .where(inArray(environmentProfiles.id, profileIds));
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
    listHeaders(environmentId: number) {
      return database.query.environmentHeaders.findMany({
        where: eq(environmentHeaders.environmentId, environmentId),
        orderBy: (table, { asc }) => [asc(table.name), asc(table.origin)],
      });
    },
    findHeader(id: number) {
      return database.query.environmentHeaders.findFirst({
        where: eq(environmentHeaders.id, id),
      });
    },
    async createHeader(values: typeof environmentHeaders.$inferInsert) {
      const [header] = await database
        .insert(environmentHeaders)
        .values(values)
        .returning();
      return header;
    },
    async updateHeader(
      id: number,
      values: Partial<typeof environmentHeaders.$inferInsert>,
    ) {
      const [header] = await database
        .update(environmentHeaders)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(environmentHeaders.id, id))
        .returning();
      return header;
    },
    async deleteHeader(id: number) {
      const [header] = await database
        .delete(environmentHeaders)
        .where(eq(environmentHeaders.id, id))
        .returning();
      return header;
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
