import { AppError } from '@probe/shared/errors/app-error';
import type { createProductRepository } from '../../repositories/products/repository';

type Repository = ReturnType<typeof createProductRepository>;

export function createProductService(repository: Repository) {
  const required = <T>(value: T | undefined) => {
    if (!value) throw new AppError('NOT_FOUND', 'Product not found');
    return value;
  };
  return {
    list: (projectId: number) => repository.list(projectId),
    async get(id: number) {
      return required(await repository.find(id));
    },
    create: (input: Parameters<Repository['create']>[0]) =>
      repository.create({ ...input, description: input.description ?? null }),
    async update(
      id: number,
      updates: Partial<Parameters<Repository['create']>[0]>,
    ) {
      return required(await repository.update(id, updates));
    },
    async delete(id: number) {
      required(await repository.delete(id));
      return { success: true };
    },
  };
}
