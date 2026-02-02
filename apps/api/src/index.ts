import { Hono } from 'hono';
import { trpcServer } from '@hono/trpc-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { appRouter, createContext } from '@signal/trpc';
import { db, runMigrations, testConnection } from '@signal/db';
import { eq } from 'drizzle-orm';
import { users } from '@signal/db';
import jwt from 'jsonwebtoken';
import * as Minio from 'minio';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// MinIO client
export const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '11002'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'signal',
  secretKey: process.env.MINIO_SECRET_KEY || 'signal_password',
});

const app = new Hono();

// Middleware
app.use(logger());
app.use('*', cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:11020',
  credentials: true,
}));

// Health check
app.get('/health', async (c) => {
  const dbConnected = await testConnection();
  return c.json({ 
    status: 'ok', 
    db: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// File upload endpoint (MinIO pre-signed URL)
app.post('/upload', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  try {
    jwt.verify(token, JWT_SECRET);
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }

  const body = await c.req.json();
  const { filename, contentType } = body;

  if (!filename || !contentType) {
    return c.json({ error: 'Missing filename or contentType' }, 400);
  }

  const bucketName = process.env.MINIO_BUCKET || 'signal-assets';
  const objectName = `uploads/${Date.now()}-${filename}`;
  const expires = 24 * 60 * 60; // 24 hours

  try {
    const presignedUrl = await minioClient.presignedPutObject(bucketName, objectName, expires);
    const publicUrl = `${process.env.MINIO_PUBLIC_URL || 'http://localhost:11002'}/${bucketName}/${objectName}`;
    
    return c.json({
      uploadUrl: presignedUrl,
      publicUrl,
      objectName,
    });
  } catch (error) {
    console.error('MinIO error:', error);
    return c.json({ error: 'Failed to generate upload URL' }, 500);
  }
});

// tRPC middleware with auth
app.use(
  '/trpc/*',
  trpcServer({
    endpoint: '/trpc',
    router: appRouter,
    createContext: async (opts, c) => {
      const authHeader = c.req.header('Authorization');
      let user = null;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
          const userData = await db.query.users.findFirst({
            where: eq(users.id, decoded.userId),
            columns: {
              id: true,
              email: true,
              name: true,
              role: true,
              createdAt: true,
              updatedAt: true,
            },
          });
          if (userData) {
            user = {
              ...userData,
              createdAt: userData.createdAt.toISOString(),
              updatedAt: userData.updatedAt.toISOString(),
            };
          }
        } catch (error) {
          // Invalid token, user remains null
        }
      }

      return createContext({ user });
    },
  })
);

// Error handling
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Start server with migrations
async function startServer() {
  try {
    // Run migrations first
    await runMigrations();
    
    const port = parseInt(process.env.PORT || '11010');
    
    console.log(`🚀 Server ready at http://localhost:${port}`);
    console.log(`➜ TRPC endpoint: http://localhost:${port}/trpc`);
    console.log(`➜ Health check: http://localhost:${port}/health`);
    
    return {
      port,
      fetch: app.fetch,
    };
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

export default await startServer();
