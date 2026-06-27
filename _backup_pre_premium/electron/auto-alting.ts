import { getAccounts } from './store/index.js'
import { getServerStatus } from './erlc-api.js'
import { deployErlc, removeRunning, getRunningIds } from './ipc/roblox.js'
import { notify } from './webhook.js'
import type { AutoAltConfig, AutoAltStatus } from '../src/types/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// Auto Alting engine
//
// Every check interval:
//   1. Query PRC for player count + player list
//   2. Sync: PRC player list is the source of truth for which alts are in-server
//   3. Deploy if below threshold and accounts are available
//   4. Remove if at capacity to make room for real players
// ─────────────────────────────────────────────────────────────────────────────

const ERLC_PLACE_ID = '2534724415'

let timer: ReturnType<typeof setInterval> | null = null
let busy = false
let cfg: AutoAltConfig | null = null
let wasFull = false   // edge-detect for the "server busy" webhook (avoid spamming every tick)

// account IDs we have deployed (and believe are in / joining the server)
const deployedIds = new Set<string>()

// Anti-cascade: when a deployed alt DROPS without ever appearing in-server (e.g.
// multi-instance not working, so each launch closes), cool it down before we try
// it again — otherwise the engine re-deploys the same accounts every tick (~30s)
// forever, which is the "it keeps launching more / unselected alts" spam.
const failCooldown = new Map<string, number>()   // accountId → don't redeploy until ts
const FAIL_COOLDOWN_MS = 3 * 60_000

let status: AutoAltStatus = {
  running: false, players: 0, maxPlayers: 0, ourAlts: 0, available: 0, lastCheck: null, log: [],
}

