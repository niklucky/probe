export type AiErrorCode =
  | 'AUTHENTICATION_FAILED'
  | 'CONNECTION_FAILED'
  | 'INVALID_CONFIGURATION'
  | 'INVALID_RESPONSE'
  | 'MODEL_NOT_FOUND'
  | 'PROVIDER_ERROR'
  | 'RATE_LIMITED';

export class AiProviderError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
    public readonly retryable = false,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

const SECRET_PATTERNS = [
  /(?:sk|key|token|bearer)[-_a-z0-9]{8,}/gi,
  /authorization\s*[:=]\s*[^\s,]+/gi,
  /x-api-key\s*[:=]\s*[^\s,]+/gi,
];

export function sanitizeProviderMessage(
  value: unknown,
  secretValues: string[] = [],
) {
  let message =
    value instanceof Error
      ? value.message
      : typeof value === 'string'
        ? value
        : 'AI provider request failed';
  for (const pattern of SECRET_PATTERNS) {
    message = message.replace(pattern, '[REDACTED]');
  }
  for (const secret of secretValues.filter(Boolean)) {
    message = message.split(secret).join('[REDACTED]');
  }
  return message.slice(0, 500);
}

export function normalizeProviderError(
  error: unknown,
  secretValues: string[] = [],
): AiProviderError {
  if (error instanceof AiProviderError) return error;
  return new AiProviderError(
    'CONNECTION_FAILED',
    `Could not reach AI provider: ${sanitizeProviderMessage(error, secretValues)}`,
    true,
  );
}

export async function errorFromResponse(
  response: Response,
  secretValues: string[] = [],
) {
  let detail = '';
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
      message?: string;
    };
    detail = body.error?.message || body.message || '';
  } catch {
    // Provider bodies are optional and deliberately not returned verbatim.
  }
  const suffix = detail
    ? `: ${sanitizeProviderMessage(detail, secretValues)}`
    : '';
  if (response.status === 401 || response.status === 403) {
    return new AiProviderError(
      'AUTHENTICATION_FAILED',
      `AI provider rejected the credentials${suffix}`,
      false,
      response.status,
    );
  }
  if (response.status === 404) {
    return new AiProviderError(
      'MODEL_NOT_FOUND',
      `AI provider endpoint or model was not found${suffix}`,
      false,
      response.status,
    );
  }
  if (response.status === 429) {
    return new AiProviderError(
      'RATE_LIMITED',
      `AI provider rate limit exceeded${suffix}`,
      true,
      response.status,
    );
  }
  return new AiProviderError(
    'PROVIDER_ERROR',
    `AI provider returned HTTP ${response.status}${suffix}`,
    response.status >= 500,
    response.status,
  );
}
