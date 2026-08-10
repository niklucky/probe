import {
  and,
  db,
  desc,
  eq,
  isNull,
  projects,
  sql,
  teamInvitations,
  teamMembers,
  teams,
  users,
} from '@probe/db';

export function createInvitationRepository(database = db) {
  const pending = and(
    isNull(teamInvitations.acceptedAt),
    isNull(teamInvitations.declinedAt),
    isNull(teamInvitations.cancelledAt),
    sql`${teamInvitations.expiresAt} > now()`,
  );

  return {
    findTeam(id: number) {
      return database.query.teams.findFirst({
        where: eq(teams.id, id),
        with: { project: true },
      });
    },
    findUserByEmail(email: string) {
      return database.query.users.findFirst({
        where: sql`lower(${users.email}) = ${email.trim().toLowerCase()}`,
      });
    },
    findMember(teamId: number, userId: number) {
      return database.query.teamMembers.findFirst({
        where: and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId),
        ),
      });
    },
    async createOrRefresh(values: typeof teamInvitations.$inferInsert) {
      const [invitation] = await database
        .insert(teamInvitations)
        .values(values)
        .onConflictDoUpdate({
          target: [teamInvitations.teamId, teamInvitations.email],
          set: {
            role: values.role,
            invitedById: values.invitedById,
            tokenHash: values.tokenHash,
            expiresAt: values.expiresAt,
            acceptedAt: null,
            declinedAt: null,
            cancelledAt: null,
            updatedAt: new Date(),
          },
        })
        .returning();
      return invitation;
    },
    async findByTokenHash(tokenHash: string) {
      const [row] = await database
        .select({
          id: teamInvitations.id,
          teamId: teamInvitations.teamId,
          email: teamInvitations.email,
          role: teamInvitations.role,
          expiresAt: teamInvitations.expiresAt,
          acceptedAt: teamInvitations.acceptedAt,
          declinedAt: teamInvitations.declinedAt,
          cancelledAt: teamInvitations.cancelledAt,
          teamName: teams.name,
          projectId: projects.id,
          projectName: projects.name,
          invitedByName: users.name,
          invitedByEmail: users.email,
        })
        .from(teamInvitations)
        .innerJoin(teams, eq(teamInvitations.teamId, teams.id))
        .innerJoin(projects, eq(teams.projectId, projects.id))
        .innerJoin(users, eq(teamInvitations.invitedById, users.id))
        .where(eq(teamInvitations.tokenHash, tokenHash))
        .limit(1);
      return row;
    },
    async listPending(email: string) {
      return database
        .select({
          id: teamInvitations.id,
          teamId: teamInvitations.teamId,
          email: teamInvitations.email,
          role: teamInvitations.role,
          expiresAt: teamInvitations.expiresAt,
          teamName: teams.name,
          projectId: projects.id,
          projectName: projects.name,
          invitedByName: users.name,
          invitedByEmail: users.email,
        })
        .from(teamInvitations)
        .innerJoin(teams, eq(teamInvitations.teamId, teams.id))
        .innerJoin(projects, eq(teams.projectId, projects.id))
        .innerJoin(users, eq(teamInvitations.invitedById, users.id))
        .where(and(eq(teamInvitations.email, email), pending))
        .orderBy(teamInvitations.createdAt);
    },
    listForProject(projectId: number) {
      return database
        .select({
          id: teamInvitations.id,
          teamId: teamInvitations.teamId,
          teamName: teams.name,
          email: teamInvitations.email,
          recipientName: users.name,
          role: teamInvitations.role,
          expiresAt: teamInvitations.expiresAt,
          acceptedAt: teamInvitations.acceptedAt,
          declinedAt: teamInvitations.declinedAt,
          cancelledAt: teamInvitations.cancelledAt,
          createdAt: teamInvitations.createdAt,
        })
        .from(teamInvitations)
        .innerJoin(teams, eq(teamInvitations.teamId, teams.id))
        .leftJoin(users, sql`lower(${users.email}) = ${teamInvitations.email}`)
        .where(eq(teams.projectId, projectId))
        .orderBy(desc(teamInvitations.createdAt));
    },
    findById(id: number) {
      return database.query.teamInvitations.findFirst({
        where: eq(teamInvitations.id, id),
      });
    },
    async findPendingById(id: number, email: string) {
      const [row] = await database
        .select()
        .from(teamInvitations)
        .where(
          and(
            eq(teamInvitations.id, id),
            eq(teamInvitations.email, email),
            pending,
          ),
        )
        .limit(1);
      return row;
    },
    accept(id: number, values: typeof teamMembers.$inferInsert) {
      return database.transaction(async (transaction) => {
        const [invitation] = await transaction
          .select({ id: teamInvitations.id })
          .from(teamInvitations)
          .where(and(eq(teamInvitations.id, id), pending))
          .for('update')
          .limit(1);
        if (!invitation) return false;

        await transaction
          .insert(teamMembers)
          .values(values)
          .onConflictDoNothing({
            target: [teamMembers.teamId, teamMembers.userId],
          });
        await transaction
          .update(teamInvitations)
          .set({ acceptedAt: new Date(), updatedAt: new Date() })
          .where(eq(teamInvitations.id, id));
        return true;
      });
    },
    async markDeclined(id: number) {
      const [invitation] = await database
        .update(teamInvitations)
        .set({ declinedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(teamInvitations.id, id), pending))
        .returning();
      return invitation;
    },
    async markCancelled(id: number) {
      const [invitation] = await database
        .update(teamInvitations)
        .set({ cancelledAt: new Date(), updatedAt: new Date() })
        .where(and(eq(teamInvitations.id, id), pending))
        .returning();
      return invitation;
    },
  };
}

export type InvitationRepository = ReturnType<
  typeof createInvitationRepository
>;
