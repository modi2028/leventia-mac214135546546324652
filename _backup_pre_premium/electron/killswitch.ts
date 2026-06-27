import { BrowserWindow } from 'electron'
import { supabaseAppStatus, supabaseEnabled } from './supabase.js'
import { setAppKilled, isAppKilled } from './kill-state.js'
import { stopAutoAlt } from './auto-alting.js'
import { stopAutoAltScheduler, startAutoAltScheduler } from './auto-alt-schedule.js'
import { stopRemoteControl, startRemoteControl } from './remote-control.js'
import { stopAutoRejoin, startAutoRejoin } from './auto-rejoin.js'
import { leaveAll } from './anti-afk.js'

// ─────────────────────────────────────────────────────────────────────────────
// Master kill-switch — MAIN-PROCESS enforcement.
//
// The renderer already shows a full-screen lockout when the server reports
// killed:true, but that overlay is cosmetic — a determined user could bypass the
// UI while the main process keeps launching alts, running auto-alt, and executing
// remote Discord commands. This worker makes the kill REAL:
//
//   • Polls rpc_app_status() on boot + every 12s (fails OPEN: a network error
//     never disables anyone — only an explicit killed:true locks the program).
//   • On kill: stop auto-alt + scheduler + remote-control + auto-rejoin, close
//     every Roblox instance, and flip the shared kill-state flag so the launch
//     core refuses ALL new launches (manual, auto-alt, remote, rejoin).
//   • RE-ENFORCES every tick while killed — NO EXCEPTIONS. If a user somehow
//     restarts a service or reopens Roblox during a kill, it's torn down again
//     within ~12s. The launch core also hard-blocks every launch while killed.
//   • On reactivate: bring the background workers back (they self-gate on their
//     own settings, so nothing runs that the user didn't enable).
//   • Broadcasts the change to every window so the lockout appears instantly.
// ─────────────────────────────────────────────────────────────────────────────

const POLL_MS = 12_000

let timer: ReturnType<typeof setInterval> | null = null

function broadcast(killed: boolean): void {
  for (const w of BrowserWindow.getAllWindows()) {
    try { w.webContents.send('app:kill-changed', killed) } catch {}
  }
}

function enforceKill(): void {
  try { stopAutoAlt() } catch {}
  try { stopAutoAltScheduler() } catch {}
  try { stopRemoteControl() } catch {}
  try { stopAutoRejoin() } catch {}
  void leaveAll()   // closes all Roblox, stops anti-AFK, clears rejoin, unlocks cookies
}

function resumeAfterKill(): void {
  // These self-gate on their own settings each tick, so re-starting them is safe.
  try { startRemoteControl() } catch {}
  try { startAutoRejoin() } catch {}
  try { startAutoAltScheduler() } catch {}
}

async function check(): Promise<void> {
  if (!supabaseEnabled()) return
  let status: { killed: boolean }
  try { status = await supabaseAppStatus() } catch { return }   // fail-open on error
  const next = !!status.killed

  // Handle a state CHANGE (lock ⇄ unlock): flip the flag, tell every window, and
  // on reactivate bring the workers back.
  if (next !== isAppKilled()) {
    setAppKilled(next)
    broadcast(next)
    if (!next) resumeAfterKill()
  }

  // While killed, RE-ENFORCE every tick — no exceptions. Idempotent: stops already-
  // stopped workers and re-closes any Roblox the user managed to reopen. Combined
  // with the launch guard (isAppKilled) in the launch core, there's no way to run
  // alts while the program is disabled.
  if (next) enforceKill()
}

export function startKillSwitch(): void {
  if (timer) clearInterval(timer)
  void check()                                  // evaluate immediately at boot
  timer = setInterval(() => void check(), POLL_MS)
}

export function stopKillSwitch(): void {
  if (timer) { clearInterval(timer); timer = null }
}
