import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// macOS doesn't use Windows-style mutexes or cookie locking
// Roblox on macOS already supports multi-instance via `open -n`
const IS_MAC = process.platform === 'darwin'

// ─────────────────────────────────────────────────────────────────────────────
// Multi-instance support (MultiBlox technique)
//
//  • Error 273 ("same account launched from different device") + multi-instance:
//      Roblox creates a named singleton (ROBLOX_singletonEvent / ROBLOX_singletonMutex)
//      so only one client runs. We use Sysinternals handle64.exe to FIND and CLOSE
//      that handle inside each Roblox process after it launches — then the next
//      account can start as its own independent instance.
//
//  • Error 773/273 session collision:
//      All instances share %LOCALAPPDATA%\Roblox\LocalStorage\RobloxCookies.dat.
//      cookielock.exe holds a byte-range lock on it so instances can't overwrite
//      each other's session (each authenticates via its own launch ticket instead).
// ─────────────────────────────────────────────────────────────────────────────

function resourcePath(name: string): string | null {
  const candidates = [
    path.join((process as NodeJS.Process & { resourcesPath?: string }).resourcesPath ?? '', name),
    path.join(path.dirname(process.execPath), name),
    path.join(__dirname, name),
    path.join(__dirname, '..', 'resources', name),
    path.join(process.cwd(), 'resources', name),
    path.join(process.cwd(), name),
  ]
  return candidates.find(p => { try { return fs.existsSync(p) } catch { return false } }) ?? null
}

function run(exe: string, args: string[]): Promise<string> {
  return new Promise(resolve => {
    const p = spawn(exe, args, { windowsHide: true })
    let out = ''
    p.stdout?.on('data', d => { out += d.toString() })
    p.on('close', () => resolve(out))
    p.on('error', () => resolve(''))
  })
}

// ── Close the Roblox singleton handle for one process ────────────────────────

export async function closeRobloxSingleton(pid: number): Promise<boolean> {
  if (IS_MAC) {
    // macOS doesn't have singleton handles to close
    return true
  }

  const exe = resourcePath('handle64.exe')
  if (!exe) { console.log('[multi] handle64.exe not found'); return false }

  // The singleton appears a few seconds after launch — retry a handful of times.
  for (let attempt = 0; attempt < 8; attempt++) {
    const out = await run(exe, ['-accepteula', '-nobanner', '-p', String(pid), '-a'])
    let closedAny = false
    for (const line of out.split(/\r?\n/)) {
      if (line.includes('ROBLOX_singletonEvent') || line.includes('ROBLOX_singletonMutex')) {
        const m = line.match(/([0-9A-Fa-f]+):/)
        if (m) {
          await run(exe, ['-accepteula', '-nobanner', '-p', String(pid), '-c', m[1], '-y'])
          closedAny = true
        }
      }
    }
    if (closedAny) { console.log(`[multi] closed singleton for PID ${pid}`); return true }
    await new Promise(r => setTimeout(r, 1000))
  }
  console.log(`[multi] no singleton found for PID ${pid}`)
  return false
}

// ── Singleton mutex keeper (multi-instance) ──────────────────────────────────
// Roblox only runs one client at a time because the first instance owns the named
// mutex `ROBLOX_singletonMutex`; a second launch makes the first close. If WE hold
// that mutex (binary-free, via a hidden PowerShell process keeping the handle open),
// no Roblox instance "owns" it, so any number of clients run side-by-side. This is
// the same approach Bloxstrap's multi-instance uses, and it doesn't depend on
// multi.exe being present / not quarantined by antivirus.

let mutexKeeper: ChildProcess | null = null
let keeperAlive = false               // real liveness — set on spawn, cleared on exit
let keeperReadyFile = ''              // PowerShell touches this once it holds the mutex
let watchdog: NodeJS.Timeout | null = null

function readyFilePath(): string {
  return path.join(os.tmpdir(), `lvnt-roblox-mutex-${process.pid}.ready`)
}

