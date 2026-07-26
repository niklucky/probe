import {
  db,
  environments,
  files,
  products,
  projects,
  teamMembers,
  teams,
  testCases,
  testCaseVersions,
  testResults,
  testRuns,
  testSuites,
  and,
  eq,
} from '@probe/db';

type Database = typeof db;

export type ProjectResource =
  | { type: 'project'; id: number }
  | { type: 'product'; id: number }
  | { type: 'environment'; id: number }
  | { type: 'team'; id: number }
  | { type: 'suite'; id: number }
  | { type: 'case'; id: number }
  | { type: 'caseVersion'; id: number }
  | { type: 'run'; id: number }
  | { type: 'result'; id: number }
  | { type: 'file'; id: number };

export function createAuthorizationRepository(database: Database = db) {
  async function resolveProjectId(
    resource: ProjectResource,
  ): Promise<number | undefined> {
    switch (resource.type) {
      case 'project':
        return (
          await database.query.projects.findFirst({
            where: eq(projects.id, resource.id),
            columns: { id: true },
          })
        )?.id;
      case 'product':
        return (
          await database.query.products.findFirst({
            where: eq(products.id, resource.id),
            columns: { projectId: true },
          })
        )?.projectId;
      case 'environment':
        return (
          await database.query.environments.findFirst({
            where: eq(environments.id, resource.id),
            columns: { projectId: true },
          })
        )?.projectId;
      case 'team':
        return (
          await database.query.teams.findFirst({
            where: eq(teams.id, resource.id),
            columns: { projectId: true },
          })
        )?.projectId;
      case 'suite': {
        const [row] = await database
          .select({ projectId: products.projectId })
          .from(testSuites)
          .innerJoin(products, eq(testSuites.productId, products.id))
          .where(eq(testSuites.id, resource.id))
          .limit(1);
        return row?.projectId;
      }
      case 'case': {
        const [row] = await database
          .select({ projectId: products.projectId })
          .from(testCases)
          .innerJoin(testSuites, eq(testCases.suiteId, testSuites.id))
          .innerJoin(products, eq(testSuites.productId, products.id))
          .where(eq(testCases.id, resource.id))
          .limit(1);
        return row?.projectId;
      }
      case 'caseVersion': {
        const [row] = await database
          .select({ projectId: products.projectId })
          .from(testCaseVersions)
          .innerJoin(testCases, eq(testCaseVersions.testCaseId, testCases.id))
          .innerJoin(testSuites, eq(testCases.suiteId, testSuites.id))
          .innerJoin(products, eq(testSuites.productId, products.id))
          .where(eq(testCaseVersions.id, resource.id))
          .limit(1);
        return row?.projectId;
      }
      case 'run':
        return (
          await database.query.testRuns.findFirst({
            where: eq(testRuns.id, resource.id),
            columns: { projectId: true },
          })
        )?.projectId;
      case 'result': {
        const [row] = await database
          .select({ projectId: testRuns.projectId })
          .from(testResults)
          .innerJoin(testRuns, eq(testResults.runId, testRuns.id))
          .where(eq(testResults.id, resource.id))
          .limit(1);
        return row?.projectId;
      }
      case 'file': {
        const file = await database.query.files.findFirst({
          where: eq(files.id, resource.id),
          columns: { entityType: true, entityId: true },
        });
        if (!file) return undefined;
        if (file.entityType === 'test_case_version') {
          return resolveProjectId({ type: 'caseVersion', id: file.entityId });
        }
        if (file.entityType === 'test_result') {
          return resolveProjectId({ type: 'result', id: file.entityId });
        }
        return undefined;
      }
    }
  }

  return {
    resolveProjectId,
    async listRoles(userId: number) {
      const owned = await database.query.projects.findMany({
        where: eq(projects.createdById, userId),
        columns: { id: true },
      });
      const memberships = await database
        .select({ projectId: teams.projectId, role: teamMembers.role })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(eq(teamMembers.userId, userId));
      return {
        ownedProjectIds: owned.map(({ id }) => id),
        memberships,
      };
    },
    async getRole(userId: number, projectId: number) {
      const project = await database.query.projects.findFirst({
        where: eq(projects.id, projectId),
        columns: { createdById: true },
      });
      if (!project) return undefined;
      if (project.createdById === userId) return 'owner' as const;
      const memberships = await database
        .select({ role: teamMembers.role })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(
          and(eq(teamMembers.userId, userId), eq(teams.projectId, projectId)),
        );
      return memberships
        .map(({ role }) => role)
        .sort(
          (a, b) =>
            ['admin', 'qa', 'manual_tester', 'viewer'].indexOf(a) -
            ['admin', 'qa', 'manual_tester', 'viewer'].indexOf(b),
        )[0];
    },
  };
}

export type AuthorizationRepository = ReturnType<
  typeof createAuthorizationRepository
>;
