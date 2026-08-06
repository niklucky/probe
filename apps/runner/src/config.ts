import { z } from 'zod';

const schema = z.object({
  RUNNER_ID: z.string().min(1).default(`runner-${process.pid}`),
  RUNNER_POLL_MS: z.coerce.number().int().min(100).default(1000),
  RUNNER_STALE_SECONDS: z.coerce.number().int().min(10).default(60),
  RUNNER_ARTIFACT_RETENTION_DAYS: z.coerce.number().int().min(1).default(14),
  ENVIRONMENT_VARIABLES_MASTER_KEY: z.string().refine((value) => {
    const key = /^[a-f0-9]{64}$/i.test(value)
      ? Buffer.from(value, 'hex')
      : Buffer.from(value, 'base64');
    return key.length === 32;
  }, 'must be a base64-encoded 32-byte key or 64 hexadecimal characters'),
  AI_MASTER_KEY: z.string().optional(),
  AI_APPROVED_LOCAL_HOSTS: z.string().default(''),
  AI_CONNECTIONS_JSON: z.string().default('[]'),
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
  MINIO_ENDPOINT: z.string().min(1).default('localhost'),
  MINIO_PORT: z.coerce.number().int().positive().default(11002),
  MINIO_USE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  MINIO_ACCESS_KEY: z.string().min(1).default('signal'),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_ARTIFACT_BUCKET: z.string().min(1).default('signal-runner-artifacts'),
});

export const runnerConfig = schema.parse(process.env);
