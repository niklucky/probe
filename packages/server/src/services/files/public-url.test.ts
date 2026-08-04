import { describe, expect, test } from 'bun:test';
import { publicizeStorageUrl } from './public-url';

describe('public storage URL', () => {
  test('replaces only the origin of a signed MinIO URL', () => {
    const result = publicizeStorageUrl(
      'http://minio:9000/probe-assets/file.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc',
      'https://signal.hgdev.me',
    );

    expect(result).toBe(
      'https://signal.hgdev.me/probe-assets/file.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc',
    );
  });
});
