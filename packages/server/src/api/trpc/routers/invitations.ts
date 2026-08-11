import {
  invitationIdInputSchema,
  invitationTokenInputSchema,
  inviteTeamMemberInputSchema,
  listProjectInvitationsInputSchema,
} from '@probe/shared/schemas/invitations';
import { protectedProcedure, publicProcedure, router } from '../../../trpc';

export const invitationsRouter = router({
  invite: protectedProcedure
    .input(inviteTeamMemberInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.invitations.invite(input, ctx.user),
    ),
  preview: publicProcedure
    .input(invitationTokenInputSchema)
    .query(({ ctx, input }) => ctx.services.invitations.preview(input.token)),
  listPending: protectedProcedure.query(({ ctx }) =>
    ctx.services.invitations.listPending(ctx.user.email),
  ),
  listForProject: protectedProcedure
    .input(listProjectInvitationsInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.invitations.listForProject(input.projectId, ctx.user.id),
    ),
  accept: protectedProcedure
    .input(invitationIdInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.invitations.acceptById(input.id, ctx.user),
    ),
  decline: protectedProcedure
    .input(invitationIdInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.invitations.decline(input.id, ctx.user),
    ),
  cancel: protectedProcedure
    .input(invitationIdInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.invitations.cancel(input.id, ctx.user.id),
    ),
});
