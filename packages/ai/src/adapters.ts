import {
  AiProviderError,
  errorFromResponse,
  normalizeProviderError,
} from './errors';
import type {
  AiAdapter,
  AiConnectionConfig,
  ConnectionTestResult,
  NormalizedUsage,
  StructuredGenerationRequest,
  StructuredGenerationResult,
} from './types';
import { runBoundedToolLoop } from './tool-loop';

type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function parseJsonText<T>(text: string | undefined): T {
  if (!text) {
    throw new AiProviderError(
      'INVALID_RESPONSE',
      'AI provider returned an empty response',
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AiProviderError(
      'INVALID_RESPONSE',
      'AI provider returned invalid structured data',
      false,
      undefined,
      text,
    );
  }
}

function requestHeaders(config: AiConnectionConfig) {
  return { 'content-type': 'application/json', ...config.headers };
}

function openAiOutputTokenLimit(
  provider: AiConnectionConfig['provider'],
  maxOutputTokens: number | undefined,
) {
  if (maxOutputTokens === undefined) return {};
  return provider === 'openai'
    ? { max_completion_tokens: maxOutputTokens }
    : { max_tokens: maxOutputTokens };
}

function openAiAdapter(config: AiConnectionConfig, fetcher: Fetch): AiAdapter {
  const endpoint =
    config.endpoint ||
    (config.provider === 'openai' ? 'https://api.openai.com/v1' : '');
  if (!endpoint) {
    throw new AiProviderError(
      'INVALID_CONFIGURATION',
      'OpenAI-compatible connections require an endpoint',
    );
  }
  const auth: Record<string, string> = config.apiKey
    ? { authorization: `Bearer ${config.apiKey}` }
    : {};
  const secretValues = [
    config.apiKey || '',
    ...Object.values(config.headers || {}),
  ];
  const adapter: AiAdapter = {
    async generateStructured<T>(
      request: StructuredGenerationRequest,
    ): Promise<StructuredGenerationResult<T>> {
      const started = Date.now();
      try {
        const supportsNativeJsonSchema =
          config.provider === 'openai' ||
          config.capabilities?.includes('native-json-schema');
        const schemaInstruction = supportsNativeJsonSchema
          ? ''
          : `\n\nReturn only one JSON object matching this JSON Schema:\n${JSON.stringify(
              request.schema,
            )}`;
        const response = await fetcher(joinUrl(endpoint, 'chat/completions'), {
          method: 'POST',
          redirect: 'error',
          signal: request.signal,
          headers: { ...requestHeaders(config), ...auth },
          body: JSON.stringify({
            model: config.model,
            messages: [
              ...(request.system
                ? [{ role: 'system', content: request.system }]
                : []),
              {
                role: 'user',
                content: `${request.prompt}${schemaInstruction}`,
              },
            ],
            temperature: request.temperature,
            ...openAiOutputTokenLimit(config.provider, request.maxOutputTokens),
            response_format: supportsNativeJsonSchema
              ? {
                  type: 'json_schema',
                  json_schema: {
                    name: request.schemaName || 'response',
                    strict: true,
                    schema: request.schema,
                  },
                }
              : { type: 'json_object' },
          }),
        });
        if (!response.ok) {
          throw await errorFromResponse(response, secretValues);
        }
        const body = (await response.json()) as {
          model?: string;
          choices?: Array<{ message?: { content?: string } }>;
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
          };
        };
        const usage: NormalizedUsage | null = body.usage
          ? {
              inputTokens: body.usage.prompt_tokens || 0,
              outputTokens: body.usage.completion_tokens || 0,
              totalTokens: body.usage.total_tokens || 0,
            }
          : null;
        return {
          value: parseJsonText<T>(body.choices?.[0]?.message?.content),
          model: body.model || config.model,
          provider: config.provider,
          usage,
          latencyMs: Date.now() - started,
        };
      } catch (error) {
        throw normalizeProviderError(error, secretValues);
      }
    },
    async runToolLoop(request) {
      return runBoundedToolLoop(
        (generation) => adapter.generateStructured(generation),
        request,
      );
    },
    async testConnection(): Promise<ConnectionTestResult> {
      const started = Date.now();
      try {
        const response = await fetcher(joinUrl(endpoint, 'models'), {
          redirect: 'error',
          headers: { ...requestHeaders(config), ...auth },
        });
        if (!response.ok) {
          throw await errorFromResponse(response, secretValues);
        }
        const body = (await response.json()) as {
          data?: Array<{ id?: string }>;
        };
        const modelAvailable =
          body.data?.some(({ id }) => id === config.model) ?? false;
        if (!modelAvailable) {
          throw new AiProviderError(
            'MODEL_NOT_FOUND',
            'Configured model was not reported by the AI provider',
          );
        }
        return {
          ok: true,
          model: config.model,
          modelAvailable,
          latencyMs: Date.now() - started,
          capabilities: config.capabilities || ['structured-generation'],
        };
      } catch (error) {
        throw normalizeProviderError(error, secretValues);
      }
    },
  };
  return adapter;
}

