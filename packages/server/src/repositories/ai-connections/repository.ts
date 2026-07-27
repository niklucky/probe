import {
  aiConnectionAuditLogs,
  aiConnections,
  and,
  asc,
  db,
  desc,
  eq,
  type CreateAiConnection,
} from '@probe/db';

type Database = typeof db;

const safeSelection = {
  id: aiConnections.id,
  name: aiConnections.name,
  provider: aiConnections.provider,
  endpoint: aiConnections.endpoint,
  model: aiConnections.model,
  capabilities: aiConnections.capabilities,
  scope: aiConnections.scope,
  enabled: aiConnections.enabled,
  isDefault: aiConnections.isDefault,
  hasCredentials: aiConnections.hasCredentials,
  createdById: aiConnections.createdById,
  createdAt: aiConnections.createdAt,
  updatedAt: aiConnections.updatedAt,
};

function bindAiConnectionRepository(database: Database) {
  return {
    list() {
      return database
        .select(safeSelection)
        .from(aiConnections)
        .orderBy(desc(aiConnections.isDefault), asc(aiConnections.name));
    },
    listEnabledByScope(scope: typeof aiConnections.$inferSelect.scope) {
      return database
        .select(safeSelection)
        .from(aiConnections)
        .where(
          and(eq(aiConnections.scope, scope), eq(aiConnections.enabled, true)),
        )
        .orderBy(desc(aiConnections.isDefault), asc(aiConnections.name));
    },
    async find(id: number) {
      const [connection] = await database
        .select()
        .from(aiConnections)
        .where(eq(aiConnections.id, id))
        .limit(1);
      return connection;
    },
    async create(values: CreateAiConnection) {
      const [connection] = await database
        .insert(aiConnections)
        .values(values)
        .returning(safeSelection);
      return connection;
    },
    async update(id: number, values: Partial<CreateAiConnection>) {
      const [connection] = await database
        .update(aiConnections)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(aiConnections.id, id))
        .returning(safeSelection);
      return connection;
    },
    async delete(id: number) {
      const [connection] = await database
        .delete(aiConnections)
        .where(eq(aiConnections.id, id))
        .returning({ id: aiConnections.id });
      return connection;
    },
    async clearDefault(scope: typeof aiConnections.$inferSelect.scope) {
      await database
        .update(aiConnections)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(aiConnections.scope, scope),
            eq(aiConnections.isDefault, true),
          ),
        );
    },
    async getDefault(scope: typeof aiConnections.$inferSelect.scope) {
      const [connection] = await database
        .select()
        .from(aiConnections)
        .where(
          and(
            eq(aiConnections.scope, scope),
            eq(aiConnections.enabled, true),
            eq(aiConnections.isDefault, true),
          ),
        )
        .limit(1);
      return connection;
    },
    async audit(
      connectionId: number | null,
      actorUserId: number,
      action: string,
      changes: Record<string, unknown>,
    ) {
      await database.insert(aiConnectionAuditLogs).values({
        connectionId,
        actorUserId,
        action,
        changes,
      });
    },
  };
}

export function createAiConnectionRepository(database: Database = db) {
  return {
    ...bindAiConnectionRepository(database),
    withTransaction<T>(
      operation: (
        repository: ReturnType<typeof bindAiConnectionRepository>,
      ) => Promise<T>,
    ) {
      return database.transaction((transaction) =>
        operation(
          bindAiConnectionRepository(transaction as unknown as Database),
        ),
      );
    },
  };
}

export type AiConnectionRepository = ReturnType<
  typeof createAiConnectionRepository
>;
