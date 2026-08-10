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
      expiresAt: Date;
    },
  >(invitation: T | undefined): T {
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.declinedAt ||
      invitation.cancelledAt ||
      invitation.expiresAt <= new Date()
    ) {
      throw new AppError('NOT_FOUND', 'Invitation is invalid or has expired');
    }
    return invitation;
  }

  async function acceptInvitation(
    invitation: {
      id: number;
      teamId: number;
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
      teamId: invitation.teamId,
      userId: user.id,
      role: invitation.role,
      joinedAt: new Date(),
    });
    if (!accepted) {
      throw new AppError('NOT_FOUND', 'Invitation is invalid or has expired');
    }
    return { success: true };
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
        (await repository.findMember(input.teamId, existingUser.id))
      ) {
        throw new AppError('CONFLICT', 'User is already a member of this team');
      }

      const token = randomBytes(32).toString('base64url');
      const invitation = await repository.createOrRefresh({
        teamId: input.teamId,
        email,
        role: input.role,
        invitedById: actor.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + invitationLifetimeMs),
      });
      const registrationUrl = new URL('/register', frontendUrl);
      registrationUrl.searchParams.set('invitation', token);
      await mailer.sendInvitation({
        to: email,
        teamName: team.name,
        projectName: team.project.name,
        invitedByName: actor.name,
        registrationUrl: registrationUrl.toString(),
        idempotencyKey: `team-invitation-${invitation.id}-${invitation.updatedAt.getTime()}`,
      });
      return {
        id: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
      };
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
      if (invitation.email !== normalizeEmail(email)) {
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
            : invitation.cancelledAt
              ? ('cancelled' as const)
              : invitation.expiresAt <= now
                ? ('expired' as const)
                : ('pending' as const),
      }));
    },

    async acceptById(id: number, user: { id: number; email: string }) {
      const invitation = await repository.findPendingById(
        id,
        normalizeEmail(user.email),
      );
      if (!invitation) {
        throw new AppError('NOT_FOUND', 'Invitation is invalid or has expired');
      }
      return acceptInvitation(invitation, user);
    },

    async acceptByToken(token: string, user: { id: number; email: string }) {
      const invitation = requireUsableInvitation(
        await repository.findByTokenHash(hashToken(token)),
      );
      return acceptInvitation(invitation, user);
    },

    async decline(id: number, user: { email: string }) {
      const invitation = await repository.findPendingById(
        id,
        normalizeEmail(user.email),
      );
      if (!invitation) {
        throw new AppError('NOT_FOUND', 'Invitation is invalid or has expired');
      }
      if (!(await repository.markDeclined(id))) {
        throw new AppError('NOT_FOUND', 'Invitation is invalid or has expired');
      }
      return { success: true };
    },

    async cancel(id: number, actorId: number) {
      const invitation = await repository.findById(id);
      if (!invitation) {
        throw new AppError('NOT_FOUND', 'Invitation not found');
      }
      await authorization.require(
        actorId,
        { type: 'team', id: invitation.teamId },
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
