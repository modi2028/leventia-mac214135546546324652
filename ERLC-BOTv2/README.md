# ER:LC Discord Bot 🚓

A full-featured Discord bot for **Emergency Response: Liberty County** communities. Remotely run in-game commands via the [PRC API](https://apidocs.policeroleplay.community/), run sessions, giveaways, tickets, infractions, promotions, and more — all rendered as branded **Components V2** panels (banner → content → separator → button), like the Orlando Utilities style.

## Architecture
```
bot.js            module loader + interaction/message router
store.js          JSON persistence (data/store.json, per-guild)
util.js           permissions, embeds, helpers
theme.js          Components V2 branded renderer (banners/logo/separator/buttons)
erlcApi.js        PRC API wrapper
features/         one module per feature (slash + prefix + components)
  erlc, sessions, giveaways, infractions, promotions, tickets,
  afk, reviews, training, suggestions, roleplay, misc, setup
```
Each feature module exports `slash`, `owns`, `prefixOwns`, `componentNs`, and the matching `handleSlash` / `handlePrefix` / `handleComponent` / `init` / `onMessage`. Adding a feature = drop a module in `features/` and add it to the `MODULES` array in `bot.js`.

## Commands (26 slash + prefix)

**ERLC** — `/erlc server|players|joinlogs|killlogs|commandlogs|bans|vehicles|queue|command`
`u!erlc <view>` · `u!run :<raw>` (admin) · whitelisted aliases: `u!heal u!kill u!respawn u!refresh u!mod u!unmod u!admin u!unadmin u!jail u!unjail u!kick u!ban u!unban u!wanted u!unwanted u!pm u!h u!msg u!priority u!weather u!time u!startfire u!stopfire`

**Sessions** — `/session info|ssu|ssd|boost|full|vote` · `u!session …` · `u!shutdown` (live ERLC stats + Join button)
**Giveaways** — `/giveaway start|end|reroll` · `u!giveaway create|end|reroll` (button entries, auto-end, survives restart)
**Staff** — `/infraction add|remove|list` · `/promotion add|history` · `/review` · `/training request|results` · `u!infraction` · `u!promotion`
**Tickets** — `/ticket setup|close|forceclose` · `/adduser` · `/removeuser` · `/close-all-tickets` · `u!ticket close` (transcripts logged)
**Community** — `/suggest` (vote buttons) · `/roleplay log|revoke` · `/afk-set` · `/afk-remove` · `u!afk` · `u!suggestion`
**Utility** — `/say` · `/dm` (user or role) · `/embed` · `/embedsender` · `/channel rename` · `/membercount` · `/ping` · `/help`
**Config (admin)** — `/setup` · `/debug` · `/reset-config`

## Permissions
- **STAFF_ROLE_ID** — staff commands (ERLC, sessions, infractions, promotions, training, say/dm). Blank ⇒ Discord **Administrator**.
- **ADMIN_ROLE_ID** — raw ERLC commands (`u!run`) + `/setup`, `/reset-config`, `/close-all-tickets`. Blank ⇒ Administrator.
- Ticket close/add/remove also allow the **support roles** set via `/setup support-roles` and the ticket owner.

## Setup
1. **Discord Developer Portal** → your app:
   - **Bot → Reset Token** → `DISCORD_TOKEN`.
   - **Bot → Privileged Gateway Intents**: enable **Message Content Intent** *and* **Server Members Intent** (both required).
   - **General Information → Application ID** → `CLIENT_ID`.
   - Invite with scopes `bot` + `applications.commands` and permissions: Manage Channels (tickets), Send Messages, Embed Links, Read Message History.
2. **ERLC server key**: in-game private server → settings → API → `ERLC_SERVER_KEY`.
3. Run:
   ```bash
   cd erlc-bot
   copy .env.example .env   # fill DISCORD_TOKEN, CLIENT_ID, GUILD_ID, ERLC_SERVER_KEY
   npm install
   npm start
   ```
   Expect `✓ Registered 26 guild commands` then `🤖 Logged in as …`.

## Configuring the look (the Orlando-style panels)
Everything visual is config-driven and set **live with `/setup`** (per server) — or globally in `.env`:
- `/setup set-channel purpose:<…> channel:#…` — wire session/log/ticket/suggestion/etc. channels.
- `/setup support-roles role_ids:<ids>` · `/setup ping-role role:@…`
- `/setup branding field:<logo|separator|color|name|footer|join-url> value:<…>`
- `/setup banner slot:<infractions|promotions|sessionStart|…> url:<image url>` — the top banner per panel type.
- `/setup view` to see current config · `/debug` for a full data dump · `/reset-config` to wipe.

Upload your banner images somewhere with a stable `https` URL (a Discord channel works) and point each `slot` at it. Panels gracefully omit images that aren't set, so the bot works before you've added any.

## Notes
- Node **18+**, discord.js **14.26+** (Components V2). Keep `.env` private (gitignored). `data/` holds the JSON store (also gitignored).
- PRC rate-limits the API; rapid commands may return `429`.
- Online count in `/membercount` needs the Presence intent (off by default) — shows 0 without it; everything else works on the two intents above.
