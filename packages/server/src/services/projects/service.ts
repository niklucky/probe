import type {
  CreateProjectInput,
  UpdateProjectInput,
} from '@probe/shared/schemas/projects';
import { AppError } from '@probe/shared/errors/app-error';
import type { ProjectRepository } from '../../repositories/projects/repository';
import type { AuthorizationService } from '../authorization/service';

export function createProjectService(
  repository: ProjectRepository,
  authorization: AuthorizationService,
) {
  async function requireProject(
    id: number,
    userId: number,
    operation: 'read' | 'manage' | 'own',
  ) {
    const access = await authorization.requireProject(userId, id, operation);
    const project = await repository.find(id);
    if (!project) {
      throw new AppError('NOT_FOUND', 'Project not found');
    }
    return { project, role: access.role };
  }

  return {
    async list(userId: number) {
      return repository.listAccessible(
        await authorization.listProjectIds(userId),
      );
    },

    create(input: CreateProjectInput, userId: number) {
      return repository.create({
        name: input.name,
        description: input.description ?? null,
        website: input.website ?? null,
        createdById: userId,
        logoUrl: null,
      });
    },

    async get(id: number, userId: number) {
      const { project, role } = await requireProject(id, userId, 'read');
      return { ...project, currentUserRole: role };
    },

    async update(input: UpdateProjectInput, userId: number) {
      await requireProject(input.id, userId, 'manage');
      const { id, ...updates } = input;
      return repository.update(id, updates);
    },

    async delete(id: number, userId: number) {
      await requireProject(id, userId, 'own');
      await repository.delete(id);
      return { success: true };
    },
  };
}
