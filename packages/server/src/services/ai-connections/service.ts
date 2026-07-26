import {
  AiProviderError,
  assertEndpointAllowed,
  createAiAdapter,
  type AiAdapter,
  type AiConnectionConfig,
  type EndpointNetworkPolicy,
} from '@probe/ai';
import { AppError } from '@probe/shared/errors/app-error';
import type {
  AiConnectionScope,
  CreateAiConnectionInput,
  UpdateAiConnectionInput,
} from '@probe/shared/schemas/ai-connections';
import type { UserRole } from '@probe/shared';
import type { AiConnectionRepository } from '../../repositories/ai-connections/repository';
import type { CredentialCipher } from './encryption';
import {
  loadEnvironmentAiConnections,
  type EnvironmentAiConnection,
} from './environment';

export interface AiConnectionActor {
  id: number;
  role: UserRole;
}

interface ServiceOptions {
  environmentConnections?: () => EnvironmentAiConnection[];
  adapterFactory?: (config: AiConnectionConfig) => AiAdapter;
  endpointValidator?: (
    endpoint: string,
    policy: EndpointNetworkPolicy,
  ) => Promise<URL>;
  approvedLocalHosts?: string[];
}

function requireAdmin(actor: AiConnectionActor) {
  if (actor.role !== 'admin') {
    throw new AppError('NOT_FOUND', 'Resource not found');
  }
}

function safeEnvironmentConnection(connection: EnvironmentAiConnection) {
  return {
    id: connection.id,
    source: 'environment' as const,
    name: connection.name,
    provider: connection.provider,
    endpoint: connection.endpoint || null,
    model: connection.model,
    capabilities: connection.capabilities || [],
    scope: connection.scope,
    enabled: connection.enabled,
    isDefault: connection.isDefault,
    hasCredentials: Boolean(
      connection.apiKey || Object.keys(connection.headers || {}).length,
    ),
    createdById: null,
    createdAt: null,
    updatedAt: null,
  };
}

function safeDatabaseConnection<
  T extends {
    id: number;
    hasCredentials: boolean;
    [key: string]: unknown;
  },
>(connection: T) {
  return {
    ...connection,
    source: 'database' as const,
  };
}

function mapProviderError(error: unknown): never {
  if (!(error instanceof AiProviderError)) throw error;
  const code =
    error.code === 'INVALID_CONFIGURATION'
      ? 'BAD_REQUEST'
      : error.code === 'MODEL_NOT_FOUND'
        ? 'NOT_FOUND'
        : 'BAD_REQUEST';
  throw new AppError(code, error.message);
}

function nonSecretChanges(
  input: CreateAiConnectionInput | UpdateAiConnectionInput,
) {
  const { secrets, ...safe } = input;
  return {
    ...safe,
    ...(secrets ? { credentialsUpdated: true } : {}),
  };
}

function hasCredentials(value: {
  apiKey?: string;
  headers?: Record<string, string>;
}) {
  return Boolean(value.apiKey || Object.keys(value.headers || {}).length);
}

