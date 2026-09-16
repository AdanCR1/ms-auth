import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { getSupabaseAdmin } from '../config/supabase';
import { success, error } from '../utils/response';

export const internalRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Middleware que valida el secreto inter-servicio
internalRoutes.use('*', async (c, next) => {
  const secretHeader = c.req.header('X-Internal-Secret');
  if (!secretHeader || secretHeader !== c.env.INTERNAL_SERVICE_SECRET) {
    return error(c, 403, 'Acceso no autorizado: Secreto interno inválido');
  }
  await next();
});

// Endpoint para que MS2 o MS3 validen un usuario en caliente
internalRoutes.get('/users/:id/validate', async (c) => {
  const userId = c.req.param('id');
  const supabaseAdmin = getSupabaseAdmin(c.env);

  const { data: perfil, error: dbError } = await supabaseAdmin
    .from('perfiles')
    .select('id, nombre, correo, rol, activo')
    .eq('id', userId)
    .single();

  if (dbError || !perfil) {
    return error(c, 404, 'Usuario no encontrado');
  }

  return success(c, perfil);
});