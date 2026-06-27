// ─────────────────────────────────────────────────────────────────────────────
// Supabase configuration
//
// Fill in your project URL and key to enable remote key validation, HWID locking,
// heartbeats, and the staff User Lookup. Leave blank to run in LOCAL-ONLY mode
// (keys validated by HMAC, no HWID binding, no User Lookup).
//
// You can also set these via env vars: LVNT_SUPABASE_URL / LVNT_SUPABASE_KEY
//
// Use the service_role key ONLY if you trust all installs, or (recommended) use
// the anon key together with the RLS policies / RPC functions in supabase-schema.sql.
// ─────────────────────────────────────────────────────────────────────────────

export const SUPABASE_URL = process.env.LVNT_SUPABASE_URL ?? ''
export const SUPABASE_KEY = process.env.LVNT_SUPABASE_KEY ?? ''

export function supabaseEnabled(): boolean {
  return SUPABASE_URL.startsWith('https://') && SUPABASE_KEY.length > 20
}
