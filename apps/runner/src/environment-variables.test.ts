import { describe, expect, test } from 'bun:test';
import { createCipheriv } from 'node:crypto';
import {
  resolveRuntimeEnvironment,
  RuntimeEnvironmentError,
} from './environment-variables';

const key = '11'.repeat(32);

function encrypt(value: string, environmentId: number, variableKey: string) {
  const iv = Buffer.alloc(12, variableKey.length);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  cipher.setAAD(
    Buffer.from(`environment-variable:${environmentId}:${variableKey}`),
  );
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

describe('execution environment variables', () => {
  test('decrypts only queried references and tracks actual secrets', () => {
    const environmentId = 7;
    expect(
      resolveRuntimeEnvironment(
        ['password', 'username'],
        [
          {
            key: 'username',
            encryptedValue: encrypt(
              'qa@example.test',
              environmentId,
              'username',
            ),
            isSecret: false,
          },
          {
            key: 'password',
            encryptedValue: encrypt(
              'private-fixture',
              environmentId,
              'password',
            ),
            isSecret: true,
          },
        ],
        environmentId,
        key,
      ),
    ).toEqual({
      values: {
        password: 'private-fixture',
        username: 'qa@example.test',
      },
      secretNames: ['password'],
    });
  });

  test('fails preflight with all missing variable names', () => {
    expect(() =>
      resolveRuntimeEnvironment(['username', 'password'], [], 7, key),
    ).toThrow(RuntimeEnvironmentError);
    try {
      resolveRuntimeEnvironment(['username', 'password'], [], 7, key);
    } catch (error) {
      expect(error).toMatchObject({
        code: 'MISSING_ENVIRONMENT_VARIABLES',
      });
      expect(String(error)).toContain('username, password');
    }
  });

  test('uses updated encrypted values on each resolution', () => {
    const first = resolveRuntimeEnvironment(
      ['username'],
      [
        {
          key: 'username',
          encryptedValue: encrypt('first', 7, 'username'),
          isSecret: false,
        },
      ],
      7,
      key,
    );
    const second = resolveRuntimeEnvironment(
      ['username'],
      [
        {
          key: 'username',
          encryptedValue: encrypt('second', 7, 'username'),
          isSecret: false,
        },
      ],
      7,
      key,
    );
    expect(first.values.username).toBe('first');
    expect(second.values.username).toBe('second');
  });
});
