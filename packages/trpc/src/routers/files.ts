import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { db, files, eq, and, desc } from '@probe/db';
import { Client } from 'minio';
import { TRPCError } from '@trpc/server';

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '11002'),
  useSSL: false,
  // Preserve the legacy local credentials so existing MinIO data remains accessible.
  accessKey: process.env.MINIO_ACCESS_KEY || 'signal',
  secretKey: process.env.MINIO_SECRET_KEY || 'signal_password',
});

// Preserve the legacy local bucket name; see README migration notes.
const BUCKET_NAME = process.env.MINIO_BUCKET || 'signal-assets';

export const filesRouter = router({
  // Get presigned URL for file upload
  getUploadUrl: protectedProcedure
    .input(z.object({
      filename: z.string().min(1),
      contentType: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const objectName = `${ctx.user.id}/${Date.now()}_${input.filename}`;
      
      try {
        const presignedUrl = await minioClient.presignedPutObject(
          BUCKET_NAME,
          objectName,
          300 // URL expires in 5 minutes
        );

        return {
          presignedUrl,
          objectName,
          publicUrl: `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '11002'}/${BUCKET_NAME}/${objectName}`,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate upload URL',
        });
      }
    }),

  // Save file metadata after upload
  saveFile: protectedProcedure
    .input(z.object({
      entityType: z.enum(['test_case_version', 'test_result']),
      entityId: z.number(),
      filename: z.string().min(1),
      originalName: z.string().min(1),
      mimeType: z.string().min(1),
      size: z.number().min(0),
      url: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const [file] = await db.insert(files).values({
        entityType: input.entityType,
        entityId: input.entityId,
        filename: input.filename,
        originalName: input.originalName,
        mimeType: input.mimeType,
        size: input.size,
        url: input.url,
        createdById: ctx.user.id,
      }).returning();

      return file;
    }),

  // List files for an entity
  list: protectedProcedure
    .input(z.object({
      entityType: z.enum(['test_case_version', 'test_result']),
      entityId: z.number(),
    }))
    .query(async ({ input }) => {
      const filesList = await db.query.files.findMany({
        where: and(
          eq(files.entityType, input.entityType),
          eq(files.entityId, input.entityId)
        ),
        orderBy: desc(files.createdAt),
        with: {
          createdBy: true,
        },
      });

      return filesList;
    }),

  // Delete a file
  delete: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input }) => {
      const file = await db.query.files.findFirst({
        where: eq(files.id, input.id),
      });

      if (!file) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'File not found',
        });
      }

      // Delete from MinIO
      try {
        await minioClient.removeObject(BUCKET_NAME, file.filename);
      } catch (error) {
        console.error('Failed to delete from MinIO:', error);
        // Continue to delete from DB even if MinIO fails
      }

      // Delete from database
      await db.delete(files).where(eq(files.id, input.id));

      return { success: true };
    }),

  // Get presigned download URL
  getDownloadUrl: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input }) => {
      const file = await db.query.files.findFirst({
        where: eq(files.id, input.id),
      });

      if (!file) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'File not found',
        });
      }

      try {
        const presignedUrl = await minioClient.presignedGetObject(
          BUCKET_NAME,
          file.filename,
          300 // URL expires in 5 minutes
        );

        return { presignedUrl };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate download URL',
        });
      }
    }),
});
