import { createHash, randomBytes } from 'node:crypto';
import { AppError } from '@probe/shared/errors/app-error';
import type { InvitationRepository } from '../../repositories/invitations/repository';
import type { AuthorizationService } from '../authorization/service';
import type { InvitationMailer } from './mailer';

const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createInvitationService(
  repository: InvitationRepository,
  authorization: AuthorizationService,
  mailer: InvitationMailer,
  frontendUrl: string,
) {
  function requireUsableInvitation<
    T extends {
      acceptedAt: Date | null;
      declinedAt: Date | null;
      cancelledAt: Date | null;
      expiredAt: Date | null;
      expiresAt: Date;
    },
  >(invitation: T | undefined): T {
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.declinedAt ||
      invitation.cancelledAt ||
      invitation.expiredAt ||
      invitation.expiresAt <= new Date()
    ) {
      throw new AppError('NOT_FOUND', 'Invitation is invalid or has expired');
    }
    return invitation;
  }

  async function acceptInvitation(
    invitation: {
      id: number;
      teamId: number | null;
      projectId: number | null;
      email: string;
      role: 'admin' | 'qa' | 'manual_tester' | 'viewer';
    },
    user: { id: number; email: string },
  ) {
    if (normalizeEmail(invitation.email) !== normalizeEmail(user.email)) {
      throw new AppError(
        'UNAUTHORIZED',
        'This invitation belongs to a different email address',
      );
    }
    const accepted = await repository.accept(invitation.id, {
      userId: user.id,
      role: invitation.role,
      joinedAt: new Date(),
    });
    if (!accepted) {
      throw new AppError('NOT_FOUND', 'Invitation is invalid or has expired');
    }
    return { success: true };
  }

  function isUniqueViolation(error: unknown) {
    let current = error;
    for (let depth = 0; depth < 4; depth += 1) {
      if (!current || typeof current !== 'object') return false;
      if ('code' in current && current.code === '23505') return true;
      current = 'cause' in current ? current.cause : undefined;
    }
    return false;
  }

  async function createAndSendInvitation(input: {
    target: { teamId: number } | { projectId: number };
    email: string;
    role: 'admin' | 'qa' | 'manual_tester' | 'viewer';
    actor: { id: number; name: string };
    projectName: string;
    teamName?: string;
    idempotencyPrefix: 'team' | 'project';
  }) {
    const token = randomBytes(32).toString('base64url');
    const invitation = await repository.createOrRefresh({
      ...input.target,
      email: input.email,
      role: input.role,
      invitedById: input.actor.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + invitationLifetimeMs),
    });
    const registrationUrl = new URL('/register', frontendUrl);
    registrationUrl.searchParams.set('invitation', token);
    await mailer.sendInvitation({
      to: input.email,
      teamName: input.teamName,
      projectName: input.projectName,
      invitedByName: input.actor.name,
      registrationUrl: registrationUrl.toString(),
      expiresAt: invitation.expiresAt,
      idempotencyKey: `${input.idempotencyPrefix}-invitation-${invitation.id}-${invitation.updatedAt.getTime()}`,
    });
    return {
      id: invitation.id,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
    };
  }

  return {
    async invite(
      input: {
        teamId: number;
        email: string;
        role: 'admin' | 'qa' | 'manual_tester' | 'viewer';
      },
      actor: { id: number; name: string },
    ) {
      await authorization.require(
        actor.id,
        { type: 'team', id: input.teamId },
        'manage',
      );
      const team = await repository.findTeam(input.teamId);
      if (!team) throw new AppError('NOT_FOUND', 'Team not found');

      const email = normalizeEmail(input.email);
      const existingUser = await repository.findUserByEmail(email);
      if (
        existingUser &&
        (await repository.findTeamMember(input.teamId, existingUser.id))
      ) {
        throw new AppError('CONFLICT', 'User is already a member of this team');
      }

      return createAndSendInvitation({
        target: { teamId: input.teamId },
        email,
        role: input.role,
        actor,
        teamName: team.name,
        projectName: team.project.name,
        idempotencyPrefix: 'team',
      });
    },

    async inviteProject(
      input: {
        projectId: number;
        email: string;
        role: 'admin' | 'qa' | 'manual_tester' | 'viewer';
      },
      actor: { id: number; name: string },
    ) {
      await authorization.requireProject(actor.id, input.projectId, 'manage');
      const project = await repository.findProject(input.projectId);
      if (!project) throw new AppError('NOT_FOUND', 'Project not found');

      const email = normalizeEmail(input.email);
      const existingUser = await repository.findUserByEmail(email);
      if (existingUser?.id === project.createdById) {
        throw new AppError('CONFLICT', 'The project owner already has access');
      }
      if (
        existingUser &&
        (await repository.findProjectMember(input.projectId, existingUser.id))
      ) {
        throw new AppError(
          'CONFLICT',
          'User is already a direct member of this project',
        );
      }

      return createAndSendInvitation({
        target: { projectId: input.projectId },
        email,
        role: input.role,
        actor,
        projectName: project.name,
        idempotencyPrefix: 'project',
      });
    },

    async preview(token: string) {
      const invitation = requireUsableInvitation(
        await repository.findByTokenHash(hashToken(token)),
      );
      return {
        email: invitation.email,
        teamName: invitation.teamName,
        projectName: invitation.projectName,
        expiresAt: invitation.expiresAt,
      };
    },

    async validateRegistrationInvitation(email: string, token: string) {
      const invitation = requireUsableInvitation(
        await repository.findByTokenHash(hashToken(token)),
      );
      if (normalizeEmail(invitation.email) !== normalizeEmail(email)) {
        throw new AppError(
          'BAD_REQUEST',
          'Registration email must match the invitation email',
        );
      }
      return invitation;
    },

    listPending(email: string) {
      return repository.listPending(normalizeEmail(email));
    },

    async listForProject(projectId: number, actorId: number) {
      await authorization.requireProject(actorId, projectId, 'manage');
      const invitations = await repository.listForProject(projectId);
      const now = new Date();
      return invitations.map((invitation) => ({
        ...invitation,
        status: invitation.acceptedAt
          ? ('accepted' as const)
          : invitation.declinedAt
            ? ('declined' as const)
            : invitation.expiredAt || invitation.expiresAt <= now
              ? ('expired' as const)
              : invitation.cancelledAt
                ? ('cancelled' as const)
                : ('pending' as const),
      }));
    },

    async acceptById(id: number, user: { id: number; email: string }) {
      const invitation = await repository.findByIdForEmail(
        id,
        normalizeEmail(user.email),
      );
      if (invitation?.acceptedAt) return { success: true };
      return acceptInvitation(requireUsableInvitation(invitation), user);
    },

    async acceptByToken(token: string, user: { id: number; email: string }) {
      const invitation = requireUsableInvitation(
        await repository.findByTokenHash(hashToken(token)),
      );
      return acceptInvitation(invitation, user);
    },

    async decline(id: number, user: { email: string }) {
      requireUsableInvitation(
        await repository.findByIdForEmail(id, normalizeEmail(user.email)),
      );
      if (!(await repository.markDeclined(id))) {
        throw new AppError('NOT_FOUND', 'Invitation is invalid or has expired');
      }
      return { success: true };
    },

    async registerUser(
      token: string,
      input: { email: string; passwordHash: string; name: string },
    ) {
      const email = normalizeEmail(input.email);
      try {
        const result = await repository.registerUserAndAccept(
          hashToken(token),
          email,
          {
            email,
            passwordHash: input.passwordHash,
            name: input.name,
            role: 'viewer',
          },
        );
        if (result.status === 'conflict') {
          throw new AppError('CONFLICT', 'User with this email already exists');
        }
        if (result.status === 'invalid') {
          throw new AppError(
            'NOT_FOUND',
            'Invitation is invalid or has expired',
          );
        }
        return result.user;
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (isUniqueViolation(error)) {
          throw new AppError('CONFLICT', 'User with this email already exists');
        }
        throw error;
      }
    },

    async cancel(id: number, actorId: number) {
      const invitation = await repository.findById(id);
      if (!invitation) {
        throw new AppError('NOT_FOUND', 'Invitation not found');
      }
      await authorization.require(
        actorId,
        invitation.teamId
          ? { type: 'team', id: invitation.teamId }
          : { type: 'project', id: invitation.projectId! },
        'manage',
      );
      if (!(await repository.markCancelled(id))) {
        throw new AppError(
          'CONFLICT',
          'Only pending invitations can be cancelled',
        );
      }
      return { success: true };
    },
  };
}

export type InvitationService = ReturnType<typeof createInvitationService>;
