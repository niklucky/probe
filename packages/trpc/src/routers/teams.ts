import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { db, teams, teamMembers, users, eq, and } from '@signal/db';
import { TRPCError } from '@trpc/server';

export const teamsRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const projectTeams = await db.query.teams.findMany({
        where: eq(teams.projectId, input.projectId),
        with: {
          members: {
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: (teams, { asc }) => [asc(teams.name)],
      });
      return projectTeams;
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      name: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const [team] = await db.insert(teams).values({
        projectId: input.projectId,
        name: input.name,
      }).returning();

      return team;
    }),

  addMember: protectedProcedure
    .input(z.object({
      teamId: z.number(),
      userId: z.number(),
      role: z.enum(['admin', 'qa', 'manual_tester', 'viewer']),
    }))
    .mutation(async ({ input }) => {
      // Check if user exists
      const userExists = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });

      if (!userExists) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Check if already a member
      const existingMember = await db.query.teamMembers.findFirst({
        where: and(
          eq(teamMembers.teamId, input.teamId),
          eq(teamMembers.userId, input.userId)
        ),
      });

      if (existingMember) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'User is already a member of this team',
        });
      }

      const [member] = await db.insert(teamMembers).values({
        teamId: input.teamId,
        userId: input.userId,
        role: input.role,
        joinedAt: new Date(),
      }).returning();

      return member;
    }),

  updateMemberRole: protectedProcedure
    .input(z.object({
      teamId: z.number(),
      userId: z.number(),
      role: z.enum(['admin', 'qa', 'manual_tester', 'viewer']),
    }))
    .mutation(async ({ input }) => {
      const [member] = await db.update(teamMembers)
        .set({ role: input.role })
        .where(and(
          eq(teamMembers.teamId, input.teamId),
          eq(teamMembers.userId, input.userId)
        ))
        .returning();

      if (!member) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Team member not found',
        });
      }

      return member;
    }),

  removeMember: protectedProcedure
    .input(z.object({
      teamId: z.number(),
      userId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const [member] = await db.delete(teamMembers)
        .where(and(
          eq(teamMembers.teamId, input.teamId),
          eq(teamMembers.userId, input.userId)
        ))
        .returning();

      if (!member) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Team member not found',
        });
      }

      return { success: true };
    }),
});