function anthropicAdapter(
  config: AiConnectionConfig,
  fetcher: Fetch,
): AiAdapter {
  const endpoint = config.endpoint || 'https://api.anthropic.com/v1';
  const headers = {
    ...requestHeaders(config),
    ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
    'anthropic-version': '2023-06-01',
  };
  const secretValues = [
    config.apiKey || '',
    ...Object.values(config.headers || {}),
  ];
  const adapter: AiAdapter = {
    async generateStructured<T>(
      request: StructuredGenerationRequest,
    ): Promise<StructuredGenerationResult<T>> {
      const started = Date.now();
      try {
        const response = await fetcher(joinUrl(endpoint, 'messages'), {
          method: 'POST',
          redirect: 'error',
          signal: request.signal,
          headers,
          body: JSON.stringify({
            model: config.model,
            max_tokens: request.maxOutputTokens ?? 4096,
            system: request.system,
            messages: [{ role: 'user', content: request.prompt }],
            temperature: request.temperature,
            tools: [
              {
                name: request.schemaName || 'structured_response',
                description: 'Return the requested structured response',
                input_schema: request.schema,
              },
            ],
            tool_choice: {
              type: 'tool',
              name: request.schemaName || 'structured_response',
            },
          }),
        });
        if (!response.ok) {
          throw await errorFromResponse(response, secretValues);
        }
        const body = (await response.json()) as {
          model?: string;
          content?: Array<{ type?: string; input?: T }>;
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        const value = body.content?.find(
          ({ type }) => type === 'tool_use',
        )?.input;
        if (value === undefined) {
          throw new AiProviderError(
            'INVALID_RESPONSE',
            'AI provider did not return structured tool data',
          );
        }
        const inputTokens = body.usage?.input_tokens || 0;
        const outputTokens = body.usage?.output_tokens || 0;
        return {
          value,
          model: body.model || config.model,
          provider: 'anthropic',
          usage: body.usage
            ? {
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
              }
            : null,
          latencyMs: Date.now() - started,
        };
      } catch (error) {
        throw normalizeProviderError(error, secretValues);
      }
    },
    async runToolLoop(request) {
      return runBoundedToolLoop(
        (generation) => adapter.generateStructured(generation),
        request,
      );
    },
    async testConnection(): Promise<ConnectionTestResult> {
      const started = Date.now();
      try {
        const response = await fetcher(joinUrl(endpoint, 'models'), {
          redirect: 'error',
          headers,
        });
        if (!response.ok) {
          throw await errorFromResponse(response, secretValues);
        }
        const body = (await response.json()) as {
          data?: Array<{ id?: string }>;
        };
        const modelAvailable =
          body.data?.some(({ id }) => id === config.model) ?? false;
        if (!modelAvailable) {
          throw new AiProviderError(
            'MODEL_NOT_FOUND',
            'Configured model was not reported by the AI provider',
          );
        }
        return {
          ok: true,
          model: config.model,
          modelAvailable,
          latencyMs: Date.now() - started,
          capabilities: config.capabilities || ['structured-generation'],
        };
      } catch (error) {
        throw normalizeProviderError(error, secretValues);
      }
    },
  };
  return adapter;
}

export function createAiAdapter(
  config: AiConnectionConfig,
  fetcher: Fetch = fetch,
): AiAdapter {
  return config.provider === 'anthropic'
    ? anthropicAdapter(config, fetcher)
    : openAiAdapter(config, fetcher);
}
