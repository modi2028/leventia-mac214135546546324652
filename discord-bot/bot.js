// ─────────────────────────────────────────────────────────────────────────────
// Leventia Alting — Discord key bot
//
// Issues / revokes / extends license keys by calling the SAME Supabase RPC
// backend the desktop app uses (supabase-schema-secure.sql). It holds a STAFF
// KEY in .env and passes it as p_staff_key; the database verifies it (HMAC vs a
// server-only secret) before doing anything. No signing secret ever lives here.
//
//   Premium key  -> role "club33"  (unlocks the Premium category in the app)
//   Basic  key   -> role "standard"
//
// Commands (restricted to your staff role / admins):
//   /genkey  plan:[Premium|Basic] months:[1-24] user:[@user] discord_id:[id]
//   /revoke  key:[LVNT-...]
//   /enable  key:[LVNT-...]
//   /extend  key:[LVNT-...] days:[n]
//   /keyinfo query:[discord id or username]
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config'
import {
  Client, GatewayIntentBits, REST, Routes,
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, ActivityType,
  ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Config ───────────────────────────────────────────────────────────────────
const {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,            // optional: register commands instantly to one server
  ADMIN_ROLE_ID,       // full access (comma-separated for multiple). Else Discord Admins.
  KEY_ROLE_ID,         // key-issuer access: /genkey + /keyinfo only (comma-separated ok)
  MOD_ROLE_ID,         // moderation access: ban/kick/mute/etc. (comma-separated ok)
  LVNT_STAFF_KEY,      // a valid LVNT-STAFF-... key (authorizes every RPC call)
  WORKER_LICENSE_KEY,  // the license key the alting PC is activated with (deploy target)
} = process.env
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uwnrvdtsqtfrlbxtffys.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_vKsSKm7qg9w0Pn_ldidpDQ_f_a9Payv'
// Dedicated LOW-PRIVILEGE bot token (member perms only, no admin) used purely to
// fetch users' avatars by id for the leaderboard. Kept on the host only — never
// shipped in the desktop app. Falls back to the main token if not set.
const AVATAR_BOT_TOKEN = process.env.AVATAR_BOT_TOKEN || DISCORD_TOKEN
const ADMIN_ROLE_IDS = (ADMIN_ROLE_ID || '').split(',').map(s => s.trim()).filter(Boolean)
const KEY_ROLE_IDS   = (KEY_ROLE_ID  || '').split(',').map(s => s.trim()).filter(Boolean)
const MOD_ROLE_IDS   = (MOD_ROLE_ID  || '').split(',').map(s => s.trim()).filter(Boolean)

// ── Tickets ──
const TICKET_PANEL_CHANNEL_ID = process.env.TICKET_PANEL_CHANNEL_ID || '1511076294849466602'
const TICKET_CATEGORY_ID      = (process.env.TICKET_CATEGORY_ID || '').trim()
const TICKET_LOG_CHANNEL_ID   = (process.env.TICKET_LOG_CHANNEL_ID || '').trim() // transcripts go here
const SUPPORT_ROLE_IDS        = (process.env.SUPPORT_ROLE_ID || '').split(',').map(s => s.trim()).filter(Boolean)

// ── Staff promotions / demotions ──
const PROMO_CHANNEL_ID = process.env.PROMO_CHANNEL_ID || '1513285194847748157'

// ── Website / download link ──
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://leventia.xyz/download'

// ── Pricing ───────────────────────────────────────────────────────────────────
// Channel the /price list is posted to (override per-use with the "channel" option).
const PRICE_CHANNEL_ID = process.env.PRICE_CHANNEL_ID || '1511075149682839653'
// EDIT THESE PRICES, then run: pm2 restart leventia-key-bot
const PRICES = {
  basic1:   { robux: '???', usd: '???' }, // Basic — 1 Month
  basic3:   { robux: '???', usd: '???' }, // Basic — 3 Months
  premium1: { robux: '???', usd: '???' }, // Premium — 1 Month
  premium3: { robux: '???', usd: '???' }, // Premium — 3 Months
}

// ── Moderation logs (persisted to modlogs.json next to bot.js) ──
const LOGS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'modlogs.json')
let modLogs = {}
try { modLogs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8')) } catch { modLogs = {} }
function addLog(userId, entry) {
  if (!modLogs[userId]) modLogs[userId] = []
  modLogs[userId].push({ ...entry, at: Date.now() })
  try { fs.writeFileSync(LOGS_FILE, JSON.stringify(modLogs)) } catch (e) { console.error('saveLogs:', e?.message) }
}

// ── Giveaways (persisted to giveaways.json) ──
const GIVEAWAYS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'giveaways.json')
let giveaways = {}
try { giveaways = JSON.parse(fs.readFileSync(GIVEAWAYS_FILE, 'utf8')) } catch { giveaways = {} }
const saveGiveaways = () => { try { fs.writeFileSync(GIVEAWAYS_FILE, JSON.stringify(giveaways)) } catch (e) { console.error('saveGiveaways:', e?.message) } }

for (const [k, v] of Object.entries({ DISCORD_TOKEN, CLIENT_ID, LVNT_STAFF_KEY })) {
  if (!v) { console.error(`✖ Missing required env var: ${k} (see .env.example)`); process.exit(1) }
}

// ── Security hardening ────────────────────────────────────────────────────────
// 1) Scrub secrets from EVERY console line + user-facing message, so a token, staff
//    key, Supabase key, or license key can never leak through a log or an error.
const SECRETS = [DISCORD_TOKEN, LVNT_STAFF_KEY, SUPABASE_KEY, WORKER_LICENSE_KEY, AVATAR_BOT_TOKEN].filter(Boolean)
function redact(input) {
  let s = typeof input === 'string' ? input : String(input ?? '')
  for (const sec of SECRETS) if (sec && s.includes(sec)) s = s.split(sec).join('[REDACTED]')
  s = s.replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{20,}/g, '[REDACTED_TOKEN]') // bot token shape
  s = s.replace(/LVNT-[A-Z]+-[A-Z0-9-]+/gi, '[REDACTED_KEY]')                                     // any LVNT key
  s = s.replace(/sb_[A-Za-z0-9_]+/g, '[REDACTED_KEY]')                                              // Supabase keys
  return s
}
for (const m of ['log', 'warn', 'error']) {
  const orig = console[m].bind(console)
  console[m] = (...args) => orig(...args.map(a => {
    if (typeof a === 'string') return redact(a)
    if (a instanceof Error) { try { a.message = redact(a.message); if (a.stack) a.stack = redact(a.stack) } catch {} return a }
    return a
  }))
}

// 2) Never let an unhandled error crash the bot or dump state — log it redacted.
process.on('unhandledRejection', r => console.error('unhandledRejection:', redact(String((r && r.stack) || r))))
process.on('uncaughtException',  e => console.error('uncaughtException:',  redact(String((e && e.stack) || e))))

// 3) Per-user rate limit — blocks command/button spam and brute-force attempts.
const _cmdHits = new Map()
function rateLimited(userId) {
  const now = Date.now()
  const hits = (_cmdHits.get(userId) || []).filter(t => now - t < 10_000)
  hits.push(now)
  _cmdHits.set(userId, hits)
  if (_cmdHits.size > 5000) _cmdHits.clear() // bound memory
  return hits.length > 6 // max 6 actions per 10s per user
}

// ── Supabase RPC helper (mirrors electron/supabase.ts) ───────────────────────
async function rpc(fn, args) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    })
    const text = await res.text()
    let data = null
    if (text) { try { data = JSON.parse(text) } catch { data = text } }
    if (!res.ok) {
      const msg = (data && data.message) || (typeof data === 'string' && data) || `Server error (HTTP ${res.status}).`
      return { ok: false, error: msg }
    }
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'Could not reach the license server.' }
  }
}

// ── Avatar auto-sync ──────────────────────────────────────────────────────────
// Keeps every registered user's Discord avatar fresh for the leaderboard. Runs on
// the host only, using the low-priv AVATAR_BOT_TOKEN to look users up BY ID via the
// Discord REST API (GET /users/:id), then stores the hash in Supabase. The desktop
// app never holds a token — it just reads the resulting CDN URL.
let avatarSyncRunning = false
async function refreshAvatars() {
  if (avatarSyncRunning || !AVATAR_BOT_TOKEN) return
  avatarSyncRunning = true
  try {
    const t = await rpc('rpc_avatar_targets', { p_staff_key: LVNT_STAFF_KEY })
    const ids = Array.isArray(t.data) ? t.data : []
    let updated = 0
    for (const id of ids) {
      try {
        const res = await fetch(`https://discord.com/api/v10/users/${id}`, { headers: { Authorization: `Bot ${AVATAR_BOT_TOKEN}` } })
        if (res.status === 429) { await new Promise(r => setTimeout(r, 3000)); continue }
        if (!res.ok) continue
        const u = await res.json()
        await rpc('rpc_set_avatar', { p_staff_key: LVNT_STAFF_KEY, p_discord_id: String(id), p_avatar: u.avatar ?? '' })
        updated++
      } catch { /* skip this user */ }
      await new Promise(r => setTimeout(r, 600))   // throttle to stay under rate limits
    }
    console.log(`✓ Avatar sync: refreshed ${updated}/${ids.length} user avatar(s)`)
  } catch (e) { console.error('avatar sync:', e?.message ?? e) }
  finally { avatarSyncRunning = false }
}

const roleLabel = (role) => (role === 'club33' ? 'Premium' : role === 'staff' ? 'Staff' : 'Basic')
const maskKey = (k) => { const p = String(k).split('-'); return p.length < 4 ? String(k) : `${p[0]}-${p[1]}-****-****-${p[p.length - 1]}` }
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—')
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—')

