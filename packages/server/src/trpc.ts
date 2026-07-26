import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { AppError } from '@probe/shared/errors/app-error';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

const withAppErrorMapping = t.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error instanceof AppError) {
      throw new TRPCError({ code: error.code, message: error.message });
    }
    throw error;
  }
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;

// Public procedures (no auth required)
export const publicProcedure = t.procedure.use(withAppErrorMapping);

// Protected procedures (auth required)
export const protectedProcedure = t.procedure
  .use(withAppErrorMapping)
  .use(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  });
