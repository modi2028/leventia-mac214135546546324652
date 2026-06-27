# Leventia Key Bot 🔑

A Discord bot that **generates and revokes Leventia Alting license keys** straight from your server. It talks to the exact same Supabase backend the desktop app uses, so keys it makes work immediately in the app and show up in the Staff tab.

| Tier | What it grants | Role under the hood |
|------|----------------|---------------------|
| **Premium** | Full app + the Premium category | `club33` |
| **Basic** | App without the Premium category | `standard` |

## Commands

| Command | What it does |
|---|---|
| `/genkey plan:<Premium\|Basic> months:<1-24> [user:@someone] [discord_id:123]` | Generate a key. If you pick a `user`, the bot **DMs them the key** and links it to their Discord for User Lookup. |
| `/revoke key:<LVNT-...>` | Instantly disable a key. |
| `/enable key:<LVNT-...>` | Re-enable a revoked key. |
| `/extend key:<LVNT-...> days:<n>` | Add time to a key. |
| `/keyinfo query:<discord id or username>` | Look up a user's key, tier, status, device binding, and last seen. |

All replies are **ephemeral** (only the staff member who ran the command sees them).

## How it works / security

- The bot never holds any signing secret. It authenticates each action with a **staff key** (`LVNT_STAFF_KEY`) which the database verifies (HMAC against a server-only secret) before issuing/revoking anything — identical to how the app's Staff tab works.
- Keys are minted **server-side** by the `rpc_issue_key` function, so they're always valid and recorded in the `licenses` table.
- Commands are locked to your server (`GUILD_ID`) and to a staff role (`ADMIN_ROLE_ID`) — or, if you leave that blank, to members with the Discord **Administrator** permission.

## Setup

### 1. Create the Discord application
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. **Bot** tab → **Reset Token** → copy it → that's `DISCORD_TOKEN`.
3. **General Information** → copy the **Application ID** → that's `CLIENT_ID`.
4. **Installation** (or **OAuth2 → URL Generator**): scopes `bot` + `applications.commands`. No special bot permissions are needed (commands reply ephemerally). Invite the bot to your server with the generated link.

### 2. Get a staff key for `LVNT_STAFF_KEY`
Either:
- Open the desktop app's **Staff** tab (if you already have staff access), **or**
- In the Supabase **SQL editor**, run:
  ```sql
  select public.make_staff_key('20280101');   -- expiry YYYYMMDD; copy the result
  ```

### 3. Configure + run
```bash
cd discord-bot
cp .env.example .env        # then fill in DISCORD_TOKEN, CLIENT_ID, LVNT_STAFF_KEY, GUILD_ID, ADMIN_ROLE_ID
npm install
npm start
```
You should see `✓ Registered N guild commands` and `🤖 Logged in as ...`. With `GUILD_ID` set, the slash commands appear in your server within seconds. Try `/genkey plan:Premium months:1`.

## Notes
- Needs **Node 18+** (uses the built-in `fetch`).
- To find role/server IDs: enable **Settings → Advanced → Developer Mode** in Discord, then right-click a server/role → *Copy ID*.
- If you ever **rotate the `staff_secret`** in the database, mint a fresh staff key (`select public.make_staff_key(...)`) and update `LVNT_STAFF_KEY`. Existing Basic/Premium keys keep working.
- Keep `.env` private — anyone with the staff key can issue/revoke keys. (`.gitignore` already excludes it.)
