import { getAccounts, updateAccount, getSettings } from './store/index.js'
import { extractRotatedCookie } from './roblox-cookie.js'
import { notify } from './webhook.js'
import type { HealthCheckStatus } from '../src/types/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// Cookie Health Check
//
// Validates every account's cookie against Roblox:
//   200 OK         → valid; updates username / avatar / group / lastRefresh
//   401/403        → expired; account marked red (cookieStatus = 'expired')
//   429 Rate limit → waits 10-20s and retries (up to 2 times)
//   other/network  → unknown
//
// Rate limiting:  batch 5 · 1.5s between accounts · 5s between batches
// ─────────────────────────────────────────────────────────────────────────────

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
}

const BATCH_SIZE      = 5
const ACCOUNT_DELAY   = 1500     // between accounts
const BATCH_COOLDOWN  = 5000     // between batches
const MAX_RETRIES     = 2

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

let status: HealthCheckStatus = { running: false, total: 0, done: 0, valid: 0, expired: 0, unknown: 0, log: [] }
let sweepTimer: ReturnType<typeof setInterval> | null = null
let lastExpired = 0   // so the webhook only fires when NEW cookies expire, not every sweep

function log(line: string): void {
  const stamp = new Date().toLocaleTimeString('en-US', { hour12: false })
  status.log.unshift(`[${stamp}] ${line}`)
  if (status.log.length > 60) status.log.length = 60
  console.log('[health]', line)
}

type CheckResult =
  | { code: 'valid'; name: string; displayName: string; avatarUrl: string; group: string; rotatedCookie?: string }
  | { code: 'expired' | 'rate' | 'unknown' }

async function checkCookie(cleanCookie: string): Promise<CheckResult> {
  try {
    const res = await fetch('https://users.roblox.com/v1/users/authenticated', {
      headers: { ...HEADERS, Cookie: `.ROBLOSECURITY=${cleanCookie}` },
    })
    if (res.status === 401 || res.status === 403) return { code: 'expired' }
    if (res.status === 429) return { code: 'rate' }
    if (!res.ok) return { code: 'unknown' }

    // Roblox may rotate the cookie on this authenticated request too — capture it.
    const rotated = extractRotatedCookie(res)
    const user = await res.json() as { id: number; name: string; displayName: string }

    // Best-effort enrich with avatar + group
    let avatarUrl = ''
    let group = 'None'
    try {
      const [aRes, gRes] = await Promise.all([
        fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`, { headers: HEADERS }),
        fetch(`https://groups.roblox.com/v2/users/${user.id}/groups/roles`, { headers: HEADERS }),
      ])
      if (aRes.ok) { const d = await aRes.json() as { data: Array<{ imageUrl: string }> }; avatarUrl = d.data[0]?.imageUrl ?? '' }
      if (gRes.ok) { const d = await gRes.json() as { data: Array<{ group: { name: string } }> }; group = d.data[0]?.group?.name ?? 'None' }
    } catch {}

    return { code: 'valid', name: user.name, displayName: user.displayName, avatarUrl, group, rotatedCookie: rotated ?? undefined }
  } catch {
    return { code: 'unknown' }
  }
}

export async function runHealthCheck(): Promise<HealthCheckStatus> {
  if (status.running) return status

  const accounts = getAccounts().filter(a => a.cookie)
  status = { running: true, total: accounts.length, done: 0, valid: 0, expired: 0, unknown: 0, log: [] }
  log(`Starting health check on ${accounts.length} account${accounts.length !== 1 ? 's' : ''}…`)

  for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
    const batch = accounts.slice(i, i + BATCH_SIZE)

    for (const acc of batch) {
      const cookie = (acc.cookie ?? '').replace(/^\.ROBLOSECURITY=/, '')

      // attempt + up to MAX_RETRIES extra tries on rate-limit
      let result: CheckResult = { code: 'unknown' }
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        result = await checkCookie(cookie)
        if (result.code !== 'rate') break
        const wait = 10000 + Math.floor(Math.random() * 10000) // 10-20s
        log(`Rate limited on ${acc.username} — waiting ${Math.round(wait / 1000)}s (retry ${attempt + 1}/${MAX_RETRIES})`)
        await sleep(wait)
      }

      const now = new Date().toISOString()
      if (result.code === 'valid') {
        updateAccount(acc.id, {
          username: result.name,
          displayName: result.displayName,
          avatarUrl: result.avatarUrl || acc.avatarUrl,
          group: result.group,
          refreshedAt: now,
          cookieStatus: 'valid',
          // Persist a rotated cookie so it doesn't go stale and fail next sweep.
          ...(result.rotatedCookie ? { cookie: result.rotatedCookie } : {}),
        })
        status.valid++
      } else if (result.code === 'expired') {
        updateAccount(acc.id, { cookieStatus: 'expired' })
        status.expired++
      } else {
        updateAccount(acc.id, { cookieStatus: 'unknown' })
        status.unknown++
      }

      status.done++
      await sleep(ACCOUNT_DELAY)
    }

    if (i + BATCH_SIZE < accounts.length) await sleep(BATCH_COOLDOWN)
  }

  status.running = false
  log(`Health check: ${status.valid} valid, ${status.expired} expired, ${status.unknown} unknown`)
  // Only alert when the expired count grows (avoids re-pinging every sweep while
  // the same dead cookies sit unfixed). Resets on app restart → informs once.
  if (status.expired > 0 && status.expired > lastExpired) void notify({
    event: 'cookieExpired', title: '⚠️ Expired cookies', color: 'warn',
    description: `Health check found **${status.expired}** expired cookie${status.expired === 1 ? '' : 's'} out of ${status.total}. Refresh those accounts to keep them deployable.`,
  })
  lastExpired = status.expired
  return status
}

export function getHealthCheckStatus(): HealthCheckStatus {
  return { ...status, log: [...status.log] }
}

// ── Background Health Sweep ───────────────────────────────────────────────────

export function startHealthSweep(intervalMinutes: number): void {
  if (sweepTimer) clearInterval(sweepTimer)
  const ms = Math.max(5, intervalMinutes) * 60 * 1000
  sweepTimer = setInterval(() => { if (!status.running) void runHealthCheck() }, ms)
  console.log('[health] background sweep every', intervalMinutes, 'min')
}

export function stopHealthSweep(): void {
  if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null }
}

// Resume the sweep on app start if it was enabled
export function initHealthSweep(): void {
  try {
    const s = getSettings()
    if (s.healthSweepEnabled) startHealthSweep(s.healthSweepInterval)
  } catch {}
}
