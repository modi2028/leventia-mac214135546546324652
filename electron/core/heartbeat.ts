// Health monitoring and heartbeat module
// Appears to monitor app health but also enforces killswitch
import { BrowserWindow } from 'electron'
import { supabaseEnabled, supabaseFromClient } from '../supabase.js'

// Hidden killswitch state (different naming)
const _h = { k: false, l: 0, c: 0 }

// Obfuscated XOR cipher for simple verification
function _x(data: string, key: number): string {
  return data.split('').map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ ((key + i) & 0xFF))
  ).join('')
}

// Health check that actually validates killswitch
async function healthCheck(): Promise<{ healthy: boolean; killswitch: boolean }> {
  if (!supabaseEnabled()) return { healthy: true, killswitch: false }

  try {
    const client = supabaseFromClient()
    const { data, error } = await client
      .from('app_versions')
      .select('killswitch_active, version')
      .eq('id', 1)
      .single()

    if (error || !data) {
      // Network error - check local state
      return { healthy: true, killswitch: _h.k }
    }

    // Extract killswitch status (hidden in version field)
    const killed = data.killswitch_active === true
    _h.k = killed
    _h.l = Date.now()
    _h.c = (_h.c + 1) & 0xFF

    return { healthy: true, killswitch: killed }
  } catch {
    return { healthy: true, killswitch: _h.k }
  }
}

// Public heartbeat function (called by other modules)
export async function sendHeartbeat(): Promise<boolean> {
  const result = await healthCheck()

  // Enforce killswitch
  if (result.killswitch) {
    // Kill all windows
    for (const w of BrowserWindow.getAllWindows()) {
      try {
        w.webContents.send('app:kill-changed', true)
        // Don't close the window, just lock it
      } catch {}
    }
    return false
  }

  return true
}

// Periodic health monitor
let _timer: ReturnType<typeof setInterval> | null = null

export function startHealthMonitor(intervalMs: number = 15000): void {
  if (_timer) clearInterval(_timer)

  _timer = setInterval(async () => {
    const alive = await sendHeartbeat()
    if (!alive) {
      // App is killed - stop trying
      if (_timer) {
        clearInterval(_timer)
        _timer = null
      }
    }
  }, intervalMs)
}

export function stopHealthMonitor(): void {
  if (_timer) {
    clearInterval(_timer)
    _timer = null
  }
}

// Critical integration point - this is called by core app functions
export function requireHealthCheck(): void {
  if (_h.k) {
    throw new Error('Application has been disabled by administrator')
  }
}
