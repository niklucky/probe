import { createDecipheriv } from 'node:crypto';
import {
  environmentCookieNameSchema,
  environmentHeaderNameSchema,
  environmentHeaderOriginSchema,
  extractEnvironmentVariableReferences,
  resolveEnvironmentTemplate,
  validateEnvironmentCookieDomain,
} from '@probe/shared/schemas/environments';

export interface StoredEnvironmentVariable {
  key: string;
  encryptedValue: string;
  isSecret: boolean;
}

export class RuntimeEnvironmentError extends Error {
  constructor(
    readonly code:
      | 'MISSING_ENVIRONMENT_VARIABLES'
      | 'ENVIRONMENT_VARIABLE_DECRYPTION_FAILED'
      | 'INVALID_ENVIRONMENT_COOKIES'
      | 'INVALID_ENVIRONMENT_HEADERS',
    message: string,
  ) {
    super(message);
    this.name = 'RuntimeEnvironmentError';
  }
}

export interface StoredEnvironmentCookie {
  name: string;
  valueTemplate: string;
  domain: string | null;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
  expiresAt: Date | null;
}

export interface RuntimeCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
  expires?: number;
}

export interface StoredEnvironmentHeader {
  name: string;
  valueTemplate: string;
  origin: string;
}

export interface RuntimeHeader {
  name: string;
  value: string;
  origin: string;
}

export function headersForRequestOrigin(
  headers: RuntimeHeader[],
  requestUrl: string,
) {
  const origin = new URL(requestUrl).origin;
  return headers.filter((header) => header.origin === origin);
}

export function cookieVariableReferences(cookies: StoredEnvironmentCookie[]) {
  return [
    ...new Set(
      cookies.flatMap(({ valueTemplate }) =>
        extractEnvironmentVariableReferences(valueTemplate),
      ),
    ),
  ].sort();
}

export function headerVariableReferences(headers: StoredEnvironmentHeader[]) {
  return [
    ...new Set(
      headers.flatMap(({ valueTemplate }) =>
        extractEnvironmentVariableReferences(valueTemplate),
      ),
    ),
  ].sort();
}

export function runtimeSensitiveVariableNames(
  secretNames: string[],
  cookieReferences: string[],
  headerReferences: string[] = [],
) {
  return [
    ...new Set([...secretNames, ...cookieReferences, ...headerReferences]),
  ];
}

export function resolveRuntimeHeaders(
  headers: StoredEnvironmentHeader[],
  values: Record<string, string>,
): RuntimeHeader[] {
  try {
    return headers.map((header) => {
      const name = environmentHeaderNameSchema.parse(header.name);
      const origin = environmentHeaderOriginSchema.parse(header.origin);
      if (origin !== header.origin) {
        throw new Error(`Header "${name}" has a non-canonical origin`);
      }
      const value = resolveEnvironmentTemplate(header.valueTemplate, values);
      if (/[\r\n]/.test(value)) {
        throw new Error(`Header "${name}" contains a line break`);
      }
      if (Buffer.byteLength(value, 'utf8') > 16_384) {
        throw new Error(`Header "${name}" exceeds the 16384-byte limit`);
      }
      return { name, value, origin };
    });
  } catch (error) {
    throw new RuntimeEnvironmentError(
      'INVALID_ENVIRONMENT_HEADERS',
      error instanceof Error ? error.message : 'Environment headers are invalid',
    );
  }
}

export function resolveRuntimeCookies(
  cookies: StoredEnvironmentCookie[],
  baseUrl: string,
  values: Record<string, string>,
  now = new Date(),
): RuntimeCookie[] {
  try {
    const target = new URL(baseUrl);
    return cookies.map((cookie) => {
      environmentCookieNameSchema.parse(cookie.name);
      validateEnvironmentCookieDomain(cookie.domain, baseUrl);
      if (!cookie.path.startsWith('/')) {
        throw new Error(`Cookie "${cookie.name}" has an invalid path`);
      }
      if (cookie.path.length > 2_048) {
        throw new Error(`Cookie "${cookie.name}" has an invalid path`);
      }
      if (!['Strict', 'Lax', 'None'].includes(cookie.sameSite)) {
        throw new Error(
          `Cookie "${cookie.name}" has an invalid SameSite value`,
        );
      }
      if (cookie.sameSite === 'None' && !cookie.secure) {
        throw new Error(
          `Cookie "${cookie.name}" uses SameSite=None without Secure`,
        );
      }
      const expires = cookie.expiresAt
        ? Math.floor(cookie.expiresAt.getTime() / 1000)
        : undefined;
      if (
        expires !== undefined &&
        cookie.expiresAt!.getTime() <= now.getTime()
      ) {
        throw new Error(`Cookie "${cookie.name}" has expired`);
      }
      const value = resolveEnvironmentTemplate(cookie.valueTemplate, values);
      if (!/^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*$/.test(value)) {
        throw new Error(
          `Cookie "${cookie.name}" contains characters that browsers do not allow`,
        );
      }
      if (Buffer.byteLength(`${cookie.name}=${value}`, 'utf8') > 4_096) {
        throw new Error(`Cookie "${cookie.name}" exceeds the 4096-byte limit`);
      }
      return {
        name: cookie.name,
        value,
        domain: cookie.domain ?? target.hostname,
        path: cookie.path,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
        ...(expires === undefined ? {} : { expires }),
      };
    });
  } catch (error) {
    throw new RuntimeEnvironmentError(
      'INVALID_ENVIRONMENT_COOKIES',
      error instanceof Error
        ? error.message
        : 'Environment cookies are invalid',
    );
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
