import { describe, expect, test } from 'bun:test';
import { createCredentialCipher } from './encryption';

const key = Buffer.alloc(32, 7).toString('base64');

describe('AI credential encryption', () => {
  test('encrypts with authenticated random ciphertext and decrypts', () => {
    const cipher = createCredentialCipher(key);
    const first = cipher.encrypt({ apiKey: 'secret' });
    const second = cipher.encrypt({ apiKey: 'secret' });

    expect(first).not.toContain('secret');
    expect(first).not.toBe(second);
    expect(cipher.decrypt(first)).toEqual({ apiKey: 'secret' });
  });

  test('fails safely without a valid deployment key', () => {
    expect(() =>
      createCredentialCipher(undefined).encrypt({ apiKey: 'x' }),
    ).toThrow('encryption is not configured');
    expect(() =>
      createCredentialCipher('bad').encrypt({ apiKey: 'x' }),
    ).toThrow('encryption key is invalid');
  });

  test('rejects ciphertext tampering', () => {
    const cipher = createCredentialCipher(key);
    const encrypted = cipher.encrypt({ apiKey: 'secret' });
    expect(() => cipher.decrypt(`${encrypted}x`)).toThrow(
      'could not be decrypted',
    );
  });
});
