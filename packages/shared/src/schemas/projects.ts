import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { projects } from '@probe/db';
import { z } from 'zod';

const projectInsertSchema = createInsertSchema(projects);

export const projectSchema = createSelectSchema(projects).pick({
  id: true,
  name: true,
  description: true,
  logoUrl: true,
  website: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
});

export const projectIdInputSchema = z.object({
  id: z.number().int().positive(),
});

export const createProjectInputSchema = projectInsertSchema.pick({
  name: true,
  description: true,
  website: true,
});

export const updateProjectInputSchema = projectInsertSchema
  .pick({
    name: true,
    description: true,
    website: true,
    logoUrl: true,
  })
  .partial()
  .extend({ id: z.number().int().positive() });

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;
