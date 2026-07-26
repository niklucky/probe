import type { AiConnectionConfig, AiProvider } from '@probe/ai';
import {
  aiConnectionScopeSchema,
  aiProviderSchema,
  type AiConnectionScope,
} from '@probe/shared/schemas/ai-connections';
import { AppError } from '@probe/shared/errors/app-error';

export interface EnvironmentAiConnection extends AiConnectionConfig {
  id: string;
  name: string;
  scope: AiConnectionScope;
  enabled: boolean;
  isDefault: boolean;
}

function fromStandardEnvironment(
  env: NodeJS.ProcessEnv,
): EnvironmentAiConnection[] {
  const connections: EnvironmentAiConnection[] = [];
  if (env.OPENAI_MODEL) {
    connections.push({
      id: 'env:openai',
      name: 'Deployment OpenAI',
      provider: 'openai',
      model: env.OPENAI_MODEL,
      apiKey: env.OPENAI_API_KEY,
      scope: 'general',
      enabled: true,
      isDefault: true,
    });
  }
  if (env.ANTHROPIC_MODEL) {
    connections.push({
      id: 'env:anthropic',
      name: 'Deployment Anthropic',
      provider: 'anthropic',
      model: env.ANTHROPIC_MODEL,
      apiKey: env.ANTHROPIC_API_KEY,
      scope: 'general',
      enabled: true,
      isDefault: !env.OPENAI_MODEL,
    });
  }
  return connections;
}

export function loadEnvironmentAiConnections(
  env: NodeJS.ProcessEnv = process.env,
): EnvironmentAiConnection[] {
  const standard = fromStandardEnvironment(env);
  if (!env.AI_CONNECTIONS_JSON) return standard;
  let values: unknown;
  try {
    values = JSON.parse(env.AI_CONNECTIONS_JSON);
  } catch {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Deployment AI connection configuration is invalid',
    );
  }
  if (!Array.isArray(values)) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Deployment AI connection configuration must be an array',
    );
  }
  return values.map((value, index) => {
    if (!value || typeof value !== 'object') {
      throw new AppError(
        'INTERNAL_SERVER_ERROR',
        'Deployment AI connection entry is invalid',
      );
    }
    const item = value as Record<string, unknown>;
    const provider = aiProviderSchema.safeParse(item.provider);
    const scope = aiConnectionScopeSchema.safeParse(item.scope ?? 'general');
    if (
      !provider.success ||
      !scope.success ||
      typeof item.name !== 'string' ||
      typeof item.model !== 'string'
    ) {
      throw new AppError(
        'INTERNAL_SERVER_ERROR',
        'Deployment AI connection entry is invalid',
      );
    }
    return {
      id: `env:${index}`,
      name: item.name,
      provider: provider.data as AiProvider,
      endpoint: typeof item.endpoint === 'string' ? item.endpoint : undefined,
      model: item.model,
      apiKey: typeof item.apiKey === 'string' ? item.apiKey : undefined,
      headers:
        item.headers && typeof item.headers === 'object'
          ? (item.headers as Record<string, string>)
          : undefined,
      capabilities: Array.isArray(item.capabilities)
        ? item.capabilities.filter(
            (capability): capability is string =>
              typeof capability === 'string',
          )
        : [],
      scope: scope.data,
      enabled: item.enabled !== false,
      isDefault: item.isDefault === true,
    };
  });
}
