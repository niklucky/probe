import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { InternalServerError } from '@probe/shared/errors/app-error';
import { serverEnv } from '../../env';

const ALGORITHM = 'aes-256-gcm';

function decodeMasterKey(value: string | undefined) {
  if (!value) {
    throw new InternalServerError(
      'Environment variable encryption is not configured',
    );
  }
  const key = /^[a-f0-9]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new InternalServerError(
      'Environment variable encryption key is invalid',
    );
  }
  return key;
}

function associatedData(environmentId: number, key: string) {
  return Buffer.from(`environment-variable:${environmentId}:${key}`, 'utf8');
}

export function createEnvironmentVariableCipher(
  masterKey = serverEnv.ENVIRONMENT_VARIABLES_MASTER_KEY,
) {
  return {
    encrypt(value: string, environmentId: number, variableKey: string) {
      const key = decodeMasterKey(masterKey);
      const iv = randomBytes(12);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      cipher.setAAD(associatedData(environmentId, variableKey));
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
    },

    decrypt(value: string, environmentId: number, variableKey: string) {
      const key = decodeMasterKey(masterKey);
      const [version, iv, tag, ciphertext, extra] = value.split('.');
      if (
        version !== 'v1' ||
        !iv ||
        !tag ||
        ciphertext === undefined ||
        extra !== undefined
      ) {
        throw new InternalServerError('Stored environment variable is invalid');
      }
      try {
        const decipher = createDecipheriv(
          ALGORITHM,
          key,
          Buffer.from(iv, 'base64url'),
        );
        decipher.setAAD(associatedData(environmentId, variableKey));
        decipher.setAuthTag(Buffer.from(tag, 'base64url'));
        return Buffer.concat([
          decipher.update(Buffer.from(ciphertext, 'base64url')),
          decipher.final(),
        ]).toString('utf8');
      } catch {
        throw new InternalServerError(
          'Stored environment variable could not be decrypted',
        );
      }
    },
  };
}

export type EnvironmentVariableCipher = ReturnType<
  typeof createEnvironmentVariableCipher
>;
