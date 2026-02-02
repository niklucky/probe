import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { db, users, eq } from '@signal/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { TRPCError } from '@trpc/server';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

export const authRouter = router({
  register: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      // Debug logging
      console.log('Register called with input:', input);
      console.log('Context:', ctx);
      
      if (!input || !input.email || !input.password || !input.name) {
        console.error('Invalid input received:', input);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Missing required fields',
        });
      }
      
      try {
        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, input.email),
        });

        if (existingUser) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'User with this email already exists',
          });
        }

        const passwordHash = await bcrypt.hash(input.password, 10);
        
        const [newUser] = await db.insert(users).values({
          email: input.email,
          passwordHash,
          name: input.name,
          role: 'viewer',
        }).returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          avatarUrl: users.avatarUrl,
          avatarType: users.avatarType,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

        // Convert dates to ISO strings for serialization
        const userResponse = {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          avatarUrl: newUser.avatarUrl,
          avatarType: newUser.avatarType,
          createdAt: newUser.createdAt instanceof Date ? newUser.createdAt.toISOString() : newUser.createdAt,
          updatedAt: newUser.updatedAt instanceof Date ? newUser.updatedAt.toISOString() : newUser.updatedAt,
        };

        const token = jwt.sign(
          { userId: newUser.id, email: newUser.email },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        return {
          token,
          user: userResponse,
        };
      } catch (error) {
        console.error('Registration error:', error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to register user',
        });
      }
    }),

  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const user = await db.query.users.findFirst({
          where: eq(users.email, input.email),
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Invalid email or password',
          });
        }

        const isValid = await bcrypt.compare(input.password, user.passwordHash);

        if (!isValid) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Invalid email or password',
          });
        }

        const token = jwt.sign(
          { userId: user.id, email: user.email },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        // Convert dates to ISO strings for serialization
        const userResponse = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl,
          avatarType: user.avatarType,
          createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
          updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : user.updatedAt,
        };

        return {
          token,
          user: userResponse,
        };
      } catch (error) {
        console.error('Login error:', error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to login',
        });
      }
    }),

  me: protectedProcedure
    .query(({ ctx }) => {
      return ctx.user;
    }),
});
