import { AppError } from '@probe/shared/errors/app-error';

const blockedHostnames = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.aws.internal',
  '169.254.169.254',
]);

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }
  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second! >= 16 && second! <= 31) ||
    (first === 192 && second === 168)
  );
}

export function assertEnvironmentNetworkTargetAllowed(value: string) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    blockedHostnames.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    isPrivateIpv4(hostname) ||
    hostname === '::1' ||
    (hostname.includes(':') &&
      (hostname.startsWith('fc') ||
        hostname.startsWith('fd') ||
        hostname.startsWith('fe80:')))
  ) {
    throw new AppError(
      'BAD_REQUEST',
      'Environment URL is not a safe network target',
    );
  }
  return url;
}
