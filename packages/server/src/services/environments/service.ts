import { AppError, ConflictError } from '@probe/shared/errors/app-error';
import type {
  CreateEnvironmentInput,
  CreateEnvironmentVariableInput,
  UpdateEnvironmentInput,
  UpdateEnvironmentVariableInput,
} from '@probe/shared/schemas/environments';
import type { EnvironmentRepository } from '../../repositories/environments/repository';
import type { AuthorizationService } from '../authorization/service';
import type { EnvironmentVariableCipher } from './encryption';

export function createEnvironmentService(
  repository: EnvironmentRepository,
  authorization: AuthorizationService,
  cipher: EnvironmentVariableCipher,
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

  function publicVariable<
    T extends {
      id: number;
      environmentId: number;
      key: string;
      encryptedValue: string;
      isSecret: boolean;
      description: string | null;
      createdById: number;
      createdAt: Date;
      updatedAt: Date;
    },
  >(variable: T) {
    const { encryptedValue, ...safe } = variable;
    return {
      ...safe,
      value: variable.isSecret
        ? null
        : cipher.decrypt(encryptedValue, variable.environmentId, variable.key),
      hasValue: true as const,
    };
  }

  async function requireUniqueVariableKey(
    environmentId: number,
    key: string,
    excludingId?: number,
  ) {
    const existing = await repository.findVariableByKey(environmentId, key);
    if (existing && existing.id !== excludingId) {
      throw new ConflictError(`Environment variable "${key}" already exists`);
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

    async listVariables(environmentId: number, userId: number) {
      await authorization.require(
        userId,
        { type: 'environment', id: environmentId },
        'read',
      );
      return Promise.all(
        (await repository.listVariables(environmentId)).map(publicVariable),
      );
    },

    async createVariable(
      input: CreateEnvironmentVariableInput,
      userId: number,
    ) {
      await authorization.require(
        userId,
        { type: 'environment', id: input.environmentId },
        'author',
      );
      if (!(await repository.find(input.environmentId))) {
        throw new AppError('NOT_FOUND', 'Environment not found');
      }
      await requireUniqueVariableKey(input.environmentId, input.key);
      const variable = await repository.createVariable({
        environmentId: input.environmentId,
        key: input.key,
        encryptedValue: cipher.encrypt(
          input.value,
          input.environmentId,
          input.key,
        ),
        isSecret: input.isSecret,
        description: input.description || null,
        createdById: userId,
      });
      return publicVariable(variable!);
    },

    async updateVariable(
      input: UpdateEnvironmentVariableInput,
      userId: number,
    ) {
      const current = await repository.findVariable(input.id);
      if (!current) {
        throw new AppError('NOT_FOUND', 'Environment variable not found');
      }
      await authorization.require(
        userId,
        { type: 'environment', id: current.environmentId },
        'author',
      );
      const nextKey = input.key ?? current.key;
      await requireUniqueVariableKey(
        current.environmentId,
        nextKey,
        current.id,
      );
      if (
        current.isSecret &&
        input.isSecret === false &&
        input.value === undefined
      ) {
        throw new AppError(
          'BAD_REQUEST',
          'Provide a replacement value when changing a secret to non-secret',
        );
      }
      let encryptedValue: string | undefined;
      if (input.value !== undefined) {
        encryptedValue = cipher.encrypt(
          input.value,
          current.environmentId,
          nextKey,
        );
      } else if (nextKey !== current.key) {
        encryptedValue = cipher.encrypt(
          cipher.decrypt(
            current.encryptedValue,
            current.environmentId,
            current.key,
          ),
          current.environmentId,
          nextKey,
        );
      }
      const variable = await repository.updateVariable(input.id, {
        ...(input.key !== undefined ? { key: input.key } : {}),
        ...(encryptedValue !== undefined ? { encryptedValue } : {}),
        ...(input.isSecret !== undefined ? { isSecret: input.isSecret } : {}),
        ...(input.description !== undefined
          ? { description: input.description || null }
          : {}),
      });
      if (!variable) {
        throw new AppError('NOT_FOUND', 'Environment variable not found');
      }
      return publicVariable(variable);
    },

    async deleteVariable(id: number, userId: number) {
      const variable = await repository.findVariable(id);
      if (!variable) {
        throw new AppError('NOT_FOUND', 'Environment variable not found');
      }
      await authorization.require(
        userId,
        { type: 'environment', id: variable.environmentId },
        'author',
      );
      if (!(await repository.deleteVariable(id))) {
        throw new AppError('NOT_FOUND', 'Environment variable not found');
      }
      return { success: true as const };
    },
  };
}

export type EnvironmentService = ReturnType<typeof createEnvironmentService>;
