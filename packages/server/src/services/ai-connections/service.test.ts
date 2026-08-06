import { describe, expect, test } from 'bun:test';
import { createCredentialCipher } from './encryption';
import { createAiConnectionService } from './service';

const admin = {
  id: 1,
  role: 'admin' as const,
};
const viewer = {
  id: 2,
  role: 'viewer' as const,
};

function fixture() {
  let nextId = 1;
  const records: Array<Record<string, any>> = [];
  const audits: Array<Record<string, any>> = [];
  const methods = {
    async list() {
      return records.map(
        ({ encryptedConfig: _encryptedConfig, ...record }) => ({
          ...record,
        }),
      );
    },
    async find(id: number) {
      return records.find((record) => record.id === id);
    },
    async create(values: Record<string, any>) {
      const now = new Date();
      const record: Record<string, any> = {
        id: nextId++,
        createdAt: now,
        updatedAt: now,
        ...values,
      };
      records.push(record);
      const { encryptedConfig: _encryptedConfig, ...safe } = record;
      return safe;
    },
    async update(id: number, values: Record<string, any>) {
      const record = records.find((candidate) => candidate.id === id);
      if (!record) return undefined;
      Object.assign(record, values, { updatedAt: new Date() });
      const { encryptedConfig: _encryptedConfig, ...safe } = record;
      return safe;
    },
    async delete(id: number) {
      const index = records.findIndex((record) => record.id === id);
      if (index === -1) return undefined;
      records.splice(index, 1);
      return { id };
    },
    async clearDefault(scope: string) {
      for (const record of records) {
        if (record.scope === scope) record.isDefault = false;
      }
    },
    async getDefault(scope: string) {
      return records.find(
        (record) =>
          record.scope === scope && record.isDefault && record.enabled,
      );
    },
    async audit(
      connectionId: number | null,
      actorUserId: number,
      action: string,
      changes: Record<string, unknown>,
    ) {
      audits.push({ connectionId, actorUserId, action, changes });
    },
  };
  const repository = {
    ...methods,
    withTransaction<T>(operation: (transaction: typeof methods) => Promise<T>) {
      return operation(methods);
    },
  };
  const service = createAiConnectionService(
    repository as never,
    createCredentialCipher(Buffer.alloc(32, 3).toString('base64')),
    {
      environmentConnections: () => [],
      approvedLocalHosts: ['local-ai.example'],
      endpointValidator: async (endpoint) => new URL(endpoint),
      adapterFactory: (config) => ({
        async generateStructured() {
          throw new Error('not used');
        },
        async runToolLoop() {
          throw new Error('not used');
        },
        async testConnection() {
          return {
            ok: true,
            model: config.model,
            modelAvailable: true,
            latencyMs: 4,
            capabilities: ['structured-generation'],
          };
        },
      }),
    },
  );
  return { service, records, audits };
}

const input = {
  name: 'Local model',
  provider: 'openai-compatible' as const,
  endpoint: 'http://local-ai.example:11434/v1',
  model: 'qwen',
  capabilities: ['structured-generation'],
  scope: 'general' as const,
  enabled: true,
  isDefault: true,
};

describe('AI connection service', () => {
  test('allows admins to configure approved keyless local providers', async () => {
    const { service } = fixture();
    const connection = await service.create(input, admin);

    expect(connection).toMatchObject({
      source: 'database',
      provider: 'openai-compatible',
      hasCredentials: false,
    });
    await expect(service.test(connection.id, admin)).resolves.toMatchObject({
      modelAvailable: true,
      model: 'qwen',
    });
  });

  test('rejects non-administrator management without leaking existence', async () => {
    const { service } = fixture();
    await expect(service.create(input, viewer)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Resource not found',
    });
  });

  test('encrypts credentials and redacts responses and audit records', async () => {
    const { service, records, audits } = fixture();
    const connection = await service.create(
      {
        ...input,
        secrets: {
          apiKey: 'top-secret',
          headers: { 'x-tenant-token': 'also-secret' },
        },
      },
      admin,
    );

    expect(records[0]?.encryptedConfig).not.toContain('top-secret');
    expect(JSON.stringify(connection)).not.toContain('secret');
    expect(JSON.stringify(audits)).not.toContain('secret');
    expect(connection.hasCredentials).toBe(true);
  });

  test('keeps a single default per scope', async () => {
    const { service, records } = fixture();
    await service.create(input, admin);
    await service.create({ ...input, name: 'Second' }, admin);
    expect(records.filter(({ isDefault }) => isDefault)).toHaveLength(1);
    expect(records.find(({ isDefault }) => isDefault)?.name).toBe('Second');
  });
});
