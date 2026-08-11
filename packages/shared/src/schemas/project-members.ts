import { z } from 'zod';

export const projectMemberRoleSchema = z.enum([
  'admin',
  'qa',
  'manual_tester',
  'viewer',
]);

export const listProjectMembersInputSchema = z.object({
  projectId: z.number().int().positive(),
});

export const projectMemberInputSchema = z.object({
  projectId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export const updateProjectMemberRoleInputSchema =
  projectMemberInputSchema.extend({
    role: projectMemberRoleSchema,
  });
