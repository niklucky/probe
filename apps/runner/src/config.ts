import { z } from 'zod';

const schema = z.object({
  RUNNER_ID: z.string().min(1).default(`runner-${process.pid}`),
  RUNNER_POLL_MS: z.coerce.number().int().min(100).default(1000),
  RUNNER_STALE_SECONDS: z.coerce.number().int().min(10).default(60),
  RUNNER_ARTIFACT_RETENTION_DAYS: z.coerce.number().int().min(1).default(14),
  RUNNER_TEST_SECRETS_JSON: z
    .string()
    .default('{}')
    .transform((value) => {
      const parsed = JSON.parse(value) as unknown;
      return z.record(z.string().min(1)).parse(parsed);
    }),
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
