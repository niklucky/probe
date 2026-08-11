import { z } from 'zod';

export const invitationTokenInputSchema = z.object({
  token: z.string().min(32).max(256),
});

export const invitationIdInputSchema = z.object({
  id: z.number().int().positive(),
});

export const listProjectInvitationsInputSchema = z.object({
  projectId: z.number().int().positive(),
});

export const inviteTeamMemberInputSchema = z.object({
  teamId: z.number().int().positive(),
  email: z.string().email().max(255),
  role: z.enum(['admin', 'qa', 'manual_tester', 'viewer']),
});