function log(line: string): void {
  const stamp = new Date().toLocaleTimeString('en-US', { hour12: false })
  status.log.unshift(`[${stamp}] ${line}`)
  if (status.log.length > 60) status.log.length = 60
  console.log('[auto-alt]', line)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cookieAccounts() {
  // If the user picked specific alts for auto-alting, limit to those; otherwise use all.
  const ids = cfg?.accountIds
  const sel = ids && ids.length ? new Set(ids) : null
  return getAccounts().filter(a => !!a.cookie && (!sel || sel.has(a.id)))
}

// Accounts we deployed that are still launched (process alive)
function ourRunningDeployed(): string[] {
  const running = new Set(getRunningIds())
  return [...deployedIds].filter(id => running.has(id))
}

// Accounts available to deploy: have a cookie and aren't already deployed.
// Health-aware: accounts a health check flagged as 'expired' (cookie 401/403) go
// LAST, so deploys use working cookies first and don't waste launches/time on dead
// accounts. Expired ones are still a fallback if nothing healthy is left.
function availableAccounts() {
  const now = Date.now()
  return cookieAccounts()
    .filter(a => !deployedIds.has(a.id))
    .filter(a => { const until = failCooldown.get(a.id); return !until || now > until })   // skip recently-dropped
    .sort((a, b) => (a.cookieStatus === 'expired' ? 1 : 0) - (b.cookieStatus === 'expired' ? 1 : 0))
}

async function deployWave(count: number): Promise<number> {
  const c = cfg
  if (!c) return 0
  const avail = availableAccounts()
  const toDeploy = avail.slice(0, Math.max(0, count))
  if (toDeploy.length === 0) { log('No available accounts to deploy.'); return 0 }

  // Space launches with a safe floor + jitter. Joining many alts in a tight,
  // uniform burst from one IP is what makes Roblox's game-join service reject
  // them with "Error 529" (overloaded/rate-limited). We honour the user's
  // launchDelay but never go below ~6s, and add randomised jitter so the joins
  // don't arrive in a detectable rhythm.
  const baseMs = Math.max(6, c.launchDelay ?? 6) * 1000
  const spacing = () => baseMs + Math.floor(Math.random() * 3500)   // +0–3.5s jitter
  log(`Deploying ${toDeploy.length} alt${toDeploy.length > 1 ? 's' : ''}…`)
  let done = 0
  for (let i = 0; i < toDeploy.length; i++) {
    const acc = toDeploy[i]
    deployedIds.add(acc.id)
    let res = await deployErlc(acc.cookie!, ERLC_PLACE_ID, c.serverCode, acc.id)
    // On failure (usually a 429), cool down longer before retrying — a rate limit
    // needs real time to clear, not an instant retry.
    if (!res.success) {
      log(`Rate-limited on ${acc.username} — waiting 15s then retrying…`)
      await new Promise(r => setTimeout(r, 15000))
      res = await deployErlc(acc.cookie!, ERLC_PLACE_ID, c.serverCode, acc.id)
    }
    if (res.success) { done++; log(`✓ Launched ${acc.username} (${done}/${toDeploy.length})`) }
    else { deployedIds.delete(acc.id); log(`✗ Failed ${acc.username}: ${res.error ?? 'error'}`) }
    // Space launches to dodge join rate limits (skip the wait after the last one)
    if (i < toDeploy.length - 1) await new Promise(r => setTimeout(r, spacing()))
  }
  log(`Done — launched ${done}/${toDeploy.length} alt${toDeploy.length > 1 ? 's' : ''}.`)
  if (done > 0) void notify({
    event: 'deploy', title: '🚀 Alts deployed', color: 'success',
    description: `Launched **${done}** alt${done === 1 ? '' : 's'} into \`${c.serverCode}\`.`,
  })
  return done
}

async function removeWave(count: number): Promise<void> {
  const running = ourRunningDeployed()
  const toRemove = running.slice(0, Math.max(0, count))
  if (toRemove.length === 0) { log('No deployed alts to remove.'); return }

  log(`Removing ${toRemove.length} alt${toRemove.length > 1 ? 's' : ''} to free slots…`)
  for (const id of toRemove) {
    removeRunning(id)
    deployedIds.delete(id)
  }
  log(`Removed ${toRemove.length} alts.`)
  void notify({
    event: 'remove', title: '➖ Alts removed', color: 'warn',
    description: `Removed **${toRemove.length}** alt${toRemove.length === 1 ? '' : 's'} to free slots for real players.`,
  })
}

// ── Main tick ─────────────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  if (!cfg || busy) return
  busy = true
  try {
    const srv = await getServerStatus(cfg.serverKey)
    status.lastCheck = new Date().toISOString()

    if (!srv.ok) {
      log(`PRC query failed: ${srv.error ?? 'unknown error'}`)
      return
    }

    status.players = srv.players
    status.maxPlayers = srv.maxPlayers

    // "Server busy" alert on the rising edge only (real players hit the remove
    // threshold) so we post once per fill-up, not every poll.
    const full = srv.players >= cfg.removeAt
    if (full && !wasFull) void notify({
      event: 'serverFull', title: '🔴 Server filling up', color: 'danger',
      description: `\`${srv.name ?? cfg.serverCode}\` reached **${srv.players}/${srv.maxPlayers}** players.`,
    })
    wasFull = full

    // Sync against PRC (the source of truth). For each deployed alt:
    //  • in the PRC list           → it's in the server (counted in srv.players)
    //  • running but not in list    → still joining (pending — counts toward projection)
    //  • not running & not in list  → dead/kicked → drop so it can redeploy
    const running = new Set(getRunningIds())
    const accounts = getAccounts()
    let pending = 0
    for (const id of [...deployedIds]) {
      const acc = accounts.find(a => a.id === id)
      const inServer = acc ? srv.names.includes(acc.username.toLowerCase()) : false
      if (inServer) continue
      if (running.has(id)) pending++          // launched, still loading in
      else {
        deployedIds.delete(id)                // gone — free it up
        failCooldown.set(id, Date.now() + FAIL_COOLDOWN_MS)   // …but cool it down so we don't spam-redeploy a client that won't stay
      }
    }

    const ourAlts = ourRunningDeployed().length
    const available = availableAccounts().length
    status.ourAlts = ourAlts
    status.available = available

    // Projected count once in-flight alts finish joining — prevents over-deploying
    const projected = srv.players + pending

    log(`Players: ${srv.players}/${srv.maxPlayers} | Our alts: ${ourAlts} | Available: ${available}`)

    // Decide action
    if (projected < cfg.deployBelow && available > 0) {
      // Only deploy the actual gap (capped by deployCount + availability)
      const gap = cfg.deployBelow - projected
      const need = Math.min(cfg.deployCount, gap, available)
      if (need > 0) await deployWave(need)
    } else if (srv.players >= cfg.removeAt && ourAlts > 0) {
      await removeWave(cfg.removeCount)
    }
  } finally {
    busy = false
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function startAutoAlt(config: AutoAltConfig): { ok: boolean; error?: string } {
  if (!config.serverKey.trim()) return { ok: false, error: 'Server key is required.' }
  if (!config.serverCode.trim()) return { ok: false, error: 'Server code is required.' }

  cfg = { ...config }
  if (timer) clearInterval(timer)
  wasFull = false
  status.running = true
  log('Automation started.')
  void tick()
  timer = setInterval(() => void tick(), Math.max(10, cfg.interval) * 1000)
  return { ok: true }
}

export function stopAutoAlt(): void {
  if (timer) { clearInterval(timer); timer = null }
  status.running = false
  log('Automation stopped.')
}

export function getAutoAltStatus(): AutoAltStatus {
  return { ...status, log: [...status.log] }
}

export async function deployNow(config: AutoAltConfig): Promise<number> {
  cfg = { ...config }
  if (!cfg.serverCode.trim()) { log('Set a server code first.'); return 0 }
  return deployWave(config.deployCount)
}

export async function removeNow(config: AutoAltConfig): Promise<void> {
  cfg = cfg ?? { ...config }
  await removeWave(config.removeCount)
}
