import { describe, expect, test } from 'bun:test';
import { AppError } from '@probe/shared/errors/app-error';
import type { InvitationRepository } from '../../repositories/invitations/repository';
import type { AuthorizationService } from '../authorization/service';
import type { InvitationMailer } from './mailer';
import { createInvitationService } from './service';

const actor = { id: 3, name: 'Project Owner' };
const user = { id: 9, email: 'new@example.com' };

function setup(
  overrides: Partial<Record<keyof InvitationRepository, any>> = {},
  options: {
    authorization?: Partial<AuthorizationService>;
    mailer?: Partial<InvitationMailer>;
  } = {},
) {
  let stored: Record<string, any> | undefined;
  let sent: Record<string, any> | undefined;
  let memberAdded: Record<string, any> | undefined;
  let acceptedId: number | undefined;
  let declinedId: number | undefined;
  let cancelledId: number | undefined;

  const repository = {
    async findTeam() {
      return {
        id: 4,
        name: 'QA',
        project: { id: 2, name: 'Website' },
      };
    },
    async findProject() {
      return { id: 2, name: 'Website', createdById: actor.id };
    },
    async findUserByEmail() {
      return undefined;
    },
    async findTeamMember() {
      return undefined;
    },
    async findProjectMember() {
      return undefined;
    },
    async createOrRefresh(values: any) {
      stored = values;
      return {
        id: 12,
        ...values,
        createdAt: new Date(),
        updatedAt: new Date(1_800_000_000_000),
        acceptedAt: null,
        declinedAt: null,
        cancelledAt: null,
        expiredAt: null,
      };
    },
    async findByTokenHash() {
      return undefined;
    },
    async listPending() {
      return [];
    },
    async listForProject() {
      return [];
    },
    async findById() {
      return undefined;
    },
    async findByIdForEmail() {
      return undefined;
    },
    async accept(id: number, values: any) {
      memberAdded = values;
      acceptedId = id;
      return true;
    },
    async registerUserAndAccept() {
      return { status: 'invalid' as const };
    },
    async markDeclined(id: number) {
      declinedId = id;
      return { id };
    },
    async markCancelled(id: number) {
      cancelledId = id;
      return { id };
    },
    ...overrides,
  } as Partial<InvitationRepository>;

  const authorization: Partial<AuthorizationService> = {
    async require() {
      return { projectId: 2, role: 'owner' as const };
    },
    async requireProject() {
      return { projectId: 2, role: 'owner' as const };
    },
    ...options.authorization,
  };
  const mailer: InvitationMailer = {
    async sendInvitation(email) {
      sent = email;
    },
    ...options.mailer,
  };
  const service = createInvitationService(
    repository as InvitationRepository,
    authorization as AuthorizationService,
    mailer,
    'https://probe.example',
  );
  return {
    service,
    get stored() {
      return stored;
    },
    get sent() {
      return sent;
    },
    get memberAdded() {
      return memberAdded;
    },
    get acceptedId() {
      return acceptedId;
    },
    get declinedId() {
      return declinedId;
    },
    get cancelledId() {
      return cancelledId;
    },
  };
}

