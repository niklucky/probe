import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '@probe/shared/errors/app-error';
import type { createUserRepository } from '../../repositories/users/repository';
import { serverEnv } from '../../env';

type Repository = ReturnType<typeof createUserRepository>;

const jwtSecret = serverEnv.JWT_SECRET;

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
      return { token: issueToken(user), user };
    },

    async login(input: { email: string; password: string }) {
      const user = await repository.findByEmail(input.email);
      if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
        throw new AppError('NOT_FOUND', 'Invalid email or password');
      }
      return {
        token: issueToken(user),
        user,
      };
    },

    async resolveUser(token: string) {
      try {
        const payload = jwt.verify(token, jwtSecret) as { userId: number };
        return (await repository.findPublicById(payload.userId)) ?? null;
      } catch {
        return null;
      }
    },
  };
}
