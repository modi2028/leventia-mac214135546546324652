import { getSettings } from './store/index.js'
import { startAutoAlt, stopAutoAlt, getAutoAltStatus } from './auto-alting.js'
import { getRunningIds, removeRunning } from './ipc/roblox.js'
import type { AutoAltScheduleWindow, AutoAltScheduleStatus } from '../src/types/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// Scheduled Auto-Alting
//
// Runs the existing auto-alting engine on a daily time schedule. While "now" is
// inside an enabled window, the engine is started with the saved AutoAltConfig;
// when every window ends, it's stopped again (and, optionally, all alts closed).
//
// Edge-triggered on purpose: we start on the rising edge (window opens) and stop
// on the falling edge (window closes). So a user who manually stops automation
// mid-window isn't fought with — it stays off until the next window opens. We
// also only auto-STOP what the schedule itself started, never a run the user
// kicked off by hand. In-memory only → the schedule only fires while the app is
// open (same constraint as Auto-Rejoin).
// ─────────────────────────────────────────────────────────────────────────────

const TICK_MS = 20_000

let timer: ReturnType<typeof setInterval> | null = null
let lastActive = false          // were we inside a window on the previous tick?
let startedBySchedule = false   // did WE start the currently-running engine?

function nowMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

function parseHHMM(s: string): number {
  const [h, m] = (s || '').split(':').map(Number)
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

function dayAllowed(days: number[] | undefined, day: number): boolean {
  return !days || days.length === 0 || days.includes(day)
}

// Is this window live at the given moment? Handles overnight windows (start>end):
// the post-midnight portion is attributed to the window's START day.
export function windowActive(w: AutoAltScheduleWindow, d = new Date()): boolean {
  const cur = nowMinutes(d)
  const s = parseHHMM(w.start)
  const e = parseHHMM(w.end)
  if (s === e) return false                          // zero-length → never
  const day = d.getDay()
  if (s < e) {
    return dayAllowed(w.days, day) && cur >= s && cur < e
  }
  // Overnight: active in [start, midnight) on the start day OR [midnight, end) the next day.
  if (cur >= s) return dayAllowed(w.days, day)
  if (cur < e)  return dayAllowed(w.days, (day + 6) % 7)   // belongs to yesterday's window
  return false
}

function anyWindowActive(windows: AutoAltScheduleWindow[], d = new Date()): boolean {
  return (windows ?? []).some(w => windowActive(w, d))
}

function tick(): void {
  const s = getSettings()
  const sch = s.autoAltSchedule
  if (!sch || !sch.enabled) { lastActive = false; return }

  const active = anyWindowActive(sch.windows)

  if (active && !lastActive) {
    // Rising edge → start the engine (only if it isn't already running and the
    // saved config has a server key + code; startAutoAlt logs its own errors).
    const cfg = s.autoAlt
    if (cfg?.serverKey?.trim() && cfg?.serverCode?.trim() && !getAutoAltStatus().running) {
      if (startAutoAlt(cfg).ok) startedBySchedule = true
    }
  } else if (!active && lastActive) {
    // Falling edge → stop the engine, but only if WE started it.
    if (startedBySchedule && getAutoAltStatus().running) {
      stopAutoAlt()
      if (sch.disconnectOnEnd) { for (const id of getRunningIds()) removeRunning(id) }
    }
    startedBySchedule = false
  }

  lastActive = active
}

export function startAutoAltScheduler(): void {
  if (timer) clearInterval(timer)
  timer = setInterval(tick, TICK_MS)
  tick()   // evaluate immediately on boot (covers starting up inside a window)
}

export function stopAutoAltScheduler(): void {
  if (timer) { clearInterval(timer); timer = null }
}

// Re-evaluate right now (called after the renderer edits the schedule so toggles
// apply instantly instead of waiting for the next tick).
export function refreshSchedule(): void {
  tick()
}

export function getScheduleStatus(): AutoAltScheduleStatus {
  const sch = getSettings().autoAltSchedule
  return {
    enabled: !!sch?.enabled,
    active: !!sch?.enabled && anyWindowActive(sch?.windows ?? []),
    running: getAutoAltStatus().running,
  }
}
