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
  const result = await next();
  if (!result.ok && result.error.cause instanceof AppError) {
    throw new TRPCError({
      code: result.error.cause.code,
      message: result.error.cause.message,
      cause: result.error.cause,
    });
  }
  return result;
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
