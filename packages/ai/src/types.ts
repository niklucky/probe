export type AiProvider = 'openai' | 'anthropic' | 'openai-compatible';

export interface AiConnectionConfig {
  provider: AiProvider;
  endpoint?: string | null;
  model: string;
  apiKey?: string;
  headers?: Record<string, string>;
  capabilities?: string[];
}

export interface StructuredGenerationRequest {
  system?: string;
  prompt: string;
  schema: Record<string, unknown>;
  schemaName?: string;
  temperature?: number;
}

export interface NormalizedUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface StructuredGenerationResult<T = unknown> {
  value: T;
  model: string;
  provider: AiProvider;
  usage: NormalizedUsage | null;
  latencyMs: number;
}

export interface ConnectionTestResult {
  ok: true;
  model: string;
  modelAvailable: boolean;
  latencyMs: number;
  capabilities: string[];
}

export interface AiAdapter {
  generateStructured<T>(
    request: StructuredGenerationRequest,
  ): Promise<StructuredGenerationResult<T>>;
  testConnection(): Promise<ConnectionTestResult>;
}
