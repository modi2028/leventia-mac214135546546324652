import { sendErlcCommand } from './erlc-api.js'
import { getSettings } from './store/index.js'
import type { AutoJailStatus } from '../src/types/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// Auto Jail  (companion to Auto Alting)
//
// When enabled, every alt we deploy is put in the in-game jail by running the PRC
// moderation command  :jail <username>  via the API, so the alts stay locked in
// the cell — off the streets and off the live map.
//
// QUEUE + BACKOFF: the PRC command endpoint is rate-limited, so we never fire jail
// commands in a burst. Instead the engine ENQUEUES the alts that need jailing and a
// single worker drains the queue one command at a time, spaced by a user-set delay
// (jailDelaySec). If PRC returns a rate-limit / transient error, the worker keeps
// the alt at the front of the queue and waits jailBackoffSec before retrying — so a
// 429 just pauses the queue instead of dropping the jail. Permanent errors (bad key
// / no perms) are dropped after a few attempts so the queue can't wedge forever.
//
// Self-gates on the `autoJail` setting (checked live), and tracks who's jailed so we
// don't re-spam :jail. An alt that leaves the server is forgotten, so it's re-queued
// if it rejoins.
// ─────────────────────────────────────────────────────────────────────────────

interface QueueItem { username: string; serverKey: string; attempts: number }

const jailed = new Set<string>()    // lowercase usernames confirmed jailed (and still in-server)
const queuedSet = new Set<string>() // lowercase usernames currently sitting in the queue
let queue: QueueItem[] = []
let working = false
let active = false                  // the auto-alting engine is running → Auto Jail is live

let lastJail: string | null = null
let lastError: string | null = null
let jailedCountSnapshot = 0

const MAX_ATTEMPTS = 5              // give up on a single alt after this many failed tries
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Clamp the user's queue timings to sane ranges (seconds).
function delays(): { spacing: number; backoff: number } {
  const s = getSettings()
  return {
    spacing: Math.max(1, Math.min(60, Math.round(s.jailDelaySec || 3))) * 1000,
    backoff: Math.max(3, Math.min(120, Math.round(s.jailBackoffSec || 10))) * 1000,
  }
}

// Reconcile the queue/jailed sets against the alts currently in the server, then
// enqueue any in-server alt we haven't jailed or queued yet. Returns the usernames
// newly added to the queue (so the engine can log it). The worker does the sending.
export function syncJail(serverKey: string, inServerAlts: string[]): string[] {
  if (!active || !getSettings().autoJail) return []

  // Forget alts that have left the server → re-jailed if they rejoin.
  const present = new Set(inServerAlts.map(u => u.toLowerCase()))
  for (const u of [...jailed]) if (!present.has(u)) jailed.delete(u)
  if (queue.length) {
    queue = queue.filter(it => {
      const keep = present.has(it.username.toLowerCase())
      if (!keep) queuedSet.delete(it.username.toLowerCase())
      return keep
    })
  }

  const added: string[] = []
  for (const username of inServerAlts) {
    const key = username.toLowerCase()
    if (jailed.has(key) || queuedSet.has(key)) continue
    queue.push({ username, serverKey, attempts: 0 })
    queuedSet.add(key)
    added.push(username)
  }
  if (queue.length) void runWorker()
  return added
}

async function runWorker(): Promise<void> {
  if (working) return
  working = true
  try {
    while (queue.length) {
      if (!active || !getSettings().autoJail) break   // stopped/disabled → leave the rest queued
      const { spacing, backoff } = delays()
      const item = queue[0]
      const res = await sendErlcCommand(item.serverKey, `:jail ${item.username}`)

      if (res.ok) {
        jailed.add(item.username.toLowerCase())
        queuedSet.delete(item.username.toLowerCase())
        queue.shift()
        lastJail = new Date().toISOString()
        lastError = null
        if (queue.length) await sleep(spacing)   // space the next command
        continue
      }

      // Failure. Rate-limit / transient → wait the backoff and retry the SAME alt.
      lastError = res.error ?? 'jail failed'
      item.attempts++
      if (res.retriable !== false && item.attempts < MAX_ATTEMPTS) {
        await sleep(backoff)
        continue   // item stays at queue[0] → retried
      }
      // Permanent error, or out of attempts → drop it so the queue keeps moving.
      queuedSet.delete(item.username.toLowerCase())
      queue.shift()
      if (queue.length) await sleep(spacing)
    }
  } finally {
    working = false
  }
}

// ── Lifecycle (called by the auto-alting engine) ──────────────────────────────

export function startAutoJail(): void {
  active = true
  jailed.clear()
  queue = []
  queuedSet.clear()
  lastError = null
}

export function stopAutoJail(): void {
  active = false
  jailed.clear()
  queue = []
  queuedSet.clear()
  lastJail = null
  lastError = null
}

export function getAutoJailStatus(): AutoJailStatus {
  jailedCountSnapshot = jailed.size
  return {
    running: active,
    enabled: !!getSettings().autoJail,
    jailedCount: jailedCountSnapshot,
    queued: queue.length,
    lastJail,
    lastError,
  }
}
