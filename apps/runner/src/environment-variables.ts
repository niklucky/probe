import { createDecipheriv } from 'node:crypto';

export interface StoredEnvironmentVariable {
  key: string;
  encryptedValue: string;
  isSecret: boolean;
}

export class RuntimeEnvironmentError extends Error {
  constructor(
    readonly code:
      | 'MISSING_ENVIRONMENT_VARIABLES'
      | 'ENVIRONMENT_VARIABLE_DECRYPTION_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'RuntimeEnvironmentError';
  }
}

function masterKey(value: string) {
  const key = /^[a-f0-9]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new RuntimeEnvironmentError(
      'ENVIRONMENT_VARIABLE_DECRYPTION_FAILED',
      'Environment variable encryption key is invalid',
    );
  }
  return key;
}

export function decryptEnvironmentVariable(
  encryptedValue: string,
  environmentId: number,
  variableKey: string,
  masterKeyValue: string,
) {
  const [version, iv, tag, ciphertext, extra] = encryptedValue.split('.');
  if (
    version !== 'v1' ||
    !iv ||
    !tag ||
    ciphertext === undefined ||
    extra !== undefined
  ) {
    throw new RuntimeEnvironmentError(
      'ENVIRONMENT_VARIABLE_DECRYPTION_FAILED',
      `Environment variable "${variableKey}" is unreadable`,
    );
  }
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      masterKey(masterKeyValue),
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAAD(
      Buffer.from(
        `environment-variable:${environmentId}:${variableKey}`,
        'utf8',
      ),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch (error) {
    if (error instanceof RuntimeEnvironmentError) throw error;
    throw new RuntimeEnvironmentError(
      'ENVIRONMENT_VARIABLE_DECRYPTION_FAILED',
      `Environment variable "${variableKey}" could not be decrypted`,
    );
  }
}

export function resolveRuntimeEnvironment(
  references: string[],
  records: StoredEnvironmentVariable[],
  environmentId: number,
  masterKeyValue: string,
) {
  const byKey = new Map(records.map((record) => [record.key, record]));
  const missing = references.filter((key) => !byKey.has(key));
  if (missing.length) {
    throw new RuntimeEnvironmentError(
      'MISSING_ENVIRONMENT_VARIABLES',
      `Execution requires variables missing from the selected environment: ${missing.join(', ')}`,
    );
  }
  const values: Record<string, string> = {};
  const secretNames: string[] = [];
  for (const key of references) {
    const record = byKey.get(key)!;
    values[key] = decryptEnvironmentVariable(
      record.encryptedValue,
      environmentId,
      key,
      masterKeyValue,
    );
    if (record.isSecret) secretNames.push(key);
  }
  return { values, secretNames };
}