export function holdRobloxMutex(): void {
  if (IS_MAC) {
    // macOS Roblox doesn't use singleton mutexes
    console.log('[multi] macOS detected - mutex handling not needed')
    return
  }

  // IMPORTANT: gate on our OWN liveness flag, not ChildProcess.killed — `.killed`
  // is only true when WE call .kill(); if the keeper dies on its own (AV, crash,
  // OS), `.killed` stays false and we'd wrongly think the mutex is still held and
  // never respawn. That silent death is exactly what makes multi-instance regress
  // (the mutex is released → Roblox single-instance returns → instances close).
  if (keeperAlive) { startWatchdog(); return }

  keeperReadyFile = readyFilePath()
  try { fs.rmSync(keeperReadyFile, { force: true }) } catch {}

  // THE multi-instance lock — matches Fishstrap's proven (no-admin) method:
  // acquire and HOLD the mutex "ROBLOX_singletonMutex" before any Roblox client
  // starts, so no single client owns it → clients run side-by-side instead of a
  // new launch replacing the previous one. We do NOT pre-create
  // "ROBLOX_singletonEvent" — that's the Event Roblox itself creates; touching it
  // is multi.exe/handle64's job (close it inside each launched client). Creating
  // it ourselves (as Event OR Mutex) risks colliding with Roblox's own object.
  // Keep the process alive so the handle stays open; write the ready-file once the
  // mutex is acquired so the launcher can confirm before the first client starts.
  const script = [
    "$ErrorActionPreference='SilentlyContinue'",
    "$m = New-Object System.Threading.Mutex($true, 'ROBLOX_singletonMutex')",
    `Set-Content -LiteralPath '${keeperReadyFile}' -Value 'ok' -Force`,
    "while ($true) { Start-Sleep -Seconds 3600 }",
  ].join('; ')
  try {
    mutexKeeper = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script], { windowsHide: true, stdio: 'ignore' })
    keeperAlive = true
    mutexKeeper.on('exit',  () => { keeperAlive = false; mutexKeeper = null })
    mutexKeeper.on('error', () => { keeperAlive = false; mutexKeeper = null })
    console.log('[multi] holding ROBLOX_singletonMutex (multi-instance enabled)')
  } catch { keeperAlive = false; mutexKeeper = null }

  startWatchdog()
}

// Self-heal: if the keeper dies for any reason, bring it straight back so the
// mutex is never released mid-session (which would re-enable single-instance).
function startWatchdog(): void {
  if (watchdog) return
  watchdog = setInterval(() => { if (!keeperAlive) holdRobloxMutex() }, 8000)
  if (watchdog.unref) watchdog.unref()
}

// Spawn the keeper if needed AND wait until it confirms the mutex is actually held
// (ready-file present). Await this before the FIRST client launch so Roblox can
// never win the race for the mutex. Returns true once the mutex is confirmed held.
export async function ensureRobloxMutex(timeoutMs = 6000): Promise<boolean> {
  holdRobloxMutex()
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try { if (keeperReadyFile && fs.existsSync(keeperReadyFile)) return true } catch {}
    if (!keeperAlive) holdRobloxMutex()          // died while waiting → respawn
    await new Promise(r => setTimeout(r, 100))
  }
  // Timed out waiting for confirmation — report whether the keeper is at least alive.
  return keeperAlive
}

export function releaseRobloxMutex(): void {
  if (watchdog) { clearInterval(watchdog); watchdog = null }
  keeperAlive = false
  if (mutexKeeper) { try { mutexKeeper.kill() } catch {} mutexKeeper = null }
  try { if (keeperReadyFile) fs.rmSync(keeperReadyFile, { force: true }) } catch {}
}

// ── Cookie lock (773/273 session fix) ────────────────────────────────────────

let cookieLockProc: ChildProcess | null = null

function cookiesPath(): string {
  const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local')
  return path.join(local, 'Roblox', 'LocalStorage', 'RobloxCookies.dat')
}

export function lockRobloxCookies(): void {
  if (IS_MAC) {
    // macOS doesn't need cookie locking (different path structure)
    return
  }

  if (cookieLockProc && !cookieLockProc.killed) return
  const exe = resourcePath('cookielock.exe')
  if (!exe) { console.log('[multi] cookielock.exe not found'); return }

  const p = cookiesPath()
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true })
    if (!fs.existsSync(p)) fs.writeFileSync(p, '')
  } catch {}

  cookieLockProc = spawn(exe, [p], { windowsHide: true, stdio: 'ignore', detached: false })
  cookieLockProc.on('exit', () => { cookieLockProc = null })
  console.log('[multi] cookie lock started')
}

export function unlockRobloxCookies(): void {
  if (cookieLockProc) { try { cookieLockProc.kill() } catch {} cookieLockProc = null }
}
