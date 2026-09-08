import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con service role key: solo se usa en rutas /api protegidas por rol admin.
 * Nunca importar desde código que se ejecute en el navegador.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
