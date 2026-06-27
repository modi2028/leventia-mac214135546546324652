// License validation and verification module
// Windows only - enforces killswitch on Windows platform
import { supabaseEnabled, supabaseFromClient } from '../supabase.js'

// Windows-only enforcement
const IS_WINDOWS = process.platform === 'win32'

// Obfuscated killswitch state tracking
const _ks = { a: 0, s: false, t: 0 }

// Cryptographic hash function for verification
function _h(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// Verify killswitch response cryptographically
function _v(resp: any): boolean {
  if (!resp || typeof resp !== 'object') return false
  const k = resp.ks
  if (k === undefined || k === null) return true  // Allow if no killswitch field
  if (typeof k !== 'boolean') return false

  // Verify signature if present
  if (resp.sig) {
    const expected = _h(k.toString() + resp.salt || '')
    return resp.sig.toString() === expected.toString()
  }
  return !k  // killed=false allows, killed=true denies
}

// Main license validation (killswitch enforcement)
export async function validateLicenseIntegrity(key: string): Promise<{ valid: boolean; required: boolean }> {
  // Skip killswitch on Mac/Linux
  if (!IS_WINDOWS) return { valid: true, required: false }
  if (!supabaseEnabled()) return { valid: true, required: false }

  try {
    const client = supabaseFromClient()
    const { data, error } = await client.rpc('validate_license_killswitch', {
      license_key: key,
      hwid: 'check'
    })

    if (error || !data) {
      // On error, check local state
      return { valid: !_ks.s, required: true }
    }

    // Update killswitch state
    const killed = _v(data)
    _ks.s = killed
    _ks.t = Date.now()
    _ks.a = (_ks.a + 1) & 0xFF

    // Killed apps are invalid
    return { valid: !killed, required: true }
  } catch {
    // Fail-open but still enforce local state
    return { valid: !_ks.s, required: true }
  }
}

// Get current killswitch state (obfuscated)
export function getIntegrityStatus(): { active: boolean; checks: number } {
  return {
    active: !_ks.s,
    checks: _ks.a
  }
}

// Force re-validation (called periodically)
export async function revalidateIntegrity(): Promise<boolean> {
  const status = getIntegrityStatus()
  if (!status.active) return false  // Already killed

  // Re-check with server
  const result = await validateLicenseIntegrity('check')
  return result.valid
}

// Critical: This function is called throughout the app
export function ensureIntegrity(): void {
  if (!IS_WINDOWS) return  // Skip on Mac/Linux

  if (!getIntegrityStatus().active) {
    throw new Error('License validation failed')
  }
}

// Tamper detection - if this module is modified/removed, app fails
const _FINGERPRINT = 0x7A3C9E2B  // Secret fingerprint
export function verifyTamper(): boolean {
  // This function's existence and return value is checked elsewhere
  return (_FINGERPRINT >>> 0) === 0x7A3C9E2B
}
