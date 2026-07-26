import { trpcServer } from '@hono/trpc-server';
import { appRouter, createContext, serverEnv, services } from '@probe/server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

export const app = new Hono();

app.use(logger());
app.use(
  '*',
  cors({
    origin: serverEnv.FRONTEND_URL,
    credentials: true,
  }),
);

app.get('/health', async (context) => {
  const dbConnected = await services.system.testConnection();
  return context.json({
    status: 'ok',
    db: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.post('/upload', async (context) => {
  const token = bearerToken(context.req.header('Authorization'));
  if (!token) {
    return context.json({ error: 'Unauthorized' }, 401);
  }
  if (!(await services.auth.resolveUser(token))) {
    return context.json({ error: 'Invalid token' }, 401);
  }

  const { filename, contentType } = await context.req.json();
  if (!filename || !contentType) {
    return context.json({ error: 'Missing filename or contentType' }, 400);
  }

  try {
    return context.json(await services.files.getLegacyUploadUrl(filename));
  } catch (error) {
    console.error('MinIO error:', error);
    return context.json({ error: 'Failed to generate upload URL' }, 500);
  }
});

app.use(
  '/trpc/*',
  trpcServer({
    endpoint: '/trpc',
    router: appRouter,
    createContext: async (_opts, context) => {
      const token = bearerToken(context.req.header('Authorization'));
      const user = token ? await services.auth.resolveUser(token) : null;
      return createContext({ user, services });
    },
  }),
);

app.onError((error, context) => {
  console.error('Error:', error);
  return context.json({ error: 'Internal server error' }, 500);
});

function bearerToken(authorization: string | undefined) {
  return authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;
}
