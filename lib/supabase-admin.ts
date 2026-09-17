import { createClient } from "@supabase/supabase-js";

function claveSecretaSupabase() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.SUPABASE_SECRET_KEY) return process.env.SUPABASE_SECRET_KEY;

  const grupo = process.env.SUPABASE_SECRET_KEYS;
  if (grupo) {
    try {
      const claves = JSON.parse(grupo) as Record<string, string>;
      if (claves.default) return claves.default;
    } catch {
      // No se exponen valores secretos en mensajes ni logs.
    }
  }

  return null;
}

export function obtenerSupabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = claveSecretaSupabase();

  if (!url || !key) {
    throw new Error(
      `Faltan credenciales de almacenamiento (URL: ${url ? "configurada" : "faltante"}; clave servidor: ${key ? "configurada" : "faltante"}).`,
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function obtenerSupabaseAdminOpcional() {
  try {
    return obtenerSupabaseAdmin();
  } catch {
    return null;
  }
}
