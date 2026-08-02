import { serverEnv, services } from '@probe/server';
import { app } from './server';

async function startServer() {
  try {
    await services.system.runMigrations();
    const repairCoordinator = setInterval(
      () =>
        void services.automationRepairs
          .processPending()
          .catch((error) => console.error('Repair coordinator failed', error)),
      2_000,
    );
    repairCoordinator.unref();
    const port = serverEnv.PORT;
    console.log(`🚀 Server ready at http://localhost:${port}`);
    console.log(`➜ TRPC endpoint: http://localhost:${port}/trpc`);
    console.log(`➜ Health check: http://localhost:${port}/health`);
    return { port, fetch: app.fetch };
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

export default await startServer();
