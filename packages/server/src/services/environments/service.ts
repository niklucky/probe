import {
  AppError,
  ConflictError,
  InternalServerError,
} from '@probe/shared/errors/app-error';
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
    if (variable.isSecret) {
      return {
        ...safe,
        value: null,
        valueStatus: 'secret' as const,
      };
    }
    try {
      return {
        ...safe,
        value: cipher.decrypt(
          encryptedValue,
          variable.environmentId,
          variable.key,
        ),
        valueStatus: 'available' as const,
      };
    } catch (error) {
      if (!(error instanceof InternalServerError)) throw error;
      return {
        ...safe,
        value: null,
        valueStatus: 'unreadable' as const,
      };
    }
  }

  function variableKeyConflict(key: string) {
    return new ConflictError(`Environment variable "${key}" already exists`);
  }

  function isUniqueViolation(error: unknown) {
    let current = error;
    for (let depth = 0; depth < 4; depth += 1) {
      if (!current || typeof current !== 'object') return false;
      if ('code' in current && current.code === '23505') return true;
      current = 'cause' in current ? current.cause : undefined;
    }
    return false;
  }

  async function mapVariableKeyConflict<T>(
    key: string,
    operation: () => Promise<T>,
  ) {
    try {
      return await operation();
    } catch (error) {
      if (isUniqueViolation(error)) throw variableKeyConflict(key);
      throw error;
    }
  }

  async function requireUniqueVariableKey(
    environmentId: number,
    key: string,
    excludingId?: number,
  ) {
    const existing = await repository.findVariableByKey(environmentId, key);
    if (existing && existing.id !== excludingId) {
      throw variableKeyConflict(key);
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

    async listVariableMetadata(environmentId: number, userId: number) {
      await authorization.require(
        userId,
        { type: 'environment', id: environmentId },
        'read',
      );
      return (await repository.listVariables(environmentId)).map(
        ({ key, description, isSecret }) => ({
          key,
          description,
          isSecret,
        }),
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
      const variable = await mapVariableKeyConflict(input.key, () =>
        repository.createVariable({
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
        }),
      );
      return publicVariable(variable!);
    },

    async updateVariable(
      input: UpdateEnvironmentVariableInput,
      userId: number,
    ) {
      const current = await repository.findVariable(input.id);
      if (!current) {
        throw new AppError('NOT_FOUND', 'Resource not found');
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
      const variable = await mapVariableKeyConflict(nextKey, () =>
        repository.updateVariable(input.id, {
          ...(input.key !== undefined ? { key: input.key } : {}),
          ...(encryptedValue !== undefined ? { encryptedValue } : {}),
          ...(input.isSecret !== undefined ? { isSecret: input.isSecret } : {}),
          ...(input.description !== undefined
            ? { description: input.description || null }
            : {}),
        }),
      );
      if (!variable) {
        throw new AppError('NOT_FOUND', 'Resource not found');
      }
      return publicVariable(variable);
    },

    async deleteVariable(id: number, userId: number) {
      const variable = await repository.findVariable(id);
      if (!variable) {
        throw new AppError('NOT_FOUND', 'Resource not found');
      }
      await authorization.require(
        userId,
        { type: 'environment', id: variable.environmentId },
        'author',
      );
      if (!(await repository.deleteVariable(id))) {
        throw new AppError('NOT_FOUND', 'Resource not found');
      }
      return { success: true as const };
    },
  };
}

export type EnvironmentService = ReturnType<typeof createEnvironmentService>;
