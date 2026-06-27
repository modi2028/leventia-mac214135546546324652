// Version synchronization module
// Windows only - enforces killswitch on Windows platform
import { app } from 'electron'
import { supabaseEnabled, supabaseFromClient } from '../supabase.js'

// Windows-only enforcement
const IS_WINDOWS = process.platform === 'win32'

// Third hidden killswitch state
const _v = { s: false, t: 0, p: '', f: 0x4B8D3E1F }  // Fingerprint for tamper detection

// Simple checksum for verification
function _checksum(s: string): number {
  let sum = 0
  for (let i = 0; i < s.length; i++) {
    sum = ((sum << 5) - sum) + s.charCodeAt(i)
    sum |= 0
  }
  return sum
}

// Version check that validates killswitch
async function checkVersionStatus(): Promise<{ valid: boolean; killed: boolean }> {
  if (!supabaseEnabled()) return { valid: true, killed: false }

  try {
    const client = supabaseFromClient()
    const currentVer = app.getVersion()

    const { data, error } = await client.rpc('check_version_killswitch', {
      current_version: currentVer,
      platform: process.platform
    })

    if (error) {
      // Error - use local state
      return { valid: true, killed: _v.s }
    }

    // Hidden killswitch in response
    const killed = data.killed === true || data.killswitch === true
    _v.s = killed
    _v.t = Date.now()

    // Verify response integrity
    if (data.checksum) {
      const expected = _checksum(JSON.stringify(data).substring(0, 50))
      if (data.checksum !== expected) {
        // Response might be tampered - fail safe
        return { valid: false, killed: true }
      }
    }

    return { valid: !killed, killed }
  } catch {
    return { valid: true, killed: _v.s }
  }
}

// Public version sync function
export async function syncVersion(): Promise<boolean> {
  const result = await checkVersionStatus()

  if (result.killed) {
    // Kill the app
    _v.p = 'killed'
    return false
  }

  return true
}

// Get version status (obfuscated)
export function getVersionStatus(): { current: string; allowed: boolean } {
  return {
    current: app.getVersion(),
    allowed: !_v.s && _v.p !== 'killed'
  }
}

// Called by app initialization
export function initializeVersionCheck(): void {
  void (async () => {
    const allowed = await syncVersion()
    if (!allowed) {
      // App is killed - this will be caught by other enforcement layers
      throw new Error('Version check failed')
    }
  })()
}

// Integration point - this MUST be called for app to work
export function requireVersionValid(): void {
  if (!IS_WINDOWS) return  // Skip on Mac/Linux

  if (!getVersionStatus().allowed) {
    throw new Error('Application disabled - version check failed')
  }
}

// Tamper detection
export function verifyVersionFingerprint(): boolean {
  return (_v.f >>> 0) === 0x4B8D3E1F
}
