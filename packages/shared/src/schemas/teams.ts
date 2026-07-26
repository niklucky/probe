import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { teamMembers, teams } from '@probe/db';
import { z } from 'zod';

const teamInsertSchema = createInsertSchema(teams);
const memberInsertSchema = createInsertSchema(teamMembers);

export const teamSchema = createSelectSchema(teams).pick({
  id: true,
  projectId: true,
  name: true,
  createdAt: true,
  updatedAt: true,
});
export const listTeamsInputSchema = z.object({
  projectId: teamInsertSchema.shape.projectId,
});
export const createTeamInputSchema = teamInsertSchema.pick({
  projectId: true,
  name: true,
});
export const teamMemberInputSchema = z.object({
  teamId: memberInsertSchema.shape.teamId,
  userId: memberInsertSchema.shape.userId,
});
export const addTeamMemberInputSchema = teamMemberInputSchema.extend({
  role: z.enum(['admin', 'qa', 'manual_tester', 'viewer']),
});
export const updateTeamMemberRoleInputSchema = addTeamMemberInputSchema;
