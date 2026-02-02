import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { db, testSuites, testSuiteVersions, eq, and, desc } from '@signal/db';
import { TRPCError } from '@trpc/server';

export const testSuitesRouter = router({
  list: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const suites = await db.query.testSuites.findMany({
        where: eq(testSuites.productId, input.productId),
        with: {
          versions: {
            orderBy: desc(testSuiteVersions.versionNumber),
            limit: 1,
          },
        },
        orderBy: desc(testSuites.updatedAt),
      });
      return suites;
    }),

  create: protectedProcedure
    .input(z.object({
      productId: z.number(),
      name: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Create suite first
      const [suite] = await db.insert(testSuites).values({
        productId: input.productId,
        name: input.name,
        description: input.description || null,
        createdById: ctx.user.id,
        currentVersionId: null, // Will update after creating version
      }).returning();

      // Create first version
      const [version] = await db.insert(testSuiteVersions).values({
        suiteId: suite.id,
        versionNumber: 1,
        name: input.name,
        description: input.description || null,
        createdById: ctx.user.id,
      }).returning();

      // Update suite with current version
      await db.update(testSuites)
        .set({ currentVersionId: version.id })
        .where(eq(testSuites.id, suite.id));

      return {
        ...suite,
        currentVersionId: version.id,
      };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const suite = await db.query.testSuites.findFirst({
        where: eq(testSuites.id, input.id),
        with: {
          versions: {
            orderBy: desc(testSuiteVersions.versionNumber),
          },
        },
      });

      if (!suite) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Test suite not found',
        });
      }

      return suite;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      // Get current suite
      const suite = await db.query.testSuites.findFirst({
        where: eq(testSuites.id, id),
        with: {
          versions: {
            orderBy: desc(testSuiteVersions.versionNumber),
            limit: 1,
          },
        },
      });

      if (!suite) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Test suite not found',
        });
      }

      const latestVersion = suite.versions[0];
      const newVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

      // Create new version
      const [version] = await db.insert(testSuiteVersions).values({
        suiteId: id,
        versionNumber: newVersionNumber,
        name: updates.name || latestVersion?.name || '',
        description: updates.description !== undefined ? updates.description : latestVersion?.description,
        createdById: ctx.user.id,
      }).returning();

      // Update suite metadata
      const [updatedSuite] = await db.update(testSuites)
        .set({
          name: updates.name || suite.name,
          description: updates.description !== undefined ? updates.description : suite.description,
          currentVersionId: version.id,
          updatedAt: new Date(),
        })
        .where(eq(testSuites.id, id))
        .returning();

      return {
        ...updatedSuite,
        newVersion: version,
      };
    }),

  getVersions: protectedProcedure
    .input(z.object({ suiteId: z.number() }))
    .query(async ({ input }) => {
      const versions = await db.query.testSuiteVersions.findMany({
        where: eq(testSuiteVersions.suiteId, input.suiteId),
        orderBy: desc(testSuiteVersions.versionNumber),
      });
      return versions;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(testSuites).where(eq(testSuites.id, input.id));
      return { success: true };
    }),
});
