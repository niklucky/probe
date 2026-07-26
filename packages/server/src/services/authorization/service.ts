import { AppError } from '@probe/shared/errors/app-error';
import type {
  AuthorizationRepository,
  ProjectResource,
} from '../../repositories/authorization/repository';

export type ProjectRole = 'owner' | 'admin' | 'qa' | 'manual_tester' | 'viewer';
export type ProjectOperation = 'read' | 'author' | 'execute' | 'manage' | 'own';

const allowedOperations: Record<ProjectRole, ProjectOperation[]> = {
  owner: ['read', 'author', 'execute', 'manage', 'own'],
  admin: ['read', 'author', 'execute', 'manage'],
  qa: ['read', 'author', 'execute'],
  manual_tester: ['read', 'execute'],
  viewer: ['read'],
};

export function createAuthorizationService(
  repository: AuthorizationRepository,
) {
  async function requireProject(
    userId: number,
    projectId: number,
    operation: ProjectOperation,
  ) {
    const role = await repository.getRole(userId, projectId);
    if (!role || !allowedOperations[role].includes(operation)) {
      throw new AppError('NOT_FOUND', 'Resource not found');
    }
    return { projectId, role };
  }

  return {
    async listProjectIds(userId: number) {
      const { ownedProjectIds, memberships } =
        await repository.listRoles(userId);
      return [
        ...new Set([
          ...ownedProjectIds,
          ...memberships.map(({ projectId }) => projectId),
        ]),
      ];
    },

    requireProject,

    async require(
      userId: number,
      resource: ProjectResource,
      operation: ProjectOperation,
    ) {
      const projectId = await repository.resolveProjectId(resource);
      if (!projectId) {
        throw new AppError('NOT_FOUND', 'Resource not found');
      }
      return requireProject(userId, projectId, operation);
    },
  };
}

export type AuthorizationService = ReturnType<
  typeof createAuthorizationService
>;