// ── Slash command definitions ────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('genkey').setDescription('Generate a Leventia license key')
    .addStringOption(o => o.setName('plan').setDescription('Key tier').setRequired(true)
      .addChoices({ name: 'Premium', value: 'club33' }, { name: 'Basic', value: 'standard' }))
    .addIntegerOption(o => o.setName('months').setDescription('Duration in months (default 1) — ignored if lifetime is on').setMinValue(1).setMaxValue(60))
    .addBooleanOption(o => o.setName('lifetime').setDescription('Lifetime key that never expires (ignores months)'))
    .addUserOption(o => o.setName('user').setDescription('Recipient — DMs them the key + enables User Lookup'))
    .addStringOption(o => o.setName('discord_id').setDescription('Recipient Discord ID (if not @-selecting a user)')),
  new SlashCommandBuilder()
    .setName('revoke').setDescription('Revoke a license key')
    .addStringOption(o => o.setName('key').setDescription('The license key (LVNT-...)').setRequired(true)),
  new SlashCommandBuilder()
    .setName('enable').setDescription('Re-enable a revoked key')
    .addStringOption(o => o.setName('key').setDescription('The license key (LVNT-...)').setRequired(true)),
  new SlashCommandBuilder()
    .setName('extend').setDescription('Extend a key by N days')
    .addStringOption(o => o.setName('key').setDescription('The license key (LVNT-...)').setRequired(true))
    .addIntegerOption(o => o.setName('days').setDescription('Days to add').setRequired(true).setMinValue(1).setMaxValue(3650)),
  new SlashCommandBuilder()
    .setName('keyrevoke').setDescription('Revoke a license key')
    .addStringOption(o => o.setName('key').setDescription('The license key (LVNT-...)').setRequired(true)),
  new SlashCommandBuilder()
    .setName('link').setDescription('Link a license key to a Discord user (for User Lookup)')
    .addUserOption(o => o.setName('user').setDescription('Discord user to link the key to').setRequired(true))
    .addStringOption(o => o.setName('key').setDescription('The license key (LVNT-...)').setRequired(true)),
  new SlashCommandBuilder()
    .setName('keyinfo').setDescription('Look up a user / key by Discord ID or username')
    .addStringOption(o => o.setName('query').setDescription('Discord ID or username').setRequired(true)),
  // ── Moderation ──
  new SlashCommandBuilder()
    .setName('ban').setDescription('Ban a member, or a user ID (works for people not in the server)')
    .addUserOption(o => o.setName('user').setDescription('Member to ban'))
    .addStringOption(o => o.setName('user_id').setDescription('User ID to ban (for people not in the server)'))
    .addStringOption(o => o.setName('reason').setDescription('Reason'))
    .addIntegerOption(o => o.setName('delete_days').setDescription('Delete their messages from the last N days (0-7)').setMinValue(0).setMaxValue(7)),
  new SlashCommandBuilder()
    .setName('kick').setDescription('Kick a member from the server')
    .addUserOption(o => o.setName('user').setDescription('Member to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),
  new SlashCommandBuilder()
    .setName('mute').setDescription('Timeout (mute) a member')
    .addUserOption(o => o.setName('user').setDescription('Member to mute').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('Duration in minutes (default 60, max 40320 = 28d)').setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),
  new SlashCommandBuilder()
    .setName('unmute').setDescription('Remove a member\'s timeout')
    .addUserOption(o => o.setName('user').setDescription('Member to unmute').setRequired(true)),
  new SlashCommandBuilder()
    .setName('unban').setDescription('Unban a user by their ID')
    .addStringOption(o => o.setName('user_id').setDescription('User ID to unban').setRequired(true)),
  new SlashCommandBuilder()
    .setName('purge').setDescription('Bulk-delete recent messages in this channel')
    .addIntegerOption(o => o.setName('amount').setDescription('How many messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder()
    .setName('warn').setDescription('Warn a member (DMs them the reason)')
    .addUserOption(o => o.setName('user').setDescription('Member to warn').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),
  new SlashCommandBuilder()
    .setName('logs').setDescription("View a member's moderation history (warns, mutes, kicks, bans)")
    .addUserOption(o => o.setName('user').setDescription('Member to look up').setRequired(true)),
  // ── Tickets ──
  new SlashCommandBuilder()
    .setName('ticketpanel').setDescription('Post the ticket panel (Open Ticket button)')
    .addChannelOption(o => o.setName('channel').setDescription('Where to post it (defaults to the configured tickets channel)')),
  new SlashCommandBuilder()
    .setName('add').setDescription('Add a member to the current ticket')
    .addUserOption(o => o.setName('user').setDescription('Member to add').setRequired(true)),
  new SlashCommandBuilder()
    .setName('remove').setDescription('Remove a member from the current ticket')
    .addUserOption(o => o.setName('user').setDescription('Member to remove').setRequired(true)),
  new SlashCommandBuilder()
    .setName('close').setDescription('Close the current ticket (saves a transcript)')
    .addStringOption(o => o.setName('reason').setDescription('Reason for closing')),
  // ── Staff promotions / demotions ──
  new SlashCommandBuilder()
    .setName('promote').setDescription('Announce a staff promotion')
    .addUserOption(o => o.setName('user').setDescription('Staff member being promoted').setRequired(true))
    .addStringOption(o => o.setName('old_rank').setDescription('Their current / old rank').setRequired(true))
    .addStringOption(o => o.setName('new_rank').setDescription('Their new rank').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the promotion').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Override the announcement channel')),
  new SlashCommandBuilder()
    .setName('demote').setDescription('Announce a staff demotion')
    .addUserOption(o => o.setName('user').setDescription('Staff member being demoted').setRequired(true))
    .addStringOption(o => o.setName('old_rank').setDescription('Their current / old rank').setRequired(true))
    .addStringOption(o => o.setName('new_rank').setDescription('Their new rank').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the demotion').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Override the announcement channel')),
  new SlashCommandBuilder()
    .setName('price').setDescription('Post the Leventia price list')
    .addChannelOption(o => o.setName('channel').setDescription('Override the price channel')),
  new SlashCommandBuilder()
    .setName('giveaway').setDescription('Start a giveaway')
    .addStringOption(o => o.setName('prize').setDescription('What are you giving away?').setRequired(true))
    .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setRequired(true).setMinValue(1).setMaxValue(50))
    .addIntegerOption(o => o.setName('days').setDescription('How many days it lasts').setRequired(true).setMinValue(0).setMaxValue(365))
    .addIntegerOption(o => o.setName('minutes').setDescription('Extra minutes (for short giveaways / testing)').setMinValue(0).setMaxValue(1440))
    .addChannelOption(o => o.setName('channel').setDescription('Channel to post in (default: here)')),
  new SlashCommandBuilder()
    .setName('reroll').setDescription('Reroll the winner(s) of an ended giveaway')
    .addStringOption(o => o.setName('message_id').setDescription('The giveaway message ID (right-click it → Copy Message ID)').setRequired(true))
    .addIntegerOption(o => o.setName('winners').setDescription('How many new winners (default 1)').setMinValue(1).setMaxValue(50)),
  // ── More moderation ──
  new SlashCommandBuilder()
    .setName('slowmode').setDescription('Set channel slowmode')
    .addIntegerOption(o => o.setName('seconds').setDescription('Seconds (0 to disable, max 21600)').setRequired(true).setMinValue(0).setMaxValue(21600))
    .addChannelOption(o => o.setName('channel').setDescription('Channel (default: here)')),
  new SlashCommandBuilder()
    .setName('lock').setDescription("Lock a channel (members can't send messages)")
    .addChannelOption(o => o.setName('channel').setDescription('Channel (default: here)'))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),
  new SlashCommandBuilder()
    .setName('unlock').setDescription('Unlock a channel')
    .addChannelOption(o => o.setName('channel').setDescription('Channel (default: here)')),
  new SlashCommandBuilder()
    .setName('clearwarns').setDescription("Clear a member's moderation logs")
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder()
    .setName('nick').setDescription("Change or reset a member's nickname")
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('nickname').setDescription('New nickname (leave empty to reset)')),
  new SlashCommandBuilder()
    .setName('role').setDescription('Add or remove a role from a member')
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Role to add/remove').setRequired(true))
    .addStringOption(o => o.setName('action').setDescription('Add or remove').setRequired(true)
      .addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' })),
  // ── Admin utilities ──
  new SlashCommandBuilder()
    .setName('say').setDescription('Make the bot send a message')
    .addStringOption(o => o.setName('message').setDescription('What to say').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Channel (default: here)')),
  new SlashCommandBuilder()
    .setName('announce').setDescription('Post an embed announcement')
    .addStringOption(o => o.setName('title').setDescription('Title').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Body (use \\n for new lines)').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Channel (default: here)')),
  // ── Public ──
  new SlashCommandBuilder()
    .setName('website').setDescription('Send the link to download Leventia'),
  new SlashCommandBuilder()
    .setName('ping').setDescription("Check the bot's latency"),
  new SlashCommandBuilder()
    .setName('userinfo').setDescription('Show info about a user')
    .addUserOption(o => o.setName('user').setDescription('User (default: you)')),
  new SlashCommandBuilder()
    .setName('avatar').setDescription("Show a user's avatar")
    .addUserOption(o => o.setName('user').setDescription('User (default: you)')),
  new SlashCommandBuilder()
    .setName('serverinfo').setDescription('Show server info'),
  new SlashCommandBuilder()
    .setName('serverpeek').setDescription('Live ER:LC server status (players, queue, staff, teams)')
    .addStringOption(o => o.setName('server_key').setDescription('ER:LC server API key').setRequired(true)),
  // ── Alt control — multi-tenant (each user's key drives their own alting PC) ──
  new SlashCommandBuilder()
    .setName('register').setDescription('Link your Leventia license key to your Discord so /deployalts works')
    .addStringOption(o => o.setName('key').setDescription('Your Leventia license key (LVNT-...)').setRequired(true)),
  new SlashCommandBuilder()
    .setName('unregister').setDescription('Unlink a license key from your Discord account')
    .addStringOption(o => o.setName('key').setDescription('Pick which of your linked keys to unlink').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder()
    .setName('deployalts').setDescription('Launch alts into an ER:LC server (requires /register first)')
    .addIntegerOption(o => o.setName('count').setDescription('How many alts to deploy').setRequired(true).setMinValue(1).setMaxValue(50))
    .addStringOption(o => o.setName('server_code').setDescription('ER:LC server code — overrides the code saved in the app (e.g. ocrps)'))
    .addStringOption(o => o.setName('server_key').setDescription('ER:LC server API key — overrides the key saved in the app')),
  new SlashCommandBuilder()
    .setName('removealts').setDescription('Remove alts from the ER:LC server (requires /register first)')
    .addIntegerOption(o => o.setName('count').setDescription('How many to remove').setRequired(true).setMinValue(1).setMaxValue(50)),
  new SlashCommandBuilder()
    .setName('stopalts').setDescription('Disconnect ALL running alts on your PC (requires /register first)'),
  new SlashCommandBuilder()
    .setName('altstatus').setDescription('Show live server + alt status (requires /register first)')
    .addStringOption(o => o.setName('server_code').setDescription('ER:LC server code to check (defaults to the one saved in the app)'))
    .addStringOption(o => o.setName('server_key').setDescription('ER:LC server key (defaults to the one saved in the app)')),
  new SlashCommandBuilder()
    .setName('antiafk').setDescription('Toggle Anti-AFK on your alting PC so alts stay in-game (requires /register first)')
    .addBooleanOption(o => o.setName('enabled').setDescription('On = keep alts moving so Roblox won\'t kick them; off = stop (default on)'))
    .addIntegerOption(o => o.setName('interval').setDescription('Minutes between movements (1-19, default 5)').setMinValue(1).setMaxValue(19)),
].map(c => c.toJSON())

// ── Authorization ─────────────────────────────────────────────────────────────
const hasRole = (interaction, ids) => ids.some(id => interaction.member?.roles?.cache?.has(id))
const ISSUER_COMMANDS = ['genkey', 'keyinfo']                                  // key-issuer role
const MOD_COMMANDS    = ['ban', 'kick', 'mute', 'unmute', 'unban', 'purge', 'warn', 'logs', 'promote', 'demote', 'giveaway', 'reroll', 'slowmode', 'lock', 'unlock', 'clearwarns', 'nick', 'role', 'extend', 'keyinfo', 'revoke', 'keyrevoke', 'enable'] // mod role (incl. key extend/revoke/enable/lookup)
const TICKET_COMMANDS = ['add', 'remove']                                      // support staff
const PUBLIC_COMMANDS = ['website', 'ping', 'userinfo', 'avatar', 'serverinfo', 'serverpeek',
  'register', 'unregister', 'deployalts', 'removealts', 'stopalts', 'altstatus', 'antiafk',
  'close'] // anyone may RUN these (close is gated to the opener/support inside the handler)
// Of those, only these reply publicly. Everything else (register, alt control, all
// mod/admin commands) replies EPHEMERALLY so keys/results stay private to the runner.
const PUBLIC_REPLY = ['website', 'ping', 'userinfo', 'avatar', 'serverinfo']
// Backend-touching commands (your Supabase keys + your alting PC) — only usable in
// YOUR home server (GUILD_ID). Other servers that add the bot can't touch your backend.
const HOME_ONLY = ['genkey', 'revoke', 'keyrevoke', 'enable', 'extend', 'link', 'keyinfo']

// Commands that must work in ANY server AND as a user-installed app ("integration"):
// the per-user remote-alting controls + read-only utilities. These are keyed to the
// caller's own license, so they're safe to run anywhere.
const ANYWHERE_COMMANDS = new Set([
  'website', 'ping', 'userinfo', 'avatar', 'serverinfo', 'serverpeek',
  'register', 'unregister', 'deployalts', 'removealts', 'stopalts', 'altstatus', 'antiafk',
])
// Inject Discord install/context targeting into the raw command JSON (works on any
// discord.js version). integration_types: 0 = guild install, 1 = user install.
// contexts: 0 = guild, 1 = bot DM, 2 = private channel. "Anywhere" commands allow
// both installs + all contexts when the app supports user-install; everything else
// stays guild-install/guild-only. NOTE: sending integration_types:[1] when the app
// does NOT allow user-install makes Discord reject the WHOLE batch — so the caller
// passes allowUserInstall based on the app's actual configuration.
function buildRegisterBody(allowUserInstall) {
  return commands.map(c => (allowUserInstall && ANYWHERE_COMMANDS.has(c.name))
    ? { ...c, integration_types: [0, 1], contexts: [0, 1, 2] }
    : { ...c, integration_types: [0], contexts: [0] })
}
// Admins can run everything; issuers only ISSUER_COMMANDS; mods only MOD_COMMANDS;
// support staff can run TICKET_COMMANDS. In foreign servers, only that server's
// Discord Admins qualify (your role IDs don't exist there).
function canRun(interaction, cmd) {
  if (!interaction.inGuild()) return false
  if (HOME_ONLY.includes(cmd) && (!GUILD_ID || interaction.guildId !== GUILD_ID)) return false
  const isAdmin = (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false)
    || (ADMIN_ROLE_IDS.length > 0 && hasRole(interaction, ADMIN_ROLE_IDS))
  if (isAdmin) return true
  if (KEY_ROLE_IDS.length && hasRole(interaction, KEY_ROLE_IDS) && ISSUER_COMMANDS.includes(cmd)) return true
  if (MOD_ROLE_IDS.length && hasRole(interaction, MOD_ROLE_IDS) && MOD_COMMANDS.includes(cmd)) return true
  if (TICKET_COMMANDS.includes(cmd) && hasRole(interaction, supportRoleIds())) return true
  return false
}

const ACCENT = 0x7c3aed
const ephemeral = { flags: MessageFlags.Ephemeral }

// ── Command handlers ──────────────────────────────────────────────────────────
async function handleGenkey(interaction) {
  const role = interaction.options.getString('plan')           // 'club33' | 'standard'
  const lifetime = interaction.options.getBoolean('lifetime') ?? false
  // Lifetime = ~100-year expiry (effectively never expires; works in the program).
  const months = lifetime ? 1200 : (interaction.options.getInteger('months') ?? 1)
  const user = interaction.options.getUser('user')
  const discordId = user?.id ?? interaction.options.getString('discord_id') ?? ''
  const discordUsername = user?.username ?? ''

  const r = await rpc('rpc_issue_key', {
    p_staff_key: LVNT_STAFF_KEY,
    p_months: months,
    p_role: role,
    p_discord_id: discordId,
    p_discord_username: discordUsername,
  })
  if (!r.ok || !r.data?.key) {
    return interaction.editReply({ content: `✖ ${r.error || r.data?.error || 'Failed to generate key.'}` })
  }
  const { key, expiresAt } = r.data
  const tier = roleLabel(role)
  const expiryStr = lifetime ? 'Lifetime (never expires)' : fmtDate(expiresAt)
  const durationStr = lifetime ? 'Lifetime' : `${months} month${months > 1 ? 's' : ''}`

  // Try to DM the recipient their key.
  let dmNote = ''
  if (user) {
    try {
      const dm = new EmbedBuilder().setColor(ACCENT).setTitle(`🔑 Your Leventia ${tier} key`)
        .setDescription(`\`\`\`\n${key}\n\`\`\``)
        .addFields({ name: 'Expires', value: expiryStr })
        .setFooter({ text: 'Paste this on the activation screen. Keep it private — it binds to one device.' })
      await user.send({ embeds: [dm] })
      dmNote = `\n📨 DM'd to <@${user.id}>.`
    } catch {
      dmNote = `\n⚠️ Could not DM <@${user.id}> (DMs closed) — send it manually.`
    }
  }

  const embed = new EmbedBuilder().setColor(ACCENT).setTitle(`✅ ${tier} key generated`)
    .setDescription(`\`\`\`\n${key}\n\`\`\``)
    .addFields(
      { name: 'Tier', value: tier, inline: true },
      { name: 'Duration', value: durationStr, inline: true },
      { name: 'Expires', value: expiryStr, inline: true },
      ...(discordId ? [{ name: 'Recipient', value: user ? `<@${user.id}>` : discordId, inline: true }] : []),
    )
  return interaction.editReply({ content: dmNote.trim() || undefined, embeds: [embed] })
}

async function handleStatus(interaction, status) {
  const key = interaction.options.getString('key').trim().toUpperCase()
  const r = await rpc('rpc_set_status', { p_staff_key: LVNT_STAFF_KEY, p_key: key, p_status: status })
  if (!r.ok) return interaction.editReply({ content: `✖ ${r.error || 'Action failed.'}` })
  const verb = status === 'revoked' ? '🚫 Revoked' : '✅ Re-enabled'
  return interaction.editReply({ content: `${verb} \`${key}\`` })
}

async function handleExtend(interaction) {
  const key = interaction.options.getString('key').trim().toUpperCase()
  const days = interaction.options.getInteger('days')
  if (/^LVNT-STAFF-/.test(key)) {
    return interaction.editReply({ content: "⛔ Master `LVNT-STAFF` keys can't be extended — their expiry is cryptographically baked into the key. Mint a new one with a later date instead.\n(Distributable `role=staff` keys like `LVNT-BASIC-…` *can* be extended.)" })
  }
  const r = await rpc('rpc_extend', { p_staff_key: LVNT_STAFF_KEY, p_key: key, p_days: days })
  if (!r.ok) return interaction.editReply({ content: `✖ ${r.error || 'Extend failed.'}` })
  return interaction.editReply({ content: `🗓️ Extended \`${key}\` by **${days}** day${days > 1 ? 's' : ''}.` })
}

async function handleLink(interaction) {
  const user = interaction.options.getUser('user')
  const key = interaction.options.getString('key').trim().toUpperCase()
  const r = await rpc('rpc_link_discord', {
    p_staff_key: LVNT_STAFF_KEY, p_key: key,
    p_discord_id: user.id, p_discord_username: user.username,
  })
  if (!r.ok || r.data?.error) return interaction.editReply({ content: `✖ ${r.error || r.data?.error || 'Link failed.'}` })
  return interaction.editReply({ content: `🔗 Linked \`${key}\` to <@${user.id}> (\`${user.username}\`).` })
}

async function handleKeyinfo(interaction) {
  const query = interaction.options.getString('query').trim()
  const r = await rpc('rpc_lookup_user', { p_staff_key: LVNT_STAFF_KEY, p_query: query })
  if (!r.ok) return interaction.editReply({ content: `✖ ${r.error || 'Lookup failed.'}` })
  const row = Array.isArray(r.data) ? r.data[0] : null
  if (!row) return interaction.editReply({ content: `🔍 No record found for \`${query}\`.` })

  const expired = new Date(row.expires_at) < new Date()
  const status = row.status === 'revoked' ? '🚫 Revoked' : expired ? '⌛ Expired' : '✅ Active'
  const embed = new EmbedBuilder().setColor(ACCENT).setTitle(`🔍 ${row.discord_username || query}`)
    .addFields(
      { name: 'Key', value: `\`${row.key}\``, inline: false },
      { name: 'Tier', value: roleLabel(row.role), inline: true },
      { name: 'Status', value: status, inline: true },
      { name: 'Expires', value: fmtDate(row.expires_at), inline: true },
      { name: 'Device bound', value: row.hwid ? '🔒 Yes' : '— No', inline: true },
      { name: 'Last seen', value: fmtDateTime(row.last_heartbeat), inline: true },
      { name: 'App version', value: row.app_version || '—', inline: true },
    )
  return interaction.editReply({ embeds: [embed] })
}

// ── Moderation ────────────────────────────────────────────────────────────────
function modEmbed(title, target, mod, reason, extra) {
  const e = new EmbedBuilder().setColor(ACCENT).setTitle(title).addFields(
    { name: 'User', value: `${target.username ?? 'user'} (<@${target.id}>)`, inline: false },
    { name: 'Moderator', value: `<@${mod.id}>`, inline: true },
  )
  if (extra) e.addFields({ name: extra.name, value: extra.value, inline: true })
  if (reason) e.addFields({ name: 'Reason', value: reason, inline: false })
  return e
}
// Returns an error string if the action is disallowed, else null.
function modBlock(interaction, member, action) {
  if (!member) return null
  if (member.id === interaction.user.id) return `You can't ${action} yourself.`
  if (member.id === interaction.guild.ownerId) return `You can't ${action} the server owner.`
  if (member.user?.bot && member.id === interaction.client.user.id) return `I can't ${action} myself.`
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
  if (!isAdmin && interaction.member?.roles?.highest && member.roles?.highest
      && interaction.member.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
    return `You can't ${action} someone with an equal or higher role than you.`
  }
  return null
}
const reasonBy = (interaction, reason) => `${reason || 'No reason provided'} — by ${interaction.user.tag}`

async function handleBan(interaction) {
  const userOpt = interaction.options.getUser('user')
  const idOpt = interaction.options.getString('user_id')?.trim()
  const targetId = userOpt?.id ?? idOpt
  if (!targetId) return interaction.editReply({ content: '⛔ Provide a `user` or a `user_id` to ban.' })
  if (!/^\d{15,21}$/.test(targetId)) return interaction.editReply({ content: '⛔ That user_id is not a valid Discord ID.' })

  const reason = (interaction.options.getString('reason') || '').slice(0, 400)
  const days = interaction.options.getInteger('delete_days') ?? 0
  // Resolve the member if they're in the server (so hierarchy/owner/self checks apply).
  const member = interaction.options.getMember('user') || await interaction.guild.members.fetch(targetId).catch(() => null)

  const block = modBlock(interaction, member, 'ban')
  if (block) return interaction.editReply({ content: '⛔ ' + block })
  if (member && !member.bannable) return interaction.editReply({ content: "⛔ I can't ban them — my role is below theirs or I'm missing the Ban Members permission." })

  // Resolve a display user even if they've never been in the server.
  const target = userOpt
    || await interaction.client.users.fetch(targetId).catch(() => null)
    || { id: targetId, username: 'Unknown user' }

  try {
    await interaction.guild.bans.create(targetId, { reason: reasonBy(interaction, reason), deleteMessageSeconds: days * 86400 })
    addLog(targetId, { type: 'Ban', reason, modId: interaction.user.id })
    const note = member ? '' : ' *(by ID — not in server)*'
    return interaction.editReply({ content: note.trim() || undefined, embeds: [modEmbed('🔨 Banned', target, interaction.user, reason)] })
  } catch (e) { return interaction.editReply({ content: '✖ Ban failed: ' + (e?.message ?? 'unknown error') }) }
}

async function handleKick(interaction) {
  const target = interaction.options.getUser('user')
  const member = interaction.options.getMember('user')
  const reason = (interaction.options.getString('reason') || '').slice(0, 400)
  if (!member) return interaction.editReply({ content: '⛔ That user is not in the server.' })
  const block = modBlock(interaction, member, 'kick')
  if (block) return interaction.editReply({ content: '⛔ ' + block })
  if (!member.kickable) return interaction.editReply({ content: "⛔ I can't kick them — my role is below theirs or I'm missing the Kick Members permission." })
  try {
    await member.kick(reasonBy(interaction, reason))
    addLog(target.id, { type: 'Kick', reason, modId: interaction.user.id })
    return interaction.editReply({ embeds: [modEmbed('👢 Kicked', target, interaction.user, reason)] })
  } catch (e) { return interaction.editReply({ content: '✖ Kick failed: ' + (e?.message ?? 'unknown error') }) }
}

async function handleMute(interaction) {
  const target = interaction.options.getUser('user')
  const member = interaction.options.getMember('user')
  const minutes = interaction.options.getInteger('minutes') ?? 60
  const reason = (interaction.options.getString('reason') || '').slice(0, 400)
  if (!member) return interaction.editReply({ content: '⛔ That user is not in the server.' })
  const block = modBlock(interaction, member, 'mute')
  if (block) return interaction.editReply({ content: '⛔ ' + block })
  if (!member.moderatable) return interaction.editReply({ content: "⛔ I can't mute them — my role is below theirs or I'm missing the Timeout Members permission." })
  try {
    await member.timeout(minutes * 60000, reasonBy(interaction, reason))
    addLog(target.id, { type: 'Mute', reason, modId: interaction.user.id, extra: `${minutes} min` })
    return interaction.editReply({ embeds: [modEmbed('🔇 Muted', target, interaction.user, reason, { name: 'Duration', value: `${minutes} min` })] })
  } catch (e) { return interaction.editReply({ content: '✖ Mute failed: ' + (e?.message ?? 'unknown error') }) }
}

async function handleUnmute(interaction) {
  const target = interaction.options.getUser('user')
  const member = interaction.options.getMember('user')
  if (!member) return interaction.editReply({ content: '⛔ That user is not in the server.' })
  try {
    await member.timeout(null, `by ${interaction.user.tag}`)
    return interaction.editReply({ embeds: [modEmbed('🔊 Unmuted', target, interaction.user, null)] })
  } catch (e) { return interaction.editReply({ content: '✖ Unmute failed: ' + (e?.message ?? 'unknown error') }) }
}

async function handleUnban(interaction) {
  const id = interaction.options.getString('user_id').trim()
  if (!/^\d{15,21}$/.test(id)) return interaction.editReply({ content: '⛔ That doesn\'t look like a valid user ID.' })
  try {
    await interaction.guild.bans.remove(id, `by ${interaction.user.tag}`)
    return interaction.editReply({ content: `✅ Unbanned <@${id}> (\`${id}\`).` })
  } catch (e) { return interaction.editReply({ content: '✖ Unban failed (not banned, or invalid ID): ' + (e?.message ?? '') }) }
}

async function handlePurge(interaction) {
  const amount = interaction.options.getInteger('amount')
  try {
    const deleted = await interaction.channel.bulkDelete(amount, true)
    return interaction.editReply({ content: `🧹 Deleted **${deleted.size}** message(s).` + (deleted.size < amount ? ' (messages older than 14 days can\'t be bulk-deleted)' : '') })
  } catch (e) { return interaction.editReply({ content: '✖ Purge failed: ' + (e?.message ?? 'I may be missing the Manage Messages permission.') }) }
}

async function handleWarn(interaction) {
  const target = interaction.options.getUser('user')
  const member = interaction.options.getMember('user')
  const reason = interaction.options.getString('reason').slice(0, 400)
  const block = modBlock(interaction, member, 'warn')
  if (block) return interaction.editReply({ content: '⛔ ' + block })
  let note = ''
  try { await target.send(`⚠️ You were **warned** in **${interaction.guild.name}**:\n> ${reason}`); note = '📨 DM sent.' }
  catch { note = '⚠️ Could not DM them (DMs closed).' }
  addLog(target.id, { type: 'Warn', reason, modId: interaction.user.id })
  return interaction.editReply({ content: note, embeds: [modEmbed('⚠️ Warned', target, interaction.user, reason)] })
}

// ── Tickets ───────────────────────────────────────────────────────────────────
const supportRoleIds = () => (SUPPORT_ROLE_IDS.length ? SUPPORT_ROLE_IDS : [...new Set([...ADMIN_ROLE_IDS, ...MOD_ROLE_IDS])])
function isSupport(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true
  if (ADMIN_ROLE_IDS.length && hasRole(interaction, ADMIN_ROLE_IDS)) return true
  return hasRole(interaction, supportRoleIds())
}

function ticketPanelPayload(guild) {
  const embed = new EmbedBuilder().setColor(ACCENT)
    .setTitle('🎫 Leventia Support')
    .setDescription('Need help, have a question, or want to **buy a key**?\nPress **Open Ticket** below and a staff member will assist you in a private channel.')
    .addFields(
      { name: '📋 Please include', value: 'A clear description of your issue and any screenshots.', inline: false },
      { name: '⏱️ Response time', value: 'Usually within a few hours.', inline: false },
    )
    .setFooter({ text: 'Leventia • One open ticket per person' }).setTimestamp()
  const icon = guild?.iconURL?.({ size: 256 })
  if (icon) embed.setThumbnail(icon)
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_open').setLabel('Open Ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary),
  )
  return { embeds: [embed], components: [row] }
}