export function createAiConnectionService(
  repository: AiConnectionRepository,
  cipher: CredentialCipher,
  options: ServiceOptions = {},
) {
  const environmentConnections =
    options.environmentConnections || loadEnvironmentAiConnections;
  const adapterFactory = options.adapterFactory || createAiAdapter;
  const endpointValidator = options.endpointValidator || assertEndpointAllowed;
  const approvedLocalHosts =
    options.approvedLocalHosts ||
    (process.env.AI_APPROVED_LOCAL_HOSTS || '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);

  async function validateConfiguration(
    config: Pick<
      AiConnectionConfig,
      'provider' | 'endpoint' | 'apiKey' | 'headers'
    >,
  ) {
    if (config.provider === 'openai-compatible' && !config.endpoint) {
      throw new AppError(
        'BAD_REQUEST',
        'OpenAI-compatible connections require an endpoint',
      );
    }
    if (config.endpoint) {
      try {
        await endpointValidator(config.endpoint, { approvedLocalHosts });
      } catch (error) {
        mapProviderError(error);
      }
    }
    if (!config.apiKey && !Object.keys(config.headers || {}).length) {
      const hostname = config.endpoint
        ? new URL(config.endpoint).hostname.toLowerCase()
        : '';
      const permittedLocalConnection =
        config.provider === 'openai-compatible' &&
        approvedLocalHosts.includes(hostname);
      if (!permittedLocalConnection) {
        throw new AppError(
          'BAD_REQUEST',
          'Credentials are required unless this is an explicitly approved local endpoint',
        );
      }
    }
  }

  async function databaseConfig(id: number) {
    const connection = await repository.find(id);
    if (!connection) throw new AppError('NOT_FOUND', 'AI connection not found');
    const secrets = connection.encryptedConfig
      ? cipher.decrypt(connection.encryptedConfig)
      : {};
    return {
      connection,
      config: {
        provider: connection.provider,
        endpoint: connection.endpoint,
        model: connection.model,
        capabilities: connection.capabilities,
        ...secrets,
      } satisfies AiConnectionConfig,
    };
  }

  function guardedAdapter(config: AiConnectionConfig): AiAdapter {
    const adapter = adapterFactory(config);
    return {
      async generateStructured(request) {
        await validateConfiguration(config);
        return adapter.generateStructured(request);
      },
      async testConnection() {
        await validateConfiguration(config);
        return adapter.testConnection();
      },
    };
  }

  return {
    async list(actor: AiConnectionActor) {
      requireAdmin(actor);
      const [database, environment] = await Promise.all([
        repository.list(),
        Promise.resolve(environmentConnections()),
      ]);
      return [
        ...environment.map(safeEnvironmentConnection),
        ...database.map(safeDatabaseConnection),
      ];
    },

    async create(input: CreateAiConnectionInput, actor: AiConnectionActor) {
      requireAdmin(actor);
      await validateConfiguration({
        provider: input.provider,
        endpoint: input.endpoint,
        ...input.secrets,
      });
      const encryptedConfig = input.secrets
        ? cipher.encrypt(input.secrets)
        : null;
      return repository.withTransaction(async (transaction) => {
        if (input.isDefault) await transaction.clearDefault(input.scope);
        const connection = await transaction.create({
          name: input.name,
          provider: input.provider,
          endpoint: input.endpoint || null,
          model: input.model,
          capabilities: input.capabilities,
          scope: input.scope,
          enabled: input.enabled,
          isDefault: input.isDefault,
          encryptedConfig,
          hasCredentials: hasCredentials(input.secrets || {}),
          createdById: actor.id,
        });
        await transaction.audit(
          connection.id,
          actor.id,
          'created',
          nonSecretChanges(input),
        );
        return safeDatabaseConnection(connection);
      });
    },

    async update(input: UpdateAiConnectionInput, actor: AiConnectionActor) {
      requireAdmin(actor);
      const current = await repository.find(input.id);
      if (!current) throw new AppError('NOT_FOUND', 'AI connection not found');
      const currentSecrets = current.encryptedConfig
        ? cipher.decrypt(current.encryptedConfig)
        : {};
      const nextSecrets = input.secrets || currentSecrets;
      const provider = input.provider || current.provider;
      const endpoint =
        input.endpoint === undefined ? current.endpoint : input.endpoint;
      await validateConfiguration({
        provider,
        endpoint,
        ...nextSecrets,
      });
      const { id, secrets, ...updates } = input;
      const encryptedConfig = secrets ? cipher.encrypt(secrets) : undefined;
      const nextScope = input.scope || current.scope;
      const willBeDefault = input.isDefault ?? current.isDefault;
      return repository.withTransaction(async (transaction) => {
        if (
          willBeDefault &&
          (input.isDefault === true || nextScope !== current.scope)
        ) {
          await transaction.clearDefault(nextScope);
        }
        const connection = await transaction.update(id, {
          ...updates,
          ...(encryptedConfig !== undefined
            ? {
                encryptedConfig,
                hasCredentials: hasCredentials(secrets || {}),
              }
            : {}),
        });
        if (!connection) {
          throw new AppError('NOT_FOUND', 'AI connection not found');
        }
        await transaction.audit(
          id,
          actor.id,
          'updated',
          nonSecretChanges(input),
        );
        return safeDatabaseConnection(connection);
      });
    },

    async delete(id: number, actor: AiConnectionActor) {
      requireAdmin(actor);
      return repository.withTransaction(async (transaction) => {
        const deleted = await transaction.delete(id);
        if (!deleted) {
          throw new AppError('NOT_FOUND', 'AI connection not found');
        }
        await transaction.audit(null, actor.id, 'deleted', {
          connectionId: id,
        });
        return { success: true as const };
      });
    },

    async test(id: number | string, actor: AiConnectionActor) {
      requireAdmin(actor);
      let config: AiConnectionConfig;
      if (typeof id === 'string') {
        const connection = environmentConnections().find(
          (candidate) => candidate.id === id,
        );
        if (!connection) {
          throw new AppError('NOT_FOUND', 'AI connection not found');
        }
        config = connection;
      } else {
        ({ config } = await databaseConfig(id));
      }
      try {
        return await guardedAdapter(config).testConnection();
      } catch (error) {
        mapProviderError(error);
      }
    },

    async getDefaultAdapter(scope: AiConnectionScope) {
      const deploymentConnection = environmentConnections().find(
        (connection) =>
          connection.enabled &&
          connection.isDefault &&
          connection.scope === scope,
      );
      if (deploymentConnection) {
        await validateConfiguration(deploymentConnection);
        return guardedAdapter(deploymentConnection);
      }
      const connection = await repository.getDefault(scope);
      if (!connection) {
        throw new AppError(
          'NOT_FOUND',
          `No default AI connection is configured for ${scope}`,
        );
      }
      const secrets = connection.encryptedConfig
        ? cipher.decrypt(connection.encryptedConfig)
        : {};
      const config = {
        provider: connection.provider,
        endpoint: connection.endpoint,
        model: connection.model,
        capabilities: connection.capabilities,
        ...secrets,
      } satisfies AiConnectionConfig;
      await validateConfiguration(config);
      return guardedAdapter(config);
    },
  };
}

export type AiConnectionService = ReturnType<typeof createAiConnectionService>;
