import {
  AppError,
  ConflictError,
  InternalServerError,
} from '@probe/shared/errors/app-error';
import type {
  CreateEnvironmentInput,
  CreateEnvironmentCookieInput,
  CreateEnvironmentHeaderInput,
  CreateEnvironmentVariableInput,
  CreateEnvironmentProfileInput,
  UpdateEnvironmentInput,
  UpdateEnvironmentCookieInput,
  UpdateEnvironmentHeaderInput,
  UpdateEnvironmentVariableInput,
  UpdateEnvironmentProfileInput,
} from '@probe/shared/schemas/environments';
import {
  extractEnvironmentVariableReferences,
  validateEnvironmentCookieDomain,
} from '@probe/shared/schemas/environments';
import type { EnvironmentRepository } from '../../repositories/environments/repository';
import type { AuthorizationService } from '../authorization/service';
import type { EnvironmentVariableCipher } from './encryption';

export function createEnvironmentService(
  repository: EnvironmentRepository,
  authorization: AuthorizationService,
  cipher: EnvironmentVariableCipher,
) {
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

  async function mapCookieConflict<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('Cookie definition already exists');
      }
      throw error;
    }
  }

  async function mapHeaderConflict<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('Header definition already exists');
      }
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

  function publicProfile<
    T extends {
      variables?: Array<{ variableId: number }>;
      cookies?: Array<{ cookieId: number }>;
      headers?: Array<{ headerId: number }>;
    },
  >(profile: T) {
    const { variables = [], cookies = [], headers = [], ...safe } = profile;
    return {
      ...safe,
      variableIds: variables
        .map(({ variableId }) => variableId)
        .sort((left, right) => left - right),
      cookieIds: cookies
        .map(({ cookieId }) => cookieId)
        .sort((left, right) => left - right),
      headerIds: headers
        .map(({ headerId }) => headerId)
        .sort((left, right) => left - right),
    };
  }

  function uniqueIds(ids: number[]) {
    return [...new Set(ids)].sort((left, right) => left - right);
  }

  function sameIds(left: number[], right: number[]) {
    const normalizedLeft = uniqueIds(left);
    const normalizedRight = uniqueIds(right);
    return (
      normalizedLeft.length === normalizedRight.length &&
      normalizedLeft.every((id, index) => id === normalizedRight[index])
    );
  }

  async function validateProfileBindings(
    environmentId: number,
    bindings: {
      variableIds: number[];
      cookieIds: number[];
      headerIds: number[];
    },
  ) {
    const normalized = {
      variableIds: uniqueIds(bindings.variableIds),
      cookieIds: uniqueIds(bindings.cookieIds),
      headerIds: uniqueIds(bindings.headerIds),
    };
    const [variables, cookies, headers] = await Promise.all([
      repository.listVariables(environmentId),
      repository.listCookies(environmentId),
      repository.listHeaders(environmentId),
    ]);
    const containsAll = (
      selected: number[],
      available: Array<{ id: number }>,
    ) => {
      const ids = new Set(available.map(({ id }) => id));
      return selected.every((id) => ids.has(id));
    };
    if (
      !containsAll(normalized.variableIds, variables) ||
      !containsAll(normalized.cookieIds, cookies) ||
      !containsAll(normalized.headerIds, headers)
    ) {
      throw new AppError(
        'BAD_REQUEST',
        'Profile bindings must belong to the same environment',
      );
    }
    const selectedVariableIds = new Set(normalized.variableIds);
    const selectedVariableKeys = new Set(
      variables
        .filter(({ id }) => selectedVariableIds.has(id))
        .map(({ key }) => key),
    );
    const selectedCookieIds = new Set(normalized.cookieIds);
    const selectedHeaderIds = new Set(normalized.headerIds);
    const requiredKeys = new Set([
      ...cookies
        .filter(({ id }) => selectedCookieIds.has(id))
        .flatMap(({ valueTemplate }) =>
          extractEnvironmentVariableReferences(valueTemplate),
        ),
      ...headers
        .filter(({ id }) => selectedHeaderIds.has(id))
        .flatMap(({ valueTemplate }) =>
          extractEnvironmentVariableReferences(valueTemplate),
        ),
    ]);
    const missingKeys = [...requiredKeys]
      .filter((key) => !selectedVariableKeys.has(key))
      .sort();
    if (missingKeys.length) {
      throw new AppError(
        'BAD_REQUEST',
        `Profile cookie/header bindings require selected variables: ${missingKeys.join(', ')}`,
      );
    }
    return normalized;
  }

  function isForeignKeyViolation(error: unknown) {
    let current = error;
    for (let depth = 0; depth < 4; depth += 1) {
      if (!current || typeof current !== 'object') return false;
      if ('code' in current && current.code === '23503') return true;
      current = 'cause' in current ? current.cause : undefined;
    }
    return false;
  }

  async function mapProfileConflict<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('Environment profile already exists');
      }
      if (isForeignKeyViolation(error)) {
        throw new ConflictError(
          'A selected profile variable, cookie, or header no longer exists',
        );
      }
      throw error;
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

    async list(input: { productId: number }, userId: number) {
      await authorization.require(
        userId,
        { type: 'product', id: input.productId },
        'read',
      );
      return repository.list(input.productId);
    },

    async create(input: CreateEnvironmentInput, userId: number) {
      await authorization.require(
        userId,
        { type: 'product', id: input.productId },
        'author',
      );
      return repository.withTransaction(async (transactionRepository) => {
        if (input.isDefault) {
          await transactionRepository.clearDefault(input.productId);
        }
        const environment = await transactionRepository.create({
          ...input,
          createdById: userId,
        });
        await transactionRepository.createProfile(
          {
            environmentId: environment!.id,
            name: 'Anonymous',
            isAnonymous: true,
            enabled: true,
            createdById: userId,
          },
          { variableIds: [], cookieIds: [], headerIds: [] },
        );
        return environment;
      });
    },

    async listProfiles(environmentId: number, userId: number) {
      await authorization.require(
        userId,
        { type: 'environment', id: environmentId },
        'read',
      );
      return (await repository.listProfiles(environmentId)).map(publicProfile);
    },

    async getProfile(id: number, userId: number) {
      const profile = await repository.findProfile(id);
      if (!profile) throw new AppError('NOT_FOUND', 'Profile not found');
      await authorization.require(
        userId,
        { type: 'environment', id: profile.environmentId },
        'read',
      );
      return publicProfile(profile);
    },

    async getEnabledProfile(id: number, environmentId: number, userId: number) {
      const profile = await repository.findProfile(id);
      if (!profile || profile.environmentId !== environmentId) {
        throw new AppError('NOT_FOUND', 'Profile not found');
      }
      await authorization.require(
        userId,
        { type: 'environment', id: environmentId },
        'read',
      );
      if (!profile.enabled) {
        throw new ConflictError('Environment profile is disabled');
      }
      return publicProfile(profile);
    },

    async listProfileVariableMetadata(profileId: number, userId: number) {
      const profile = await repository.findProfile(profileId);
      if (!profile) throw new AppError('NOT_FOUND', 'Profile not found');
      await authorization.require(
        userId,
        { type: 'environment', id: profile.environmentId },
        'read',
      );
      if (!profile.enabled) {
        throw new ConflictError('Environment profile is disabled');
      }
      const selected = new Set(
        profile.variables.map(({ variableId }) => variableId),
      );
      return (await repository.listVariables(profile.environmentId))
        .filter(({ id }) => selected.has(id))
        .map(({ key, description, isSecret }) => ({
          key,
          description,
          isSecret,
        }));
    },

    async createProfile(input: CreateEnvironmentProfileInput, userId: number) {
      await authorization.require(
        userId,
        { type: 'environment', id: input.environmentId },
        'author',
      );
      if (!(await repository.find(input.environmentId))) {
        throw new AppError('NOT_FOUND', 'Environment not found');
      }
      const bindings = await validateProfileBindings(input.environmentId, {
        variableIds: input.variableIds,
        cookieIds: input.cookieIds,
        headerIds: input.headerIds,
      });
      return mapProfileConflict(() =>
        repository.withTransaction(async (transactionRepository) => {
          const profile = await transactionRepository.createProfile(
            {
              environmentId: input.environmentId,
              name: input.name,
              isAnonymous: false,
              enabled: input.enabled,
              createdById: userId,
            },
            bindings,
          );
          return publicProfile({
            ...profile,
            variables: bindings.variableIds.map((variableId) => ({
              variableId,
            })),
            cookies: bindings.cookieIds.map((cookieId) => ({ cookieId })),
            headers: bindings.headerIds.map((headerId) => ({ headerId })),
          });
        }),
      );
    },

    async updateProfile(input: UpdateEnvironmentProfileInput, userId: number) {
      const current = await repository.findProfile(input.id);
      if (!current) throw new AppError('NOT_FOUND', 'Profile not found');
      await authorization.require(
        userId,
        { type: 'environment', id: current.environmentId },
        'author',
      );
      if (
        current.isAnonymous &&
        (input.name !== undefined ||
          input.cookieIds !== undefined ||
          input.headerIds !== undefined)
      ) {
        throw new AppError(
          'BAD_REQUEST',
          'The Anonymous profile cannot be renamed or given cookies or headers',
        );
      }
      const hasBindingUpdate =
        input.variableIds !== undefined ||
        input.cookieIds !== undefined ||
        input.headerIds !== undefined;
      const validatedBindings = hasBindingUpdate
        ? await validateProfileBindings(current.environmentId, {
            variableIds:
              input.variableIds ??
              current.variables.map(({ variableId }) => variableId),
            cookieIds:
              input.cookieIds ??
              current.cookies.map(({ cookieId }) => cookieId),
            headerIds:
              input.headerIds ??
              current.headers.map(({ headerId }) => headerId),
          })
        : undefined;
      const bindings =
        validatedBindings &&
        (!sameIds(
          validatedBindings.variableIds,
          current.variables.map(({ variableId }) => variableId),
        ) ||
          !sameIds(
            validatedBindings.cookieIds,
            current.cookies.map(({ cookieId }) => cookieId),
          ) ||
          !sameIds(
            validatedBindings.headerIds,
            current.headers.map(({ headerId }) => headerId),
          ))
          ? validatedBindings
          : undefined;
      const { id, name, variableIds, cookieIds, headerIds, ...otherUpdates } =
        input;
      const updates = {
        ...otherUpdates,
        ...(name !== undefined && name !== current.name ? { name } : {}),
      };
      return mapProfileConflict(() =>
        repository.withTransaction(async (transactionRepository) => {
          const profile = await transactionRepository.updateProfile(
            id,
            updates,
            bindings,
          );
          if (!profile) throw new AppError('NOT_FOUND', 'Profile not found');
          return publicProfile({
            ...profile,
            variables: (
              validatedBindings?.variableIds ??
              current.variables.map(({ variableId }) => variableId)
            ).map((variableId) => ({ variableId })),
            cookies: (
              validatedBindings?.cookieIds ??
              current.cookies.map(({ cookieId }) => cookieId)
            ).map((cookieId) => ({ cookieId })),
            headers: (
              validatedBindings?.headerIds ??
              current.headers.map(({ headerId }) => headerId)
            ).map((headerId) => ({ headerId })),
          });
        }),
      );
    },

    async deleteProfile(id: number, userId: number) {
      const profile = await repository.findProfile(id);
      if (!profile) throw new AppError('NOT_FOUND', 'Profile not found');
      await authorization.require(
        userId,
        { type: 'environment', id: profile.environmentId },
        'author',
      );
      if (profile.isAnonymous) {
        throw new ConflictError('The Anonymous profile cannot be deleted');
      }
      try {
        if (!(await repository.deleteProfile(id))) {
          throw new AppError('NOT_FOUND', 'Profile not found');
        }
      } catch (error) {
        if (isUniqueViolation(error) || isForeignKeyViolation(error)) {
          throw new ConflictError(
            'Profile is referenced by automation history; disable it instead',
          );
        }
        throw error;
      }
      return { success: true as const };
    },

    async update(input: UpdateEnvironmentInput, userId: number) {
      await authorization.require(
        userId,
        { type: 'environment', id: input.id },
        'author',
      );
      const current = await repository.find(input.id);
      if (!current) throw new AppError('NOT_FOUND', 'Environment not found');
      const { id, ...updates } = input;
      if (updates.baseUrl) {
        for (const cookie of await repository.listCookies(id)) {
          try {
            validateEnvironmentCookieDomain(cookie.domain, updates.baseUrl);
          } catch (error) {
            throw new AppError(
              'BAD_REQUEST',
              error instanceof Error
                ? error.message
                : 'Cookie domain is invalid',
            );
          }
        }
      }
      return repository.withTransaction(async (transactionRepository) => {
        if (updates.isDefault) {
          await transactionRepository.clearDefault(current.productId);
        }
        const environment = await transactionRepository.update(id, updates);
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

    async listCookies(environmentId: number, userId: number) {
      await authorization.require(
        userId,
        { type: 'environment', id: environmentId },
        'read',
      );
      return repository.listCookies(environmentId);
    },

    async createCookie(input: CreateEnvironmentCookieInput, userId: number) {
      await authorization.require(
        userId,
        { type: 'environment', id: input.environmentId },
        'author',
      );
      const environment = await repository.find(input.environmentId);
      if (!environment)
        throw new AppError('NOT_FOUND', 'Environment not found');
      try {
        validateEnvironmentCookieDomain(input.domain, environment.baseUrl);
      } catch (error) {
        throw new AppError(
          'BAD_REQUEST',
          error instanceof Error ? error.message : 'Cookie domain is invalid',
        );
      }
      return mapCookieConflict(() =>
        repository.createCookie({
          ...input,
          domain: input.domain ?? null,
          expiresAt: input.expiresAt ?? null,
          createdById: userId,
        }),
      );
    },

    async updateCookie(input: UpdateEnvironmentCookieInput, userId: number) {
      const current = await repository.findCookie(input.id);
      if (!current) throw new AppError('NOT_FOUND', 'Resource not found');
      await authorization.require(
        userId,
        { type: 'environment', id: current.environmentId },
        'author',
      );
      const environment = await repository.find(current.environmentId);
      if (!environment) throw new AppError('NOT_FOUND', 'Resource not found');
      const domain = input.domain === undefined ? current.domain : input.domain;
      const sameSite = input.sameSite ?? current.sameSite;
      const secure = input.secure ?? current.secure;
      if (sameSite === 'None' && !secure) {
        throw new AppError(
          'BAD_REQUEST',
          'SameSite=None cookies must be secure',
        );
      }
      try {
        validateEnvironmentCookieDomain(domain, environment.baseUrl);
      } catch (error) {
        throw new AppError(
          'BAD_REQUEST',
          error instanceof Error ? error.message : 'Cookie domain is invalid',
        );
      }
      const { id, ...updates } = input;
      const cookie = await mapCookieConflict(() =>
        repository.withTransaction(async (transactionRepository) => {
          await transactionRepository.bumpProfilesForBinding('cookie', id);
          return transactionRepository.updateCookie(id, updates);
        }),
      );
      if (!cookie) throw new AppError('NOT_FOUND', 'Resource not found');
      return cookie;
    },

    async deleteCookie(id: number, userId: number) {
      const cookie = await repository.findCookie(id);
      if (!cookie) throw new AppError('NOT_FOUND', 'Resource not found');
      await authorization.require(
        userId,
        { type: 'environment', id: cookie.environmentId },
        'author',
      );
      const deleted = await repository.withTransaction(
        async (transactionRepository) => {
          await transactionRepository.bumpProfilesForBinding('cookie', id);
          return transactionRepository.deleteCookie(id);
        },
      );
      if (!deleted) {
        throw new AppError('NOT_FOUND', 'Resource not found');
      }
      return { success: true as const };
    },

    async listHeaders(environmentId: number, userId: number) {
      await authorization.require(
        userId,
        { type: 'environment', id: environmentId },
        'read',
      );
      return repository.listHeaders(environmentId);
    },

    async createHeader(input: CreateEnvironmentHeaderInput, userId: number) {
      await authorization.require(
        userId,
        { type: 'environment', id: input.environmentId },
        'author',
      );
      const environment = await repository.find(input.environmentId);
      if (!environment) {
        throw new AppError('NOT_FOUND', 'Environment not found');
      }
      return mapHeaderConflict(() =>
        repository.createHeader({
          ...input,
          origin: input.origin ?? new URL(environment.baseUrl).origin,
          createdById: userId,
        }),
      );
    },

    async updateHeader(input: UpdateEnvironmentHeaderInput, userId: number) {
      const current = await repository.findHeader(input.id);
      if (!current) throw new AppError('NOT_FOUND', 'Resource not found');
      await authorization.require(
        userId,
        { type: 'environment', id: current.environmentId },
        'author',
      );
      const { id, ...updates } = input;
      const header = await mapHeaderConflict(() =>
        repository.withTransaction(async (transactionRepository) => {
          await transactionRepository.bumpProfilesForBinding('header', id);
          return transactionRepository.updateHeader(id, updates);
        }),
      );
      if (!header) throw new AppError('NOT_FOUND', 'Resource not found');
      return header;
    },

    async deleteHeader(id: number, userId: number) {
      const header = await repository.findHeader(id);
      if (!header) throw new AppError('NOT_FOUND', 'Resource not found');
      await authorization.require(
        userId,
        { type: 'environment', id: header.environmentId },
        'author',
      );
      const deleted = await repository.withTransaction(
        async (transactionRepository) => {
          await transactionRepository.bumpProfilesForBinding('header', id);
          return transactionRepository.deleteHeader(id);
        },
      );
      if (!deleted) {
        throw new AppError('NOT_FOUND', 'Resource not found');
      }
      return { success: true as const };
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
        repository.withTransaction(async (transactionRepository) => {
          await transactionRepository.bumpProfilesForBinding(
            'variable',
            input.id,
          );
          return transactionRepository.updateVariable(input.id, {
            ...(input.key !== undefined ? { key: input.key } : {}),
            ...(encryptedValue !== undefined ? { encryptedValue } : {}),
            ...(input.isSecret !== undefined
              ? { isSecret: input.isSecret }
              : {}),
            ...(input.description !== undefined
              ? { description: input.description || null }
              : {}),
          });
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
      const deleted = await repository.withTransaction(
        async (transactionRepository) => {
          await transactionRepository.bumpProfilesForBinding('variable', id);
          return transactionRepository.deleteVariable(id);
        },
      );
      if (!deleted) {
        throw new AppError('NOT_FOUND', 'Resource not found');
      }
      return { success: true as const };
    },
  };
}

export type EnvironmentService = ReturnType<typeof createEnvironmentService>;
