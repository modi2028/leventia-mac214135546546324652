import { SUPABASE_URL, SUPABASE_KEY, supabaseEnabled } from './supabase-config.js'
import { getHwid } from './hwid.js'
import type { ValidationResult, UserLookupResult, KeyRecord, UpdatePost, UpdateCategory, LeaderboardEntry, LeaderboardMetric } from '../src/types/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// Supabase client — RPC ONLY.
//
// The publishable key can only EXECUTE the rpc_* functions (see
// supabase-schema-secure.sql). It cannot read, dump, edit, or forge the
// licenses table directly — RLS is on with no table policies. All signing
// secrets live in the database, never in this app.
//
// Staff actions pass the caller's staff license key; the database verifies it
// (HMAC against the server-side secret) before doing anything.
// ─────────────────────────────────────────────────────────────────────────────

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    })
    if (res.status === 401 || res.status === 403) return { ok: false, error: 'API access denied.' }
    if (!res.ok) {
      let msg = `Server error (HTTP ${res.status}).`
      try { const j = await res.json() as { message?: string }; if (j.message) msg = j.message } catch {}
      return { ok: false, error: msg }
    }
    // Void RPCs (extend / set-status / set-role / reset-hwid) return 204 with an
    // EMPTY body — calling res.json() on that throws and turns a successful call
    // into a false failure. Read text first and only parse when there's content.
    const text = await res.text()
    let data: T | undefined
    if (text) { try { data = JSON.parse(text) as T } catch { /* non-JSON body */ } }
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'Could not reach the license server.' }
  }
}

interface LicenseRow {
  key: string; plan: string; role: string; status: string; expires_at: string
  hwid: string | null; discord_id: string | null; discord_username: string | null
  app_version: string | null; last_heartbeat: string | null
  cookies_total: number | null; cookies_healthy: number | null; cookies_expired: number | null
  cookies_last_check: string | null; created_at: string
}

// ── Activation (HWID-bound, server-validated) ────────────────────────────────

