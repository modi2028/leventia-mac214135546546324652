import { ipcMain, shell, BrowserWindow, dialog, session, app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn, execFileSync } from 'node:child_process'
import { unlockRobloxCookies, ensureRobloxMutex, closeRobloxSingleton } from '../multi-instance.js'
import { applyPerformance, clientSettingsForExe } from '../low-gpu.js'
import { setMuteRoblox } from '../mute-roblox.js'
import { getLicense, getSettings, updateAccount, getAccounts } from '../store/index.js'
import { supabaseEnabled, supabaseRecordLaunch } from '../supabase.js'
import { extractRotatedCookie } from '../roblox-cookie.js'
import { watchForRejoin, unwatchRejoin } from '../rejoin-watch.js'
import { isAppKilled } from '../kill-state.js'
import type { RobloxUserResponse, RobloxPresenceResponse } from '../../src/types/index.js'

// ── Roblox client discovery ─────────────────────────────────────────────────

type RobloxLauncher = 'roblox' | 'bloxstrap' | 'fishstrap'

// AUTHORITATIVE current player: the exact RobloxPlayerBeta.exe that the
// `roblox-player://` protocol launches — i.e. what normal Roblox uses when you
// click a game (the path that actually works). Reading this from the registry
// avoids the trap where Roblox has TWO version folders (e.g. a freshly-staged
// update that isn't active yet, or a Studio folder): guessing by file timestamps
// can pick the wrong/inactive one, which makes the launched client think it must
// update → the bootstrapper ("installer") runs and the alt opens LOGGED OUT.
function playerFromProtocol(): string | null {
  try {
    const out = execFileSync(
      'reg',
      ['query', 'HKCU\\Software\\Classes\\roblox-player\\shell\\open\\command', '/ve'],
      { encoding: 'utf8', windowsHide: true },
    )
    const m = out.match(/[A-Za-z]:\\[^"\r\n]*?RobloxPlayerBeta\.exe/i)
    if (m && fs.existsSync(m[0])) return m[0]
  } catch { /* protocol not registered (e.g. Bloxstrap/Fishstrap) → fall back */ }
  return null
}

// Find the RobloxPlayerBeta.exe to launch. Prefer the protocol-registered current
// player (authoritative); otherwise fall back to scanning version folders and
// picking the most-recently-installed one (covers Bloxstrap/Fishstrap setups).
function findRobloxPlayer(): { type: RobloxLauncher; path: string } | null {
  const fromReg = playerFromProtocol()
  if (fromReg) return { type: 'roblox', path: fromReg }

  const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local')
  const bases: Array<{ type: RobloxLauncher; dir: string }> = [
    { type: 'bloxstrap', dir: path.join(local, 'Bloxstrap', 'Versions') },
    { type: 'fishstrap', dir: path.join(local, 'Fishstrap', 'Versions') },
    { type: 'roblox',    dir: path.join(local, 'Roblox', 'Versions') },
    { type: 'roblox',    dir: path.join(local, 'Programs', 'Roblox', 'Versions') },
  ]

  const candidates: Array<{ type: RobloxLauncher; path: string; installed: number }> = []
  for (const base of bases) {
    try {
      for (const d of fs.readdirSync(base.dir)) {
        const dir = path.join(base.dir, d)
        const exePath = path.join(dir, 'RobloxPlayerBeta.exe')
        try {
          const exeStat = fs.statSync(exePath)   // throws → no player exe here, skip
          let installed: number
          try { const ds = fs.statSync(dir); installed = ds.birthtimeMs || ds.mtimeMs } catch { installed = exeStat.mtimeMs }
          candidates.push({ type: base.type, path: exePath, installed })
        } catch {}
      }
    } catch {}
  }

  if (!candidates.length) return null
  candidates.sort((a, b) => b.installed - a.installed)
  return { type: candidates[0].type, path: candidates[0].path }
}

// Wipe RobloxCookies.dat before/after each launch.
// Multiple instances sharing this file causes teleport auth to mix up (error 773).
async function wipeRobloxCookies(): Promise<void> {
  const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local')
  const cookiesPath = path.join(local, 'Roblox', 'LocalStorage', 'RobloxCookies.dat')
  try { fs.unlinkSync(cookiesPath) } catch {}
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Origin': 'https://www.roblox.com',
  'Referer': 'https://www.roblox.com/',
}

async function robloxFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: { ...HEADERS, ...(options.headers as Record<string, string> ?? {}) },
  })
}

