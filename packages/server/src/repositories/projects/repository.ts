import { and, db, eq, projects } from '@probe/db';

export function createProjectRepository(database = db) {
  return {
    listByOwner(createdById: number) {
      return database.query.projects.findMany({
        where: eq(projects.createdById, createdById),
        orderBy: (table, { desc }) => [desc(table.updatedAt)],
      });
    },

    findOwned(id: number, createdById: number) {
      return database.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.createdById, createdById)),
      });
    },

    async create(values: typeof projects.$inferInsert) {
      const [project] = await database.insert(projects).values(values).returning();
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
