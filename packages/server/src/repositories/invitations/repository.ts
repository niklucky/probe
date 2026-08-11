import {
  and,
  db,
  desc,
  eq,
  isNull,
  or,
  projectMembers,
  projects,
  sql,
  teamInvitations,
  teamMembers,
  teams,
  users,
} from '@probe/db';

type InvitationInsert = typeof teamInvitations.$inferInsert;

export function createInvitationRepository(database = db) {
  const pending = and(
    isNull(teamInvitations.acceptedAt),
    isNull(teamInvitations.declinedAt),
    isNull(teamInvitations.cancelledAt),
    isNull(teamInvitations.expiredAt),
    sql`${teamInvitations.expiresAt} > now()`,
  );

  const targetProjectId = sql<number>`coalesce(${teams.projectId}, ${teamInvitations.projectId})`;

  return {
    findTeam(id: number) {
      return database.query.teams.findFirst({
        where: eq(teams.id, id),
        with: { project: true },
      });
    },
    findProject(id: number) {
      return database.query.projects.findFirst({ where: eq(projects.id, id) });
    },
    findUserByEmail(email: string) {
      return database.query.users.findFirst({
        where: sql`lower(${users.email}) = ${email.trim().toLowerCase()}`,
      });
    },
    findTeamMember(teamId: number, userId: number) {
      return database.query.teamMembers.findFirst({
        where: and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId),
        ),
      });
    },
    findProjectMember(projectId: number, userId: number) {
      return database.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
        ),
      });
    },
    async createOrRefresh(values: InvitationInsert) {
      return database.transaction(async (transaction) => {
        const target = values.teamId
          ? `team:${values.teamId}`
          : `project:${values.projectId}`;
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`${target}:${values.email}`}))`,
        );
        const targetFilter = values.teamId
          ? eq(teamInvitations.teamId, values.teamId)
          : eq(teamInvitations.projectId, values.projectId!);
        const [existing] = await transaction
          .select()
          .from(teamInvitations)
          .where(
            and(
              targetFilter,
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
          projectId: targetProjectId,
          email: teamInvitations.email,
          role: teamInvitations.role,
          expiresAt: teamInvitations.expiresAt,
          acceptedAt: teamInvitations.acceptedAt,
          declinedAt: teamInvitations.declinedAt,
          cancelledAt: teamInvitations.cancelledAt,
          expiredAt: teamInvitations.expiredAt,
          teamName: teams.name,
          projectName: projects.name,
          invitedByName: users.name,
          invitedByEmail: users.email,
        })
        .from(teamInvitations)
        .leftJoin(teams, eq(teamInvitations.teamId, teams.id))
        .innerJoin(projects, eq(projects.id, targetProjectId))
        .innerJoin(users, eq(teamInvitations.invitedById, users.id))
        .where(eq(teamInvitations.tokenHash, tokenHash))
        .limit(1);
      return row;
    },
    listPending(email: string) {
      return database
        .select({
          id: teamInvitations.id,
          teamId: teamInvitations.teamId,
          projectId: targetProjectId,
          email: teamInvitations.email,
          role: teamInvitations.role,
          expiresAt: teamInvitations.expiresAt,
          teamName: teams.name,
          projectName: projects.name,
          invitedByName: users.name,
          invitedByEmail: users.email,
        })
        .from(teamInvitations)
        .leftJoin(teams, eq(teamInvitations.teamId, teams.id))
        .innerJoin(projects, eq(projects.id, targetProjectId))
        .innerJoin(users, eq(teamInvitations.invitedById, users.id))
        .where(and(eq(teamInvitations.email, email), pending))
        .orderBy(teamInvitations.createdAt);
    },
    async listForProject(projectId: number) {
      return database
        .select({
          id: teamInvitations.id,
          teamId: teamInvitations.teamId,
          projectId: targetProjectId,
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
        .leftJoin(teams, eq(teamInvitations.teamId, teams.id))
        .leftJoin(users, sql`lower(${users.email}) = ${teamInvitations.email}`)
        .where(
          or(
            eq(teams.projectId, projectId),
            eq(teamInvitations.projectId, projectId),
          ),
        )
        .orderBy(desc(teamInvitations.createdAt));
    },
    findById(id: number) {
      return database.query.teamInvitations.findFirst({
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
    accept(
      id: number,
      values: {
        userId: number;
        role: 'admin' | 'qa' | 'manual_tester' | 'viewer';
        joinedAt: Date;
      },
    ) {
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

        if (invitation.teamId) {
          await transaction
            .insert(teamMembers)
            .values({ ...values, teamId: invitation.teamId })
            .onConflictDoNothing({
              target: [teamMembers.teamId, teamMembers.userId],
            });
        } else {
          await transaction
            .insert(projectMembers)
            .values({ ...values, projectId: invitation.projectId! })
            .onConflictDoNothing({
              target: [projectMembers.projectId, projectMembers.userId],
            });
        }
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
        const membership = {
          userId: user.id,
          role: invitation.role,
          joinedAt: new Date(),
        };
        if (invitation.teamId) {
          await transaction
            .insert(teamMembers)
            .values({ ...membership, teamId: invitation.teamId })
            .onConflictDoNothing({
              target: [teamMembers.teamId, teamMembers.userId],
            });
        } else {
          await transaction
            .insert(projectMembers)
            .values({ ...membership, projectId: invitation.projectId! })
            .onConflictDoNothing({
              target: [projectMembers.projectId, projectMembers.userId],
            });
        }
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