async function getCsrfToken(cookie?: string): Promise<string> {
  const headers: Record<string, string> = {}
  if (cookie) headers['Cookie'] = `.ROBLOSECURITY=${cookie}`
  const res = await robloxFetch('https://auth.roblox.com/v2/login', {
    method: 'POST', body: '{}', headers,
  })
  return res.headers.get('x-csrf-token') ?? ''
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Account-age gate. Roblox heavily restricts/captchas/bans brand-new accounts, so
// the app refuses to launch anything under 3 days old. Returns true only when the
// age is KNOWN to be under the threshold (unknown age = allowed, fail-open).
const MIN_ACCOUNT_AGE_MS = 3 * 86_400_000
async function isAccountUnderAge(accountId: string): Promise<boolean> {
  const acc = getAccounts().find(a => a.id === accountId)
  if (!acc) return false
  let created = acc.created
  if (!created && acc.userId) {
    try {
      const res = await robloxFetch(`https://users.roblox.com/v1/users/${acc.userId}`)
      if (res.ok) { const d = await res.json() as { created?: string }; created = d.created; if (created) updateAccount(accountId, { created }) }
    } catch { /* couldn't fetch → leave unknown */ }
  }
  if (!created) return false
  const ms = Date.now() - new Date(created).getTime()
  return !isNaN(ms) && ms < MIN_ACCOUNT_AGE_MS
}

// Game auth ticket — exact headers Roblox's WinInet client sends.
// Step 1: POST → 403 + x-csrf-token. Step 2: POST with X-CSRF-TOKEN → ticket.
// Retries with backoff on 429 (Roblox rate-limits this endpoint when launching
// several alts in quick succession). Returns a specific error so callers can log it.
async function getGameAuthTicket(cleanCookie: string): Promise<{ ticket: string | null; rotatedCookie?: string; error?: string }> {
  const url = 'https://auth.roblox.com/v1/authentication-ticket/'
  // IMPORTANT: use the SAME cookie for both requests. The CSRF token returned by
  // the first (challenge) request is bound to that cookie's session — if we swap
  // to a rotated cookie for the second request, Roblox rejects the now-mismatched
  // CSRF and no ticket is issued (the account then fails to log in / opens the
  // installer instead of joining). We still CAPTURE any rotated cookie so it can
  // be persisted afterwards, but we never change the cookie used mid-flow.
  let rotated: string | null = null
  const buildHeaders = (csrf?: string): Record<string, string> => ({
    'User-Agent':       'Roblox/WinInet',
    'Referer':          'https://www.roblox.com/develop',
    'RBX-For-Gameauth': 'true',
    'Content-Type':     'application/json',
    'Cookie':           `.ROBLOSECURITY=${cleanCookie}`,
    ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}),
  })
  let lastErr = 'unknown error'
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res1 = await fetch(url, { method: 'POST', headers: buildHeaders(), body: '{}' })
      const r1 = extractRotatedCookie(res1); if (r1) rotated = r1
      if (res1.status === 429) { lastErr = 'Roblox rate limit (429)'; await sleep(2000 * (attempt + 1)); continue }
      const csrf = res1.headers.get('x-csrf-token')
      if (!csrf) { lastErr = `no CSRF token (HTTP ${res1.status})`; await sleep(800); continue }
      const res2 = await fetch(url, { method: 'POST', headers: buildHeaders(csrf), body: '{}' })
      const r2 = extractRotatedCookie(res2); if (r2) rotated = r2
      if (res2.status === 429) { lastErr = 'Roblox rate limit (429)'; await sleep(2000 * (attempt + 1)); continue }
      const ticket = res2.headers.get('rbx-authentication-ticket')
      if (ticket) return { ticket, rotatedCookie: rotated ?? undefined }
      lastErr = `no ticket (HTTP ${res2.status}) — cookie may be expired`
      await sleep(800)
    } catch (e) { lastErr = e instanceof Error ? e.message : 'network error'; await sleep(1000) }
  }
  return { ticket: null, rotatedCookie: rotated ?? undefined, error: lastErr }
}

