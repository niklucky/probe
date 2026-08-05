import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import {
  environmentCookies,
  environmentHeaders,
  environmentVariables,
  environments,
} from '@probe/db';
import { z } from 'zod';

const environmentInsertSchema = createInsertSchema(environments);

const baseUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2_048)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  }, 'Base URL must use HTTP or HTTPS')
  .refine((value) => {
    const url = new URL(value);
    return !url.username && !url.password;
  }, 'Base URL must not contain credentials');

export const environmentSchema = createSelectSchema(environments).pick({
  id: true,
  projectId: true,
  productId: true,
  name: true,
  type: true,
  baseUrl: true,
  isDefault: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
});

export const listEnvironmentsInputSchema = z.object({
  projectId: z.number().int().positive(),
  productId: z.number().int().positive().optional(),
});

export const createEnvironmentInputSchema = environmentInsertSchema
  .pick({
    projectId: true,
    productId: true,
    name: true,
    type: true,
    isDefault: true,
  })
  .extend({
    name: z.string().trim().min(1).max(255),
    baseUrl: baseUrlSchema,
    productId: z.number().int().positive().optional(),
    isDefault: z.boolean().default(false),
  });

export const updateEnvironmentInputSchema = createEnvironmentInputSchema
  .omit({ projectId: true })
  .partial()
  .extend({ id: z.number().int().positive() });

export const environmentIdInputSchema = z.object({
  id: z.number().int().positive(),
});

export const environmentVariableKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(
    /^[A-Za-z_][A-Za-z0-9_]*$/,
    'Variable key must start with a letter or underscore and contain only letters, numbers, and underscores',
  );

const environmentVariableValueSchema = z.string().max(50_000);

export const environmentVariableSchema = createSelectSchema(
  environmentVariables,
)
  .pick({
    id: true,
    environmentId: true,
    key: true,
    isSecret: true,
    description: true,
    createdById: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    value: z.string().nullable(),
    valueStatus: z.enum(['available', 'secret', 'unreadable']),
  });

export const listEnvironmentVariablesInputSchema = z.object({
  environmentId: z.number().int().positive(),
});

export const createEnvironmentVariableInputSchema = z.object({
  environmentId: z.number().int().positive(),
  key: environmentVariableKeySchema,
  value: environmentVariableValueSchema,
  isSecret: z.boolean().default(false),
  description: z.string().trim().max(500).optional(),
});

export const updateEnvironmentVariableInputSchema = z.object({
  id: z.number().int().positive(),
  key: environmentVariableKeySchema.optional(),
  value: environmentVariableValueSchema.optional(),
  isSecret: z.boolean().optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

export const environmentVariableIdInputSchema = z.object({
  id: z.number().int().positive(),
});

export const environmentCookieNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(
    /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/,
    'Cookie name contains invalid characters',
  );

export const environmentCookieValueTemplateSchema = z
  .string()
  .min(1)
  .max(4_096)
  .refine(
    (value) => extractEnvironmentVariableReferences(value).length > 0,
    'Cookie value must reference at least one environment variable',
  );

const cookieDomainSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .transform((value) => value.replace(/^\./, '').toLowerCase())
  .refine(
    (value) =>
      value === 'localhost' ||
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(
        value,
      ),
    'Cookie domain is invalid',
  );

const cookiePathSchema = z
  .string()
  .min(1)
  .max(2_048)
  .startsWith('/', 'Cookie path must start with /');

export const environmentCookieSchema = createSelectSchema(
  environmentCookies,
).pick({
  id: true,
  environmentId: true,
  name: true,
  valueTemplate: true,
  domain: true,
  path: true,
  httpOnly: true,
  secure: true,
  sameSite: true,
  expiresAt: true,
  enabled: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
});

export const listEnvironmentCookiesInputSchema = z.object({
  environmentId: z.number().int().positive(),
});

const cookieDefinitionFields = z.object({
  name: environmentCookieNameSchema,
  valueTemplate: environmentCookieValueTemplateSchema,
  domain: cookieDomainSchema.nullable().optional(),
  path: cookiePathSchema.default('/'),
  httpOnly: z.boolean().default(true),
  secure: z.boolean().default(true),
  sameSite: z.enum(['Strict', 'Lax', 'None']).default('Lax'),
  expiresAt: z.coerce.date().nullable().optional(),
  enabled: z.boolean().default(true),
});

export const createEnvironmentCookieInputSchema = cookieDefinitionFields
  .extend({ environmentId: z.number().int().positive() })
  .superRefine(validateCookieAttributeCombination);

export const updateEnvironmentCookieInputSchema = cookieDefinitionFields
  .partial()
  .extend({ id: z.number().int().positive() })
  .superRefine(validateCookieAttributeCombination);

export const environmentCookieIdInputSchema = z.object({
  id: z.number().int().positive(),
});

const reservedEnvironmentHeaderNames = new Set([
  'accept-charset',
  'accept-encoding',
  'access-control-request-headers',
  'access-control-request-method',
  'connection',
  'content-length',
  'cookie',
  'cookie2',
  'date',
  'dnt',
  'expect',
  'forwarded',
  'host',
  'keep-alive',
  'origin',
  'permissions-policy',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'referer',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'user-agent',
  'via',
]);

export function isReservedEnvironmentHeaderName(value: string) {
  const name = value.trim().toLowerCase();
  return (
    reservedEnvironmentHeaderNames.has(name) ||
    name.startsWith('proxy-') ||
    name.startsWith('sec-') ||
    name.startsWith('x-forwarded-') ||
    name.startsWith('x-probe-')
  );
}

export const environmentHeaderNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(
    /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/,
    'Header name contains invalid characters',
  )
  .refine(
    (value) => !isReservedEnvironmentHeaderName(value),
    'Header name is reserved or managed by the browser runner',
  );

export const environmentHeaderValueTemplateSchema = z
  .string()
  .min(1)
  .max(16_384)
  .refine((value) => !/[\r\n]/.test(value), 'Header value must be one line')
  .refine(
    (value) => extractEnvironmentVariableReferences(value).length > 0,
    'Header value must reference at least one environment variable',
  );

export const environmentHeaderOriginSchema = z
  .string()
  .trim()
  .url()
  .max(2_048)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  }, 'Header origin must use HTTP or HTTPS')
  .refine((value) => {
    const url = new URL(value);
    return !url.username && !url.password;
  }, 'Header origin must not contain credentials')
  .transform((value) => new URL(value).origin);

