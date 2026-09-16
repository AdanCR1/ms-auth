import { Hono } from 'hono';
import type { Env, Variables, UserRole } from '../types';
import { getSupabaseClient, getSupabaseAdmin } from '../config/supabase';
import { authMiddleware } from '../middlewares/auth';
import { requireRole } from '../middlewares/role';
import { success, error } from '../utils/response';

export const authRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// 1. Registro público
authRoutes.post('/register', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.email || !body.password || !body.nombre) {
    return error(c, 400, 'Faltan campos obligatorios: email, password, nombre');
  }

  const supabase = getSupabaseClient(c.env);
  const { data, error: signUpError } = await supabase.auth.signUp({
    email: body.email,
    password: body.password,
    options: {
      data: {
        nombre: body.nombre,
      },
    },
  });

  if (signUpError || !data.user) {
    return error(c, 400, signUpError?.message || 'Error al registrar el usuario');
  }

  return success(
    c,
    {
      user_id: data.user.id,
      email: data.user.email,
    },
    'Usuario registrado exitosamente',
    201
  );
});

// 2. Inicio de sesión con auto-reparación de perfil
authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.email || !body.password) {
    return error(c, 400, 'Faltan credenciales: email y password');
  }

  const supabase = getSupabaseClient(c.env);
  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (signInError || !data.user || !data.session) {
    return error(c, 401, 'Credenciales inválidas');
  }

  const supabaseAdmin = getSupabaseAdmin(c.env);
  
  // 1. Intentar obtener el perfil
  let { data: perfil } = await supabaseAdmin
    .from('perfiles')
    .select('id, nombre, correo, rol, activo')
    .eq('id', data.user.id)
    .maybeSingle();

  // 2. Fallback: Si el trigger falló o no existía, lo insertamos aquí
  if (!perfil) {
    const nombreUsuario =
      data.user.user_metadata?.nombre || data.user.email?.split('@')[0] || 'Usuario';

    const { data: nuevoPerfil, error: insertError } = await supabaseAdmin
      .from('perfiles')
      .insert({
        id: data.user.id,
        nombre: nombreUsuario,
        correo: data.user.email!,
        rol: 'auxiliar',
        activo: true,
      })
      .select('id, nombre, correo, rol, activo')
      .single();

    if (insertError || !nuevoPerfil) {
      return error(c, 500, 'Error al inicializar el perfil de usuario', insertError?.message);
    }

    perfil = nuevoPerfil;
  }

  // 3. Verificar estado activo
  if (!perfil.activo) {
    return error(c, 403, 'Acceso denegado: cuenta desactivada');
  }

  return success(c, {
    access_token: data.session.access_token,
    user: {
      id: perfil.id,
      email: perfil.correo,
      nombre: perfil.nombre,
      rol: perfil.rol,
    },
  });
});

// 4. Obtener datos del usuario autenticado
authRoutes.get('/me', authMiddleware, async (c) => {
  return success(c, c.get('user'));
});

// 5. Endpoint de Administración: Cambio de Roles (Superadmin)
authRoutes.patch(
  '/users/:id/role',
  authMiddleware,
  requireRole(['superadmin']),
  async (c) => {
    const targetUserId = c.req.param('id');
    const body = await c.req.json().catch(() => null);

    const validRoles: UserRole[] = ['superadmin', 'revisor', 'investigador', 'auxiliar'];
    if (!body || !body.rol || !validRoles.includes(body.rol)) {
      return error(c, 400, 'Rol especificado inválido');
    }

    const supabaseAdmin = getSupabaseAdmin(c.env);
    const { data: perfilActualizado, error: updateError } = await supabaseAdmin
      .from('perfiles')
      .update({ rol: body.rol })
      .eq('id', targetUserId)
      .select('id, nombre, correo, rol, activo')
      .single();

    if (updateError || !perfilActualizado) {
      return error(c, 404, 'No se pudo encontrar o actualizar el usuario');
    }

    return success(c, perfilActualizado, 'Rol actualizado correctamente');
  }
);