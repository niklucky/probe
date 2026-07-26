import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '@probe/shared/errors/app-error';
import type { User } from '@probe/shared';
import type { createUserRepository } from '../../repositories/users/repository';

type Repository = ReturnType<typeof createUserRepository>;

const jwtSecret =
  process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

type PublicUser = NonNullable<
  Awaited<ReturnType<Repository['findPublicById']>>
>;

function toContextUser(user: PublicUser): User {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function createAuthService(repository: Repository) {
  function issueToken(user: { id: number; email: string }) {
    return jwt.sign({ userId: user.id, email: user.email }, jwtSecret, {
      expiresIn: '7d',
    });
  }

  return {
    async register(input: { email: string; password: string; name: string }) {
      if (await repository.findByEmail(input.email)) {
        throw new AppError('CONFLICT', 'User with this email already exists');
      }
      const user = await repository.create({
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 10),
        name: input.name,
        role: 'viewer',
      });
      return { token: issueToken(user), user: toContextUser(user) };
    },

    async login(input: { email: string; password: string }) {
      const user = await repository.findByEmail(input.email);
      if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
        throw new AppError('NOT_FOUND', 'Invalid email or password');
      }
      return {
        token: issueToken(user),
        user: toContextUser(user),
      };
    },

    async resolveUser(token: string): Promise<User | null> {
      try {
        const payload = jwt.verify(token, jwtSecret) as { userId: number };
        const user = await repository.findPublicById(payload.userId);
        return user ? toContextUser(user) : null;
      } catch {
        return null;
      }
    },
  };
}
