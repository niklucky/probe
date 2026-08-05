import { describe, expect, test } from 'bun:test';
import {
  createEnvironmentCookieInputSchema,
  environmentVariableKeySchema,
  extractEnvironmentVariableReferences,
  extractEnvironmentVariableReferencesFromValue,
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
  });
});