// Post the panel only if one isn't already present in the channel (so restarts don't spam).
async function ensureTicketPanel() {
  try {
    const channel = await client.channels.fetch(TICKET_PANEL_CHANNEL_ID).catch(() => null)
    if (!channel?.isTextBased?.()) { console.log('ℹ️  Ticket channel not found / not text — skipping panel.'); return }
    const msgs = await channel.messages.fetch({ limit: 30 }).catch(() => null)
    const exists = msgs?.some(m => m.author.id === client.user.id &&
      m.components?.some(r => r.components?.some(c => c.customId === 'ticket_open')))
    if (!exists) { await channel.send(ticketPanelPayload(channel.guild)); console.log('✓ Ticket panel posted.') }
  } catch (e) { console.error('ensureTicketPanel:', e?.message ?? e) }
}

async function openTicket(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })
  const guild = interaction.guild
  const opener = interaction.user

  const existing = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.topic?.includes(`opener:${opener.id}`))
  if (existing) return interaction.editReply({ content: `⛔ You already have an open ticket: <#${existing.id}>` })

  const support = supportRoleIds()
  const p = PermissionFlagsBits
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [p.ViewChannel] },
    { id: opener.id, allow: [p.ViewChannel, p.SendMessages, p.ReadMessageHistory, p.AttachFiles] },
    { id: client.user.id, allow: [p.ViewChannel, p.SendMessages, p.ReadMessageHistory, p.ManageChannels] },
    ...support.map(rid => ({ id: rid, allow: [p.ViewChannel, p.SendMessages, p.ReadMessageHistory, p.AttachFiles] })),
  ]

  let channel
  try {
    channel = await guild.channels.create({
      name: `ticket-${opener.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90) || `ticket-${opener.id}`,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID || undefined,
      topic: `Ticket • opener:${opener.id}`,
      permissionOverwrites: overwrites,
    })
  } catch (e) {
    return interaction.editReply({ content: '✖ Could not create the ticket channel — I likely need the **Manage Channels** permission. ' + (e?.message ?? '') })
  }

  const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🎫 Support Ticket')
    .setDescription(`Hey ${opener}, thanks for reaching out! Describe your issue in detail and a staff member will be with you shortly.`)
    .addFields(
      { name: 'Opened by', value: `<@${opener.id}>`, inline: true },
      { name: 'Status', value: '🟢 Open — unclaimed', inline: true },
    )
    .setFooter({ text: 'Leventia Support' }).setTimestamp()
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setEmoji('✋').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
  )
  const ping = support.length ? support.map(r => `<@&${r}>`).join(' ') : ''
  await channel.send({
    content: `${opener} ${ping}`.trim(),
    embeds: [embed],
    components: [row],
    allowedMentions: { users: [opener.id], roles: support }, // explicitly allow the support-role ping
  })
  return interaction.editReply({ content: `✅ Your ticket is ready: <#${channel.id}>` })
}

async function claimTicket(interaction) {
  if (!isSupport(interaction)) return interaction.reply({ content: '⛔ Only support staff can claim tickets.', flags: MessageFlags.Ephemeral })
  const channel = interaction.channel
  if (channel.topic?.includes('claimed:')) return interaction.reply({ content: '⛔ This ticket is already claimed.', flags: MessageFlags.Ephemeral })
  await channel.setTopic(`${channel.topic} • claimed:${interaction.user.id}`).catch(() => {})
  const old = interaction.message.embeds[0]
  const embed = EmbedBuilder.from(old).spliceFields(1, 1, { name: 'Status', value: `🔒 Claimed by <@${interaction.user.id}>`, inline: true })
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claimed').setEmoji('✋').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
  )
  await interaction.update({ embeds: [embed], components: [row] })
  await channel.send({ content: `✋ Ticket claimed by <@${interaction.user.id}> — they'll help you from here.` })
}

const isTicketChannel = (channel) => !!channel?.topic?.includes('opener:')
const ticketOpenerId = (channel) => channel?.topic?.match(/opener:(\d+)/)?.[1]
const canCloseTicket = (interaction) => isSupport(interaction) || interaction.user.id === ticketOpenerId(interaction.channel)

// Fetch up to ~500 messages and render a plain-text transcript.
async function buildTranscript(channel) {
  const all = []
  let before
  for (let i = 0; i < 5; i++) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) }).catch(() => null)
    if (!batch || batch.size === 0) break
    all.push(...batch.values())
    before = batch.last().id
    if (batch.size < 100) break
  }
  all.reverse() // oldest -> newest
  const lines = all.map(m => {
    const t = new Date(m.createdTimestamp).toISOString().replace('T', ' ').slice(0, 19)
    let c = m.content || ''
    if (m.embeds.length) c += `${c ? ' ' : ''}[embed]`
    if (m.attachments.size) c += ' ' + [...m.attachments.values()].map(a => a.url).join(' ')
    return `[${t}] ${m.author.username}: ${c}`
  })
  return lines.join('\n') || '(no messages)'
}

