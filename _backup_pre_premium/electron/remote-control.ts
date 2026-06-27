import { getLicense, getSettings, getAccounts } from './store/index.js'
import { deployNow, removeNow } from './auto-alting.js'
import { getRunningIds, removeRunning } from './ipc/roblox.js'
import { getServerStatus } from './erlc-api.js'
import { supabaseEnabled, supabasePollCommands, supabaseAckCommand } from './supabase.js'

// ─────────────────────────────────────────────────────────────────────────────
// Remote control worker
//
// Polls Supabase every 6s for commands the Discord bot queued for THIS install
// (matched by the activated license key), executes them, and acks the result.
// This lets /deployalts in Discord launch alts on this PC.
// ─────────────────────────────────────────────────────────────────────────────

let timer: ReturnType<typeof setInterval> | null = null
let busy = false

async function tick(): Promise<void> {
  if (busy || !supabaseEnabled()) return
  const lic = getLicense()
  if (!lic?.key) return

  busy = true
  try {
    const cmds = await supabasePollCommands(lic.key).catch(() => [])
    for (const c of cmds) {
      let status = 'done'
      let result = ''
      try {
        const cfg = getSettings().autoAlt
        const count = Math.max(1, Math.min(50, Number((c.payload as Record<string, unknown>).count) || 1))

        // Payload overrides take priority over what's saved in app settings.
        const serverKey  = String((c.payload as Record<string, unknown>).serverKey  ?? cfg.serverKey  ?? '').trim()
        const serverCode = String((c.payload as Record<string, unknown>).serverCode ?? cfg.serverCode ?? '').trim()

        switch (c.type) {
          case 'deploy':
            if (!serverKey || !serverCode) {
              status = 'error'
              result = 'No server key/code. Either set them in the app (Premium → Auto Alting) or pass server_code/server_key in the command.'
            } else {
              // Roblox rate-limits auth per IP, so space launches generously to avoid
              // the client-side "429 Authentication Failed". Respect the app's setting
              // but enforce a safe ~12s floor (reliability over raw speed).
              const launchDelay = Math.max(Number(cfg.launchDelay) || 12, 12)
              const launched = await deployNow({ ...cfg, serverKey, serverCode, deployCount: count, launchDelay })
              status = launched > 0 ? 'done' : 'error'
              result = launched > 0
                ? `Launched ${launched}/${count} alt(s) into "${serverCode}".`
                : `No alts launched — check the app log. (Cookies expired, or no available accounts?)`
            }
            break
          case 'remove':
            await removeNow({ ...cfg, serverKey, serverCode, removeCount: count })
            result = `Removing up to ${count} alt(s).`
            break
          case 'stop': {
            let n = 0
            for (const id of getRunningIds()) { if (removeRunning(id)) n++ }
            result = `Stopped ${n} running alt(s).`
            break
          }
          case 'status': {
            if (!serverKey) { status = 'error'; result = 'No server key set. Pass server_key or set it in the app (Premium → Auto Alting).'; break }
            const srv = await getServerStatus(serverKey)
            if (!srv.ok) { status = 'error'; result = `Couldn't read server "${serverCode || '?'}": ${srv.error ?? 'unknown error'}`; break }
            // Cross-reference our launched alts against the live player list.
            const accounts = getAccounts()
            const running = getRunningIds()
            let inServer = 0
            for (const id of running) {
              const acc = accounts.find(a => a.id === id)
              if (acc && srv.names.includes(acc.username.toLowerCase())) inServer++
            }
            const name = srv.name ?? serverCode ?? 'Server'
            result = `🟢 ${name} — ${srv.players}/${srv.maxPlayers} players · Your alts: ${running.length} launched, ${inServer} confirmed in-server`
            break
          }
          default:
            status = 'error'; result = `Unknown command type: ${c.type}`
        }
      } catch (e) {
        status = 'error'; result = e instanceof Error ? e.message : 'execution error'
      }
      await supabaseAckCommand(lic.key, c.id, status, result).catch(() => {})
    }
  } finally {
    busy = false
  }
}

export function startRemoteControl(): void {
  if (timer) clearInterval(timer)
  timer = setInterval(() => void tick(), 6000)
  void tick()
}

export function stopRemoteControl(): void {
  if (timer) { clearInterval(timer); timer = null }
}
