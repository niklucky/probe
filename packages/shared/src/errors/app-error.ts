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