// Generate the transcript, post it to the log channel, then delete the ticket.
async function closeTicketFlow(channel, closer, reason) {
  const opener = ticketOpenerId(channel)
  let file = null
  try {
    const body = await buildTranscript(channel)
    const head = `Ticket: ${channel.name}\nOpened by: ${opener ?? 'unknown'}\nClosed by: ${closer.username} (${closer.id})\nReason: ${reason || 'No reason given'}\nClosed: ${new Date().toISOString()}\n${'='.repeat(60)}\n\n`
    file = new AttachmentBuilder(Buffer.from(head + body, 'utf8'), { name: `transcript-${channel.name}.txt` })
  } catch { /* transcript best-effort */ }

  if (TICKET_LOG_CHANNEL_ID) {
    const log = await channel.guild.channels.fetch(TICKET_LOG_CHANNEL_ID).catch(() => null)
    if (log?.isTextBased?.()) {
      const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🎫 Ticket Closed')
        .addFields(
          { name: 'Ticket', value: `\`${channel.name}\``, inline: true },
          { name: 'Opened by', value: opener ? `<@${opener}>` : 'unknown', inline: true },
          { name: 'Closed by', value: `<@${closer.id}>`, inline: true },
          { name: 'Reason', value: reason || 'No reason given', inline: false },
        ).setTimestamp()
      await log.send({ embeds: [embed], files: file ? [file] : [] }).catch(() => {})
    }
  }
  await channel.send(`🔒 Closed by <@${closer.id}>. Saving transcript and deleting in 5s…`).catch(() => {})
  setTimeout(() => channel.delete('Ticket closed').catch(() => {}), 5000)
}

