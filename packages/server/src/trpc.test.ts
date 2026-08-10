import { describe, expect, test } from 'bun:test';
import { AppError } from '@probe/shared/errors/app-error';
import type { Context } from './context';
import { protectedProcedure, router } from './trpc';

describe('tRPC application error mapping', () => {
  test('preserves application error codes from downstream resolvers', async () => {
    const testRouter = router({
      fail: protectedProcedure.query(() => {
        throw new AppError('NOT_FOUND', 'Resource not found');
      }),
    });
    const caller = testRouter.createCaller({
      user: {
        id: 1,
        email: 'user@example.com',
        name: 'User',
        role: 'viewer',
        avatarUrl: null,
        avatarType: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      services: {} as Context['services'],
    });

    await expect(caller.fail()).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Resource not found',
    });
  });
});
