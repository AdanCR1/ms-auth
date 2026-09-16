import type { MiddlewareHandler } from 'hono';
import type { Env, Variables, UserRole } from '../types';
import { getSupabaseAdmin } from '../config/supabase';
import { error } from '../utils/response';

export const authMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (
  c,
  next
) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(c, 401, 'Token de autenticación faltante o con formato inválido');
  }

  const token = authHeader.substring(7);
  const supabaseAdmin = getSupabaseAdmin(c.env);

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return error(c, 401, 'Token inválido o expirado');
  }

  // Consulta en caliente: no confiamos en el token, verificamos estado y rol en PostgreSQL
  const { data: perfil, error: perfilError } = await supabaseAdmin
    .from('perfiles')
    .select('id, nombre, correo, rol, activo')
    .eq('id', user.id)
    .single();

  if (perfilError || !perfil) {
    return error(c, 403, 'Perfil de usuario no encontrado en el sistema');
  }

  if (!perfil.activo) {
    return error(c, 403, 'Esta cuenta ha sido desactivada');
  }

  c.set('user', {
    id: perfil.id,
    email: perfil.correo,
    nombre: perfil.nombre,
    rol: perfil.rol as UserRole,
  });

  await next();
};