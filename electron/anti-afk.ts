import { spawn } from 'node:child_process'
import { unlockRobloxCookies } from './multi-instance.js'
import { clearAllRejoin } from './rejoin-watch.js'
import { setMuteRoblox } from './mute-roblox.js'
import { getRunningPidMap } from './ipc/roblox.js'
import { trimNow } from './resource-trim.js'
import { getSettings } from './store/index.js'
import type { AntiAfkStatus, AntiAfkAction } from '../src/types/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// Anti-AFK service
//
// Roblox reads movement/jump through raw input / DirectInput, which IGNORES
// background PostMessage'd window messages — so background input never moves the
// character. To actually register, we briefly FOREGROUND each target Roblox
// window, send real scan-code keyboard / mouse input (keybd_event / mouse_event,
// which the engine sees), move to the next, then restore the user's window.
//
// Targeting is robust (no dependency on the app having launched the alt): we act
// on EVERY Roblox window EXCEPT the one you're actively using (the foreground
// window when the cycle starts), so your main is never disturbed. Ticking
// specific alts in the UI additionally limits input to just those.
//
// Trade-off: each target window momentarily flashes to the foreground while it
// receives input.
//
//   jump  → tap Space (recommended)
//   ws    → tap W then S (forward, then back)
//   zoom  → tap I then O (zoom camera in/out)
// ─────────────────────────────────────────────────────────────────────────────

let timer: ReturnType<typeof setInterval> | null = null
let intervalMinutes = 5
let lastWiggle: string | null = null
let lastWindowCount = 0

// Build the input body for the chosen action. These run AFTER we foreground the
// target window, so KeyTap/Move deliver real input to the focused Roblox window.
// NOTE: KeyTap takes VIRTUAL-KEY codes (not scancodes) — it derives the scancode
// via MapVirtualKey, matching AntiAFK-RBX's proven input form.
function actionBody(action: AntiAfkAction): string {
  switch (action) {
    case 'jump': return 'KeyTap 0x20 90'                                                    // tap Space (recommended)
    case 'zoom': return 'KeyTap 0x49 220; Start-Sleep -Milliseconds 80; KeyTap 0x4F 220'   // I then O (zoom in/out)
    case 'ws':
    default:     return 'KeyTap 0x57 350; Start-Sleep -Milliseconds 80; KeyTap 0x53 350'   // W then S (forward, back)
  }
}

