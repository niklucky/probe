import { describe, expect, test } from 'bun:test';
import { AppError } from '@probe/shared/errors/app-error';
import { createEnvironmentVariableCipher } from './encryption';
import { createEnvironmentService } from './service';

function fixture(
  options: {
    denyAuthorization?: boolean;
    uniqueViolationOn?: 'create' | 'update';
  } = {},
) {
  let nextId = 1;
  const records: Array<Record<string, any>> = [];
  const cookies: Array<Record<string, any>> = [];
  const environment = {
    id: 7,
    projectId: 2,
    productId: null,
    baseUrl: 'https://staging.example.test',
    isDefault: false,
  };
  const methods: any = {
    async find(id: number) {
      return id === environment.id ? environment : undefined;
    },
    async update(id: number, values: Record<string, any>) {
      if (id !== environment.id) return undefined;
      Object.assign(environment, values);
      return environment;
    },
    async clearDefault() {},
    withTransaction<T>(operation: (repository: any) => Promise<T>) {
      return operation(methods);
    },
    async listVariables(environmentId: number) {
      return records.filter((record) => record.environmentId === environmentId);
    },
    async listCookies(environmentId: number) {
      return cookies.filter((cookie) => cookie.environmentId === environmentId);
    },
    async findCookie(id: number) {
      return cookies.find((cookie) => cookie.id === id);
    },
    async createCookie(values: Record<string, any>) {
      const now = new Date();
      const cookie = {
        id: nextId++,
        createdAt: now,
        updatedAt: now,
        ...values,
      };
      cookies.push(cookie);
      return cookie;
    },
    async updateCookie(id: number, values: Record<string, any>) {
      const cookie = cookies.find((candidate) => candidate.id === id);
      if (!cookie) return undefined;
      Object.assign(cookie, values, { updatedAt: new Date() });
      return cookie;
    },
    async deleteCookie(id: number) {
      const index = cookies.findIndex((cookie) => cookie.id === id);
      if (index === -1) return undefined;
      return cookies.splice(index, 1)[0];
    },
    async findVariable(id: number) {
      return records.find((record) => record.id === id);
    },
    async findVariableByKey(environmentId: number, key: string) {
      return records.find(
        (record) =>
          record.environmentId === environmentId && record.key === key,
      );
    },
    async createVariable(values: Record<string, any>) {
      if (options.uniqueViolationOn === 'create') {
        throw { code: '23505' };
      }
      const now = new Date();
      const record = {
        id: nextId++,
        createdAt: now,
        updatedAt: now,
        ...values,
      };
      records.push(record);
      return record;
    },
    async updateVariable(id: number, values: Record<string, any>) {
      if (options.uniqueViolationOn === 'update') {
        throw { cause: { code: '23505' } };
      }
      const record = records.find((candidate) => candidate.id === id);
      if (!record) return undefined;
      Object.assign(record, values, { updatedAt: new Date() });
      return record;
    },
    async deleteVariable(id: number) {
      const index = records.findIndex((record) => record.id === id);
      if (index === -1) return undefined;
      return records.splice(index, 1)[0];
    },
  };
  const authorization = {
    async require() {
      if (options.denyAuthorization) {
        throw new AppError('NOT_FOUND', 'Resource not found');
      }
      return { projectId: environment.projectId, role: 'qa' as const };
    },
  };
  const service = createEnvironmentService(
    methods as never,
    authorization as never,
    createEnvironmentVariableCipher(Buffer.alloc(32, 12).toString('base64')),
  );
  return { service, records, cookies };
}

