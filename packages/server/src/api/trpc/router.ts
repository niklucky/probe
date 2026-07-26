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
});

export type AppRouter = typeof appRouter;
