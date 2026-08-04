import { trpcServer } from '@hono/trpc-server';
import { appRouter, createContext, serverEnv, services } from '@probe/server';
import { Hono, type Context } from 'hono';
import { serveStatic } from 'hono/bun';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { proxy } from 'hono/proxy';

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

async function proxyStorage(context: Context) {
  const maxBodyBytes = 100 * 1024 * 1024;
  const contentLength = Number(context.req.header('content-length') ?? 0);
  if (contentLength > maxBodyBytes) {
    return context.text('Storage request body is too large', 413);
  }
  const target = new URL(context.req.url);
  target.protocol = serverEnv.MINIO_USE_SSL ? 'https:' : 'http:';
  target.hostname = serverEnv.MINIO_ENDPOINT;
  target.port = String(serverEnv.MINIO_PORT);

  const headers = new Headers(context.req.raw.headers);
  headers.delete('host');
  const method = context.req.method;
  const body = ['GET', 'HEAD'].includes(method)
    ? undefined
    : await context.req.arrayBuffer();
  if (body && body.byteLength > maxBodyBytes) {
    return context.text('Storage request body is too large', 413);
  }
  return proxy(target, {
    raw: context.req.raw,
    headers,
    body,
  });
}

for (const bucket of new Set([
  serverEnv.MINIO_BUCKET,
  serverEnv.RUNNER_ARTIFACT_BUCKET,
])) {
  app.all(`/${bucket}`, proxyStorage);
  app.all(`/${bucket}/*`, proxyStorage);
}

app.use('*', serveStatic({ root: './public' }));
app.get('*', serveStatic({ path: './public/index.html' }));

app.onError((error, context) => {
  console.error('Error:', error);
  return context.json({ error: 'Internal server error' }, 500);
});

function bearerToken(authorization: string | undefined) {
  return authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;
}
