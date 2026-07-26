import { db, eq, inArray, projects } from '@probe/db';

export function createProjectRepository(database = db) {
  return {
    listAccessible(ids: number[]) {
      if (ids.length === 0) return Promise.resolve([]);
      return database.query.projects.findMany({
        where: inArray(projects.id, ids),
        orderBy: (table, { desc }) => [desc(table.updatedAt)],
      });
    },

    find(id: number) {
      return database.query.projects.findFirst({
        where: eq(projects.id, id),
      });
    },

    async create(values: typeof projects.$inferInsert) {
      const [project] = await database
        .insert(projects)
        .values(values)
        .returning();
      return project;
    },

    async update(id: number, values: Partial<typeof projects.$inferInsert>) {
      const [project] = await database
        .update(projects)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(projects.id, id))
        .returning();
      return project;
    },

    async delete(id: number) {
      await database.delete(projects).where(eq(projects.id, id));
    },
  };
}

export type ProjectRepository = ReturnType<typeof createProjectRepository>;
