import { and, db, desc, eq, files } from '@probe/db';

export function createFileRepository(database = db) {
  return {
    async create(values: typeof files.$inferInsert) {
      const [file] = await database.insert(files).values(values).returning();
      return file;
    },
    list(entityType: string, entityId: number) {
      return database.query.files.findMany({
        where: and(
          eq(files.entityType, entityType),
          eq(files.entityId, entityId),
        ),
        orderBy: desc(files.createdAt),
        with: {
          createdBy: {
            columns: {
              id: true,
              email: true,
              name: true,
              role: true,
              avatarUrl: true,
              avatarType: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });
    },
    find(id: number) {
      return database.query.files.findFirst({ where: eq(files.id, id) });
    },
    async delete(id: number) {
      await database.delete(files).where(eq(files.id, id));
    },
  };
}
