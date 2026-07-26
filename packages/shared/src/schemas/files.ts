import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { files } from '@probe/db';
import { z } from 'zod';

const fileInsertSchema = createInsertSchema(files);

export const publicFileSchema = createSelectSchema(files).pick({
  id: true,
  entityType: true,
  entityId: true,
  filename: true,
  originalName: true,
  mimeType: true,
  size: true,
  url: true,
  createdById: true,
  createdAt: true,
});
export const getUploadUrlInputSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
});
export const saveFileInputSchema = fileInsertSchema
  .pick({
    entityType: true,
    entityId: true,
    filename: true,
    originalName: true,
    mimeType: true,
    size: true,
    url: true,
  })
  .extend({
    entityType: z.enum(['test_case_version', 'test_result']),
  });
export const listFilesInputSchema = z.object({
  entityType: z.enum(['test_case_version', 'test_result']),
  entityId: fileInsertSchema.shape.entityId,
});
export const fileIdInputSchema = z.object({ id: z.number().int().positive() });
