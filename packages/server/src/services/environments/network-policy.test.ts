import { describe, expect, test } from 'bun:test';
import { assertEnvironmentNetworkTargetAllowed } from './network-policy';

describe('environment network policy', () => {
  test('allows public HTTP(S) targets', () => {
    expect(
      assertEnvironmentNetworkTargetAllowed('https://example.com/test').host,
    ).toBe('example.com');
  });

  for (const target of [
    'file:///etc/passwd',
    'http://localhost:3000',
    'http://127.0.0.1',
    'http://10.0.0.1',
    'http://169.254.169.254/latest/meta-data',
    'https://user:password@example.com',
  ]) {
    test(`blocks ${target}`, () => {
      expect(() => assertEnvironmentNetworkTargetAllowed(target)).toThrow();
    });
  }
});
