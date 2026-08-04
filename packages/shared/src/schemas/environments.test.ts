import { describe, expect, test } from 'bun:test';
import {
  environmentVariableKeySchema,
  extractEnvironmentVariableReferences,
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
});
