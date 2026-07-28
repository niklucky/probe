import { describe, expect, test } from 'bun:test';
import { parseServerEnv } from './env';

describe('server environment', () => {
  test('parses typed defaults and deployment AI connections', () => {
    const env = parseServerEnv({
      AI_APPROVED_LOCAL_HOSTS: 'localhost, models.internal ',
      AI_CONNECTIONS_JSON: JSON.stringify([
        {
          name: 'Local',
          provider: 'openai-compatible',
          endpoint: 'http://models.internal:11434/v1',
          model: 'qwen',
          isDefault: true,
        },
      ]),
    });

    expect(env.PORT).toBe(11010);
    expect(env.MINIO_USE_SSL).toBe(false);
    expect(env.AI_APPROVED_LOCAL_HOSTS).toEqual([
      'localhost',
      'models.internal',
    ]);
    expect(env.AI_CONNECTIONS_JSON[0]).toMatchObject({
      provider: 'openai-compatible',
      scope: 'general',
      enabled: true,
    });
  });

  test('rejects malformed JSON and invalid master keys', () => {
    expect(() => parseServerEnv({ AI_CONNECTIONS_JSON: '{' })).toThrow(
      'AI_CONNECTIONS_JSON',
    );
    expect(() => parseServerEnv({ AI_MASTER_KEY: 'invalid' })).toThrow(
      'AI_MASTER_KEY',
    );
    expect(() => parseServerEnv({ RUNNER_NETWORK_POLICY: 'host' })).toThrow(
      'RUNNER_NETWORK_POLICY',
    );
  });
});
