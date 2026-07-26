import { describe, expect, test } from 'bun:test';
import { createAuthorizationService } from './service';

const repository = {
  async resolveProjectId() {
    return 7;
  },
  async listRoles() {
    return {
      ownedProjectIds: [1],
      memberships: [{ projectId: 7, role: 'viewer' as const }],
    };
  },
  async getRole(userId: number) {
    const roles = {
      1: 'owner',
      2: 'admin',
      3: 'qa',
      4: 'manual_tester',
      5: 'viewer',
    } as const;
    return roles[userId as keyof typeof roles];
  },
};

const authorization = createAuthorizationService(repository);

describe('project authorization service', () => {
  test('deduplicates accessible projects', async () => {
    expect(await authorization.listProjectIds(5)).toEqual([1, 7]);
  });

  test('allows each project role its intended operations', async () => {
    await expect(
      authorization.requireProject(1, 7, 'own'),
    ).resolves.toBeTruthy();
    await expect(
      authorization.requireProject(2, 7, 'manage'),
    ).resolves.toBeTruthy();
    await expect(
      authorization.requireProject(3, 7, 'author'),
    ).resolves.toBeTruthy();
    await expect(
      authorization.requireProject(4, 7, 'execute'),
    ).resolves.toBeTruthy();
    await expect(
      authorization.requireProject(5, 7, 'read'),
    ).resolves.toBeTruthy();
  });

  test('denies unauthorized operations without leaking existence', async () => {
    await expect(
      authorization.requireProject(5, 7, 'author'),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Resource not found',
    });
    await expect(
      authorization.requireProject(99, 7, 'read'),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Resource not found',
    });
  });

  test('uses the same parent-chain check for nested resources', async () => {
    await expect(
      authorization.require(4, { type: 'caseVersion', id: 42 }, 'execute'),
    ).resolves.toMatchObject({ projectId: 7, role: 'manual_tester' });
  });
});
