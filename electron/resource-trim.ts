import { spawn } from 'node:child_process'
import { getRunningPidMap } from './ipc/roblox.js'
import { getSettings } from './store/index.js'
import type { ResourceTrimStatus } from '../src/types/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// Performance sweep  (Resource Trim + Pixel Size Reduction + RAM Limit)
//
// One per-minute pass over the alt processes THIS app launched (tracked by PID via
// getRunningPidMap — never your manually-opened main), applying whichever of the
// three independent Performance toggles are on. We skip the foreground window so
// the alt you're actively watching is left alone. All three are bundled into one
// PowerShell pass so they don't fight over the same windows.
//
//   • Resource Trim (autoTrim)        → minimize idle alts + BelowNormal CPU
//                                        priority + EmptyWorkingSet (RAM back to OS).
//   • Pixel Size Reduction (pixel>0)  → shrink each alt's window to N×N px (min 100).
//                                        Roblox renders to the window size, so a tiny
//                                        window draws far fewer pixels = big GPU/CPU
//                                        save while the client stays "active" (not
//                                        minimized). Takes precedence over Trim's
//                                        minimize so the tiny window stays visible.
//   • RAM Limit (ram>0)               → hard-cap each alt's working set to N MB via
//                                        SetProcessWorkingSetSizeEx, so Roblox can't
//                                        balloon past your budget per account.
//
// Self-gates on the settings each tick, so toggling any of them takes effect on the
// next sweep with no restart, and the loop costs nothing when all three are off.
// ─────────────────────────────────────────────────────────────────────────────

let timer: ReturnType<typeof setInterval> | null = null
let lastTrim: string | null = null
let processedCount = 0
let freedMb = 0

// Alts the auto-alting engine has flagged as STILL LOADING (launched but not yet
// confirmed in the server). The global sweep skips these so minimizing them can't
// slow their join — they get minimized per-account the moment they confirm in-game.
let loadingPids = new Set<number>()

const SWEEP_MS = 30_000   // re-apply every 30s (working set / window size creep back) — aggressive

interface SweepOpts { trim: boolean; pixel: number; ram: number }   // pixel = px (0=off), ram = bytes (0=off)

function buildScript(targetPids: number[], opts: SweepOpts, force: boolean): string {
  return `
$ErrorActionPreference='SilentlyContinue'
$targets = @(${targetPids.join(',')})
$pixel  = ${opts.pixel}
$ramMax = ${opts.ram}
$doTrim = $${opts.trim ? 'true' : 'false'}
$force  = $${force ? 'true' : 'false'}
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class Perf {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("psapi.dll")]  public static extern bool EmptyWorkingSet(IntPtr hProcess);
  [DllImport("kernel32.dll")] public static extern bool SetProcessWorkingSetSizeEx(IntPtr hProcess, IntPtr min, IntPtr max, uint flags);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
}
"@
$fg = [Perf]::GetForegroundWindow()
$count = 0
$freed = 0
Get-Process RobloxPlayerBeta -ErrorAction SilentlyContinue | ForEach-Object {
  # Only the alts we launched (by PID). Empty target list → act on none.
  if ($targets.Count -eq 0 -or ($targets -notcontains $_.Id)) { return }
  $h = $_.MainWindowHandle
  # Normally skip the window you're actively using; when forced (engine-driven
  # per-account trim of a confirmed alt) act on it even if it's the foreground one.
  $isFg = (-not $force) -and ($h -ne [IntPtr]::Zero -and $h.ToInt64() -eq $fg.ToInt64())
  $before = $_.WorkingSet64
  if (-not $isFg) {
    if ($pixel -ge 100 -and $h -ne [IntPtr]::Zero) {
      # Un-minimize (so the resize is honoured) then shrink to a tiny N×N window.
      [Perf]::ShowWindow($h, 4) | Out-Null                                              # SW_SHOWNOACTIVATE
      [Perf]::SetWindowPos($h, [IntPtr]::Zero, 0, 0, $pixel, $pixel, 0x16) | Out-Null   # SWP_NOMOVE|NOZORDER|NOACTIVATE
    } elseif ($doTrim -and $h -ne [IntPtr]::Zero) {
      [Perf]::ShowWindow($h, 7) | Out-Null                                              # SW_SHOWMINNOACTIVE (minimize)
    }
    if ($doTrim) { try { $_.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::BelowNormal } catch {} }
  }
  if ($ramMax -gt 0) {
    $min = [int64]([Math]::Min(50MB, $ramMax / 2))
    # 0x6 = QUOTA_LIMITS_HARDWS_MAX_ENABLE (0x4) | QUOTA_LIMITS_HARDWS_MIN_DISABLE (0x2)
    try { [Perf]::SetProcessWorkingSetSizeEx($_.Handle, [IntPtr]$min, [IntPtr]([int64]$ramMax), 0x6) | Out-Null } catch {}
  }
  if ($doTrim -or $ramMax -gt 0) { try { [Perf]::EmptyWorkingSet($_.Handle) | Out-Null } catch {} }
  try { $_.Refresh(); $after = $_.WorkingSet64; if ($before -gt $after) { $freed += ($before - $after) } } catch {}
  $count++
}
Write-Output "$count $freed"
`
}