describe('environment variable service', () => {
  test('encrypts all values and never returns secret plaintext', async () => {
    const { service, records } = fixture();
    const created = await service.createVariable(
      {
        environmentId: 7,
        key: 'password',
        value: 'super-secret',
        isSecret: true,
      },
      3,
    );

    expect(records[0]?.encryptedValue).not.toContain('super-secret');
    expect(created).toMatchObject({ value: null, valueStatus: 'secret' });
    expect(JSON.stringify(created)).not.toContain('super-secret');
    expect((await service.listVariables(7, 3))[0]).toMatchObject({
      value: null,
      valueStatus: 'secret',
    });
  });

  test('decrypts non-secret values and rebinds ciphertext after rename', async () => {
    const { service } = fixture();
    const created = await service.createVariable(
      {
        environmentId: 7,
        key: 'tenant',
        value: 'north',
        isSecret: false,
      },
      3,
    );
    expect(created.value).toBe('north');
    expect(created.valueStatus).toBe('available');

    const renamed = await service.updateVariable(
      { id: created.id, key: 'tenant_id' },
      3,
    );
    expect(renamed).toMatchObject({ key: 'tenant_id', value: 'north' });
  });

  test('rejects duplicate keys within one environment', async () => {
    const { service } = fixture();
    await service.createVariable(
      { environmentId: 7, key: 'username', value: 'qa', isSecret: false },
      3,
    );
    await expect(
      service.createVariable(
        {
          environmentId: 7,
          key: 'username',
          value: 'other',
          isSecret: false,
        },
        3,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  test('does not reveal an existing secret by reclassifying it', async () => {
    const { service } = fixture();
    const created = await service.createVariable(
      {
        environmentId: 7,
        key: 'password',
        value: 'secret',
        isSecret: true,
      },
      3,
    );

    await expect(
      service.updateVariable({ id: created.id, isSecret: false }, 3),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      service.updateVariable(
        { id: created.id, isSecret: false, value: 'public replacement' },
        3,
      ),
    ).resolves.toMatchObject({ value: 'public replacement', isSecret: false });
  });

  test('uses the same not-found response for missing and unauthorized IDs', async () => {
    const missing = fixture();
    const denied = fixture({ denyAuthorization: true });
    denied.records.push({ id: 5, environmentId: 7 });

    await expect(
      missing.service.updateVariable({ id: 404, description: 'x' }, 3),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Resource not found',
    });
    await expect(
      denied.service.updateVariable({ id: 5, description: 'x' }, 3),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Resource not found',
    });
    await expect(missing.service.deleteVariable(404, 3)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Resource not found',
    });
    await expect(denied.service.deleteVariable(5, 3)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Resource not found',
    });
  });

  test('maps create and rename unique-constraint races to conflict', async () => {
    const createRace = fixture({ uniqueViolationOn: 'create' });
    await expect(
      createRace.service.createVariable(
        { environmentId: 7, key: 'username', value: 'qa', isSecret: false },
        3,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    const updateRace = fixture({ uniqueViolationOn: 'update' });
    const created = await updateRace.service.createVariable(
      { environmentId: 7, key: 'username', value: 'qa', isSecret: false },
      3,
    );
    await expect(
      updateRace.service.updateVariable({ id: created.id, key: 'renamed' }, 3),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  test('keeps list usable when one non-secret value is unreadable', async () => {
    const { service, records } = fixture();
    const readable = await service.createVariable(
      { environmentId: 7, key: 'tenant', value: 'north', isSecret: false },
      3,
    );
    const secret = await service.createVariable(
      { environmentId: 7, key: 'password', value: 'hidden', isSecret: true },
      3,
    );
    records.find(({ id }) => id === readable.id)!.encryptedValue = 'corrupted';
    records.find(({ id }) => id === secret.id)!.encryptedValue = 'corrupted';

    expect(await service.listVariables(7, 3)).toEqual([
      expect.objectContaining({
        id: readable.id,
        value: null,
        valueStatus: 'unreadable',
      }),
      expect.objectContaining({
        id: secret.id,
        value: null,
        valueStatus: 'secret',
      }),
    ]);
  });

  test('updates secret metadata without requiring or exposing its value', async () => {
    const { service } = fixture();
    const created = await service.createVariable(
      { environmentId: 7, key: 'password', value: 'hidden', isSecret: true },
      3,
    );

    await expect(
      service.updateVariable({ id: created.id, description: 'QA password' }, 3),
    ).resolves.toMatchObject({
      description: 'QA password',
      value: null,
      valueStatus: 'secret',
    });
  });
});

describe('environment cookie service', () => {
  test('stores and returns templates without materializing resolved values', async () => {
    const { service, cookies } = fixture();
    const created = await service.createCookie(
      {
        environmentId: 7,
        name: 'session_id',
        valueTemplate: '{{session_id}}',
        domain: null,
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        expiresAt: null,
        enabled: true,
      },
      3,
    );

    expect(created.valueTemplate).toBe('{{session_id}}');
    expect(JSON.stringify(created)).not.toContain('resolved-session');
    expect(cookies[0]).not.toHaveProperty('value');
    expect(await service.listCookies(7, 3)).toEqual([created]);
  });

  test('rejects cookie domains outside the environment host policy', async () => {
    const { service } = fixture();
    await expect(
      service.createCookie(
        {
          environmentId: 7,
          name: 'session_id',
          valueTemplate: '{{session_id}}',
          domain: 'unrelated.example.test',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
          expiresAt: null,
          enabled: true,
        },
        3,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('revalidates cookie domains when the environment base URL changes', async () => {
    const { service } = fixture();
    await service.createCookie(
      {
        environmentId: 7,
        name: 'session_id',
        valueTemplate: '{{session_id}}',
        domain: 'example.test',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        expiresAt: null,
        enabled: true,
      },
      3,
    );

    await expect(
      service.update({ id: 7, baseUrl: 'https://other.test' }, 3),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('validates merged attributes during partial cookie updates', async () => {
    const { service } = fixture();
    const cookie = await service.createCookie(
      {
        environmentId: 7,
        name: 'session_id',
        valueTemplate: '{{session_id}}',
        domain: null,
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        expiresAt: null,
        enabled: true,
      },
      3,
    );

    await expect(
      service.updateCookie({ id: cookie!.id, secure: false }, 3),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