async function handleClose(interaction) {
  if (!isTicketChannel(interaction.channel)) {
    return interaction.editReply({ content: '⛔ Use this **inside a ticket channel**.' })
  }
  if (!canCloseTicket(interaction)) {
    return interaction.editReply({ content: '⛔ Only staff or the ticket opener can close this ticket.' })
  }
  const reason = interaction.options.getString('reason') || ''
  await interaction.editReply({ content: '🔒 Closing ticket…' })
  return closeTicketFlow(interaction.channel, interaction.user, reason)
}

// Add/remove a member from the current ticket channel.
async function handleTicketMember(interaction, add) {
  const channel = interaction.channel
  if (!channel?.topic?.includes('opener:')) {
    return interaction.editReply({ content: '⛔ Use this **inside a ticket channel**.' })
  }
  if (!isSupport(interaction)) {
    return interaction.editReply({ content: '⛔ Only support staff can manage ticket members.' })
  }
  const user = interaction.options.getUser('user')
  const p = PermissionFlagsBits
  try {
    if (add) {
      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true,
      })
      await channel.send(`➕ <@${user.id}> was added to the ticket by <@${interaction.user.id}>.`)
      return interaction.editReply({ content: `✅ Added <@${user.id}> to this ticket.` })
    }
    const opener = channel.topic.match(/opener:(\d+)/)?.[1]
    if (user.id === opener) return interaction.editReply({ content: "⛔ You can't remove the ticket opener." })
    await channel.permissionOverwrites.delete(user.id)
    await channel.send(`➖ <@${user.id}> was removed from the ticket by <@${interaction.user.id}>.`)
    return interaction.editReply({ content: `✅ Removed <@${user.id}> from this ticket.` })
  } catch (e) {
    return interaction.editReply({ content: '✖ Failed — I may need the Manage Channels/Roles permission. ' + (e?.message ?? '') })
  }
}

async function handleTicketPanel(interaction) {
  const channel = interaction.options.getChannel('channel')
    || await interaction.guild.channels.fetch(TICKET_PANEL_CHANNEL_ID).catch(() => null)
  if (!channel?.isTextBased?.()) return interaction.editReply({ content: '⛔ Tickets channel not found. Pass a channel or set TICKET_PANEL_CHANNEL_ID.' })
  await channel.send(ticketPanelPayload(interaction.guild))
  return interaction.editReply({ content: `✅ Ticket panel posted in <#${channel.id}>.` })
}

async function handleLogs(interaction) {
  const user = interaction.options.getUser('user')
  const entries = (modLogs[user.id] || []).slice().sort((a, b) => b.at - a.at)
  const count = (t) => entries.filter(e => e.type === t).length
  const icons = { Warn: '⚠️', Mute: '🔇', Kick: '👢', Ban: '🔨' }

  const embed = new EmbedBuilder().setColor(ACCENT)
    .setTitle('🗂️ Moderation Logs')
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setDescription(`<@${user.id}> · \`${user.username}\`\n\n⚠️ **${count('Warn')}** warns · 🔇 **${count('Mute')}** mutes · 👢 **${count('Kick')}** kicks · 🔨 **${count('Ban')}** bans`)

  if (!entries.length) {
    embed.addFields({ name: 'History', value: '✅ Clean record — no moderation actions logged.' })
  } else {
    const lines = entries.slice(0, 15).map((e, i) =>
      `**${i + 1}.** ${icons[e.type] || '•'} **${e.type}**${e.extra ? ` (${e.extra})` : ''} — ${e.reason || 'No reason'}\n┗ by <@${e.modId}> · <t:${Math.floor(e.at / 1000)}:R>`)
    embed.addFields({ name: `History (showing ${Math.min(entries.length, 15)} of ${entries.length})`, value: lines.join('\n').slice(0, 1024) })
  }
  embed.setFooter({ text: 'Leventia Moderation' }).setTimestamp()
  return interaction.editReply({ embeds: [embed] })
}

// ── Staff promotions / demotions ──────────────────────────────────────────────
async function handleRankChange(interaction, promo) {
  const user    = interaction.options.getUser('user')
  const oldRank = interaction.options.getString('old_rank')
  const newRank = interaction.options.getString('new_rank')
  const reason  = interaction.options.getString('reason').slice(0, 1000)
  const channel = interaction.options.getChannel('channel')
    || await interaction.guild.channels.fetch(PROMO_CHANNEL_ID).catch(() => null)
  if (!channel?.isTextBased?.()) {
    return interaction.editReply({ content: '⛔ Announcement channel not found. Pass a `channel` or set PROMO_CHANNEL_ID.' })
  }

  const embed = new EmbedBuilder()
    .setColor(promo ? 0x22c55e : 0xef4444)
    .setAuthor({ name: promo ? 'Staff Promotion' : 'Staff Demotion', iconURL: user.displayAvatarURL() })
    .setTitle(promo ? '📈 Congratulations on your promotion!' : '📉 Staff Rank Update')
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setDescription(promo
      ? `<@${user.id}> has been **promoted**. Keep up the great work! 🎉`
      : `<@${user.id}>'s staff rank has been **changed**.`)
    .addFields(
      { name: '👤 Staff Member', value: `<@${user.id}>`, inline: true },
      { name: promo ? '⬆️ Promoted By' : '🛠️ Actioned By', value: `<@${interaction.user.id}>`, inline: true },
      { name: '​', value: '​', inline: true },
      { name: '📊 Rank Change', value: `\`${oldRank}\`  ➜  **${newRank}**`, inline: false },
      { name: '📝 Reason', value: reason, inline: false },
    )
    .setFooter({ text: 'Leventia Staff Management' }).setTimestamp()

  await channel.send({ content: `<@${user.id}>`, embeds: [embed] })
  return interaction.editReply({ content: `✅ ${promo ? 'Promotion' : 'Demotion'} announced in <#${channel.id}>.` })
}

async function handlePrice(interaction) {
  const channel = interaction.options.getChannel('channel')
    || await interaction.guild.channels.fetch(PRICE_CHANNEL_ID).catch(() => null)
  if (!channel?.isTextBased?.()) return interaction.editReply({ content: '⛔ Price channel not found. Pass a `channel` or set PRICE_CHANNEL_ID.' })
  const fmt = (p) => `R$ **${p.robux}**  •  $${p.usd}`
  const embed = new EmbedBuilder().setColor(ACCENT)
    .setTitle('💎 Leventia Pricing')
    .setDescription('Pick the plan that fits you — prices in **Robux** and **USD**.')
    .addFields(
      { name: '🔑 Basic', value: `**1 Month**\n┗ ${fmt(PRICES.basic1)}\n**3 Months**\n┗ ${fmt(PRICES.basic3)}`, inline: true },
      { name: '⭐ Premium', value: `**1 Month**\n┗ ${fmt(PRICES.premium1)}\n**3 Months**\n┗ ${fmt(PRICES.premium3)}`, inline: true },
      { name: '🛒 How to buy', value: 'Open a ticket and a staff member will get you sorted!', inline: false },
    )
    .setFooter({ text: 'Leventia' }).setTimestamp()
  const icon = interaction.guild?.iconURL?.({ size: 256 })
  if (icon) embed.setThumbnail(icon)
  await channel.send({ embeds: [embed] })
  return interaction.editReply({ content: `✅ Price list posted in <#${channel.id}>.` })
}

async function handleWebsite(interaction) {
  const embed = new EmbedBuilder().setColor(ACCENT)
    .setTitle('🌐 Download Leventia')
    .setDescription(`Get the Leventia Alting program from our official website:\n${WEBSITE_URL}`)
    .setFooter({ text: 'Leventia' }).setTimestamp()
  const icon = interaction.guild?.iconURL?.({ size: 256 })
  if (icon) embed.setThumbnail(icon)
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Open Website').setEmoji('🌐').setStyle(ButtonStyle.Link).setURL(WEBSITE_URL),
  )
  return interaction.editReply({ embeds: [embed], components: [row] })
}

