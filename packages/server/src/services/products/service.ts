import { AppError } from '@probe/shared/errors/app-error';
import type { createProductRepository } from '../../repositories/products/repository';
import type { AuthorizationService } from '../authorization/service';

type Repository = ReturnType<typeof createProductRepository>;

export function createProductService(
  repository: Repository,
  authorization: AuthorizationService,
) {
  const required = <T>(value: T | undefined) => {
    if (!value) throw new AppError('NOT_FOUND', 'Product not found');
    return value;
  };
  return {
    async list(projectId: number, userId: number) {
      await authorization.requireProject(userId, projectId, 'read');
      return repository.list(projectId);
    },
    async get(id: number, userId: number) {
      await authorization.require(userId, { type: 'product', id }, 'read');
      return required(await repository.find(id));
    },
    async create(input: Parameters<Repository['create']>[0], userId: number) {
      await authorization.requireProject(userId, input.projectId, 'author');
      return repository.create({
        ...input,
        description: input.description ?? null,
      });
    },
    async update(
      id: number,
      updates: Partial<Parameters<Repository['create']>[0]>,
      userId: number,
    ) {
      await authorization.require(userId, { type: 'product', id }, 'author');
      return required(await repository.update(id, updates));
    },
    async delete(id: number, userId: number) {
      await authorization.require(userId, { type: 'product', id }, 'author');
      required(await repository.delete(id));
      return { success: true };
    },
  };
}
