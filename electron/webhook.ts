import { getSettings } from './store/index.js'
import type { WebhookEvents } from '../src/types/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// Discord webhook alerts
//
// Posts event embeds (alts deployed/removed, server busy, cookies expired) to a
// user-configured Discord webhook so they can monitor their alting PC from
// Discord. Fire-and-forget — a webhook failure must never affect the app.
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = { info: 0x7c3aed, success: 0x22c55e, warn: 0xf59e0b, danger: 0xef4444 }

// Only accept real Discord webhook URLs (avoids the setting being abused to POST
// app/account data to an arbitrary host).
const WEBHOOK_RE = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/i

export function isValidWebhookUrl(url: string): boolean {
  return WEBHOOK_RE.test((url || '').trim())
}

interface NotifyOpts {
  event: keyof WebhookEvents
  title: string
  description?: string
  color?: keyof typeof COLORS
  fields?: Array<{ name: string; value: string; inline?: boolean }>
}

async function post(url: string, payload: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch {
    return false
  }
}

function embed(opts: { title: string; description?: string; color?: keyof typeof COLORS; fields?: NotifyOpts['fields'] }) {
  return {
    username: 'Leventia Alting',
    embeds: [{
      title: opts.title,
      description: opts.description,
      color: COLORS[opts.color ?? 'info'],
      fields: opts.fields,
      footer: { text: 'Leventia Alting' },
      timestamp: new Date().toISOString(),
    }],
  }
}

// Post an event alert IF the webhook is enabled and this event type is on.
export async function notify(opts: NotifyOpts): Promise<void> {
  try {
    const s = getSettings()
    if (!s.webhookEnabled || !isValidWebhookUrl(s.webhookUrl)) return
    // Per-event toggle (undefined = on, so older saved settings still fire).
    if (s.webhookEvents && s.webhookEvents[opts.event] === false) return
    await post(s.webhookUrl.trim(), embed(opts))
  } catch { /* never throw from a notification */ }
}

// Send a test message to a specific URL (used by the Settings "Send test" button).
export async function sendTestWebhook(url: string): Promise<{ ok: boolean; error?: string }> {
  const u = (url || '').trim()
  if (!isValidWebhookUrl(u)) return { ok: false, error: 'That is not a valid Discord webhook URL.' }
  const ok = await post(u, embed({
    title: '✅ Webhook connected',
    description: 'Leventia Alting will post alerts here.',
    color: 'success',
  }))
  return ok ? { ok: true } : { ok: false, error: 'Discord rejected the webhook (check the URL).' }
}
