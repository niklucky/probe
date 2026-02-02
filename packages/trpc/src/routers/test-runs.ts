import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { db, testRuns, testRunItems, testResults, testCaseVersions, eq, and, desc, inArray } from '@signal/db';
import { TRPCError } from '@trpc/server';

export const testRunsRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const runs = await db.query.testRuns.findMany({
        where: eq(testRuns.projectId, input.projectId),
        orderBy: desc(testRuns.createdAt),
      });
      return runs;
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      testCaseVersionIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      const { projectId, name, description, testCaseVersionIds } = input;
      
      // Use current date as default name if not provided
      const runName = name || new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      if (testCaseVersionIds.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'At least one test case must be selected',
        });
      }

      // Verify all test case versions exist
      const versions = await db.query.testCaseVersions.findMany({
        where: inArray(testCaseVersions.id, testCaseVersionIds),
      });

      if (versions.length !== testCaseVersionIds.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'One or more test case versions not found',
        });
      }

      // Create test run
      const [run] = await db.insert(testRuns).values({
        projectId,
        name: runName,
        description: description || null,
        executedById: ctx.user.id,
      }).returning();

      // Create test run items
      const items = await db.insert(testRunItems).values(
        testCaseVersionIds.map((id, index) => ({
          runId: run.id,
          testCaseVersionId: id,
          orderIndex: index,
        }))
      ).returning();

      // Initialize test results as "not_run"
      await db.insert(testResults).values(
        testCaseVersionIds.map((id) => ({
          runId: run.id,
          testCaseVersionId: id,
          status: 'not_run' as const,
        }))
      );

      return {
        ...run,
        items,
      };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const run = await db.query.testRuns.findFirst({
        where: eq(testRuns.id, input.id),
        with: {
          items: {
            with: {
              testCaseVersion: {
                with: {
                  testCase: true,
                },
              },
            },
            orderBy: (items, { asc }) => [asc(items.orderIndex)],
          },
          results: {
            with: {
              testCaseVersion: true,
              executedBy: {
                columns: {
                  id: true,
                  name: true,
                },
              },
              files: {
                with: {
                  createdBy: {
                    columns: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!run) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Test run not found',
        });
      }

      // Calculate statistics
      const stats = {
        total: run.results.length,
        passed: run.results.filter(r => r.status === 'passed').length,
        failed: run.results.filter(r => r.status === 'failed').length,
        skipped: run.results.filter(r => r.status === 'skipped').length,
        blocked: run.results.filter(r => r.status === 'blocked').length,
        notRun: run.results.filter(r => r.status === 'not_run').length,
      };

      return {
        ...run,
        stats,
      };
    }),

  updateResult: protectedProcedure
    .input(z.object({
      runId: z.number(),
      testCaseVersionId: z.number(),
      status: z.enum(['passed', 'failed', 'skipped', 'blocked']),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { runId, testCaseVersionId, status, notes } = input;

      // Check if result exists
      const existingResult = await db.query.testResults.findFirst({
        where: and(
          eq(testResults.runId, runId),
          eq(testResults.testCaseVersionId, testCaseVersionId)
        ),
      });

      if (!existingResult) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Test result not found',
        });
      }

      const [result] = await db.update(testResults)
        .set({
          status,
          notes: notes || null,
          executedById: ctx.user.id,
          executedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(testResults.runId, runId),
          eq(testResults.testCaseVersionId, testCaseVersionId)
        ))
        .returning();

      return result;
    }),

  complete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const [run] = await db.update(testRuns)
        .set({
          completedAt: new Date(),
        })
        .where(eq(testRuns.id, input.id))
        .returning();

      if (!run) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Test run not found',
        });
      }

      return run;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(testRuns).where(eq(testRuns.id, input.id));
      return { success: true };
    }),

  getResult: protectedProcedure
    .input(z.object({
      runId: z.number(),
      testCaseVersionId: z.number(),
    }))
    .query(async ({ input }) => {
      const result = await db.query.testResults.findFirst({
        where: and(
          eq(testResults.runId, input.runId),
          eq(testResults.testCaseVersionId, input.testCaseVersionId)
        ),
        with: {
          testCaseVersion: {
            with: {
              testCase: true,
            },
          },
          executedBy: {
            columns: {
              id: true,
              name: true,
            },
          },
          files: {
            with: {
              createdBy: {
                columns: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!result) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Test result not found',
        });
      }

      return result;
    }),
});