function buildScript(action: AntiAfkAction, targetPids: number[], minimize: boolean): string {
  return `
$ErrorActionPreference='SilentlyContinue'
$targets = @(${targetPids.join(',')})
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class AAFK {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr pid);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool attach);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, int dx, int dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern uint MapVirtualKey(uint code, uint mapType);
}
"@
# Real key press to the FOCUSED window — virtual key + hardware scancode, with NO
# KEYEVENTF_SCANCODE flag. This is the form AntiAFK-RBX uses and that Roblox's raw
# input actually registers (scancode-only events were being ignored). KEYUP=0x02.
function KeyTap($vk, $hold) {
  $scan = [byte]([AAFK]::MapVirtualKey([uint32]$vk, 0))
  [AAFK]::keybd_event([byte]$vk, $scan, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds $hold
  [AAFK]::keybd_event([byte]$vk, $scan, 0x02, [UIntPtr]::Zero)
}
# Relative mouse move (MOUSEEVENTF_MOVE=0x0001)
function Move($dx, $dy) { [AAFK]::mouse_event(0x0001, [int]$dx, [int]$dy, 0, [UIntPtr]::Zero) }
# Foreground a window reliably (AttachThreadInput defeats the foreground lock)
function Focus($h) {
  [AAFK]::ShowWindow($h, 9) | Out-Null            # SW_RESTORE
  $fg = [AAFK]::GetForegroundWindow()
  $a = [AAFK]::GetWindowThreadProcessId($fg, [IntPtr]::Zero)
  $b = [AAFK]::GetCurrentThreadId()
  [AAFK]::AttachThreadInput($b, $a, $true) | Out-Null
  [AAFK]::BringWindowToTop($h) | Out-Null
  [AAFK]::SetForegroundWindow($h) | Out-Null
  [AAFK]::AttachThreadInput($b, $a, $false) | Out-Null
  Start-Sleep -Milliseconds 130
}
$orig = [AAFK]::GetForegroundWindow()
$count = 0
Get-Process RobloxPlayerBeta -ErrorAction SilentlyContinue | ForEach-Object {
  $h = $_.MainWindowHandle
  if ($h -eq [IntPtr]::Zero) { return }
  if ($h.ToInt64() -eq $orig.ToInt64()) { return }            # never touch the window you're actively using (your main)
  if ($targets.Count -gt 0 -and ($targets -notcontains $_.Id)) { return }  # if specific alts were picked, limit to them
  $count++
  Focus $h
  ${actionBody(action)}
  ${minimize ? '[AAFK]::ShowWindow($h, 6) | Out-Null   # SW_MINIMIZE — freeze it again for performance' : ''}
}
# return focus to the user's original window (AttachThreadInput = reliable restore)
if ($orig -ne [IntPtr]::Zero) {
  $cur = [AAFK]::GetForegroundWindow()
  $ta = [AAFK]::GetWindowThreadProcessId($cur, [IntPtr]::Zero)
  $tb = [AAFK]::GetCurrentThreadId()
  [AAFK]::AttachThreadInput($tb, $ta, $true) | Out-Null
  [AAFK]::BringWindowToTop($orig) | Out-Null
  [AAFK]::SetForegroundWindow($orig) | Out-Null
  [AAFK]::AttachThreadInput($tb, $ta, $false) | Out-Null
}
Write-Output $count
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

async function wiggle(): Promise<void> {
  let action: AntiAfkAction = 'jump'
  let selected: string[] = []
  let minimize = false
  let mute = false
  try { const s = getSettings(); action = s.antiAfkAction ?? 'jump'; selected = s.antiAfkAccountIds ?? []; minimize = !!s.antiAfkMinimize; mute = !!s.antiAfkMute } catch {}

  // Mute every Roblox instance's audio (re-run each cycle to catch new windows).
  if (mute) setMuteRoblox(true)

  // OPTIONAL restrict: if the user ticked specific alts AND we know their PIDs
  // (we launched them this session), limit input to just those windows. Otherwise
  // (no selection, or PIDs unknown after a restart) the script falls back to ALL
  // Roblox windows except the one you're actively using — see buildScript.
  const pidMap = getRunningPidMap()
  const targetPids = selected.map(id => pidMap[id]).filter((p): p is number => typeof p === 'number')

  // When minimize is on we restore → act → minimize each window, so Roblox stays
  // minimized (frozen, low-perf) between cycles but still receives the action.
  const out = await runPowerShell(buildScript(action, targetPids, minimize))
  const n = parseInt(out.split(/\s+/).pop() ?? '0', 10)
  lastWindowCount = isNaN(n) ? 0 : n
  lastWiggle = new Date().toISOString()

  // Anti-AFK had to FOREGROUND each alt to send real input, which un-minimizes them.
  // Re-apply Resource Trim right now so every window it just opened gets re-minimized
  // + RAM-trimmed immediately, instead of staying open until the next 30s sweep.
  // (No-ops if no Performance option is on; skips the window you're actively using.)
  void trimNow()
}

// ── Public API ────────────────────────────────────────────────────────────────

export function startAntiAfk(minutes?: number): void {
  if (minutes && minutes > 0) intervalMinutes = minutes
  if (timer) clearInterval(timer)

  // Wiggle once immediately, then on the interval
  void wiggle()
  timer = setInterval(() => { void wiggle() }, intervalMinutes * 60 * 1000)
}

export function stopAntiAfk(): void {
  if (timer) { clearInterval(timer); timer = null }
}

export function setAntiAfkInterval(minutes: number): void {
  intervalMinutes = Math.max(1, Math.min(19, minutes))
  if (timer) startAntiAfk(intervalMinutes) // restart with new interval
}

export function isAntiAfkRunning(): boolean {
  return timer !== null
}

export async function getAntiAfkStatus(): Promise<AntiAfkStatus> {
  // windowCount reflects the windows actually kept active on the last cycle.
  return {
    running: timer !== null,
    intervalMinutes,
    windowCount: lastWindowCount,
    lastWiggle,
  }
}

// Close every running Roblox instance and stop the service.
export function leaveAll(): Promise<number> {
  stopAntiAfk()
  clearAllRejoin()       // don't let Auto-Rejoin re-launch what we're force-closing
  unlockRobloxCookies()  // release the RobloxCookies.dat lock

  // macOS: use pkill, Windows: use taskkill
  const isMac = process.platform === 'darwin'

  return new Promise(resolve => {
    const tk = spawn(
      isMac ? 'pkill' : 'taskkill',
      isMac ? ['-9', '-f', 'Roblox'] : ['/F', '/IM', 'RobloxPlayerBeta.exe'],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )
    let out = ''
    tk.stdout?.on('data', d => { out += d.toString() })
    tk.on('close', () => {
      // On macOS, count lines from pkill; on Windows, count SUCCESS matches
      const killed = isMac
        ? (out.match(/\n/g) ?? []).length
        : (out.match(/SUCCESS/gi) ?? []).length
      lastWindowCount = 0
      resolve(killed)
    })
    tk.on('error', () => resolve(0))
  })
}
