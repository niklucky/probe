import {
  aiConnectionSecretInputSchema,
  createAiConnectionInputSchema,
} from '@probe/shared/schemas/ai-connections';
import { InternalServerError } from '@probe/shared/errors/app-error';
import { z } from 'zod';

const deploymentAiConnectionSchema = createAiConnectionInputSchema
  .omit({ secrets: true })
  .extend(aiConnectionSecretInputSchema.shape);

const aiConnectionsJsonSchema = z
  .string()
  .default('[]')
  .transform((value, context) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'must contain valid JSON',
      });
      return z.NEVER;
    }
  })
  .pipe(z.array(deploymentAiConnectionSchema));

const masterKeySchema = z
  .string()
  .refine((value) => {
    const key = /^[a-f0-9]{64}$/i.test(value)
      ? Buffer.from(value, 'hex')
      : Buffer.from(value, 'base64');
    return key.length === 32;
  }, 'must be a base64-encoded 32-byte key or 64 hexadecimal characters')
  .optional();

const rawServerEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(11010),
  FRONTEND_URL: z.string().url().default('http://localhost:11020'),
  JWT_SECRET: z
    .string()
    .min(16)
    .default('your-secret-key-change-this-in-production'),
  MINIO_ENDPOINT: z.string().min(1).default('localhost'),
  MINIO_PORT: z.coerce.number().int().min(1).max(65535).default(11002),
  MINIO_USE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  MINIO_ACCESS_KEY: z.string().min(1).default('signal'),
  MINIO_SECRET_KEY: z.string().min(1).default('signal_password'),
  MINIO_BUCKET: z.string().min(1).default('signal-assets'),
  MINIO_PUBLIC_URL: z
    .string()
    .url()
    .refine(
      (value) => {
        const url = new URL(value);
        return (
          ['http:', 'https:'].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          url.pathname === '/' &&
          !url.search &&
          !url.hash
        );
      },
      'must be an HTTP(S) origin without credentials, path, query, or fragment',
    )
    .optional(),
  RUNNER_VERSION: z.string().min(1).default('1'),
  RUNNER_CONTAINER_IMAGE: z
    .string()
    .min(1)
    .default('probe-playwright-runner:1'),
  RUNNER_CPU_LIMIT: z.coerce.number().positive().max(8).default(1),
  RUNNER_MEMORY_MB: z.coerce.number().int().min(128).max(8192).default(768),
  RUNNER_PROCESS_LIMIT: z.coerce.number().int().min(32).max(1024).default(128),
  RUNNER_ARTIFACT_LIMIT_MB: z.coerce
    .number()
    .int()
    .min(16)
    .max(2048)
    .default(256),
  RUNNER_NETWORK_POLICY: z
    .string()
    .min(1)
    .refine(
      (value) => !['host', 'bridge', 'default', 'none'].includes(value),
      'must name a dedicated egress-controlled Docker network',
    )
    .default('probe-runner-egress'),
  RUNNER_ARTIFACT_BUCKET: z.string().min(1).default('signal-runner-artifacts'),
  AI_MASTER_KEY: masterKeySchema,
  ENVIRONMENT_VARIABLES_MASTER_KEY: masterKeySchema,
  AI_APPROVED_LOCAL_HOSTS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean),
    ),
  AI_CONNECTIONS_JSON: aiConnectionsJsonSchema,
  OPENAI_MODEL: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  INVITATION_FROM_EMAIL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(3).optional(),
  ),
});

const validatedServerEnvSchema = rawServerEnvSchema.superRefine(
  (value, context) => {
    if (value.NODE_ENV === 'production' && !value.INVITATION_FROM_EMAIL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['INVITATION_FROM_EMAIL'],
        message: 'is required in production',
      });
    }
  },
);

export const serverEnvSchema = validatedServerEnvSchema.transform((value) => ({
  ...value,
  INVITATION_FROM_EMAIL:
    value.INVITATION_FROM_EMAIL || 'Probe <onboarding@resend.dev>',
  MINIO_PUBLIC_URL:
    value.MINIO_PUBLIC_URL ||
    `${value.MINIO_USE_SSL ? 'https' : 'http'}://${value.MINIO_ENDPOINT}:${value.MINIO_PORT}`,
}));

export function parseServerEnv(input: NodeJS.ProcessEnv) {
  const result = serverEnvSchema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new InternalServerError(
      `Server environment configuration is invalid: ${details}`,
    );
  }
  return result.data;
}

export const serverEnv = parseServerEnv(process.env);
export type ServerEnv = z.infer<typeof serverEnvSchema>;