export const environmentHeaderSchema = createSelectSchema(
  environmentHeaders,
).pick({
  id: true,
  environmentId: true,
  name: true,
  valueTemplate: true,
  origin: true,
  enabled: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
});

export const listEnvironmentHeadersInputSchema = z.object({
  environmentId: z.number().int().positive(),
});

const headerDefinitionFields = z.object({
  name: environmentHeaderNameSchema,
  valueTemplate: environmentHeaderValueTemplateSchema,
  origin: environmentHeaderOriginSchema.optional(),
  enabled: z.boolean().default(true),
});

export const createEnvironmentHeaderInputSchema = headerDefinitionFields.extend(
  { environmentId: z.number().int().positive() },
);

export const updateEnvironmentHeaderInputSchema = headerDefinitionFields
  .partial()
  .extend({ id: z.number().int().positive() });

export const environmentHeaderIdInputSchema = z.object({
  id: z.number().int().positive(),
});

const placeholderPattern = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

function validateCookieAttributeCombination(
  value: { sameSite?: 'Strict' | 'Lax' | 'None'; secure?: boolean },
  context: z.RefinementCtx,
) {
  if (value.sameSite === 'None' && value.secure === false) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['secure'],
      message: 'SameSite=None cookies must be secure',
    });
  }
}

export function validateEnvironmentCookieDomain(
  domain: string | null | undefined,
  baseUrl: string,
) {
  if (!domain) return;
  const hostname = new URL(baseUrl).hostname.toLowerCase();
  const normalizedDomain = domain.replace(/^\./, '').toLowerCase();
  if (
    normalizedDomain !== hostname &&
    !hostname.endsWith(`.${normalizedDomain}`)
  ) {
    throw new Error(
      `Cookie domain must match or be a parent of the environment host ${hostname}`,
    );
  }
}

export function resolveEnvironmentTemplate(
  template: string,
  values: Record<string, string>,
) {
  const missing = extractEnvironmentVariableReferences(template).filter(
    (key) => !(key in values),
  );
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  return template.replace(
    placeholderPattern,
    (_match, key: string) => values[key]!,
  );
}

export function extractEnvironmentVariableReferences(value: string) {
  return [
    ...new Set(
      [...value.matchAll(placeholderPattern)].map((match) => match[1]!),
    ),
  ];
}

export function extractEnvironmentVariableReferencesFromValue(value: unknown) {
  const references: string[] = [];
  const seen = new Set<string>();
  const visit = (current: unknown) => {
    if (typeof current === 'string') {
      for (const key of extractEnvironmentVariableReferences(current)) {
        if (!seen.has(key)) {
          seen.add(key);
          references.push(key);
        }
      }
      return;
    }
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (current && typeof current === 'object') {
      Object.values(current).forEach(visit);
    }
  };
  visit(value);
  return references;
}

export type CreateEnvironmentInput = z.infer<
  typeof createEnvironmentInputSchema
>;
export type UpdateEnvironmentInput = z.infer<
  typeof updateEnvironmentInputSchema
>;
export type CreateEnvironmentVariableInput = z.infer<
  typeof createEnvironmentVariableInputSchema
>;
export type UpdateEnvironmentVariableInput = z.infer<
  typeof updateEnvironmentVariableInputSchema
>;
export type CreateEnvironmentCookieInput = z.infer<
  typeof createEnvironmentCookieInputSchema
>;
export type UpdateEnvironmentCookieInput = z.infer<
  typeof updateEnvironmentCookieInputSchema
>;
export type CreateEnvironmentHeaderInput = z.infer<
  typeof createEnvironmentHeaderInputSchema
>;
export type UpdateEnvironmentHeaderInput = z.infer<
  typeof updateEnvironmentHeaderInputSchema
>;
