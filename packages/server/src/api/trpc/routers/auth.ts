import {
  loginInputSchema,
  registerInputSchema,
} from '@probe/shared/schemas/users';
import { protectedProcedure, publicProcedure, router } from '../../../trpc';

export const authRouter = router({
  register: publicProcedure
    .input(registerInputSchema)
    .mutation(({ ctx, input }) => ctx.services.auth.register(input)),
  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ ctx, input }) => ctx.services.auth.login(input)),
  me: protectedProcedure.query(({ ctx }) => ctx.user),
});