// ── Giveaways ─────────────────────────────────────────────────────────────────
async function handleGiveaway(interaction) {
  const prize   = interaction.options.getString('prize').slice(0, 240)
  const winners = interaction.options.getInteger('winners')
  const days    = interaction.options.getInteger('days')
  const minutes = interaction.options.getInteger('minutes') ?? 0
  const channel = interaction.options.getChannel('channel') || interaction.channel
  const ms = days * 86400000 + minutes * 60000
  if (ms <= 0) return interaction.editReply({ content: '⛔ The giveaway must last at least 1 minute (set `days` or `minutes`).' })
  if (!channel?.isTextBased?.()) return interaction.editReply({ content: '⛔ That channel can\'t hold messages.' })

  const endsAt = Date.now() + ms
  const ends = Math.floor(endsAt / 1000)
  const embed = new EmbedBuilder().setColor(ACCENT)
    .setTitle('🎉  GIVEAWAY  🎉')
    .setDescription(`# ${prize}\n\nClick **🎉 Enter** below for your chance to win!`)
    .addFields(
      { name: '🏆 Winners', value: `**${winners}**`, inline: true },
      { name: '⏰ Ends', value: `<t:${ends}:R>`, inline: true },
      { name: '🎟️ Hosted by', value: `<@${interaction.user.id}>`, inline: true },
    )
    .setFooter({ text: 'Leventia Giveaways • Ends' }).setTimestamp(endsAt)
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gw_enter').setLabel('Enter Giveaway').setEmoji('🎉').setStyle(ButtonStyle.Success),
  )
  const msg = await channel.send({ embeds: [embed], components: [row] })
  giveaways[msg.id] = { channelId: channel.id, guildId: interaction.guildId, prize, winners, endsAt, hostId: interaction.user.id, entrants: [], ended: false }
  saveGiveaways()
  return interaction.editReply({ content: `✅ Giveaway for **${prize}** started in <#${channel.id}> — ends <t:${ends}:R>.` })
}

async function giveawayEnter(interaction) {
  const g = giveaways[interaction.message.id]
  if (!g || g.ended) return interaction.reply({ content: '⛔ This giveaway has ended.', flags: MessageFlags.Ephemeral })
  const idx = g.entrants.indexOf(interaction.user.id)
  let msg
  if (idx === -1) { g.entrants.push(interaction.user.id); msg = `🎉 You're entered to win **${g.prize}**! Good luck 🍀` }
  else { g.entrants.splice(idx, 1); msg = '➖ You left the giveaway.' }
  saveGiveaways()
  return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral })
}

async function endGiveaway(mid) {
  const g = giveaways[mid]
  if (!g || g.ended) return
  g.ended = true; saveGiveaways()
  const channel = await client.channels.fetch(g.channelId).catch(() => null)
  if (!channel?.isTextBased?.()) return

  const pool = [...new Set(g.entrants)]
  const total = pool.length
  const winners = []
  while (winners.length < g.winners && pool.length) winners.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  const mentions = winners.length ? winners.map(id => `<@${id}>`).join(', ') : null

  const msg = await channel.messages.fetch(mid).catch(() => null)
  if (msg) {
    const embed = EmbedBuilder.from(msg.embeds[0]).setColor(0x4ade80).setTitle('🎉  GIVEAWAY ENDED  🎉')
      .setDescription(`# ${g.prize}`)
      .setFields(
        { name: '👑 Winners', value: mentions || 'No valid entries 😢', inline: false },
        { name: '🎟️ Entries', value: String(total), inline: true },
        { name: 'Hosted by', value: `<@${g.hostId}>`, inline: true },
      )
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('gw_enter').setLabel('Giveaway Ended').setEmoji('🎉').setStyle(ButtonStyle.Secondary).setDisabled(true))
    await msg.edit({ embeds: [embed], components: [row] }).catch(() => {})
  }
  await channel.send(mentions
    ? `🎉 Congratulations ${mentions}! You won **${g.prize}**! 🏆`
    : `😢 No one entered the giveaway for **${g.prize}**.`).catch(() => {})
}

async function handleReroll(interaction) {
  const mid = interaction.options.getString('message_id').trim()
  const n = interaction.options.getInteger('winners') ?? 1
  const g = giveaways[mid]
  if (!g) return interaction.editReply({ content: '⛔ No giveaway found with that message ID (it may be older than 7 days, or the ID is wrong).' })
  if (!g.ended) return interaction.editReply({ content: "⛔ That giveaway hasn't ended yet — use it after it finishes." })

  const pool = [...new Set(g.entrants)]
  if (!pool.length) return interaction.editReply({ content: '⛔ That giveaway had no entries to reroll.' })
  const winners = []
  while (winners.length < n && pool.length) winners.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  const mentions = winners.map(id => `<@${id}>`).join(', ')

  const channel = await client.channels.fetch(g.channelId).catch(() => null)
  if (channel?.isTextBased?.()) {
    await channel.send(`🔄 **Reroll!** New winner${winners.length > 1 ? 's' : ''} for **${g.prize}**: ${mentions} 🎉`).catch(() => {})
  }
  return interaction.editReply({ content: `✅ Rerolled — new winner${winners.length > 1 ? 's' : ''}: ${mentions}` })
}

// Periodic sweep — ends due giveaways and prunes old finished ones (restart-safe).
function checkGiveaways() {
  const now = Date.now(); let dirty = false
  for (const [mid, g] of Object.entries(giveaways)) {
    if (!g.ended && g.endsAt <= now) endGiveaway(mid).catch(() => {})
    else if (g.ended && g.endsAt < now - 7 * 86400000) { delete giveaways[mid]; dirty = true }
  }
  if (dirty) saveGiveaways()
}

// ── More moderation ───────────────────────────────────────────────────────────
async function handleSlowmode(interaction) {
  const seconds = interaction.options.getInteger('seconds')
  const channel = interaction.options.getChannel('channel') || interaction.channel
  try {
    await channel.setRateLimitPerUser(seconds, `by ${interaction.user.tag}`)
    return interaction.editReply({ content: seconds > 0 ? `🐌 Slowmode set to **${seconds}s** in <#${channel.id}>.` : `✅ Slowmode disabled in <#${channel.id}>.` })
  } catch (e) { return interaction.editReply({ content: '✖ Failed (need Manage Channels): ' + (e?.message ?? '') }) }
}

async function handleLock(interaction, lock) {
  const channel = interaction.options.getChannel('channel') || interaction.channel
  const reason = interaction.options.getString('reason') || ''
  try {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: lock ? false : null })
    await channel.send(lock ? `🔒 This channel has been **locked**.${reason ? ` Reason: ${reason}` : ''}` : '🔓 This channel has been **unlocked**.').catch(() => {})
    return interaction.editReply({ content: lock ? `🔒 Locked <#${channel.id}>.` : `🔓 Unlocked <#${channel.id}>.` })
  } catch (e) { return interaction.editReply({ content: '✖ Failed (need Manage Channels/Roles): ' + (e?.message ?? '') }) }
}

async function handleClearwarns(interaction) {
  const user = interaction.options.getUser('user')
  const had = (modLogs[user.id] || []).length
  delete modLogs[user.id]
  try { fs.writeFileSync(LOGS_FILE, JSON.stringify(modLogs)) } catch {}
  return interaction.editReply({ content: `🧹 Cleared **${had}** log entr${had === 1 ? 'y' : 'ies'} for <@${user.id}>.` })
}

async function handleNick(interaction) {
  const member = interaction.options.getMember('user')
  if (!member) return interaction.editReply({ content: '⛔ That user is not in the server.' })
  if (!member.manageable) return interaction.editReply({ content: "⛔ I can't change their nickname — my role is below theirs or I lack Manage Nicknames." })
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
  if (!isAdmin && member.id !== interaction.user.id && interaction.member?.roles?.highest?.comparePositionTo(member.roles.highest) <= 0) {
    return interaction.editReply({ content: "⛔ You can't rename someone with an equal or higher role." })
  }
  const nick = interaction.options.getString('nickname') || null
  try {
    await member.setNickname(nick, `by ${interaction.user.tag}`)
    return interaction.editReply({ content: nick ? `✏️ Renamed <@${member.id}> to **${nick}**.` : `✅ Reset <@${member.id}>'s nickname.` })
  } catch (e) { return interaction.editReply({ content: '✖ Failed: ' + (e?.message ?? '') }) }
}

async function handleRole(interaction) {
  const member = interaction.options.getMember('user')
  if (!member) return interaction.editReply({ content: '⛔ That user is not in the server.' })
  const role = interaction.options.getRole('role')
  const action = interaction.options.getString('action')
  const me = interaction.guild.members.me
  if (me?.roles?.highest && me.roles.highest.comparePositionTo(role) <= 0) return interaction.editReply({ content: "⛔ I can't manage that role — it sits above my highest role." })
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
  if (!isAdmin && interaction.member?.roles?.highest && interaction.member.roles.highest.comparePositionTo(role) <= 0) {
    return interaction.editReply({ content: "⛔ You can't assign a role equal to or above your own." })
  }
  try {
    if (action === 'add') { await member.roles.add(role); return interaction.editReply({ content: `✅ Added <@&${role.id}> to <@${member.id}>.` }) }
    await member.roles.remove(role)
    return interaction.editReply({ content: `✅ Removed <@&${role.id}> from <@${member.id}>.` })
  } catch (e) { return interaction.editReply({ content: '✖ Failed (need Manage Roles): ' + (e?.message ?? '') }) }
}

// ── Admin utilities ──
async function handleSay(interaction) {
  const text = interaction.options.getString('message')
  const channel = interaction.options.getChannel('channel') || interaction.channel
  if (!channel?.isTextBased?.()) return interaction.editReply({ content: '⛔ That channel can\'t hold messages.' })
  await channel.send({ content: text, allowedMentions: { parse: ['users', 'roles'] } }).catch(() => {}) // no @everyone/@here
  return interaction.editReply({ content: `✅ Sent in <#${channel.id}>.` })
}

async function handleAnnounce(interaction) {
  const title = interaction.options.getString('title')
  const message = interaction.options.getString('message').replace(/\\n/g, '\n')
  const channel = interaction.options.getChannel('channel') || interaction.channel
  if (!channel?.isTextBased?.()) return interaction.editReply({ content: '⛔ That channel can\'t hold messages.' })
  const embed = new EmbedBuilder().setColor(ACCENT).setTitle(title).setDescription(message)
    .setFooter({ text: `Announcement by ${interaction.user.username}` }).setTimestamp()
  const icon = interaction.guild?.iconURL?.({ size: 256 })
  if (icon) embed.setThumbnail(icon)
  await channel.send({ embeds: [embed] }).catch(() => {})
  return interaction.editReply({ content: `📢 Announcement posted in <#${channel.id}>.` })
}

// ── Public info ──
async function handlePing(interaction) {
  return interaction.editReply({ content: `🏓 Pong! WebSocket latency: **${Math.max(0, Math.round(client.ws.ping))}ms**.` })
}