function runPowerShell(script: string): Promise<string> {
  return new Promise(resolve => {
    const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true })
    let out = ''
    ps.stdout.on('data', d => { out += d.toString() })
    ps.on('close', () => resolve(out.trim()))
    ps.on('error', () => resolve(''))
  })
}

// Resolve the active Performance options from settings (clamped to safe ranges).
function readOpts(): SweepOpts {
  const s = getSettings()
  return {
    trim:  !!s.autoTrim,
    pixel: s.pixelReduceEnabled ? Math.max(100, Math.min(2000, Math.round(s.pixelReduceSize || 100))) : 0,
    ram:   s.ramLimitEnabled ? Math.max(150, Math.min(4000, Math.round(s.ramLimitMb || 350))) * 1024 * 1024 : 0,
  }
}

// Run one PowerShell pass over the given PIDs with the active options. `force`
// ignores the foreground-window protection (used for engine-driven per-account trim).
async function applyToPids(pids: number[], opts: SweepOpts, force: boolean): Promise<void> {
  if (pids.length === 0) return
  const out = await runPowerShell(buildScript(pids, opts, force))
  const [c, f] = out.split(/\s+/)
  const count = parseInt(c ?? '0', 10)
  const freedBytes = parseInt(f ?? '0', 10)
  processedCount = isNaN(count) ? 0 : count
  freedMb = isNaN(freedBytes) ? 0 : Math.round(freedBytes / (1024 * 1024))
  lastTrim = new Date().toISOString()
}

async function sweep(): Promise<void> {
  const opts = readOpts()
  if (!opts.trim && !opts.pixel && !opts.ram) return   // nothing enabled
  // All launched alts MINUS the ones still loading (those get handled per-account
  // on confirm, so we never minimize a window that's still joining).
  const pids = Object.values(getRunningPidMap()).filter(p => !loadingPids.has(p))
  if (pids.length === 0) { processedCount = 0; return }
  await applyToPids(pids, opts, false)   // background sweep → protect the user's foreground window
}

// ── Per-account / engine hooks ────────────────────────────────────────────────

// Immediately apply the active Performance actions (minimize/resize/RAM-cap) to a
// specific set of PIDs — used by the auto-alting engine the moment an alt is
// confirmed in-server, so it minimizes right away instead of waiting for the sweep.
export function trimPids(pids: number[]): Promise<void> {
  const opts = readOpts()
  if (!opts.trim && !opts.pixel && !opts.ram) return Promise.resolve()
  return applyToPids(pids, opts, true)   // engine confirmed these alts → minimize even if foreground
}

// Tell the global sweep which alt PIDs are still loading (and must NOT be minimized
// yet). The engine refreshes this every poll.
export function setLoadingPids(pids: number[]): void {
  loadingPids = new Set(pids)
}

// ── Public API ──────────────────────────────────────────────────────────────

// Start the sweep loop. Safe to call at boot — it no-ops each tick until the user
// enables a Performance option, so flipping one on takes effect on the next tick.
export function startResourceTrim(): void {
  if (timer) return
  void sweep()
  timer = setInterval(() => void sweep(), SWEEP_MS)
}

export function stopResourceTrim(): void {
  if (timer) { clearInterval(timer); timer = null }
  processedCount = 0
  freedMb = 0
  loadingPids = new Set()
}

// One-shot sweep — used right after the user toggles a Performance option on, so
// they get immediate feedback instead of waiting up to a minute for the interval.
export function trimNow(): Promise<void> {
  return sweep()
}

export function getResourceTrimStatus(): ResourceTrimStatus {
  const s = getSettings()
  return {
    enabled: !!(s.autoTrim || s.pixelReduceEnabled || s.ramLimitEnabled),
    trimmedCount: processedCount,
    freedMb,
    lastTrim,
  }
}
