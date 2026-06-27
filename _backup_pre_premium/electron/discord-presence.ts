import net from 'node:net'
import { getRunningIds } from './ipc/roblox.js'

// ─────────────────────────────────────────────────────────────────────────────
// Discord Rich Presence
//
// Connects to the local Discord desktop client over its IPC pipe and shows
// "Playing Leventia Alting" with the logo while the app is open. No third-party
// library — just the raw Discord IPC protocol (handshake + SET_ACTIVITY frames).
//
// SETUP (one-time, in the Discord Developer Portal):
//   • The "Playing <name>" text comes from the APPLICATION's name.
//   • The logo comes from Rich Presence → Art Assets → upload an image named "logo".
//   • Put that application's ID in RPC_APP_ID below.
// ─────────────────────────────────────────────────────────────────────────────

// Default: the existing app id. Replace with a dedicated app named "Leventia Alting"
// (with a "logo" art asset) for exact branding.
const RPC_APP_ID = '1513202224916992121'

const OP_HANDSHAKE = 0
const OP_FRAME = 1

let socket: net.Socket | null = null
let connected = false
let updateTimer: ReturnType<typeof setInterval> | null = null
const startedAt = Date.now()

function encode(op: number, data: unknown): Buffer {
  const json = Buffer.from(JSON.stringify(data))
  const head = Buffer.alloc(8)
  head.writeInt32LE(op, 0)
  head.writeInt32LE(json.length, 4)
  return Buffer.concat([head, json])
}

function buildActivity() {
  let n = 0
  try { n = getRunningIds().length } catch {}
  return {
    details: "Using ERLC's best alting tool, Leventia",
    state: n > 0 ? `Running ${n} alt${n === 1 ? '' : 's'}` : 'Idle',
    assets: { large_image: 'logo', large_text: 'Leventia Alting' },
    timestamps: { start: startedAt },
    instance: false,
  }
}

function sendActivity(): void {
  if (!socket || !connected) return
  try {
    socket.write(encode(OP_FRAME, {
      cmd: 'SET_ACTIVITY',
      args: { pid: process.pid, activity: buildActivity() },
      nonce: String(Date.now()),
    }))
  } catch { /* socket died — close handler reconnects */ }
}

function tryConnect(attempt = 0): void {
  // Discord exposes pipes discord-ipc-0 .. discord-ipc-9. Scan them.
  if (attempt > 9) { setTimeout(() => tryConnect(0), 30000); return } // Discord likely not running — retry later
  const s = net.createConnection(`\\\\?\\pipe\\discord-ipc-${attempt}`)
  let settled = false

  s.once('error', () => {
    if (settled) return
    settled = true
    try { s.destroy() } catch {}
    tryConnect(attempt + 1)
  })

  s.once('connect', () => {
    settled = true
    socket = s
    s.write(encode(OP_HANDSHAKE, { v: 1, client_id: RPC_APP_ID }))
  })

  s.on('data', () => {
    // First frame back from Discord = handshake READY → start showing activity.
    if (!connected && socket === s) { connected = true; sendActivity() }
  })

  s.on('close', () => {
    if (socket === s) {
      connected = false
      socket = null
      setTimeout(() => tryConnect(0), 15000) // Discord closed/restarted — reconnect
    }
  })
}

export function startPresence(): void {
  tryConnect(0)
  if (updateTimer) clearInterval(updateTimer)
  updateTimer = setInterval(sendActivity, 15000) // refresh the alt count live
}
