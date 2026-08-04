import { describe, expect, test } from 'bun:test';
import {
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
