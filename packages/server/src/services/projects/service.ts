import type {
  CreateProjectInput,
  UpdateProjectInput,
} from '@probe/shared/schemas/projects';
import { AppError } from '@probe/shared/errors/app-error';
import type { ProjectRepository } from '../../repositories/projects/repository';

export function createProjectService(repository: ProjectRepository) {
  async function requireOwned(id: number, userId: number) {
    const project = await repository.findOwned(id, userId);
    if (!project) {
      throw new AppError('NOT_FOUND', 'Project not found');
    }
    return project;
  }

  return {
    list(userId: number) {
      return repository.listByOwner(userId);
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

    get(id: number, userId: number) {
      return requireOwned(id, userId);
    },

    async update(input: UpdateProjectInput, userId: number) {
      await requireOwned(input.id, userId);
      const { id, ...updates } = input;
      return repository.update(id, updates);
    },

    async delete(id: number, userId: number) {
      await requireOwned(id, userId);
      await repository.delete(id);
      return { success: true };
    },
  };
}
