import { describe, expect, test } from 'bun:test';
import { chooseHighestRole } from './repository';

describe('effective project role', () => {
  test('chooses the most permissive direct or team-derived role', () => {
    expect(chooseHighestRole(['viewer', 'qa'])).toBe('qa');
    expect(chooseHighestRole(['manual_tester', 'admin', 'qa'])).toBe('admin');
  });

  test('is deterministic regardless of membership order', () => {
    expect(chooseHighestRole(['viewer', 'manual_tester'])).toBe(
      chooseHighestRole(['manual_tester', 'viewer']),
    );
  });
});
