import { and, db, eq, projectMembers, projects } from '@probe/db';

export function createProjectMemberRepository(database = db) {
  return {
    list(projectId: number) {
      return database.query.projectMembers.findMany({
        where: eq(projectMembers.projectId, projectId),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: (table, { asc }) => [asc(table.invitedAt)],
      });
    },
    findProject(projectId: number) {
      return database.query.projects.findFirst({
        where: eq(projects.id, projectId),
        columns: { createdById: true },
      });
    },
    async updateRole(
      projectId: number,
      userId: number,
      role: typeof projectMembers.$inferInsert.role,
    ) {
      const [member] = await database
        .update(projectMembers)
        .set({ role })
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, userId),
          ),
        )
        .returning();
      return member;
    },
    async remove(projectId: number, userId: number) {
      const [member] = await database
        .delete(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, userId),
          ),
        )
        .returning();
      return member;
    },
  };
}

export type ProjectMemberRepository = ReturnType<
  typeof createProjectMemberRepository
>;
