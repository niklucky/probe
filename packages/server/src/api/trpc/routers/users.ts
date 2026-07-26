import {
  changePasswordInputSchema,
  searchUsersInputSchema,
  updateAvatarInputSchema,
  updateProfileInputSchema,
} from '@probe/shared/schemas/users';
import { protectedProcedure, router } from '../../../trpc';

export const usersRouter = router({
  getProfile: protectedProcedure.query(({ ctx }) =>
    ctx.services.users.getProfile(ctx.user.id),
  ),
  updateProfile: protectedProcedure
    .input(updateProfileInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.users.updateProfile(ctx.user.id, input),
    ),
  updateAvatar: protectedProcedure
    .input(updateAvatarInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.users.updateAvatar(ctx.user.id, input),
    ),
  changePassword: protectedProcedure
    .input(changePasswordInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.users.changePassword(
        ctx.user.id,
        input.currentPassword,
        input.newPassword,
      ),
    ),
  search: protectedProcedure
    .input(searchUsersInputSchema)
    .query(({ ctx, input }) => ctx.services.users.search(input.query, input.limit)),
});
