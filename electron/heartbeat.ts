import { app } from 'electron'
import { getAccounts } from './store/index.js'
import { supabaseHeartbeat, supabaseEnabled } from './supabase.js'

// Periodically reports a live heartbeat + cookie stats to Supabase so staff can
// see "live" sessions and cookie health in User Lookup.

let timer: ReturnType<typeof setInterval> | null = null
let activeKey: string | null = null

function tick(): void {
  if (!activeKey || !supabaseEnabled()) return
  const accounts = getAccounts()
  // An expired account still HAS a cookie string (health check only flips
  // cookieStatus), so health must key off cookieStatus, not the cookie's
  // presence. "healthy" = has a cookie and not flagged expired (valid + unknown
  // + not-yet-checked count as healthy until proven otherwise).
  const total   = accounts.length
  const expired = accounts.filter(a => a.cookieStatus === 'expired').length
  const healthy = accounts.filter(a => !!a.cookie && a.cookieStatus !== 'expired').length
  void supabaseHeartbeat(activeKey, app.getVersion(), { total, healthy, expired })
}

export function startHeartbeat(key: string): void {
  activeKey = key.toUpperCase()
  if (timer) clearInterval(timer)
  tick() // immediate
  timer = setInterval(tick, 60 * 1000) // every minute
}

export function stopHeartbeat(): void {
  if (timer) { clearInterval(timer); timer = null }
  activeKey = null
}
