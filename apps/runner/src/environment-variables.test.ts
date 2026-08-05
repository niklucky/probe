import { describe, expect, test } from 'bun:test';
import { createCipheriv } from 'node:crypto';
import {
  cookieVariableReferences,
  headerVariableReferences,
  resolveRuntimeCookies,
  resolveRuntimeEnvironment,
  resolveRuntimeHeaders,
  RuntimeEnvironmentError,
  runtimeSensitiveVariableNames,
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

describe('execution environment headers', () => {
  const definition = {
    name: 'Authorization',
    valueTemplate: 'Bearer {{access_token}}',
    origin: 'https://staging.example.test',
  };

  test('resolves templates and treats referenced values as sensitive', () => {
    expect(headerVariableReferences([definition])).toEqual(['access_token']);
    expect(
      resolveRuntimeHeaders([definition], { access_token: 'private-token' }),
    ).toEqual([
      {
        name: 'Authorization',
        value: 'Bearer private-token',
        origin: 'https://staging.example.test',
      },
    ]);
    expect(
      runtimeSensitiveVariableNames(
        ['password'],
        ['session_id'],
        ['access_token'],
      ),
    ).toEqual(['password', 'session_id', 'access_token']);
  });

  test('rejects reserved names, malformed origins, controls, and missing values', () => {
    expect(() =>
      resolveRuntimeHeaders([{ ...definition, name: 'Host' }], {
        access_token: 'value',
      }),
    ).toThrow('reserved or managed');
    expect(() =>
      resolveRuntimeHeaders(
        [{ ...definition, origin: 'https://staging.example.test/' }],
        { access_token: 'value' },
      ),
    ).toThrow('non-canonical origin');
    expect(() =>
      resolveRuntimeHeaders([definition], { access_token: 'line\nbreak' }),
    ).toThrow('disallowed control character');
    expect(() =>
      resolveRuntimeHeaders([definition], { access_token: 'null\0byte' }),
    ).toThrow('disallowed control character');
    expect(() =>
      resolveRuntimeHeaders([definition], { access_token: 'tab\tallowed' }),
    ).not.toThrow();
    expect(() => resolveRuntimeHeaders([definition], {})).toThrow(
      'Missing environment variables: access_token',
    );
  });
});

describe('execution environment cookies', () => {
  const definition = {
    name: 'session_id',
    valueTemplate: 'session={{session_id}}',
    domain: null,
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax' as const,
    expiresAt: null,
  };

  test('resolves templates and safely infers the environment host', () => {
    expect(cookieVariableReferences([definition])).toEqual(['session_id']);
    expect(
      resolveRuntimeCookies([definition], 'https://staging.example.test/app', {
        session_id: 'private-cookie',
      }),
    ).toEqual([
      {
        name: 'session_id',
        value: 'session=private-cookie',
        domain: 'staging.example.test',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ]);
  });

  test('treats every cookie-referenced variable as sensitive', () => {
    expect(runtimeSensitiveVariableNames(['password'], ['session_id'])).toEqual(
      ['password', 'session_id'],
    );
  });

  test('allows a related parent domain but rejects unrelated domains', () => {
    expect(
      resolveRuntimeCookies(
        [{ ...definition, domain: 'example.test' }],
        'https://staging.example.test',
        { session_id: 'value' },
      )[0]?.domain,
    ).toBe('example.test');
    expect(() =>
      resolveRuntimeCookies(
        [{ ...definition, domain: 'unrelated.example.test' }],
        'https://staging.example.test',
        { session_id: 'value' },
      ),
    ).toThrow(RuntimeEnvironmentError);
  });

  test('rejects malformed targets, expired cookies, and invalid attributes', () => {
    const values = { session_id: 'value' };
    expect(() =>
      resolveRuntimeCookies([definition], 'not a URL', values),
    ).toThrow(RuntimeEnvironmentError);
    try {
      resolveRuntimeCookies([definition], 'not a URL', values);
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_ENVIRONMENT_COOKIES' });
    }
    expect(() =>
      resolveRuntimeCookies(
        [{ ...definition, expiresAt: new Date('2026-01-01T00:00:00Z') }],
        'https://staging.example.test',
        values,
        new Date('2026-01-02T00:00:00Z'),
      ),
    ).toThrow('Cookie "session_id" has expired');
    expect(() =>
      resolveRuntimeCookies(
        [{ ...definition, sameSite: 'None', secure: false }],
        'https://staging.example.test',
        values,
      ),
    ).toThrow('SameSite=None without Secure');
  });

  test('rejects resolved values that browsers cannot store', () => {
    expect(() =>
      resolveRuntimeCookies([definition], 'https://staging.example.test', {
        session_id: 'line one; line two',
      }),
    ).toThrow('Cookie "session_id" contains characters');
    expect(() =>
      resolveRuntimeCookies([definition], 'https://staging.example.test', {
        session_id: 'x'.repeat(4_096),
      }),
    ).toThrow('Cookie "session_id" exceeds the 4096-byte limit');
  });

  test('rejects unrelated domains and missing template values before launch', () => {
    expect(() =>
      resolveRuntimeCookies([definition], 'https://staging.example.test', {}),
    ).toThrow('Missing environment variables: session_id');
  });
});
