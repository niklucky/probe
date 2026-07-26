import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { AiProviderError } from './errors';

export interface EndpointNetworkPolicy {
  approvedLocalHosts?: string[];
  dnsLookup?: typeof lookup;
}

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) {
    const [first, second] = address.split('.').map(Number);
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second! >= 16 && second! <= 31) ||
      (first === 192 && second === 168)
    );
  }
  const normalized = address.toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    if (isIP(mapped) === 4) return isPrivateAddress(mapped);
    const [highValue, lowValue, extra] = mapped.split(':');
    const high = Number.parseInt(highValue || '', 16);
    const low = Number.parseInt(lowValue || '', 16);
    if (
      extra === undefined &&
      Number.isInteger(high) &&
      Number.isInteger(low) &&
      high >= 0 &&
      high <= 0xffff &&
      low >= 0 &&
      low <= 0xffff
    ) {
      return isPrivateAddress(
        `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`,
      );
    }
  }
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  );
}

export async function assertEndpointAllowed(
  value: string,
  policy: EndpointNetworkPolicy = {},
) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AiProviderError(
      'INVALID_CONFIGURATION',
      'Custom endpoint must be a valid URL',
    );
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new AiProviderError(
      'INVALID_CONFIGURATION',
      'Custom endpoint must be an HTTP(S) origin without credentials, query, or fragment',
    );
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const approved = new Set(
    (policy.approvedLocalHosts || []).map((host) => host.toLowerCase()),
  );
  const explicitlyApproved = approved.has(hostname);
  if (
    [
      'metadata.google.internal',
      'metadata.aws.internal',
      '169.254.169.254',
    ].includes(hostname)
  ) {
    throw new AiProviderError(
      'INVALID_CONFIGURATION',
      'Custom endpoint is blocked by the network policy',
    );
  }

  let addresses: string[];
  if (isIP(hostname)) {
    addresses = [hostname];
  } else {
    try {
      const results = await (policy.dnsLookup || lookup)(hostname, {
        all: true,
        verbatim: true,
      });
      addresses = results.map(({ address }) => address);
    } catch {
      throw new AiProviderError(
        'CONNECTION_FAILED',
        'Custom endpoint hostname could not be resolved',
        true,
      );
    }
  }
  if (!addresses.length) {
    throw new AiProviderError(
      'CONNECTION_FAILED',
      'Custom endpoint hostname did not resolve to an address',
      true,
    );
  }
  if (addresses.some(isPrivateAddress) && !explicitlyApproved) {
    throw new AiProviderError(
      'INVALID_CONFIGURATION',
      'Private or local AI endpoints must be explicitly approved by the deployment',
    );
  }
  return url;
}
