import { AppError } from '@probe/shared/errors/app-error';
import type { createTeamRepository } from '../../repositories/teams/repository';
import type { AuthorizationService } from '../authorization/service';

type Repository = ReturnType<typeof createTeamRepository>;

export function createTeamService(
  repository: Repository,
  authorization: AuthorizationService,
) {
  return {
    async list(projectId: number, actorId: number) {
      await authorization.requireProject(actorId, projectId, 'read');
      return repository.list(projectId);
    },
    async create(input: Parameters<Repository['create']>[0], actorId: number) {
      await authorization.requireProject(actorId, input.projectId, 'manage');
      return repository.create(input);
    },
    async addMember(
      teamId: number,
      userId: number,
      role: Parameters<Repository['updateRole']>[2],
      actorId: number,
    ) {
      await authorization.require(
        actorId,
        { type: 'team', id: teamId },
        'manage',
      );
      if (!(await repository.findUser(userId))) {
        throw new AppError('NOT_FOUND', 'User not found');
      }
      if (await repository.findMember(teamId, userId)) {
        throw new AppError('CONFLICT', 'User is already a member of this team');
      }
      return repository.addMember({
        teamId,
        userId,
        role,
        joinedAt: new Date(),
      });
    },
    async updateRole(
      teamId: number,
      userId: number,
      role: Parameters<Repository['updateRole']>[2],
      actorId: number,
    ) {
      await authorization.require(
        actorId,
        { type: 'team', id: teamId },
        'manage',
      );
      const member = await repository.updateRole(teamId, userId, role);
      if (!member) throw new AppError('NOT_FOUND', 'Team member not found');
      return member;
    },
    async removeMember(teamId: number, userId: number, actorId: number) {
      await authorization.require(
        actorId,
        { type: 'team', id: teamId },
        'manage',
      );
      const member = await repository.removeMember(teamId, userId);
      if (!member) throw new AppError('NOT_FOUND', 'Team member not found');
      return { success: true };
    },
  };
}
