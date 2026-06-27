// ─────────────────────────────────────────────────────────────────────────────
// Global kill-switch state — the single source of truth the launch core checks.
//
// Kept in its OWN module with NO imports so the launch core (ipc/roblox.ts) can
// consult it without importing the killswitch worker (which imports the launch
// core, the auto-alt engine, etc.) — avoiding an import cycle. The worker
// (killswitch.ts) is the only writer; everything else only reads isKilled().
// ─────────────────────────────────────────────────────────────────────────────

let killed = false

export function setAppKilled(v: boolean): void { killed = v }
export function isAppKilled(): boolean { return killed }