async function handleUserinfo(interaction) {
  const user = interaction.options.getUser('user') || interaction.user
  const member = interaction.options.getMember('user')
    || (user.id === interaction.user.id ? interaction.member : await interaction.guild.members.fetch(user.id).catch(() => null))
  const embed = new EmbedBuilder().setColor(ACCENT).setTitle(user.username)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'User', value: `<@${user.id}>`, inline: true },
      { name: 'ID', value: `\`${user.id}\``, inline: true },
      { name: 'Account created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: false },
    )
  if (member?.joinedTimestamp) embed.addFields({ name: 'Joined server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: false })
  if (member) {
    const roles = member.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => `<@&${r.id}>`).slice(0, 20).join(' ') || 'None'
    embed.addFields({ name: `Roles (${member.roles.cache.size - 1})`, value: roles.slice(0, 1024) })
  }
  return interaction.editReply({ embeds: [embed] })
}

async function handleAvatar(interaction) {
  const user = interaction.options.getUser('user') || interaction.user
  const url = user.displayAvatarURL({ size: 1024 })
  const embed = new EmbedBuilder().setColor(ACCENT).setTitle(`${user.username}'s avatar`).setImage(url)
    .setDescription(`[Open in browser](${url})`)
  return interaction.editReply({ embeds: [embed] })
}

async function handleServerpeek(interaction) {
  const key = interaction.options.getString('server_key').trim()
  const h = { 'server-key': key, 'Accept': 'application/json' }
  let info = {}, players = [], queue = []
  try {
    const [iR, pR, qR] = await Promise.all([
      fetch('https://api.erlc.gg/v1/server', { headers: h }),
      fetch('https://api.erlc.gg/v1/server/players', { headers: h }),
      fetch('https://api.erlc.gg/v1/server/queue', { headers: h }),
    ])
    if (iR.status === 401 || iR.status === 403) return interaction.editReply({ content: '✖ Invalid server key.' })
    if (iR.status === 429) return interaction.editReply({ content: '✖ Rate limited by ER:LC — try again shortly.' })
    info = await iR.json().catch(() => ({}))
    players = await pR.json().catch(() => [])
    queue = await qR.json().catch(() => [])
  } catch { return interaction.editReply({ content: '✖ Could not reach the ER:LC API.' }) }
  if (!Array.isArray(players)) players = []

  const teams = {}
  for (const p of players) { const t = p.Team || 'Unknown'; teams[t] = (teams[t] || 0) + 1 }
  const staff = players.filter(p => p.Permission && p.Permission !== 'Normal').length
  const teamLines = Object.entries(teams).sort((a, b) => b[1] - a[1]).map(([t, n]) => `\`${n}\` ${t}`).join('\n') || 'No players online'
  const cur = info.CurrentPlayers ?? players.length
  const max = info.MaxPlayers ?? 40
  const filled = Math.max(0, Math.min(12, Math.round((cur / Math.max(max, 1)) * 12)))
  const bar = '█'.repeat(filled) + '░'.repeat(12 - filled)

  const embed = new EmbedBuilder().setColor(ACCENT)
    .setTitle(`🌆 ${info.Name || 'ER:LC Server'}`)
    .setDescription(info.JoinKey ? `Join code: \`${info.JoinKey}\`` : null)
    .addFields(
      { name: '👥 Players', value: `\`${bar}\` ${cur}/${max}`, inline: false },
      { name: '🕐 Queue', value: String(Array.isArray(queue) ? queue.length : 0), inline: true },
      { name: '🛡️ Staff online', value: String(staff), inline: true },
      { name: '👤 Owner', value: info.OwnerId ? `[${info.OwnerId}](https://roblox.com/users/${info.OwnerId}/profile)` : '—', inline: true },
      { name: '📊 Teams', value: teamLines, inline: false },
    )
    .setFooter({ text: 'Leventia • Live ER:LC' }).setTimestamp()
  return interaction.editReply({ embeds: [embed] })
}

async function handleServerinfo(interaction) {
  const g = interaction.guild
  const embed = new EmbedBuilder().setColor(ACCENT).setTitle(g.name)
    .addFields(
      { name: '👑 Owner', value: `<@${g.ownerId}>`, inline: true },
      { name: '👥 Members', value: String(g.memberCount), inline: true },
      { name: '📅 Created', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`, inline: true },
      { name: '💬 Channels', value: String(g.channels.cache.size), inline: true },
      { name: '🎭 Roles', value: String(g.roles.cache.size), inline: true },
      { name: '😀 Emojis', value: String(g.emojis.cache.size), inline: true },
    )
  const icon = g.iconURL?.({ size: 256 })
  if (icon) embed.setThumbnail(icon)
  return interaction.editReply({ embeds: [embed] })
}

// ── Alt control (remote bridge — multi-tenant) ────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Resolve the worker key for the calling user:
//   1. Look up their Discord ID in the licenses table (self-registered key).
//   2. Fall back to WORKER_LICENSE_KEY (owner default, for your own server).
async function resolveWorkerKey(discordId) {
  const r = await rpc('rpc_get_worker_key', { p_discord_id: discordId })
  if (r.ok && r.data?.found && r.data?.key) return { key: r.data.key, role: r.data.role }
  if (WORKER_LICENSE_KEY && discordId === (process.env.OWNER_DISCORD_ID || '')) return { key: WORKER_LICENSE_KEY, role: 'staff' }
  return null
}

async function runRemote(interaction, type, payload, verb) {
  const worker = await resolveWorkerKey(interaction.user.id)
  if (!worker) {
    const embed = new EmbedBuilder().setColor(0xf59e0b).setTitle('🔑 Not Registered')
      .setDescription('You need to link your Leventia key first:\n```\n/register key:LVNT-...\n```\nGet a key at: ' + WEBSITE_URL)
      .setFooter({ text: 'Your key links your Discord to your alting PC.' })
    return interaction.editReply({ embeds: [embed] })
  }
  // Remote alting is a Premium feature. Only club33 (Premium) or staff keys qualify.
  if (worker.role !== 'club33' && worker.role !== 'staff') {
    const embed = new EmbedBuilder().setColor(0xa78bfa).setTitle('⭐ Premium Required')
      .setDescription('Remote alting (`/deployalts`, `/removealts`, `/stopalts`, `/altstatus`, `/antiafk`) is a **Premium** feature.\nYour linked key is **Basic** — upgrade to Premium to control your alts from Discord.')
      .addFields({ name: 'Get Premium', value: WEBSITE_URL })
      .setFooter({ text: 'Already have a Premium key? Use /register to link it.' })
    return interaction.editReply({ embeds: [embed] })
  }
  const q = await rpc('rpc_queue_command', { p_staff_key: LVNT_STAFF_KEY, p_worker_key: worker.key, p_type: type, p_payload: payload })
  if (!q.ok || !q.data?.id) return interaction.editReply({ content: `✖ ${q.error || 'Could not queue the command.'}` })

  // Poll up to ~40s for the worker to pick it up and finish (deploys space launches
  // ~12s apart to dodge Roblox's 429 rate limit, so they take a while).
  let last = 'pending'
  for (let i = 0; i < 20; i++) {
    await sleep(2000)
    const g = await rpc('rpc_get_command', { p_staff_key: LVNT_STAFF_KEY, p_id: q.data.id })
    const st = g.data?.status
    if (st === 'done') {
      const embed = new EmbedBuilder().setColor(0x22c55e).setTitle('✅ Command Complete')
        .setDescription(g.data.result || `${verb} done.`).setTimestamp()
      return interaction.editReply({ embeds: [embed] })
    }
    if (st === 'error') {
      const embed = new EmbedBuilder().setColor(0xef4444).setTitle('⚠️ Command Failed')
        .setDescription(g.data.result || 'The alting PC reported an error.').setTimestamp()
      return interaction.editReply({ embeds: [embed] })
    }
    if (st) last = st
  }
  if (last === 'running') {
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🚀 In Progress')
      .setDescription(`Your alting PC is **${verb}** now. Launches are spaced ~12s apart to avoid Roblox's rate limit, so larger batches take a minute or two.\nWatch the app's Auto-Alt log on that PC for live progress.`).setTimestamp()
    return interaction.editReply({ embeds: [embed] })
  }
  const embed = new EmbedBuilder().setColor(0xf59e0b).setTitle('⚠️ PC Not Responding')
    .setDescription('The command was queued but your alting PC didn\'t pick it up in time.\n\n**Checklist:**\n• Leventia program is **open and running** on the PC\n• The PC is **on and awake** (not sleeping)\n• The app is **activated with the SAME key you registered** — the app must show this key:\n```\n' + worker.key + '\n```\nIf the app is activated with a different key, the PC never sees this command. Re-activate the app with the key above, or `/register` the key the app is using.\n\nThe command stays in the queue — the PC will run it the next time it polls.')
    .setTimestamp()
  return interaction.editReply({ embeds: [embed] })
}

async function handleRegister(interaction) {
  const key = interaction.options.getString('key').trim().toUpperCase()
  if (!/^LVNT-/.test(key)) {
    return interaction.editReply({ content: '⛔ That doesn\'t look like a Leventia key. It should start with `LVNT-`.' })
  }
  // Fetch the user by ID with the BOT's token (server-side only — the token never
  // leaves the host) to get their current avatar hash, then store it for the
  // leaderboard. The desktop app never sees a token; it just reads the CDN URL.
  let avatarHash = interaction.user.avatar ?? ''
  try { const u = await interaction.client.users.fetch(interaction.user.id, { force: true }); if (u?.avatar) avatarHash = u.avatar } catch {}
  const r = await rpc('rpc_self_register', { p_key: key, p_discord_id: interaction.user.id, p_discord_username: interaction.user.username, p_discord_avatar: avatarHash })
  if (!r.ok || r.data?.ok === false) {
    const err = r.data?.error || r.error || 'Registration failed.'
    const embed = new EmbedBuilder().setColor(0xef4444).setTitle('✖ Registration Failed').setDescription(err)
    return interaction.editReply({ embeds: [embed] })
  }
  const role = r.data?.role
  const tierLabel = role === 'staff' ? '🛡️ Staff' : role === 'club33' ? '⭐ Premium' : '🔑 Basic'
  const tierColor = role === 'staff' ? 0x60a5fa : role === 'club33' ? 0xa78bfa : 0x22c55e
  const expires = r.data?.expiresAt ? `<t:${Math.floor(new Date(r.data.expiresAt).getTime() / 1000)}:D>` : '—'
  const embed = new EmbedBuilder().setColor(tierColor)
    .setTitle('✅ Registered!')
    .setDescription('Your key is now linked to your Discord.\nYou can control your alting PC from **any server** this bot is in.')
    .addFields(
      { name: 'Tier', value: tierLabel, inline: true },
      { name: 'Expires', value: expires, inline: true },
    )
    .addFields({ name: 'Next steps', value: '1. Make sure **Leventia** is open and activated on your PC\n2. Set your **server code** in Premium → Auto Alting\n3. Run `/deployalts count:5`' })
    .setFooter({ text: 'Leventia Remote Control' }).setTimestamp()
  return interaction.editReply({ embeds: [embed] })
}

// Cache a user's linked keys briefly so autocomplete doesn't hammer the DB per keystroke.
const _myKeysCache = new Map()
async function getMyKeys(userId) {
  const c = _myKeysCache.get(userId)
  if (c && Date.now() - c.at < 10_000) return c.keys
  const r = await rpc('rpc_list_my_keys', { p_staff_key: LVNT_STAFF_KEY, p_discord_id: userId })
  const keys = Array.isArray(r.data) ? r.data : []
  _myKeysCache.set(userId, { at: Date.now(), keys })
  return keys
}

async function handleAutocomplete(interaction) {
  if (interaction.commandName !== 'unregister') return interaction.respond([]).catch(() => {})
  try {
    const keys = await getMyKeys(interaction.user.id)
    const choices = keys.slice(0, 25).map(k => ({ name: `${maskKey(k.key)} (${roleLabel(k.role)})`, value: k.key }))
    return interaction.respond(choices).catch(() => {})
  } catch { return interaction.respond([]).catch(() => {}) }
}

async function handleUnregister(interaction) {
  const key = interaction.options.getString('key').trim().toUpperCase()
  const r = await rpc('rpc_unregister', { p_key: key, p_discord_id: interaction.user.id })
  if (!r.ok || r.data?.ok === false) {
    return interaction.editReply({ content: `✖ ${r.data?.error || r.error || 'Could not unregister that key.'}` })
  }
  _myKeysCache.delete(interaction.user.id)
  const embed = new EmbedBuilder().setColor(0xf59e0b).setTitle('Unregistered')
    .setDescription(`\`${maskKey(r.data.key)}\` has been unlinked from your Discord account.\nYou can re-link it anytime with \`/register\`.`)
    .setTimestamp()
  return interaction.editReply({ embeds: [embed] })
}

async function handleButton(interaction) {
  try {
    switch (interaction.customId) {
      case 'ticket_open':  return await openTicket(interaction)
      case 'ticket_claim': return await claimTicket(interaction)
      case 'ticket_close': {
        if (!canCloseTicket(interaction)) {
          return interaction.reply({ content: '⛔ Only staff or the ticket opener can close this.', flags: MessageFlags.Ephemeral })
        }
        const modal = new ModalBuilder().setCustomId('ticket_close_modal').setTitle('Close Ticket')
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('reason').setLabel('Reason for closing (optional)')
              .setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)))
        return interaction.showModal(modal)
      }
      case 'gw_enter':     return await giveawayEnter(interaction)
    }
  } catch (e) {
    console.error('button error:', e)
    const m = '✖ ' + redact(e?.message ?? 'Something went wrong.')
    if (interaction.deferred || interaction.replied) interaction.editReply({ content: m }).catch(() => {})
    else interaction.reply({ content: m, flags: MessageFlags.Ephemeral }).catch(() => {})
  }
}

