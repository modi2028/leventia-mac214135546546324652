import crypto from 'node:crypto'
import type { ValidationResult, KeyRecord } from '../src/types/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// Key validation — FORMAT + EXPIRY + local-DB membership ONLY.
//
// The HMAC signing secrets used to live in this file. They have been removed:
// the same staff secret was also seeded server-side (app_secrets.staff_secret),
// and rpc_activate grants master "staff" access to ANY key that HMAC-verifies
// against it — so shipping the secret in the client meant anyone could extract
// it and forge a master staff key. The secret now lives ONLY in the database;
// key authenticity is verified server-side by rpc_activate (see
// supabase-schema-secure.sql).
//
// IMPORTANT: this local validator is a NON-AUTHORITATIVE offline fallback, used
// only when Supabase is not configured. Without the signing secret it cannot
// prove a key is genuine — it only rejects malformed/expired keys and (for basic
// keys) checks the locally-issued key database. When Supabase IS configured it
// is the sole authority and this path is never reached. Never reintroduce a
// signing secret here.
// ─────────────────────────────────────────────────────────────────────────────

// ── Key formats ───────────────────────────────────────────────────────────────
// Staff   : LVNT-STAFF-XXXXXXXX-YYYYMMDD
// Basic   : LVNT-BASIC-XXXXXX-XXXXXX-YYYYMMDD
// Premium : LVNT-PREMIUM-XXXXXX-XXXXXX-YYYYMMDD (or legacy LVNT-PREM-…); role gives the tier
const STAFF_RE  = /^LVNT-STAFF-([A-F0-9]{8})-(\d{8})$/i
const BASIC_RE  = /^LVNT-(?:BASIC|PREMIUM|PREM)-([A-F0-9]+)-([A-F0-9]+)-(\d{8})$/i
const LEGACY_RE = /^(?:LVNT|RDASH)-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-(\d{8})$/i

const DEMO_KEYS = new Set(['RDASH-DEMO-0001-TEST-20271231', 'LVNT-DEMO-0001-TEST-20271231'])

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseExpiry(d: string): Date | null {
  if (!/^\d{8}$/.test(d)) return null
  const date = new Date(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8), 23, 59, 59)
  return isNaN(date.getTime()) ? null : date
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Offline/local-only key validation (no Supabase). Validates FORMAT + EXPIRY,
 * and for basic/legacy keys requires the key to exist in the local key database.
 * Authenticity is NOT proven here — when Supabase is configured, rpc_activate
 * (server-side, secret never leaves the DB) is the sole authority.
 */
export async function validateKey(
  key: string,
  keyDatabase: KeyRecord[],
): Promise<ValidationResult> {
  const norm = key.trim().toUpperCase()

  // ── Staff key (format + expiry only; server is the real authority) ──────────
  const staffM = STAFF_RE.exec(norm)
  if (staffM) {
    const expiry = parseExpiry(staffM[2])
    if (!expiry) return { valid: false, error: 'Invalid expiry date in key.' }
    if (expiry < new Date()) return { valid: false, error: 'This staff key has expired.' }
    return { valid: true, expiresAt: expiry, type: 'staff' }
  }

  // ── Basic key (format + expiry + local DB membership) ───────────────────────
  const basicM = BASIC_RE.exec(norm)
  if (basicM) {
    const expiry = parseExpiry(basicM[3])
    if (!expiry) return { valid: false, error: 'Invalid expiry date in key.' }
    if (expiry < new Date()) return { valid: false, error: 'This key has expired.' }

    const record = keyDatabase.find(r => r.key === norm)
    if (!record) return { valid: false, error: 'Key not found. Contact staff to obtain a valid key.' }
    if (record.revoked) return { valid: false, error: 'This key has been revoked.' }
    return { valid: true, expiresAt: expiry, type: 'basic' }
  }

  // ── Legacy LVNT / RDASH keys + demo key (backward compat) ───────────────────
  const legM = LEGACY_RE.exec(norm)
  if (legM) {
    const expiry = parseExpiry(legM[1])
    if (!expiry) return { valid: false, error: 'Invalid expiry date in key.' }
    if (expiry < new Date()) return { valid: false, error: 'This key has expired.' }
    if (DEMO_KEYS.has(norm)) return { valid: true, expiresAt: expiry, type: 'basic' }
    const record = keyDatabase.find(r => r.key === norm)
    if (record && !record.revoked) return { valid: true, expiresAt: expiry, type: 'basic' }
    return { valid: false, error: 'Key not found. Contact staff to obtain a valid key.' }
  }

  return { valid: false, error: 'Unrecognised key format. Expected LVNT-STAFF-…, LVNT-PREMIUM-… or LVNT-BASIC-…' }
}

/**
 * Generate a LOCAL-ONLY basic key (used only in the no-Supabase fallback for
 * store:issue-key). It carries no server-verifiable signature — it is just a
 * unique, format-shaped id stored in the local key database. Real, signed keys
 * are minted server-side by rpc_issue_key (the secret never leaves the DB).
 */
export function generateLocalKey(months: 1 | 3): string {
  const expiry = new Date()
  expiry.setMonth(expiry.getMonth() + months)
  const dateStr = [
    expiry.getFullYear(),
    String(expiry.getMonth() + 1).padStart(2, '0'),
    String(expiry.getDate()).padStart(2, '0'),
  ].join('')

  const uid  = crypto.randomBytes(3).toString('hex').toUpperCase() // 6 hex chars
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase() // 6 hex chars (random, not an HMAC)
  return `LVNT-BASIC-${uid}-${rand}-${dateStr}`
}
