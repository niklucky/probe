import bcrypt from 'bcryptjs';
import { AppError } from '@probe/shared/errors/app-error';
import type { createUserRepository } from '../../repositories/users/repository';

type Repository = ReturnType<typeof createUserRepository>;

export function createUserService(repository: Repository) {
  return {
    async getProfile(userId: number) {
      const user = await repository.findPublicById(userId);
      if (!user) throw new AppError('NOT_FOUND', 'User not found');
      return user;
    },
    async updateProfile(
      userId: number,
      input: { email?: string; name?: string },
    ) {
      if (input.email) {
        const existing = await repository.findByEmail(input.email);
        if (existing && existing.id !== userId) {
          throw new AppError('CONFLICT', 'Email is already taken');
        }
      }
      return repository.updatePublic(userId, input);
    },
    updateAvatar(
      userId: number,
      input: {
        avatarUrl: string;
        avatarType: 'predefined' | 'custom';
      },
    ) {
      return repository.updatePublic(userId, input);
    },
    async changePassword(
      userId: number,
      currentPassword: string,
      newPassword: string,
    ) {
      const user = await repository.findById(userId);
      if (!user) throw new AppError('NOT_FOUND', 'User not found');
      if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
        throw new AppError('BAD_REQUEST', 'Current password is incorrect');
      }
      await repository.updatePassword(userId, await bcrypt.hash(newPassword, 10));
      return { success: true };
    },
    search: (query: string, limit: number) => repository.search(query, limit),
  };
}
