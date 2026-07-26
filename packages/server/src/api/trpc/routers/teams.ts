import {
  addTeamMemberInputSchema,
  createTeamInputSchema,
  listTeamsInputSchema,
  teamMemberInputSchema,
  updateTeamMemberRoleInputSchema,
} from '@probe/shared/schemas/teams';
import { protectedProcedure, router } from '../../../trpc';

export const teamsRouter = router({
  list: protectedProcedure
    .input(listTeamsInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.teams.list(input.projectId, ctx.user.id),
    ),
  create: protectedProcedure
    .input(createTeamInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.teams.create(input, ctx.user.id),
    ),
  addMember: protectedProcedure
    .input(addTeamMemberInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.teams.addMember(
        input.teamId,
        input.userId,
        input.role,
        ctx.user.id,
      ),
    ),
  updateMemberRole: protectedProcedure
    .input(updateTeamMemberRoleInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.teams.updateRole(
        input.teamId,
        input.userId,
        input.role,
        ctx.user.id,
      ),
    ),
  removeMember: protectedProcedure
    .input(teamMemberInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.teams.removeMember(input.teamId, input.userId, ctx.user.id),
    ),
});
