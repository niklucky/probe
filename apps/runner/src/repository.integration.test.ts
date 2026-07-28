import { expect, test } from 'bun:test';
import {
  automationExecutionJobs,
  db,
  eq,
  environments,
  products,
  projects,
  testAutomations,
  testCases,
  testCaseVersions,
  testSuites,
  testSuiteVersions,
  users,
} from '@probe/db';
import { createRunnerRepository } from './repository';

const integrationTest = process.env.RUNNER_INTEGRATION_DATABASE_URL
  ? test
  : test.skip;

integrationTest(
  'two concurrent workers cannot claim the same PostgreSQL job',
  async () => {
    const suffix = crypto.randomUUID();
    let automationId: number | undefined;
    const [user] = await db
      .insert(users)
      .values({
        email: `runner-${suffix}@example.test`,
        passwordHash: 'not-used',
        name: 'Runner integration test',
      })
      .returning();
    const [project] = await db
      .insert(projects)
      .values({ name: 'Runner integration test', createdById: user!.id })
      .returning();
    try {
      const [product] = await db
        .insert(products)
        .values({
          projectId: project!.id,
          name: 'Web',
          type: 'website',
        })
        .returning();
      const [environment] = await db
        .insert(environments)
        .values({
          projectId: project!.id,
          productId: product!.id,
          name: 'Test',
          type: 'staging',
          baseUrl: 'https://example.test',
          createdById: user!.id,
        })
        .returning();
      const [suite] = await db
        .insert(testSuites)
        .values({
          productId: product!.id,
          name: 'Suite',
          createdById: user!.id,
        })
        .returning();
      const [suiteVersion] = await db
        .insert(testSuiteVersions)
        .values({
          suiteId: suite!.id,
          versionNumber: 1,
          name: 'Suite',
          createdById: user!.id,
        })
        .returning();
      const [testCase] = await db
        .insert(testCases)
        .values({ suiteId: suite!.id, createdById: user!.id })
        .returning();
      const [caseVersion] = await db
        .insert(testCaseVersions)
        .values({
          testCaseId: testCase!.id,
          suiteVersionId: suiteVersion!.id,
          versionNumber: 1,
          title: 'Concurrent claim',
          expectedResult: 'One worker wins',
          status: 'ready',
          createdById: user!.id,
        })
        .returning();
      const [automation] = await db
        .insert(testAutomations)
        .values({
          testCaseId: testCase!.id,
          sourceTestCaseVersionId: caseVersion!.id,
          environmentId: environment!.id,
          versionNumber: 1,
          status: 'accepted',
          source: "import { test } from '@playwright/test';",
          promptVersion: 'integration-test',
          createdById: user!.id,
          acceptedById: user!.id,
          acceptedAt: new Date(),
        })
        .returning();
      automationId = automation!.id;
      await db.insert(automationExecutionJobs).values({
        projectId: project!.id,
        automationId: automation!.id,
        environmentId: environment!.id,
        requestedById: user!.id,
        settings: {
          browser: 'chromium',
          captureVideo: false,
          runnerVersion: 'integration-test',
          containerImage: 'integration-test',
          cpuLimit: 1,
          memoryMb: 128,
          processLimit: 32,
          artifactLimitMb: 16,
          networkPolicy: 'integration-test',
        },
      });

      const repository = createRunnerRepository();
      const claims = await Promise.all([
        repository.claim(`worker-a-${suffix}`),
        repository.claim(`worker-b-${suffix}`),
      ]);
      expect(claims.filter(Boolean)).toHaveLength(1);
      expect(claims.filter(Boolean)[0]?.status).toBe('claimed');
    } finally {
      await db
        .delete(automationExecutionJobs)
        .where(eq(automationExecutionJobs.projectId, project!.id));
      if (automationId) {
        await db
          .delete(testAutomations)
          .where(eq(testAutomations.id, automationId));
      }
      await db.delete(projects).where(eq(projects.id, project!.id));
      await db.delete(users).where(eq(users.id, user!.id));
    }
  },
);
