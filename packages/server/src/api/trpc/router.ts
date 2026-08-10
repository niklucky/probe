import { router } from '../../trpc';
import { authRouter } from './routers/auth';
import { usersRouter } from './routers/users';
import { projectsRouter } from './routers/projects';
import { productsRouter } from './routers/products';
import { teamsRouter } from './routers/teams';
import { testSuitesRouter } from './routers/test-suites';
import { testCasesRouter } from './routers/test-cases';
import { testRunsRouter } from './routers/test-runs';
import { filesRouter } from './routers/files';
import { environmentsRouter } from './routers/environments';
import { aiConnectionsRouter } from './routers/ai-connections';
import { aiAuthoringRouter } from './routers/ai-authoring';
import { testAutomationsRouter } from './routers/test-automations';
import { automationExecutionsRouter } from './routers/automation-executions';
import { automationRepairsRouter } from './routers/automation-repairs';
import { browserAuthoringRouter } from './routers/browser-authoring';
import { invitationsRouter } from './routers/invitations';

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  projects: projectsRouter,
  products: productsRouter,
  teams: teamsRouter,
  testSuites: testSuitesRouter,
  testCases: testCasesRouter,
  testRuns: testRunsRouter,
  files: filesRouter,
  environments: environmentsRouter,
  aiConnections: aiConnectionsRouter,
  aiAuthoring: aiAuthoringRouter,
  testAutomations: testAutomationsRouter,
  automationExecutions: automationExecutionsRouter,
  automationRepairs: automationRepairsRouter,
  browserAuthoring: browserAuthoringRouter,
  invitations: invitationsRouter,
});

export type AppRouter = typeof appRouter;
