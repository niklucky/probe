export type AppErrorCode =
  | 'BAD_REQUEST'
  | 'CONFLICT'
  | 'INTERNAL_SERVER_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return { code: this.code, message: this.message };
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super('BAD_REQUEST', message);
    this.name = 'BadRequestError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message);
    this.name = 'ConflictError';
  }
}

export class InternalServerError extends AppError {
  constructor(message: string) {
    super('INTERNAL_SERVER_ERROR', message);
    this.name = 'InternalServerError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super('UNAUTHORIZED', message);
    this.name = 'UnauthorizedError';
  }
}
