import { and, db, eq, teamMembers, teams, users } from '@probe/db';

export function createTeamRepository(database = db) {
  return {
    list(projectId: number) {
      return database.query.teams.findMany({
        where: eq(teams.projectId, projectId),
        with: {
          members: {
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
          },
        },
        orderBy: (table, { asc }) => [asc(table.name)],
      });
    },
    async create(values: typeof teams.$inferInsert) {
      const [team] = await database.insert(teams).values(values).returning();
      return team;
    },
    findUser(id: number) {
      return database.query.users.findFirst({ where: eq(users.id, id) });
    },
    findMember(teamId: number, userId: number) {
      return database.query.teamMembers.findFirst({
        where: and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId),
        ),
      });
    },
    async addMember(values: typeof teamMembers.$inferInsert) {
      const [member] = await database.insert(teamMembers).values(values).returning();
      return member;
    },
    async updateRole(
      teamId: number,
      userId: number,
      role: typeof teamMembers.$inferInsert.role,
    ) {
      const [member] = await database
        .update(teamMembers)
        .set({ role })
        .where(
          and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
        )
        .returning();
      return member;
    },
    async removeMember(teamId: number, userId: number) {
      const [member] = await database
        .delete(teamMembers)
        .where(
          and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
        )
        .returning();
      return member;
    },
  };
}
