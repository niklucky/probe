import { services } from '@probe/server';
import { app } from './server';

async function startServer() {
  try {
    await services.system.runMigrations();
    const port = Number.parseInt(process.env.PORT || '11010');
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