// Tracks spawned Roblox processes by account ID so we can disconnect them later.
const runningProcesses = new Map<string, ReturnType<typeof spawn>>()

// multi.exe — holds the Roblox singleton mutex so multiple instances can start.
// Run once at app startup and keep it alive for the entire session.
let multiProcess: ReturnType<typeof spawn> | null = null

export async function runMultiExe(): Promise<boolean> {
  if (multiProcess && !multiProcess.killed) return true

  const candidates = [
    path.join((process as NodeJS.Process & { resourcesPath?: string }).resourcesPath ?? '', 'multi.exe'),
    path.join(path.dirname(process.execPath), 'multi.exe'),
    path.join(__dirname, 'multi.exe'),          // same dir as compiled main.js (dist-electron/)
    path.join(__dirname, '..', 'resources', 'multi.exe'),
    path.join(process.cwd(), 'multi.exe'),
    path.join(process.cwd(), 'resources', 'multi.exe'),
  ]

  const multiPath = candidates.find(p => { try { return fs.existsSync(p) } catch { return false } })
  if (!multiPath) { console.log('[Multi] multi.exe not found, tried:', candidates.join(', ')); return false }

  console.log('[Multi] Starting:', multiPath)
  const proc = spawn(multiPath, [], {
    cwd: path.dirname(multiPath),
    stdio: ['pipe', 'pipe', 'pipe'],
    // NOTE: keep windowsHide:false — this matches the known-good V2.2 build. Hiding
    // multi.exe's console was tried and correlated with the multi-instance "429
    // authentication failed" regression, so we leave it visible.
    windowsHide: false,
  })
  multiProcess = proc
  proc.stdout?.on('data', (d: Buffer) => console.log('[multi]', d.toString().trim()))
  proc.stderr?.on('data', (d: Buffer) => console.error('[multi]', d.toString().trim()))
  proc.on('exit', (code: number) => { console.log('[multi] exited', code); multiProcess = null })

  // Wait 3 s for mutexes to be acquired before any Roblox launch
  await new Promise(r => setTimeout(r, 3000))
  console.log('[Multi] PID', proc.pid, '— mutex held')
  return true
}

// ── ERLC launch core (shared by IPC handler + auto-alting engine) ────────────
//
// Launches are serialized via a queue so RobloxPlayerBeta instances spawn
// one-at-a-time (spaced), which keeps multi.exe's mutex handling reliable.

let launchQueue: Promise<unknown> = Promise.resolve()

// Append a timestamped line to %APPDATA%/<app>/launch-log.txt so launch failures
// are diagnosable after the fact (the detached Roblox process gives us nothing).
function launchLog(line: string): void {
  try {
    const p = path.join(app.getPath('userData'), 'launch-log.txt')
    fs.appendFileSync(p, `[${new Date().toISOString()}] ${line}\n`)
  } catch {}
  console.log('[Join]', line)
}

