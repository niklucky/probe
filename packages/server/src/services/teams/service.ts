import { AppError } from '@probe/shared/errors/app-error';
import type { createTeamRepository } from '../../repositories/teams/repository';

type Repository = ReturnType<typeof createTeamRepository>;

export function createTeamService(repository: Repository) {
  return {
    list: (projectId: number) => repository.list(projectId),
    create: (input: Parameters<Repository['create']>[0]) =>
      repository.create(input),
    async addMember(
      teamId: number,
      userId: number,
      role: Parameters<Repository['updateRole']>[2],
    ) {
      if (!(await repository.findUser(userId))) {
        throw new AppError('NOT_FOUND', 'User not found');
      }
      if (await repository.findMember(teamId, userId)) {
        throw new AppError('CONFLICT', 'User is already a member of this team');
      }
      return repository.addMember({ teamId, userId, role, joinedAt: new Date() });
    },
    async updateRole(
      teamId: number,
      userId: number,
      role: Parameters<Repository['updateRole']>[2],
    ) {
      const member = await repository.updateRole(teamId, userId, role);
      if (!member) throw new AppError('NOT_FOUND', 'Team member not found');
      return member;
    },
    async removeMember(teamId: number, userId: number) {
      const member = await repository.removeMember(teamId, userId);
      if (!member) throw new AppError('NOT_FOUND', 'Team member not found');
      return { success: true };
    },
  };
}
