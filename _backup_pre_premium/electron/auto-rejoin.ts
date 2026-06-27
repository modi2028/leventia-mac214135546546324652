import { getAccounts, getSettings } from './store/index.js'
import { deployErlc, getRunningIds } from './ipc/roblox.js'
import { rejoinList, touchRejoin, unwatchRejoin } from './rejoin-watch.js'
import { notify } from './webhook.js'

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Rejoin (Premium)
//
// Every 60s, presence-checks the app-launched accounts we're watching. Any that
// are no longer in-game (kicked / crashed / disconnected) get re-queued for launch
// with the SAME server code. A grace window after each (re)launch avoids
// re-launching a client that's simply still loading back in.
//
// Limits (by design): only runs while the app is open; a dead cookie or a changed
// server code makes the rejoin fail; bursts of drops are spaced by the launch queue.
// ─────────────────────────────────────────────────────────────────────────────

const ERLC_PLACE_ID = '2534724415'
const GRACE_MS = 120_000   // don't judge an account as "dropped" within 2 min of a launch
const POLL_MS  = 60_000

let timer: ReturnType<typeof setInterval> | null = null
let busy = false

async function fetchPresence(userIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>()
  if (!userIds.length) return map
  try {
    const res = await fetch('https://presence.roblox.com/v1/presence/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ userIds }),
    })
    if (!res.ok) return map
    const data = await res.json() as { userPresences?: Array<{ userId: number; userPresenceType: number }> }
    for (const p of data.userPresences ?? []) map.set(p.userId, p.userPresenceType)
  } catch { /* network — treat as unknown, don't rejoin on uncertainty */ }
  return map
}

async function tick(): Promise<void> {
  if (busy) return
  try {
    if (!getSettings().autoRejoinEnabled) return
    const now = Date.now()
    // Watched accounts past their grace window (skip ones still loading in).
    const ready = rejoinList().filter(w => now - w.lastLaunchAt > GRACE_MS)
    if (!ready.length) return

    const accounts = getAccounts()
    const targets = ready
      .map(w => ({ w, acc: accounts.find(a => a.id === w.accountId) }))
      .filter((x): x is { w: typeof ready[number]; acc: NonNullable<typeof x.acc> } => !!x.acc && !!x.acc.cookie)
    if (!targets.length) return

    busy = true
    const presence = await fetchPresence(targets.map(t => t.acc.userId))

    for (const { w, acc } of targets) {
      const pt = presence.get(acc.userId)
      // pt: 0 offline, 1 online(web), 2 in-game, 3 studio. Only re-queue on a
      // KNOWN not-in-game state; skip undefined (presence unknown) to avoid
      // rejoining on a failed lookup.
      if (pt === undefined || pt === 2) continue

      touchRejoin(w.accountId)   // reset grace so the next tick doesn't double-launch while it reconnects
      const res = await deployErlc(acc.cookie!, ERLC_PLACE_ID, w.code, w.accountId)
      if (res.success) {
        void notify({ event: 'deploy', title: '🔁 Auto-Rejoin', color: 'warn',
          description: `**${acc.username}** dropped — re-queued into \`${w.code}\`.` })
      } else {
        // Couldn't get an auth ticket (e.g. expired cookie) → stop retrying it.
        unwatchRejoin(w.accountId)
      }
    }
  } catch { /* never let the loop throw */ }
  finally { busy = false }
}

export function startAutoRejoin(): void {
  if (timer) clearInterval(timer)
  timer = setInterval(() => void tick(), POLL_MS)
}

export function stopAutoRejoin(): void {
  if (timer) { clearInterval(timer); timer = null }
}
