import { AppError } from '@probe/shared/errors/app-error';
import type {
  CreateEnvironmentInput,
  UpdateEnvironmentInput,
} from '@probe/shared/schemas/environments';
import type { EnvironmentRepository } from '../../repositories/environments/repository';
import type { AuthorizationService } from '../authorization/service';

export function createEnvironmentService(
  repository: EnvironmentRepository,
  authorization: AuthorizationService,
) {
  async function requireProductInProject(
    productId: number | undefined,
    projectId: number,
  ) {
    if (!productId) return;
    const product = await repository.findProduct(productId);
    if (!product || product.projectId !== projectId) {
      throw new AppError('NOT_FOUND', 'Product not found');
    }
  }

  return {
    async get(id: number, userId: number) {
      await authorization.require(userId, { type: 'environment', id }, 'read');
      const environment = await repository.find(id);
      if (!environment) {
        throw new AppError('NOT_FOUND', 'Environment not found');
      }
      return environment;
    },

    async list(
      input: { projectId: number; productId?: number },
      userId: number,
    ) {
      await authorization.requireProject(userId, input.projectId, 'read');
      await requireProductInProject(input.productId, input.projectId);
      return repository.list(input.projectId, input.productId);
    },

    async create(input: CreateEnvironmentInput, userId: number) {
      await authorization.requireProject(userId, input.projectId, 'author');
      await requireProductInProject(input.productId, input.projectId);
      return repository.withTransaction(async (transactionRepository) => {
        if (input.isDefault) {
          await transactionRepository.clearDefault(
            input.projectId,
            input.productId,
          );
        }
        return transactionRepository.create({
          ...input,
          productId: input.productId ?? null,
          createdById: userId,
        });
      });
    },

    async update(input: UpdateEnvironmentInput, userId: number) {
      await authorization.require(
        userId,
        { type: 'environment', id: input.id },
        'author',
      );
      const current = await repository.find(input.id);
      if (!current) throw new AppError('NOT_FOUND', 'Environment not found');
      const productId =
        input.productId === undefined ? current.productId : input.productId;
      await requireProductInProject(productId ?? undefined, current.projectId);
      const { id, ...updates } = input;
      return repository.withTransaction(async (transactionRepository) => {
        if (updates.isDefault) {
          await transactionRepository.clearDefault(
            current.projectId,
            productId,
          );
        }
        const environment = await transactionRepository.update(id, {
          ...updates,
          productId,
        });
        if (!environment) {
          throw new AppError('NOT_FOUND', 'Environment not found');
        }
        return environment;
      });
    },

    async delete(id: number, userId: number) {
      await authorization.require(
        userId,
        { type: 'environment', id },
        'author',
      );
      if (!(await repository.delete(id))) {
        throw new AppError('NOT_FOUND', 'Environment not found');
      }
      return { success: true as const };
    },
  };
}

export type EnvironmentService = ReturnType<typeof createEnvironmentService>;
