import { describe, expect, test } from 'bun:test';
import { createEnvironmentVariableCipher } from './encryption';
import { createEnvironmentService } from './service';

function fixture() {
  let nextId = 1;
  const records: Array<Record<string, any>> = [];
  const environment = { id: 7, projectId: 2 };
  const methods = {
    async find(id: number) {
      return id === environment.id ? environment : undefined;
    },
    async listVariables(environmentId: number) {
      return records.filter((record) => record.environmentId === environmentId);
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
      return { projectId: environment.projectId, role: 'qa' as const };
    },
  };
  const service = createEnvironmentService(
    methods as never,
    authorization as never,
    createEnvironmentVariableCipher(Buffer.alloc(32, 12).toString('base64')),
  );
  return { service, records };
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
    expect(created.value).toBeNull();
    expect(JSON.stringify(created)).not.toContain('super-secret');
    expect((await service.listVariables(7, 3))[0]?.value).toBeNull();
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
});
