import { AppError } from '@probe/shared/errors/app-error';
import type { ProjectMemberRepository } from '../../repositories/project-members/repository';
import type { AuthorizationService } from '../authorization/service';

export function createProjectMemberService(
  repository: ProjectMemberRepository,
  authorization: AuthorizationService,
) {
  async function requireMutableMember(
    projectId: number,
    userId: number,
    actorId: number,
  ) {
    await authorization.requireProject(actorId, projectId, 'manage');
    const project = await repository.findProject(projectId);
    if (!project) throw new AppError('NOT_FOUND', 'Project not found');
    if (project.createdById === userId) {
      throw new AppError('BAD_REQUEST', 'The project owner cannot be changed');
    }
  }

  return {
    async list(projectId: number, actorId: number) {
      await authorization.requireProject(actorId, projectId, 'read');
      return repository.list(projectId);
    },
    async updateRole(
      projectId: number,
      userId: number,
      role: 'admin' | 'qa' | 'manual_tester' | 'viewer',
      actorId: number,
    ) {
      await requireMutableMember(projectId, userId, actorId);
      const member = await repository.updateRole(projectId, userId, role);
      if (!member) throw new AppError('NOT_FOUND', 'Project member not found');
      return member;
    },
    async remove(projectId: number, userId: number, actorId: number) {
      await requireMutableMember(projectId, userId, actorId);
      const member = await repository.remove(projectId, userId);
      if (!member) throw new AppError('NOT_FOUND', 'Project member not found');
      return { success: true };
    },
  };
}

export type ProjectMemberService = ReturnType<
  typeof createProjectMemberService
>;
