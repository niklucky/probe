import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '@probe/shared/errors/app-error';
import type { createUserRepository } from '../../repositories/users/repository';
import { serverEnv } from '../../env';
import type { InvitationService } from '../invitations/service';

type Repository = ReturnType<typeof createUserRepository>;

const jwtSecret = serverEnv.JWT_SECRET;

export function createAuthService(
  repository: Repository,
  invitations?: InvitationService,
) {
  function issueToken(user: { id: number; email: string }) {
    return jwt.sign({ userId: user.id, email: user.email }, jwtSecret, {
      expiresIn: '7d',
    });
  }

  return {
    async register(input: {
      email: string;
      password: string;
      name: string;
      invitationToken?: string;
    }) {
      const email = input.email.trim().toLowerCase();
      if (input.invitationToken) {
        if (!invitations) {
          throw new AppError(
            'INTERNAL_SERVER_ERROR',
            'Invitations are not configured',
          );
        }
      }
      if (await repository.findByEmail(email)) {
        throw new AppError('CONFLICT', 'User with this email already exists');
      }
      const passwordHash = await bcrypt.hash(input.password, 10);
      const user = input.invitationToken
        ? await invitations!.registerUser(input.invitationToken, {
            email,
            passwordHash,
            name: input.name,
          })
        : await repository.create({
            email,
            passwordHash,
            name: input.name,
            role: 'viewer',
          });
      return { token: issueToken(user), user };
    },

    async login(input: { email: string; password: string }) {
      const user = await repository.findByEmail(
        input.email.trim().toLowerCase(),
      );
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
