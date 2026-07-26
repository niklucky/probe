import type { AiConnectionConfig, AiProvider } from '@probe/ai';
import { type AiConnectionScope } from '@probe/shared/schemas/ai-connections';
import { parseServerEnv } from '../../env';

export interface EnvironmentAiConnection extends AiConnectionConfig {
  id: string;
  name: string;
  scope: AiConnectionScope;
  enabled: boolean;
  isDefault: boolean;
}

function fromStandardEnvironment(
  env: ReturnType<typeof parseServerEnv>,
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
  const parsed = parseServerEnv(env);
  const standard = fromStandardEnvironment(parsed);
  return [
    ...standard,
    ...parsed.AI_CONNECTIONS_JSON.map((item, index) => {
      return {
        id: `env:${index}`,
        name: item.name,
        provider: item.provider as AiProvider,
        endpoint: item.endpoint || undefined,
        model: item.model,
        apiKey: item.apiKey,
        headers: item.headers,
        capabilities: item.capabilities,
        scope: item.scope,
        enabled: item.enabled,
        isDefault: item.isDefault,
      };
    }),
  ];
}
