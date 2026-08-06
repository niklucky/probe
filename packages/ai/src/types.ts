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
  maxOutputTokens?: number;
  signal?: AbortSignal;
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

export interface ToolLoopTurn<TCall, TResult> {
  call: TCall;
  result: TResult;
}

export interface BoundedToolLoopRequest<TCall, TResult> {
  system?: string;
  prompt: string;
  decisionSchema: Record<string, unknown>;
  decisionSchemaName?: string;
  maxToolCalls: number;
  maxDurationMs: number;
  maxTotalTokens: number;
  signal?: AbortSignal;
  parseCall(value: unknown): TCall;
  isFinished(call: TCall): boolean;
  execute(call: TCall): Promise<TResult>;
  serializeResult?(result: TResult): unknown;
}

export interface BoundedToolLoopResult<TCall, TResult> {
  turns: Array<ToolLoopTurn<TCall, TResult>>;
  model: string | null;
  provider: AiProvider | null;
  usage: NormalizedUsage;
  latencyMs: number;
  finished: boolean;
}

export interface AiAdapter {
  generateStructured<T>(
    request: StructuredGenerationRequest,
  ): Promise<StructuredGenerationResult<T>>;
  runToolLoop<TCall, TResult>(
    request: BoundedToolLoopRequest<TCall, TResult>,
  ): Promise<BoundedToolLoopResult<TCall, TResult>>;
  testConnection(): Promise<ConnectionTestResult>;
}
