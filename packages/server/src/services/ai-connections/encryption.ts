import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { InternalServerError } from '@probe/shared/errors/app-error';
import { serverEnv } from '../../env';

const ALGORITHM = 'aes-256-gcm';

function decodeMasterKey(value: string | undefined) {
  if (!value) {
    throw new InternalServerError('AI credential encryption is not configured');
  }
  const key = /^[a-f0-9]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new InternalServerError('AI credential encryption key is invalid');
  }
  return key;
}

export function createCredentialCipher(masterKey = serverEnv.AI_MASTER_KEY) {
  return {
    encrypt(value: Record<string, unknown>) {
      const key = decodeMasterKey(masterKey);
      const iv = randomBytes(12);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      const ciphertext = Buffer.concat([
        cipher.update(JSON.stringify(value), 'utf8'),
        cipher.final(),
      ]);
      return [
        'v1',
        iv.toString('base64url'),
        cipher.getAuthTag().toString('base64url'),
        ciphertext.toString('base64url'),
      ].join('.');
    },
    decrypt(value: string) {
      const key = decodeMasterKey(masterKey);
      const [version, iv, tag, ciphertext, extra] = value.split('.');
      if (
        version !== 'v1' ||
        !iv ||
        !tag ||
        !ciphertext ||
        extra !== undefined
      ) {
        throw new InternalServerError('Stored AI credentials are invalid');
      }
      try {
        const decipher = createDecipheriv(
          ALGORITHM,
          key,
          Buffer.from(iv, 'base64url'),
        );
        decipher.setAuthTag(Buffer.from(tag, 'base64url'));
        const plaintext = Buffer.concat([
          decipher.update(Buffer.from(ciphertext, 'base64url')),
          decipher.final(),
        ]).toString('utf8');
        return JSON.parse(plaintext) as {
          apiKey?: string;
          headers?: Record<string, string>;
        };
      } catch {
        throw new InternalServerError(
          'Stored AI credentials could not be decrypted',
        );
      }
    },
  };
}

export type CredentialCipher = ReturnType<typeof createCredentialCipher>;
