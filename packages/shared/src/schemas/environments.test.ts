import { describe, expect, test } from 'bun:test';
import {
  createEnvironmentCookieInputSchema,
  createEnvironmentHeaderInputSchema,
  environmentVariableKeySchema,
  extractEnvironmentVariableReferences,
  extractEnvironmentVariableReferencesFromValue,
  validateEnvironmentCookieDomain,
} from './environments';

describe('environment variable placeholders', () => {
  test('extracts unique, case-sensitive references in encounter order', () => {
    expect(
      extractEnvironmentVariableReferences(
        'Log in with {{ username }} and {{password}}, then reuse {{username}}.',
      ),
    ).toEqual(['username', 'password']);
  });

  test('uses identifier-safe keys', () => {
    expect(environmentVariableKeySchema.parse('tenant_id')).toBe('tenant_id');
    expect(() => environmentVariableKeySchema.parse('tenant-id')).toThrow();
    expect(() => environmentVariableKeySchema.parse('1tenant')).toThrow();
  });

  test('extracts references from every nested manual specification field', () => {
    expect(
      extractEnvironmentVariableReferencesFromValue({
        title: 'Sign in as {{username}}',
        description: 'Use tenant {{tenant}}',
        prerequisites: ['Password {{password}} exists'],
        steps: [
          {
            action: 'Enter {{username}} and {{password}}',
            expectedResult: 'Welcome to {{tenant}}',
          },
        ],
        expectedResult: '{{username}} is signed in',
        tags: ['{{tag_name}}'],
      }),
    ).toEqual(['username', 'tenant', 'password', 'tag_name']);
  });
});

describe('environment header definitions', () => {
  const base = {
    environmentId: 1,
    name: 'Authorization',
    valueTemplate: 'Bearer {{access_token}}',
    origin: 'https://staging.example.test/app',
    enabled: true,
  };

  test('normalizes exact origins and requires variable-backed values', () => {
    expect(createEnvironmentHeaderInputSchema.parse(base).origin).toBe(
      'https://staging.example.test',
    );
    expect(
      createEnvironmentHeaderInputSchema.safeParse({
        ...base,
        valueTemplate: 'Bearer plaintext-secret',
      }).success,
    ).toBe(false);
  });

  test('rejects reserved, transport-managed, and runner-managed names', () => {
    for (const name of [
      'Host',
      'Content-Length',
      'Cookie',
      'Connection',
      'Forwarded',
      'X-Forwarded-For',
      'Sec-Fetch-Site',
      'Set-Cookie',
      'Set-Cookie2',
      'X-Probe-Internal',
    ]) {
      expect(
        createEnvironmentHeaderInputSchema.safeParse({ ...base, name })
          .success,
      ).toBe(false);
    }
    expect(
      createEnvironmentHeaderInputSchema.safeParse({
        ...base,
        name: 'X-Test-Tenant',
      }).success,
    ).toBe(true);
  });

  test('rejects disallowed value controls while preserving legal tabs', () => {
    for (const valueTemplate of [
      'Bearer {{access_token}}\0',
      'Bearer {{access_token}}\nnext',
      'Bearer {{access_token}}\x7F',
    ]) {
      expect(
        createEnvironmentHeaderInputSchema.safeParse({
          ...base,
          valueTemplate,
        }).success,
      ).toBe(false);
    }
    expect(
      createEnvironmentHeaderInputSchema.safeParse({
        ...base,
        valueTemplate: 'Bearer\t{{access_token}}',
      }).success,
    ).toBe(true);
  });
});

describe('environment cookie definitions', () => {
  test('requires variable-backed values and secure SameSite=None cookies', () => {
    const base = {
      environmentId: 1,
      name: 'session_id',
      valueTemplate: '{{session_id}}',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax' as const,
      enabled: true,
    };
    expect(createEnvironmentCookieInputSchema.safeParse(base).success).toBe(
      true,
    );
    expect(
      createEnvironmentCookieInputSchema.safeParse({
        ...base,
        valueTemplate: 'plaintext-secret',
      }).success,
    ).toBe(false);
    expect(
      createEnvironmentCookieInputSchema.safeParse({
        ...base,
        sameSite: 'None',
        secure: false,
      }).success,
    ).toBe(false);
    expect(
      createEnvironmentCookieInputSchema.safeParse({
        ...base,
        valueTemplate: `{{session_id}}${'x'.repeat(4_096)}`,
      }).success,
    ).toBe(false);
  });

  test('allows exact and parent domains but rejects unrelated hosts', () => {
    expect(() =>
      validateEnvironmentCookieDomain(
        'example.test',
        'https://staging.example.test',
      ),
    ).not.toThrow();
    expect(() =>
      validateEnvironmentCookieDomain(
        'evil-example.test',
        'https://staging.example.test',
      ),
    ).toThrow('must match or be a parent');
  });
});
