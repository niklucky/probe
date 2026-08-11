import { describe, expect, test } from 'bun:test';
import { AppError } from '@probe/shared/errors/app-error';
import { createProjectMemberService } from './service';

function setup(
  options: {
    ownerId?: number;
    memberExists?: boolean;
    canManage?: boolean;
  } = {},
) {
  let updated: unknown;
  let removed = false;
  const repository = {
    async list() {
      return [];
    },
    async findProject() {
      return { createdById: options.ownerId ?? 1 };
    },
    async updateRole(projectId: number, userId: number, role: string) {
      if (options.memberExists === false) return undefined;
      updated = { projectId, userId, role };
      return updated as any;
    },
    async remove() {
      if (options.memberExists === false) return undefined;
      removed = true;
      return { id: 2 } as any;
    },
  };
  const authorization = {
    async requireProject() {
      if (options.canManage === false) {
        throw new AppError('NOT_FOUND', 'Resource not found');
      }
      return { projectId: 7, role: 'admin' as const };
    },
  };
  return {
    service: createProjectMemberService(
      repository as any,
      authorization as any,
    ),
    get updated() {
      return updated;
    },
    get removed() {
      return removed;
    },
  };
}

describe('project member service', () => {
  test('updates and removes direct memberships', async () => {
    const context = setup();
    await context.service.updateRole(7, 2, 'qa', 1);
    expect(context.updated).toEqual({ projectId: 7, userId: 2, role: 'qa' });
    await context.service.remove(7, 2, 1);
    expect(context.removed).toBe(true);
  });

  test('prevents changing or removing the project owner', async () => {
    const context = setup({ ownerId: 2 });
    await expect(
      context.service.updateRole(7, 2, 'viewer', 1),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(context.service.remove(7, 2, 1)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(context.removed).toBe(false);
  });

  test('reports missing memberships', async () => {
    const context = setup({ memberExists: false });
    await expect(context.service.remove(7, 2, 1)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  test('does not expose the member roster to viewers', async () => {
    const context = setup({ canManage: false });
    await expect(context.service.list(7, 5)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
