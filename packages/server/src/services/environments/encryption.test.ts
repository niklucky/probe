import { describe, expect, test } from 'bun:test';
import { createEnvironmentVariableCipher } from './encryption';

const key = Buffer.alloc(32, 11).toString('base64');

describe('environment variable encryption', () => {
  test('encrypts values with authenticated, randomized ciphertext', () => {
    const cipher = createEnvironmentVariableCipher(key);
    const first = cipher.encrypt('top-secret', 4, 'password');
    const second = cipher.encrypt('top-secret', 4, 'password');

    expect(first).not.toContain('top-secret');
    expect(first).not.toBe(second);
    expect(cipher.decrypt(first, 4, 'password')).toBe('top-secret');
  });

  test('binds ciphertext to its environment and variable key', () => {
    const cipher = createEnvironmentVariableCipher(key);
    const encrypted = cipher.encrypt('value', 4, 'username');

    expect(() => cipher.decrypt(encrypted, 5, 'username')).toThrow(
      'could not be decrypted',
    );
    expect(() => cipher.decrypt(encrypted, 4, 'other')).toThrow(
      'could not be decrypted',
    );
  });
});
