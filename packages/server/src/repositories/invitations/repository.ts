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
    isNull(teamInvitations.expiredAt),
    sql`${teamInvitations.expiresAt} > now()`,
  );

  return {
    async findTeam(id: number) {
      return await database.query.teams.findFirst({
        where: eq(teams.id, id),
        with: { project: true },
      });
    },
    async findUserByEmail(email: string) {
      return await database.query.users.findFirst({
        where: sql`lower(${users.email}) = ${email.trim().toLowerCase()}`,
      });
    },
    async findMember(teamId: number, userId: number) {
      return await database.query.teamMembers.findFirst({
        where: and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId),
        ),
      });
    },
    async createOrRefresh(values: typeof teamInvitations.$inferInsert) {
      return database.transaction(async (transaction) => {
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`${values.teamId}:${values.email}`}))`,
        );
        const [existing] = await transaction
          .select()
          .from(teamInvitations)
          .where(
            and(
              eq(teamInvitations.teamId, values.teamId),
              eq(teamInvitations.email, values.email),
              isNull(teamInvitations.acceptedAt),
              isNull(teamInvitations.declinedAt),
              isNull(teamInvitations.cancelledAt),
              isNull(teamInvitations.expiredAt),
            ),
          )
          .for('update')
          .limit(1);
        const now = new Date();
        if (existing && existing.expiresAt > now) {
          const [invitation] = await transaction
            .update(teamInvitations)
            .set({
              role: values.role,
              invitedById: values.invitedById,
              tokenHash: values.tokenHash,
              expiresAt: values.expiresAt,
              updatedAt: now,
            })
            .where(eq(teamInvitations.id, existing.id))
            .returning();
          return invitation;
        }
        if (existing) {
          await transaction
            .update(teamInvitations)
            .set({ expiredAt: now, updatedAt: now })
            .where(eq(teamInvitations.id, existing.id));
        }
        const [invitation] = await transaction
          .insert(teamInvitations)
          .values(values)
          .returning();
        return invitation;
      });
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
          expiredAt: teamInvitations.expiredAt,
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
    async listForProject(projectId: number) {
      return await database
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
          expiredAt: teamInvitations.expiredAt,
          createdAt: teamInvitations.createdAt,
        })
        .from(teamInvitations)
        .innerJoin(teams, eq(teamInvitations.teamId, teams.id))
        .leftJoin(users, sql`lower(${users.email}) = ${teamInvitations.email}`)
        .where(eq(teams.projectId, projectId))
        .orderBy(desc(teamInvitations.createdAt));
    },
    async findById(id: number) {
      return await database.query.teamInvitations.findFirst({
        where: eq(teamInvitations.id, id),
      });
    },
    async findByIdForEmail(id: number, email: string) {
      const [row] = await database
        .select()
        .from(teamInvitations)
        .where(
          and(
            eq(teamInvitations.id, id),
            sql`lower(${teamInvitations.email}) = ${email.trim().toLowerCase()}`,
          ),
        )
        .limit(1);
      return row;
    },
    accept(id: number, values: typeof teamMembers.$inferInsert) {
      return database.transaction(async (transaction) => {
        const [invitation] = await transaction
          .select()
          .from(teamInvitations)
          .where(eq(teamInvitations.id, id))
          .for('update')
          .limit(1);
        if (!invitation) return false;
        if (invitation.acceptedAt) return true;
        if (
          invitation.declinedAt ||
          invitation.cancelledAt ||
          invitation.expiredAt ||
          invitation.expiresAt <= new Date()
        ) {
          return false;
        }

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
    registerUserAndAccept(
      tokenHash: string,
      email: string,
      values: typeof users.$inferInsert,
    ) {
      return database.transaction(async (transaction) => {
        const [invitation] = await transaction
          .select()
          .from(teamInvitations)
          .where(
            and(
              eq(teamInvitations.tokenHash, tokenHash),
              sql`lower(${teamInvitations.email}) = ${email.trim().toLowerCase()}`,
            ),
          )
          .for('update')
          .limit(1);
        if (
          !invitation ||
          invitation.acceptedAt ||
          invitation.declinedAt ||
          invitation.cancelledAt ||
          invitation.expiredAt ||
          invitation.expiresAt <= new Date()
        ) {
          return { status: 'invalid' as const };
        }
        const existingUser = await transaction.query.users.findFirst({
          where: sql`lower(${users.email}) = ${email.trim().toLowerCase()}`,
          columns: { id: true },
        });
        if (existingUser) return { status: 'conflict' as const };

        const [user] = await transaction
          .insert(users)
          .values(values)
          .returning({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            avatarUrl: users.avatarUrl,
            avatarType: users.avatarType,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          });
        await transaction
          .insert(teamMembers)
          .values({
            teamId: invitation.teamId,
            userId: user.id,
            role: invitation.role,
            joinedAt: new Date(),
          })
          .onConflictDoNothing({
            target: [teamMembers.teamId, teamMembers.userId],
          });
        await transaction
          .update(teamInvitations)
          .set({ acceptedAt: new Date(), updatedAt: new Date() })
          .where(eq(teamInvitations.id, invitation.id));
        return { status: 'accepted' as const, user };
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
