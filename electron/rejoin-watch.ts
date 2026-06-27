// ─────────────────────────────────────────────────────────────────────────────
// Auto-Rejoin watch list — which app-launched accounts should be kept in-game,
// and the server code to re-queue them with. Kept in its OWN module (no imports)
// so the launch core (ipc/roblox.ts) can record launches without importing the
// rejoin service, which would create a circular import.
//
// In-memory only → Auto-Rejoin only works while the app is open (by design).
// ─────────────────────────────────────────────────────────────────────────────

interface Watch { code: string; lastLaunchAt: number }
const watching = new Map<string, Watch>()

// Record that an account was launched into a server (arms the grace timer).
export function watchForRejoin(accountId: string, code: string): void {
  if (code) watching.set(accountId, { code, lastLaunchAt: Date.now() })
}

// Stop watching (manual disconnect, auto-alt removal, or a dead account).
export function unwatchRejoin(accountId: string): void {
  watching.delete(accountId)
}

// Reset the grace timer (e.g. right before a re-queue) so we don't double-launch
// while the client is still loading back in.
export function touchRejoin(accountId: string): void {
  const w = watching.get(accountId)
  if (w) w.lastLaunchAt = Date.now()
}

// Stop watching everything (panic / leave-all → Auto-Rejoin must not undo it).
export function clearAllRejoin(): void {
  watching.clear()
}

export function rejoinList(): Array<{ accountId: string; code: string; lastLaunchAt: number }> {
  return [...watching.entries()].map(([accountId, v]) => ({ accountId, code: v.code, lastLaunchAt: v.lastLaunchAt }))
}
