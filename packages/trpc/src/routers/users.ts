import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { db, users, eq, like } from '@probe/db';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';

export const usersRouter = router({
  // Get current user profile
  getProfile: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.user.id),
        columns: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatarUrl: true,
          avatarType: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      return user;
    }),

  // Update profile (email, name)
  updateProfile: protectedProcedure
    .input(z.object({
      email: z.string().email().optional(),
      name: z.string().min(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if email is already taken by another user
      if (input.email) {
        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, input.email),
        });

        if (existingUser && existingUser.id !== ctx.user.id) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Email is already taken',
          });
        }
      }

      const [updatedUser] = await db.update(users)
        .set({
          ...(input.email && { email: input.email }),
          ...(input.name && { name: input.name }),
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.user.id))
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

      return updatedUser;
    }),

  // Update avatar
  updateAvatar: protectedProcedure
    .input(z.object({
      avatarUrl: z.string().min(1),
      avatarType: z.enum(['predefined', 'custom']),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updatedUser] = await db.update(users)
        .set({
          avatarUrl: input.avatarUrl,
          avatarType: input.avatarType,
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.user.id))
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

      return updatedUser;
    }),

  // Change password
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.user.id),
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);

      if (!isValid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Current password is incorrect',
        });
      }

      const newPasswordHash = await bcrypt.hash(input.newPassword, 10);

      await db.update(users)
        .set({
          passwordHash: newPasswordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.user.id));

      return { success: true };
    }),

  // Search users (for adding to teams)
  search: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ input }) => {
      const searchResults = await db.query.users.findMany({
        where: like(users.email, `%${input.query}%`),
        columns: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
        },
        limit: input.limit,
      });

      return searchResults;
    }),
});
