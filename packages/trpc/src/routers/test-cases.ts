import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { db, testCases, testCaseVersions, testSuites, eq, desc } from '@probe/db';
import { TRPCError } from '@trpc/server';

export const testCasesRouter = router({
  list: protectedProcedure
    .input(z.object({
      suiteId: z.number(),
      versionId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      // If specific version requested, get cases for that suite version
      if (input.versionId) {
        const cases = await db.query.testCaseVersions.findMany({
          where: eq(testCaseVersions.suiteVersionId, input.versionId),
          with: {
            testCase: true,
          },
          orderBy: desc(testCaseVersions.createdAt),
        });
        return cases.map(({ testCase, ...version }) => ({
          ...testCase,
          versions: [version],
          currentVersion: version,
        }));
      }

      // Otherwise, get current versions for all cases in suite
      const allCases = await db.query.testCases.findMany({
        where: eq(testCases.suiteId, input.suiteId),
        with: {
          versions: {
            orderBy: desc(testCaseVersions.versionNumber),
            limit: 1,
          },
        },
      });

      return allCases.map(tc => ({
        ...tc,
        currentVersion: tc.versions[0],
      }));
    }),

  listByProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      // Get all test suites for the product
      const suites = await db.query.testSuites.findMany({
        where: eq(testSuites.productId, input.productId),
      });

      if (suites.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No test suites found for this product',
        });
      }

      // For each suite, get all test cases with their current versions
      const result = await Promise.all(
        suites.map(async (suite) => {
          const testCasesList = await db.query.testCases.findMany({
            where: eq(testCases.suiteId, suite.id),
            with: {
              versions: {
                orderBy: desc(testCaseVersions.versionNumber),
                limit: 1,
              },
            },
          });

          return {
            suiteId: suite.id,
            suiteName: suite.name,
            testCases: testCasesList.map(tc => ({
              ...tc,
              currentVersion: tc.versions[0],
            })),
          };
        })
      );

      return result;
    }),

  create: protectedProcedure
    .input(z.object({
      suiteId: z.number(),
      title: z.string().min(1),
      description: z.string().optional(),
      steps: z.array(z.string()),
      expectedResult: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
      tags: z.array(z.string()).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const { suiteId, ...caseData } = input;

      // Get current suite version
      const suite = await db.query.testSuites.findFirst({
        where: eq(testSuites.id, suiteId),
      });

      if (!suite) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Test suite not found',
        });
      }

      if (!suite.currentVersionId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Suite has no current version',
        });
      }

      // Create test case
      const [testCase] = await db.insert(testCases).values({
        suiteId,
        createdById: ctx.user.id,
        currentVersionId: null,
      }).returning();

      // Create first version linked to current suite version
      const [version] = await db.insert(testCaseVersions).values({
        testCaseId: testCase.id,
        suiteVersionId: suite.currentVersionId,
        versionNumber: 1,
        title: caseData.title,
        description: caseData.description || null,
        steps: caseData.steps,
        expectedResult: caseData.expectedResult || null,
        priority: caseData.priority,
        status: 'draft',
        tags: caseData.tags,
        createdById: ctx.user.id,
      }).returning();

      // Update test case with current version
      await db.update(testCases)
        .set({ currentVersionId: version.id })
        .where(eq(testCases.id, testCase.id));

      return {
        ...testCase,
        currentVersion: version,
      };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number(), versionId: z.number().optional() }))
    .query(async ({ input }) => {
      const testCase = await db.query.testCases.findFirst({
        where: eq(testCases.id, input.id),
        with: {
          versions: {
            orderBy: desc(testCaseVersions.versionNumber),
            with: {
              files: true,
            },
          },
        },
      });

      if (!testCase) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Test case not found',
        });
      }

      return testCase;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      steps: z.array(z.string()).optional(),
      expectedResult: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      status: z.enum(['draft', 'ready', 'deprecated']).optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      // Get current test case
      const testCase = await db.query.testCases.findFirst({
        where: eq(testCases.id, id),
        with: {
          suite: true,
          versions: {
            orderBy: desc(testCaseVersions.versionNumber),
            limit: 1,
          },
        },
      });

      if (!testCase) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Test case not found',
        });
      }

      const latestVersion = testCase.versions[0];
      const newVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

      // Get current suite version
      const suiteVersionId = testCase.suite.currentVersionId;
      if (!suiteVersionId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Suite has no current version',
        });
      }

      // Create new version
      const [version] = await db.insert(testCaseVersions).values({
        testCaseId: id,
        suiteVersionId,
        versionNumber: newVersionNumber,
        title: updates.title || latestVersion?.title || '',
        description: updates.description !== undefined ? updates.description : latestVersion?.description,
        steps: updates.steps || latestVersion?.steps || [],
        expectedResult: updates.expectedResult !== undefined ? updates.expectedResult : latestVersion?.expectedResult,
        priority: updates.priority || latestVersion?.priority || 'medium',
        status: updates.status || latestVersion?.status || 'draft',
        tags: updates.tags || latestVersion?.tags || [],
        createdById: ctx.user.id,
      }).returning();

      // Update test case with current version
      const [updatedTestCase] = await db.update(testCases)
        .set({
          currentVersionId: version.id,
          updatedAt: new Date(),
        })
        .where(eq(testCases.id, id))
        .returning();

      return {
        ...updatedTestCase,
        newVersion: version,
      };
    }),

  getVersions: protectedProcedure
    .input(z.object({ testCaseId: z.number() }))
    .query(async ({ input }) => {
      const versions = await db.query.testCaseVersions.findMany({
        where: eq(testCaseVersions.testCaseId, input.testCaseId),
        orderBy: desc(testCaseVersions.versionNumber),
      });
      return versions;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(testCases).where(eq(testCases.id, input.id));
      return { success: true };
    }),
});
