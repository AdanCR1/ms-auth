import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env, Variables } from './types';
import { authRoutes } from './routes/auth.routes';
import { internalRoutes } from './routes/internal.routes';
import { error, success } from './utils/response';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Middlewares Globales
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => origin || '*',
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Internal-Secret'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })
);

// Health Check
app.get('/health', (c) => {
  return success(c, {
    service: 'ms-auth',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Montaje de Rutas
app.route('/api/v1/auth', authRoutes);
app.route('/internal', internalRoutes);

// Manejador Global 404
app.notFound((c) => {
  return error(c, 404, `Ruta no encontrada: \({c.req.method}\){c.req.url}`);
});

// Manejador Global de Errores no capturados
app.onError((err, c) => {
  console.error(`[Error ms-auth]:`, err);
  return error(c, 500, 'Error interno del servidor en ms-auth', err.message);
});

export default app;