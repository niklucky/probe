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
  MINIO_PUBLIC_URL: z.string().url().optional(),
  AI_MASTER_KEY: masterKeySchema,
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
});

export const serverEnvSchema = rawServerEnvSchema.transform((value) => ({
  ...value,
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