export async function supabaseActivate(key: string): Promise<ValidationResult & { role?: string; reachable?: boolean }> {
  const r = await rpc<{ valid: boolean; role?: string; expiresAt?: string; error?: string; discordUsername?: string }>(
    'rpc_activate', { p_key: key.trim().toUpperCase(), p_hwid: getHwid() }
  )
  // reachable:false means we couldn't get a definitive answer (network down,
  // 5xx, API error) — NOT that the key is bad. Callers must not revoke access
  // on this; only a successful response with valid:false is a real rejection.
  if (!r.ok) return { valid: false, error: r.error ?? 'Activation failed.', reachable: false }
  const d = r.data!
  if (!d.valid) return { valid: false, error: d.error ?? 'Invalid key.' }

  const expiry = d.expiresAt ? new Date(d.expiresAt) : null
  if (!expiry || isNaN(expiry.getTime())) return { valid: false, error: 'Invalid expiry returned.' }
  const role = d.role ?? 'standard'
  return { valid: true, expiresAt: expiry, type: role === 'staff' ? 'staff' : 'basic', role, discordUsername: d.discordUsername || undefined }
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────

export async function supabaseHeartbeat(
  key: string, appVersion: string,
  cookies: { total: number; healthy: number; expired: number },
): Promise<void> {
  if (!supabaseEnabled()) return
  await rpc('rpc_heartbeat', {
    p_key: key.toUpperCase(), p_hwid: getHwid(), p_version: appVersion,
    p_total: cookies.total, p_healthy: cookies.healthy, p_expired: cookies.expired,
  })
}

// ── Staff: issue + list keys ─────────────────────────────────────────────────

export async function supabaseIssueKey(
  staffKey: string,
  months: number, role: string, discordId?: string, discordUsername?: string,
): Promise<KeyRecord | null> {
  const r = await rpc<{ key?: string; expiresAt?: string; role?: string; months?: number; error?: string }>(
    'rpc_issue_key',
    { p_staff_key: staffKey, p_months: months, p_role: role, p_discord_id: discordId ?? '', p_discord_username: discordUsername ?? '' }
  )
  if (!r.ok || !r.data?.key) return null
  const d = r.data
  return {
    key: d.key!, type: 'basic', issuedAt: new Date().toISOString(),
    expiresAt: d.expiresAt ?? '', months: d.months ?? months, revoked: false,
    role: d.role, discordId, discordUsername,
  }
}

export async function supabaseListKeys(staffKey: string): Promise<KeyRecord[]> {
  const r = await rpc<LicenseRow[]>('rpc_list_keys', { p_staff_key: staffKey })
  if (!r.ok || !Array.isArray(r.data)) return []
  return r.data.map(row => {
    const created = row.created_at ?? new Date().toISOString()
    const months = Math.max(1, Math.round((new Date(row.expires_at).getTime() - new Date(created).getTime()) / (30 * 86400000)))
    return {
      key: row.key, type: 'basic' as const, issuedAt: created, expiresAt: row.expires_at,
      months, revoked: row.status === 'revoked', role: row.role,
      discordUsername: row.discord_username ?? undefined, discordId: row.discord_id ?? undefined,
    }
  })
}

// ── Staff: user lookup ────────────────────────────────────────────────────────

export async function supabaseLookupUser(staffKey: string, query: string): Promise<UserLookupResult> {
  const r = await rpc<LicenseRow[]>('rpc_lookup_user', { p_staff_key: staffKey, p_query: query.trim() })
  if (!r.ok || !Array.isArray(r.data) || !r.data[0]) return { found: false, session: 'offline', role: 'standard' }
  const row = r.data[0]

  const now = Date.now()
  const expired = new Date(row.expires_at) < new Date()
  const status = row.status === 'revoked' ? 'revoked' : expired ? 'expired' : 'active'
  const hbMs = row.last_heartbeat ? new Date(row.last_heartbeat).getTime() : 0
  const session = hbMs && (now - hbMs) < 2 * 60 * 1000 ? 'live' : hbMs ? 'last-known' : 'offline'

  return {
    found: true,
    discordId: row.discord_id ?? undefined,
    discordUsername: row.discord_username ?? undefined,
    role: row.role || 'standard',
    license: { key: row.key, plan: row.plan || row.role || 'basic', expiresAt: row.expires_at, status },
    hardware: { hwid: row.hwid, lastHeartbeat: row.last_heartbeat, appVersion: row.app_version },
    cookies: {
      total: row.cookies_total ?? 0, healthy: row.cookies_healthy ?? 0,
      expired: row.cookies_expired ?? 0, lastCheck: row.cookies_last_check,
    },
    session,
  }
}

// ── Staff: management actions ─────────────────────────────────────────────────

export const supabaseResetHwid = async (staffKey: string, key: string) =>
  (await rpc('rpc_reset_hwid', { p_staff_key: staffKey, p_key: key })).ok
export const supabaseRevoke = async (staffKey: string, key: string) =>
  (await rpc('rpc_set_status', { p_staff_key: staffKey, p_key: key, p_status: 'revoked' })).ok
export const supabaseEnable = async (staffKey: string, key: string) =>
  (await rpc('rpc_set_status', { p_staff_key: staffKey, p_key: key, p_status: 'active' })).ok
export const supabaseSetRole = async (staffKey: string, key: string, role: string) =>
  (await rpc('rpc_set_role', { p_staff_key: staffKey, p_key: key, p_role: role })).ok
export const supabaseExtend = async (staffKey: string, key: string, days: number) =>
  (await rpc('rpc_extend', { p_staff_key: staffKey, p_key: key, p_days: days })).ok

// ── Updates feed (shared via the DB) ──────────────────────────────────────────

interface UpdateRow {
  id: string; title: string; body: string; version: string | null
  category: string; author: string; posted_at: string
}

function rowToUpdate(r: UpdateRow): UpdatePost {
  return {
    id: r.id, title: r.title, body: r.body,
    version: r.version ?? undefined,
    category: (r.category as UpdateCategory) ?? 'announcement',
    author: r.author, postedAt: r.posted_at,
  }
}

export async function supabaseGetUpdates(): Promise<UpdatePost[]> {
  const r = await rpc<UpdateRow[]>('rpc_get_updates', {})
  if (!r.ok || !Array.isArray(r.data)) return []
  return r.data.map(rowToUpdate)
}

export async function supabasePostUpdate(
  staffKey: string,
  payload: { title: string; body: string; version?: string; category: UpdateCategory },
): Promise<UpdatePost | null> {
  const r = await rpc<UpdateRow>('rpc_post_update', {
    p_staff_key: staffKey, p_title: payload.title, p_body: payload.body,
    p_version: payload.version ?? '', p_category: payload.category,
  })
  if (!r.ok || !r.data) return null
  return rowToUpdate(r.data)
}

export async function supabaseDeleteUpdate(staffKey: string, id: string): Promise<boolean> {
  return (await rpc('rpc_delete_update', { p_staff_key: staffKey, p_id: id })).ok
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export async function supabaseRecordLaunch(key: string, sessionAlts: number): Promise<void> {
  if (!supabaseEnabled()) return
  await rpc('rpc_record_launch', { p_key: key.toUpperCase(), p_session_alts: sessionAlts })
}

export async function supabaseLeaderboard(metric: LeaderboardMetric): Promise<LeaderboardEntry[]> {
  const r = await rpc<LeaderboardEntry[]>('rpc_leaderboard', { p_metric: metric })
  if (!r.ok || !Array.isArray(r.data)) return []
  return r.data
}

// ── Remote control (Discord bot → this worker) ────────────────────────────────

export interface RemoteCommand { id: string; type: string; payload: Record<string, unknown> }

export async function supabasePollCommands(key: string): Promise<RemoteCommand[]> {
  const r = await rpc<Array<{ id: string; type: string; payload: Record<string, unknown> }>>('rpc_poll_commands', { p_key: key })
  if (!r.ok || !Array.isArray(r.data)) return []
  return r.data.map(c => ({ id: c.id, type: c.type, payload: c.payload ?? {} }))
}

export async function supabaseAckCommand(key: string, id: string, status: string, result: string): Promise<void> {
  await rpc('rpc_ack_command', { p_key: key, p_id: id, p_status: status, p_result: result })
}

// ── Owner kill-switch ─────────────────────────────────────────────────────────

// "Is the app allowed to run?" Fails OPEN: if we can't reach the server we return
// killed:false so a network blip / outage never disables everyone's app. Only an
// explicit server killed:true locks the program.
export async function supabaseAppStatus(): Promise<{ killed: boolean }> {
  const r = await rpc<{ killed?: boolean }>('rpc_app_status', {})
  if (!r.ok || !r.data) return { killed: false }
  return { killed: !!r.data.killed }
}

// Owner-only toggle. Verified server-side against owner_secret (never stored here).
export async function supabaseSetKill(ownerSecret: string, killed: boolean): Promise<{ ok: boolean; killed?: boolean; error?: string }> {
  const r = await rpc<{ ok: boolean; killed?: boolean; error?: string }>('rpc_set_kill', { p_owner_secret: ownerSecret, p_killed: killed })
  if (!r.ok) return { ok: false, error: r.error ?? 'Could not reach the server.' }
  return r.data ?? { ok: false, error: 'No response.' }
}

// ── Update channel (in-app "new version available" notice) ─────────────────────

// Public: the latest published version + its download URL. Everyone reads this on
// launch and compares it to their own app.getVersion(). Empty when none set.
export async function supabaseLatestVersion(): Promise<{ version?: string; url?: string }> {
  const r = await rpc<{ version?: string; url?: string }>('rpc_latest_version', {})
  if (!r.ok || !r.data) return {}
  return { version: r.data.version || undefined, url: r.data.url || undefined }
}

// Owner-only: publish a new version + download link (verified against owner_secret).
export async function supabaseSetVersion(ownerSecret: string, version: string, url: string): Promise<{ ok: boolean; version?: string; url?: string; error?: string }> {
  const r = await rpc<{ ok: boolean; version?: string; url?: string; error?: string }>('rpc_set_version', { p_owner_secret: ownerSecret, p_version: version, p_url: url })
  if (!r.ok) return { ok: false, error: r.error ?? 'Could not reach the server.' }
  return r.data ?? { ok: false, error: 'No response.' }
}

export { supabaseEnabled }
