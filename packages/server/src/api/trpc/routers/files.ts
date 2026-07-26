import {
  fileIdInputSchema,
  getUploadUrlInputSchema,
  listFilesInputSchema,
  saveFileInputSchema,
} from '@probe/shared/schemas/files';
import { protectedProcedure, router } from '../../../trpc';

export const filesRouter = router({
  getUploadUrl: protectedProcedure
    .input(getUploadUrlInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.files.getUploadUrl(ctx.user.id, input.filename),
    ),
  saveFile: protectedProcedure
    .input(saveFileInputSchema)
    .mutation(({ ctx, input }) => ctx.services.files.save(input, ctx.user.id)),
  list: protectedProcedure
    .input(listFilesInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.files.list(input.entityType, input.entityId),
    ),
  delete: protectedProcedure
    .input(fileIdInputSchema)
    .mutation(({ ctx, input }) => ctx.services.files.delete(input.id)),
  getDownloadUrl: protectedProcedure
    .input(fileIdInputSchema)
    .mutation(({ ctx, input }) => ctx.services.files.getDownloadUrl(input.id)),
});
