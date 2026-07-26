import { describe, expect, test } from 'bun:test';
import { assertEndpointAllowed } from './network-policy';

const dnsLookup = (async (host: string) => [
  {
    address: host === 'private.example' ? '10.0.0.2' : '203.0.113.2',
    family: 4,
  },
]) as never;

describe('AI endpoint network policy', () => {
  test('allows public endpoints', async () => {
    expect(
      (await assertEndpointAllowed('https://models.example/v1', { dnsLookup }))
        .hostname,
    ).toBe('models.example');
  });

  test('blocks private DNS results unless the hostname is approved', async () => {
    await expect(
      assertEndpointAllowed('http://private.example:11434/v1', { dnsLookup }),
    ).rejects.toMatchObject({ code: 'INVALID_CONFIGURATION' });
    await expect(
      assertEndpointAllowed('http://private.example:11434/v1', {
        dnsLookup,
        approvedLocalHosts: ['private.example'],
      }),
    ).resolves.toBeTruthy();
  });

  test('always blocks cloud metadata targets', async () => {
    await expect(
      assertEndpointAllowed('http://169.254.169.254/latest', {
        approvedLocalHosts: ['169.254.169.254'],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CONFIGURATION' });
  });

  test('blocks IPv4-mapped private IPv6 addresses', async () => {
    await expect(
      assertEndpointAllowed('http://[::ffff:10.0.0.2]/v1'),
    ).rejects.toMatchObject({ code: 'INVALID_CONFIGURATION' });
  });
});
