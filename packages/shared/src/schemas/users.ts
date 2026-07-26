import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { users } from '@probe/db';
import { z } from 'zod';

const userInsertSchema = createInsertSchema(users);

export const publicUserSchema = createSelectSchema(users).pick({
  id: true,
  email: true,
  name: true,
  role: true,
  avatarUrl: true,
  avatarType: true,
  createdAt: true,
  updatedAt: true,
});
export const registerInputSchema = userInsertSchema
  .pick({ email: true, name: true })
  .extend({ password: z.string().min(6) });
export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
export const updateProfileInputSchema = userInsertSchema
  .pick({ email: true, name: true })
  .partial();
export const updateAvatarInputSchema = z.object({
  avatarUrl: z.string().min(1),
  avatarType: z.enum(['predefined', 'custom']),
});
export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});
export const searchUsersInputSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(10),
});
