import { describe, expect, test } from 'bun:test';
import {
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from './app-error';

describe('application error wrappers', () => {
  test.each([
    [BadRequestError, 'BAD_REQUEST'],
    [ConflictError, 'CONFLICT'],
    [InternalServerError, 'INTERNAL_SERVER_ERROR'],
    [NotFoundError, 'NOT_FOUND'],
    [UnauthorizedError, 'UNAUTHORIZED'],
  ] as const)('%s maps to %s', (ErrorType, code) => {
    expect(new ErrorType('message')).toMatchObject({
      code,
      message: 'message',
    });
  });
});
