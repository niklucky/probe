import {
  listProjectMembersInputSchema,
  projectMemberInputSchema,
  updateProjectMemberRoleInputSchema,
} from '@probe/shared/schemas/project-members';
import { protectedProcedure, router } from '../../../trpc';

export const projectMembersRouter = router({
  list: protectedProcedure
    .input(listProjectMembersInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.projectMembers.list(input.projectId, ctx.user.id),
    ),
  updateRole: protectedProcedure
    .input(updateProjectMemberRoleInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.projectMembers.updateRole(
        input.projectId,
        input.userId,
        input.role,
        ctx.user.id,
      ),
    ),
  remove: protectedProcedure
    .input(projectMemberInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.projectMembers.remove(
        input.projectId,
        input.userId,
        ctx.user.id,
      ),
    ),
});