// ── Wire up the client ────────────────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  presence: {
    status: 'online',   // 'online' | 'idle' | 'dnd' | 'invisible'
    activities: [{ name: 'Leventia keys • /genkey', type: ActivityType.Watching }],
  },
})

client.once('clientReady', async () => {
  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN)

    // Does this app allow user-install ("integration")? If so we can tag the
    // per-user commands so they resolve in other servers + DMs. If not, sending
    // integration_types:[1] would make Discord reject the whole batch.
    let allowUserInstall = false
    try {
      const me = await rest.get(Routes.currentApplication())
      const cfg = me?.integration_types_config
      const types = cfg ? Object.keys(cfg) : (Array.isArray(me?.integration_types) ? me.integration_types : [])
      allowUserInstall = types.map(String).includes('1')
    } catch { /* fall back to guild-install only */ }

    // GLOBAL registration → commands work in EVERY server the bot is added to,
    // whether it's added to the SERVER (guild install) or to a USER's account
    // (user install / "integration"). Per-guild registration could not reach the
    // user-install case, which is why /deployalts showed only as an integration
    // and didn't work in other servers.
    try {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: buildRegisterBody(allowUserInstall) })
    } catch (e) {
      // Most likely the app doesn't actually permit user-install → retry as
      // guild-install only so we never end up with ZERO commands registered.
      console.error('✖ global register (user-install) failed, retrying guild-install only:', e?.message ?? e)
      allowUserInstall = false
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: buildRegisterBody(false) })
    }
    console.log(`✓ Registered ${commands.length} GLOBAL commands (user-install: ${allowUserInstall ? 'on' : 'off'}). New/changed command DEFINITIONS can take up to ~1h to propagate.`)

    // Remove any leftover per-guild copies (from the previous per-guild build) so
    // they don't appear as DUPLICATES next to the global commands.
    for (const gid of client.guilds.cache.keys()) {
      try { await rest.put(Routes.applicationGuildCommands(CLIENT_ID, gid), { body: [] }) } catch {}
    }
  } catch (e) {
    console.error('✖ Failed to register commands:', e?.message ?? e)
  }
  console.log(`🤖 Logged in as ${client.user.tag}`)
  ensureTicketPanel()
  checkGiveaways()
  setInterval(checkGiveaways, 30000)
  // Keep leaderboard avatars fresh: sync now + every 6h.
  refreshAvatars()
  setInterval(refreshAvatars, 6 * 60 * 60 * 1000)
})

// New server adds the bot → global commands already apply there. Clear any stale
// per-guild copies so the global ones don't show up duplicated.
client.on('guildCreate', async (guild) => {
  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN)
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guild.id), { body: [] })
  } catch { /* ignore */ }
})

client.on('interactionCreate', async (interaction) => {
  // Autocomplete fires per keystroke — handle it before (and exempt from) rate limiting.
  if (interaction.isAutocomplete()) return handleAutocomplete(interaction)
  // Ticket-close reason modal.
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'ticket_close_modal') {
      if (!isTicketChannel(interaction.channel) || !canCloseTicket(interaction)) {
        return interaction.reply({ content: '⛔ Cannot close this.', flags: MessageFlags.Ephemeral }).catch(() => {})
      }
      const reason = interaction.fields.getTextInputValue('reason') || ''
      await interaction.reply({ content: '🔒 Closing ticket…', flags: MessageFlags.Ephemeral }).catch(() => {})
      await closeTicketFlow(interaction.channel, interaction.user, reason)
    }
    return
  }
  // Anti-spam: throttle per user before doing any work.
  if (interaction.user && rateLimited(interaction.user.id)) {
    if (interaction.isRepliable()) interaction.reply({ content: '⏳ Slow down — too many actions. Try again in a few seconds.', flags: MessageFlags.Ephemeral }).catch(() => {})
    return
  }
  if (interaction.isButton()) return handleButton(interaction)
  if (!interaction.isChatInputCommand()) return
  const isPublic = PUBLIC_COMMANDS.includes(interaction.commandName)
  if (!isPublic && !canRun(interaction, interaction.commandName)) {
    return interaction.reply({ content: '⛔ You are not allowed to use this command.', ...ephemeral })
  }
  // Only true info commands reply publicly; everything else is ephemeral (private).
  await interaction.deferReply(PUBLIC_REPLY.includes(interaction.commandName) ? {} : ephemeral)
  try {
    switch (interaction.commandName) {
      case 'genkey':    return await handleGenkey(interaction)
      case 'revoke':    return await handleStatus(interaction, 'revoked')
      case 'keyrevoke': return await handleStatus(interaction, 'revoked')
      case 'enable':    return await handleStatus(interaction, 'active')
      case 'extend':    return await handleExtend(interaction)
      case 'link':      return await handleLink(interaction)
      case 'keyinfo':   return await handleKeyinfo(interaction)
      case 'ban':       return await handleBan(interaction)
      case 'kick':      return await handleKick(interaction)
      case 'mute':      return await handleMute(interaction)
      case 'unmute':    return await handleUnmute(interaction)
      case 'unban':     return await handleUnban(interaction)
      case 'purge':     return await handlePurge(interaction)
      case 'warn':      return await handleWarn(interaction)
      case 'logs':      return await handleLogs(interaction)
      case 'ticketpanel': return await handleTicketPanel(interaction)
      case 'add':       return await handleTicketMember(interaction, true)
      case 'remove':    return await handleTicketMember(interaction, false)
      case 'close':     return await handleClose(interaction)
      case 'promote':   return await handleRankChange(interaction, true)
      case 'demote':    return await handleRankChange(interaction, false)
      case 'website':   return await handleWebsite(interaction)
      case 'price':     return await handlePrice(interaction)
      case 'giveaway':  return await handleGiveaway(interaction)
      case 'reroll':    return await handleReroll(interaction)
      case 'slowmode':  return await handleSlowmode(interaction)
      case 'lock':      return await handleLock(interaction, true)
      case 'unlock':    return await handleLock(interaction, false)
      case 'clearwarns':return await handleClearwarns(interaction)
      case 'nick':      return await handleNick(interaction)
      case 'role':      return await handleRole(interaction)
      case 'say':       return await handleSay(interaction)
      case 'announce':  return await handleAnnounce(interaction)
      case 'ping':      return await handlePing(interaction)
      case 'userinfo':  return await handleUserinfo(interaction)
      case 'avatar':    return await handleAvatar(interaction)
      case 'serverinfo':return await handleServerinfo(interaction)
      case 'serverpeek':return await handleServerpeek(interaction)
      case 'register':   return await handleRegister(interaction)
      case 'unregister': return await handleUnregister(interaction)
      case 'deployalts': {
        const payload = { count: interaction.options.getInteger('count') }
        const sc = interaction.options.getString('server_code')
        const sk = interaction.options.getString('server_key')
        if (sc) payload.serverCode = sc
        if (sk) payload.serverKey = sk
        return await runRemote(interaction, 'deploy', payload, 'deploying alts')
      }
      case 'removealts': return await runRemote(interaction, 'remove', { count: interaction.options.getInteger('count') }, 'removing alts')
      case 'stopalts':   return await runRemote(interaction, 'stop', {}, 'stopping all alts')
      case 'altstatus': {
        const payload = {}
        const sc = interaction.options.getString('server_code')
        const sk = interaction.options.getString('server_key')
        if (sc) payload.serverCode = sc
        if (sk) payload.serverKey = sk
        return await runRemote(interaction, 'status', payload, 'checking status')
      }
      case 'antiafk': {
        const payload = {}
        const en = interaction.options.getBoolean('enabled')
        const iv = interaction.options.getInteger('interval')
        if (en !== null) payload.enabled = en
        if (iv !== null) payload.interval = iv
        return await runRemote(interaction, 'antiafk', payload, en === false ? 'disabling Anti-AFK' : 'enabling Anti-AFK')
      }
      default:        return interaction.editReply({ content: 'Unknown command.' })
    }
  } catch (e) {
    console.error(e)
    return interaction.editReply({ content: `✖ Error: ${redact(e?.message ?? 'something went wrong.')}` })
  }
})

client.login(DISCORD_TOKEN)