describe('invitation service', () => {
  test('normalizes email, stores only a token hash, and sends a registration link', async () => {
    const context = setup();
    await context.service.invite(
      { teamId: 4, email: ' NEW@Example.com ', role: 'qa' },
      actor,
    );

    expect(context.stored?.email).toBe('new@example.com');
    expect(context.stored?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(context.sent?.to).toBe('new@example.com');
    const link = new URL(context.sent?.registrationUrl);
    const token = link.searchParams.get('invitation');
    expect(token?.length).toBeGreaterThanOrEqual(32);
    expect(context.stored?.tokenHash).not.toBe(token);
  });

  test('rejects an invitation for an existing team member', async () => {
    const context = setup({
      async findUserByEmail() {
        return { id: 9 } as any;
      },
      async findTeamMember() {
        return { id: 1 } as any;
      },
    });
    await expect(
      context.service.invite(
        { teamId: 4, email: user.email, role: 'viewer' },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  test('creates a direct project invitation without requiring a team', async () => {
    const context = setup();
    await context.service.inviteProject(
      { projectId: 2, email: ' NEW@Example.com ', role: 'manual_tester' },
      actor,
    );

    expect(context.stored).toMatchObject({
      projectId: 2,
      email: 'new@example.com',
      role: 'manual_tester',
    });
    expect(context.stored?.teamId).toBeUndefined();
    expect(context.sent?.projectName).toBe('Website');
    expect(context.sent?.teamName).toBeUndefined();
  });

  test('rejects a duplicate direct project membership', async () => {
    const context = setup({
      async findUserByEmail() {
        return { id: user.id };
      },
      async findProjectMember() {
        return { id: 4 };
      },
    });
    await expect(
      context.service.inviteProject(
        { projectId: 2, email: user.email, role: 'viewer' },
        actor,
      ),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'User is already a direct member of this project',
    });
    expect(context.stored).toBeUndefined();
  });

  test('rejects a direct invitation for the project owner', async () => {
    const context = setup({
      async findProject() {
        return { id: 2, name: 'Website', createdById: user.id };
      },
      async findUserByEmail() {
        return { id: user.id };
      },
    });

    await expect(
      context.service.inviteProject(
        { projectId: 2, email: user.email, role: 'viewer' },
        actor,
      ),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'The project owner already has access',
    });
    expect(context.stored).toBeUndefined();
  });

  test('accepts a pending invitation and passes membership details to the repository', async () => {
    const invitation = {
      id: 12,
      teamId: 4,
      email: user.email,
      role: 'qa' as const,
      tokenHash: 'hash',
      invitedById: 3,
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      declinedAt: null,
      cancelledAt: null,
      expiredAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const context = setup({
      async findByIdForEmail() {
        return invitation;
      },
    });

    await context.service.acceptById(invitation.id, user);
    expect(context.memberAdded).toMatchObject({
      userId: 9,
      role: 'qa',
    });
    expect(context.acceptedId).toBe(12);
  });

  test('declines a pending invitation without adding membership', async () => {
    const context = setup({
      async findByIdForEmail() {
        return {
          id: 12,
          teamId: 4,
          email: user.email,
          role: 'viewer',
          expiresAt: new Date(Date.now() + 60_000),
          acceptedAt: null,
          declinedAt: null,
          cancelledAt: null,
          expiredAt: null,
        } as any;
      },
    });
    await context.service.decline(12, user);
    expect(context.declinedId).toBe(12);
    expect(context.memberAdded).toBeUndefined();
  });

  test('rejects expired tokens and registration email mismatches', async () => {
    const expired = setup({
      async findByTokenHash() {
        return {
          id: 12,
          teamId: 4,
          email: user.email,
          role: 'viewer',
          expiresAt: new Date(Date.now() - 1),
          acceptedAt: null,
          declinedAt: null,
          cancelledAt: null,
          expiredAt: null,
        } as any;
      },
    });
    await expect(expired.service.preview('x'.repeat(32))).rejects.toMatchObject(
      {
        code: 'NOT_FOUND',
      },
    );

    const mismatch = setup({
      async findByTokenHash() {
        return {
          id: 12,
          teamId: 4,
          email: user.email,
          role: 'viewer',
          expiresAt: new Date(Date.now() + 60_000),
          acceptedAt: null,
          declinedAt: null,
          cancelledAt: null,
          expiredAt: null,
        } as any;
      },
    });
    await expect(
      mismatch.service.validateRegistrationInvitation(
        'other@example.com',
        'x'.repeat(32),
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('lists manager-visible statuses and cancels pending invitations', async () => {
    const invitation = {
      id: 12,
      teamId: 4,
      email: user.email,
      role: 'viewer' as const,
      tokenHash: 'hash',
      invitedById: actor.id,
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      declinedAt: null,
      cancelledAt: null,
      expiredAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const context = setup({
      async listForProject() {
        return [
          {
            ...invitation,
            teamName: 'QA',
            recipientName: null,
          },
          {
            ...invitation,
            id: 13,
            expiresAt: new Date(Date.now() - 1),
            teamName: 'QA',
            recipientName: 'Expired User',
          },
        ];
      },
      async findById() {
        return invitation;
      },
    });

    const listed = await context.service.listForProject(2, actor.id);
    expect(listed.map(({ status }) => status)).toEqual(['pending', 'expired']);
    await context.service.cancel(invitation.id, actor.id);
    expect(context.cancelledId).toBe(invitation.id);
  });

  test('treats a repeated acceptance as success', async () => {
    const context = setup({
      async findByIdForEmail() {
        return {
          id: 12,
          teamId: 4,
          email: user.email,
          role: 'viewer',
          expiresAt: new Date(Date.now() + 60_000),
          acceptedAt: new Date(),
          declinedAt: null,
          cancelledAt: null,
          expiredAt: null,
        } as any;
      },
    });

    await expect(context.service.acceptById(12, user)).resolves.toEqual({
      success: true,
    });
    expect(context.memberAdded).toBeUndefined();
  });

  test('does not create an invitation when authorization is denied', async () => {
    const context = setup(
      {},
      {
        authorization: {
          async require() {
            throw new AppError('UNAUTHORIZED', 'Forbidden');
          },
        },
      },
    );

    await expect(
      context.service.invite(
        { teamId: 4, email: user.email, role: 'viewer' },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(context.stored).toBeUndefined();
  });

  test('preserves the invitation record when email delivery fails', async () => {
    const context = setup(
      {},
      {
        mailer: {
          async sendInvitation() {
            throw new AppError('INTERNAL_SERVER_ERROR', 'Delivery failed');
          },
        },
      },
    );

    await expect(
      context.service.invite(
        { teamId: 4, email: user.email, role: 'viewer' },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(context.stored).toBeDefined();
  });

  test('checks authorization before cancelling an invitation', async () => {
    const context = setup(
      {
        async findById() {
          return { id: 12, teamId: 4 } as any;
        },
      },
      {
        authorization: {
          async require() {
            throw new AppError('UNAUTHORIZED', 'Forbidden');
          },
        },
      },
    );

    await expect(context.service.cancel(12, actor.id)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(context.cancelledId).toBeUndefined();
  });
});