async function doJoin(
  cookie: string, placeId: string, linkCode: string | undefined, accountId: string,
): Promise<{ success: boolean; error?: string }> {
  // Master kill-switch: the owner can globally disable the program. When killed,
  // refuse EVERY launch here — the single choke-point all paths funnel through
  // (manual join, auto-alt, remote control, auto-rejoin) — so nothing slips past.
  if (isAppKilled()) {
    launchLog(`✖ ${accountId}: launch blocked — program disabled by administrator`)
    return { success: false, error: 'The program has been disabled by the administrator.' }
  }

  const cleanCookie = cookie.trim().replace(/^\.ROBLOSECURITY=/, '')
  const psCode      = (linkCode ?? '').trim()
  if (!psCode) return { success: false, error: 'No server code provided.' }

  // Block accounts under 3 days old (universal — covers manual, auto-alt, remote).
  if (await isAccountUnderAge(accountId)) {
    launchLog(`✖ ${accountId}: account under 3 days old — blocked`)
    return { success: false, error: 'Account is under 3 days old — too new to join (avoid bans/captchas). Try again in a few days.' }
  }

  try {
    // CONFIRM the singleton mutex is actually held before we launch anything, so a
    // dead/slow keeper can't let Roblox grab the mutex and start closing instances.
    // This awaits the keeper's ready-file (and respawns it if it died).
    const mutexOk = await ensureRobloxMutex()
    launchLog(mutexOk ? 'mutex held → multi-instance ready' : '⚠ mutex keeper unconfirmed — instances may collide')
    await wipeRobloxCookies()

    const { ticket, rotatedCookie, error: ticketErr } = await getGameAuthTicket(cleanCookie)
    // Roblox rotated the cookie during auth → save the fresh token so this alt
    // isn't flagged "expired" on the next health check (a one-use death).
    if (rotatedCookie && rotatedCookie !== cleanCookie) {
      updateAccount(accountId, { cookie: rotatedCookie, cookieStatus: 'valid' })
      console.log('[Join] saved rotated cookie for', accountId)
    }
    if (!ticket) { launchLog(`✖ ${accountId}: no auth ticket — ${ticketErr ?? 'cookie may be expired'}`); return { success: false, error: ticketErr ?? 'Could not get auth ticket — cookie may be expired.' } }
    launchLog(`${accountId}: got auth ticket (len ${ticket.length})`)

    const launchData = encodeURIComponent(JSON.stringify({ psCode }))
    const joinUrl    = `https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestPrivateGame&placeId=${placeId}&launchData=${launchData}`

    const player = findRobloxPlayer()
    if (!player) { launchLog(`✖ ${accountId}: RobloxPlayerBeta.exe not found`); return { success: false, error: 'RobloxPlayerBeta.exe not found. Open Roblox once so it installs/updates, then try again.' } }
    const robloxPath = player.path
    // Which client we're launching. If this points at a stale version folder,
    // Roblox shows the bootstrapper ("installer") instead of joining — letting
    // Roblox update once (open it normally) fixes that.
    launchLog(`client: ${player.type} → ${robloxPath}`)

    const browserTracker = String(Math.floor(Math.random() * 100000) + 500000)
                         + String(Math.floor(Math.random() * 80000)  + 10000)
    const args = [
      '--app', '-t', ticket, '-j', joinUrl, '-b', browserTracker,
      '--launchtime', String(Date.now()), '--rloc', 'en_us', '--gloc', 'en_us',
    ]
    // Apply Low GPU FastFlags before EVERY launch when enabled. Roblox reads
    // ClientAppSettings.json fresh at client startup, so (re)writing it right
    // before each spawn guarantees the flags are present — even if a Roblox update
    // created a new version folder or reset the file since the last launch. This is
    // why it "sometimes didn't make changes": first-instance-only could miss a
    // freshly-updated version folder, and a failed/locked write was never retried.
    try {
      const s = getSettings()
      const fpsCap = s.fpsCap ?? 0
      if (s.lowGpuEnabled || fpsCap > 0) {
        // Pass the EXACT exe we're about to launch so its ClientSettings folder is
        // always written (not just the broadly-scanned version folders).
        const ok = applyPerformance({ lowGpu: s.lowGpuEnabled, fpsCap }, robloxPath)
        launchLog(ok
          ? `applied performance FastFlags (lowGpu=${s.lowGpuEnabled}, fps=${fpsCap > 0 ? fpsCap : (s.lowGpuEnabled ? 30 : '∞')}) → ${clientSettingsForExe(robloxPath)}`
          : '⚠ performance flags enabled but wrote 0 folders')
      }
    } catch (e) { launchLog('Performance flags apply error: ' + ((e as Error)?.message ?? e)) }

    const proc = spawn(robloxPath, args, { detached: true, stdio: 'ignore', windowsHide: false })
    // Capture spawn failures (ENOENT, AV block, etc.) — previously swallowed, so a
    // launch that never started looked like a silent no-op.
    proc.on('error', (e) => launchLog(`✖ ${accountId}: spawn error — ${e?.message ?? e}`))
    proc.on('exit', (code) => { runningProcesses.delete(accountId); if (code) launchLog(`${accountId}: client exited early (code ${code})`) })
    if (proc.pid) launchLog(`${accountId}: launched (pid ${proc.pid})`)
    runningProcesses.set(accountId, proc)
    proc.unref()
    // Second layer: close THIS instance's own singleton handle (if handle64.exe is
    // present) so it can't be the one that gets taken over by the next launch.
    if (proc.pid) void closeRobloxSingleton(proc.pid)

    // Record the launch for the leaderboard (launches +1, session peak, streak)
    try {
      const lic = getLicense()
      if (lic && supabaseEnabled()) void supabaseRecordLaunch(lic.key, runningProcesses.size)
    } catch {}

    // If "Mute all alts" is enabled, silence this new instance too — independent of
    // Anti-AFK. Its audio session only appears a few seconds after the window, so
    // apply on a short delay (setMuteRoblox mutes every Roblox pid, catching it).
    try { if (getSettings().antiAfkMute) setTimeout(() => setMuteRoblox(true), 9000) } catch {}

    // Let this client fully redeem its auth ticket before we touch cookies / launch
    // the next one — prevents the client-side "429 Authentication Failed".
    await new Promise(r => setTimeout(r, 4000))
    await wipeRobloxCookies()

    // Arm Auto-Rejoin for this account with the server code it joined.
    watchForRejoin(accountId, psCode)

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// Public launch API — chains onto the queue so launches stay serialized.
export function deployErlc(
  cookie: string, placeId: string, linkCode: string | undefined, accountId: string,
): Promise<{ success: boolean; error?: string }> {
  const task = launchQueue.then(() => doJoin(cookie, placeId, linkCode, accountId))
  launchQueue = task.catch(() => {})
  return task
}

export function removeRunning(accountId: string): boolean {
  unwatchRejoin(accountId)   // intentional disconnect → don't auto-rejoin it
  const proc = runningProcesses.get(accountId)
  if (!proc) return false
  try { proc.kill(); runningProcesses.delete(accountId); return true } catch { return false }
}

export function getRunningIds(): string[] {
  return [...runningProcesses.keys()]
}

// accountId → PID for currently-running, app-launched instances. Anti-AFK uses
// this to target only the windows of the accounts the user opted in.
export function getRunningPidMap(): Record<string, number> {
  const map: Record<string, number> = {}
  for (const [id, proc] of runningProcesses) {
    if (proc.pid && !proc.killed) map[id] = proc.pid
  }
  return map
}

export function registerRobloxHandlers(): void {

  // ── Public profile lookup ──────────────────────────────────────────────────

  ipcMain.handle('roblox:get-user-by-username', async (_e, username: string) => {
    try {
      const res = await robloxFetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
      })
      if (!res.ok) return null
      const data = await res.json() as { data: Array<{ id: number; name: string; displayName: string }> }
      return data.data[0] ?? null
    } catch { return null }
  })

  ipcMain.handle('roblox:get-user-by-id', async (_e, id: number) => {
    try {
      const res = await robloxFetch(`https://users.roblox.com/v1/users/${id}`)
      if (!res.ok) return null
      return await res.json() as RobloxUserResponse
    } catch { return null }
  })

  ipcMain.handle('roblox:get-avatar-url', async (_e, userId: number) => {
    try {
      const res = await robloxFetch(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
      )
      if (!res.ok) return null
      const data = await res.json() as { data: Array<{ imageUrl: string }> }
      return data.data[0]?.imageUrl ?? null
    } catch { return null }
  })

  ipcMain.handle('roblox:get-presence', async (_e, userIds: number[]) => {
    try {
      const res = await robloxFetch('https://presence.roblox.com/v1/presence/users', {
        method: 'POST',
        body: JSON.stringify({ userIds }),
      })
      if (!res.ok) return []
      const data = await res.json() as { userPresences: RobloxPresenceResponse[] }
      return data.userPresences
    } catch { return [] }
  })

  ipcMain.handle('roblox:get-group', async (_e, userId: number) => {
    try {
      const res = await robloxFetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`)
      if (!res.ok) return 'None'
      const data = await res.json() as { data: Array<{ group: { name: string } }> }
      return data.data[0]?.group?.name ?? 'None'
    } catch { return 'None' }
  })

  // ── Cookie validation ──────────────────────────────────────────────────────

  ipcMain.handle('roblox:validate-cookie', async (_e, rawCookie: string) => {
    const cookie = rawCookie.trim().replace(/^\.ROBLOSECURITY=/, '')
    try {
      const res = await robloxFetch('https://users.roblox.com/v1/users/authenticated', {
        headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
      })
      if (!res.ok) return null
      const user = await res.json() as { id: number; name: string; displayName: string }

      const [avatarRes, groupRes, detailRes] = await Promise.all([
        robloxFetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`),
        robloxFetch(`https://groups.roblox.com/v2/users/${user.id}/groups/roles`),
        robloxFetch(`https://users.roblox.com/v1/users/${user.id}`),   // for `created` (account age)
      ])

      let avatarUrl = ''
      if (avatarRes.ok) {
        const d = await avatarRes.json() as { data: Array<{ imageUrl: string }> }
        avatarUrl = d.data[0]?.imageUrl ?? ''
      }
      let group = 'None'
      if (groupRes.ok) {
        const d = await groupRes.json() as { data: Array<{ group: { name: string } }> }
        group = d.data[0]?.group?.name ?? 'None'
      }
      let created: string | undefined
      if (detailRes.ok) {
        const d = await detailRes.json() as { created?: string }
        created = d.created
      }

      return { id: user.id, name: user.name, displayName: user.displayName, avatarUrl, group, cookie, created }
    } catch { return null }
  })

  // ── Browser login window ───────────────────────────────────────────────────

  // STABLE partition (not a per-login `…-${Date.now()}` one). A fresh partition
  // every time looks like a brand-new, never-seen browser to Roblox's Arkose /
  // FunCaptcha risk engine, which serves the most aggressive captchas. Reusing
  // one partition lets device-trust cookies (RBXEventTrackerV2, browser id, the
  // "remember this device" 2FA token, …) persist, so Roblox trusts the device and
  // shows far fewer captchas. We wipe ONLY the auth cookie before each login so
  // the user can still sign into a different account.
  const LOGIN_PARTITION = 'persist:roblox-login'

  ipcMain.handle('roblox:browser-login', async () => {
    const ses = session.fromPartition(LOGIN_PARTITION)
    try {
      for (const url of ['https://www.roblox.com', 'https://roblox.com']) {
        const existing = await ses.cookies.get({ url, name: '.ROBLOSECURITY' })
        for (const c of existing) await ses.cookies.remove(url, c.name).catch(() => {})
      }
    } catch {}

    return new Promise<{ id: number; name: string; displayName: string; avatarUrl: string; group: string; cookie: string; created?: string } | null>(resolve => {
      const loginWin = new BrowserWindow({
        width: 920,
        height: 680,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          partition: LOGIN_PARTITION,
          // No DevTools in production (matches the main window lockdown).
          devTools: !!process.env['VITE_DEV_SERVER_URL'],
        },
        title: 'Log in to Roblox',
        autoHideMenuBar: true,
        backgroundColor: '#1a1a1a',
      })
      if (!process.env['VITE_DEV_SERVER_URL']) {
        loginWin.webContents.on('before-input-event', (event, input) => {
          if (input.type !== 'keyDown') return
          const key = (input.key || '').toLowerCase()
          const mod = input.control || input.meta
          if (key === 'f12' || (mod && input.shift && (key === 'i' || key === 'j' || key === 'c'))) event.preventDefault()
        })
        loginWin.webContents.on('devtools-opened', () => loginWin.webContents.closeDevTools())
      }

      loginWin.loadURL('https://www.roblox.com/login')
      let resolved = false

      const tryExtract = async () => {
        if (resolved) return
        try {
          const cookies = await loginWin.webContents.session.cookies.get({
            url: 'https://www.roblox.com',
            name: '.ROBLOSECURITY',
          })
          if (!cookies.length) return
          const cookie = cookies[0].value

          const authRes = await robloxFetch('https://users.roblox.com/v1/users/authenticated', {
            headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
          })
          if (!authRes.ok) return
          const user = await authRes.json() as { id: number; name: string; displayName: string }

          resolved = true
          loginWin.close()

          const [avatarRes, groupRes, detailRes] = await Promise.all([
            robloxFetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`),
            robloxFetch(`https://groups.roblox.com/v2/users/${user.id}/groups/roles`),
            robloxFetch(`https://users.roblox.com/v1/users/${user.id}`),
          ])
          let avatarUrl = ''
          if (avatarRes.ok) {
            const d = await avatarRes.json() as { data: Array<{ imageUrl: string }> }
            avatarUrl = d.data[0]?.imageUrl ?? ''
          }
          let group = 'None'
          if (groupRes.ok) {
            const d = await groupRes.json() as { data: Array<{ group: { name: string } }> }
            group = d.data[0]?.group?.name ?? 'None'
          }
          let created: string | undefined
          if (detailRes.ok) { const d = await detailRes.json() as { created?: string }; created = d.created }

          resolve({ id: user.id, name: user.name, displayName: user.displayName, avatarUrl, group, cookie, created })
        } catch {}
      }

      loginWin.webContents.session.cookies.on('changed', () => setTimeout(tryExtract, 400))
      loginWin.webContents.on('did-navigate', () => setTimeout(tryExtract, 600))
      loginWin.on('closed', () => { if (!resolved) resolve(null) })
    })
  })

  // ── File import ────────────────────────────────────────────────────────────

  ipcMain.handle('roblox:import-cookies-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Cookie File',
      filters: [
        { name: 'Text / CSV', extensions: ['txt', 'csv'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    if (result.canceled || !result.filePaths[0]) return []

    const content = fs.readFileSync(result.filePaths[0], 'utf-8')
    const lines = content.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean)
    const cookies: string[] = []

    for (const line of lines) {
      const eqMatch = line.match(/\.ROBLOSECURITY=([^\s,;]+)/)
      if (eqMatch) { cookies.push(eqMatch[1]); continue }
      if (line.startsWith('_|WARNING') || (line.length > 50 && /^[A-Za-z0-9_|%+/=\-]+$/.test(line))) {
        cookies.push(line)
      }
    }
    return cookies
  })

  // ── ERLC ──────────────────────────────────────────────────────────────────

  // ── ERLC setup check ──────────────────────────────────────────────────────

  ipcMain.handle('roblox:check-setup', () => {
    const player = findRobloxPlayer()

    const multiCandidates = [
      path.join((process as NodeJS.Process & { resourcesPath?: string }).resourcesPath ?? '', 'multi.exe'),
      path.join(path.dirname(process.execPath), 'multi.exe'),
      path.join(__dirname, '..', 'resources', 'multi.exe'),
      path.join(__dirname, '..', '..', 'resources', 'multi.exe'),
      path.join(process.cwd(), 'resources', 'multi.exe'),
    ]
    const multiFound = multiCandidates.some(p => { try { return fs.existsSync(p) } catch { return false } })

    return {
      found:         !!player,
      type:          player?.type ?? null,
      path:          player?.path ?? null,
      multiInstance: player?.type === 'bloxstrap' || multiFound,
      multiExe:      multiFound,
    }
  })

  // ── ERLC resolve (just normalises the code; erlc.xyz is optional) ─────────

  ipcMain.handle('roblox:resolve-erlc-code', async (_e, serverCode: string) => {
    // ERLC always uses placeId 2534724415. The server code IS the psCode.
    // erlc.xyz is checked opportunistically in case the code resolves to a different psCode.
    const psCode = serverCode.trim()
    try {
      const res = await fetch(`https://erlc.xyz/join/${psCode}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
        redirect: 'follow',
      })
      if (res.ok) {
        const html = await res.text()
        const m = html.match(/"psCode"\s*:\s*"([^"]+)"/)
          ?? html.match(/psCode[=:\s]+"?([A-Za-z0-9_-]{3,})"?/)
        if (m?.[1]) return { placeId: '2534724415', linkCode: m[1] }
      }
    } catch {}
    return { placeId: '2534724415', linkCode: psCode }
  })

  // ── Disconnect / running-process management ────────────────────────────────

  ipcMain.handle('roblox:get-running', () => getRunningIds())

  ipcMain.handle('roblox:disconnect', (_e, accountId: string): { success: boolean; error?: string } => {
    if (!removeRunning(accountId)) return { success: false, error: 'No running process for this account.' }
    return { success: true }
  })

  ipcMain.handle('roblox:disconnect-all', (): { success: boolean; count: number } => {
    let count = 0
    for (const id of getRunningIds()) { if (removeRunning(id)) count++ }
    unlockRobloxCookies()
    return { success: true, count }
  })

  // ── ERLC join ─────────────────────────────────────────────────────────────

  ipcMain.handle('roblox:join-erlc', (
    _e,
    cookie: string,
    placeId: string,
    _accessCode: string | undefined,
    linkCode: string | undefined,
    accountId: string,
  ): Promise<{ success: boolean; error?: string }> => {
    return deployErlc(cookie, placeId, linkCode, accountId)
  })

  // ── Legacy login (kept for compatibility) ─────────────────────────────────

  ipcMain.handle('roblox:login-with-cookie', async (_e, cookie: string) => {
    try {
      const cleanCookie = cookie.trim().replace(/^\.ROBLOSECURITY=/, '')
      const res = await robloxFetch('https://users.roblox.com/v1/users/authenticated', {
        headers: { Cookie: `.ROBLOSECURITY=${cleanCookie}` },
      })
      if (!res.ok) return { success: false, error: 'Invalid cookie — could not authenticate.' }
      const user = await res.json() as { id: number; name: string; displayName: string }
      return { success: true, userId: user.id, username: user.name, cookie: cleanCookie }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('roblox:login-with-credentials', async (_e, username: string, password: string) => {
    try {
      const csrfToken = await getCsrfToken()
      const res = await robloxFetch('https://auth.roblox.com/v2/login', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({ ctype: 'Username', cvalue: username, password }),
      })
      const setCookie = res.headers.get('set-cookie') ?? ''
      const cookieMatch = setCookie.match(/\.ROBLOSECURITY=([^;]+)/)
      if (res.status === 200) {
        const body = await res.json() as { user?: { id: number; name: string }; isChallengeRequired?: boolean; twoStepVerificationData?: Record<string, unknown> }
        if (cookieMatch) return { success: true, userId: body.user?.id, username: body.user?.name, cookie: cookieMatch[1] }
        if (body.isChallengeRequired) {
          return { success: false, requiresTwoStep: true, twoStepTicket: String(body.twoStepVerificationData?.ticket ?? ''), twoStepType: String(body.twoStepVerificationData?.mediaType ?? 'Email'), userId: body.user?.id, username: body.user?.name }
        }
        return { success: true, userId: body.user?.id, username: body.user?.name }
      }
      const body = await res.json() as { errors?: Array<{ message: string; fieldData?: unknown }> }
      if (res.status === 403 && (body.errors?.[0] as Record<string, unknown>)?.fieldData) {
        const fd = (body.errors?.[0] as Record<string, unknown>).fieldData as Record<string, unknown>
        return { success: false, requiresTwoStep: true, twoStepTicket: String(fd?.ticket ?? ''), twoStepType: String(fd?.mediaType ?? 'Email') }
      }
      return { success: false, error: body.errors?.[0]?.message ?? `HTTP ${res.status}` }
    } catch (err) { return { success: false, error: String(err) } }
  })

  ipcMain.handle('roblox:verify-2fa', async (_e, userId: number, ticket: string, code: string, challengeType: string) => {
    try {
      const csrfToken = await getCsrfToken()
      const typeSlug = challengeType.toLowerCase() === 'authenticatorapp' ? 'totp' : 'email'
      const verifyRes = await robloxFetch(
        `https://twostepverification.roblox.com/v1/users/${userId}/challenges/${typeSlug}/verify`,
        { method: 'POST', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify({ actionType: 'Login', challengeId: ticket, code }) }
      )
      if (!verifyRes.ok) {
        const body = await verifyRes.json() as { errors?: Array<{ message: string }> }
        return { success: false, error: body.errors?.[0]?.message ?? 'Invalid 2FA code.' }
      }
      const verifyData = await verifyRes.json() as { verificationToken?: string }
      if (!verifyData.verificationToken) return { success: false, error: '2FA verification failed.' }
      const loginRes = await robloxFetch('https://auth.roblox.com/v2/login', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({ ctype: 'Username', cvalue: '', password: '', challengeId: ticket, verificationToken: verifyData.verificationToken, rememberDevice: false }),
      })
      const setCookie = loginRes.headers.get('set-cookie') ?? ''
      const cookieMatch = setCookie.match(/\.ROBLOSECURITY=([^;]+)/)
      const body = await loginRes.json() as { user?: { id: number; name: string } }
      if (cookieMatch) return { success: true, userId: body.user?.id, username: body.user?.name, cookie: cookieMatch[1] }
      return { success: false, error: 'Could not extract session cookie after 2FA.' }
    } catch (err) { return { success: false, error: String(err) } }
  })
}
