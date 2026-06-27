# Roblox Account Dashboard (RDASH)

A dark, modern desktop dashboard for tracking multiple Roblox accounts. Built with Electron, React, Vite, TypeScript, and Tailwind CSS.

## Features

- **Account tracking** — Add accounts by username or user ID (no credentials required)
- **Live presence** — Online/offline/in-game/studio status via Roblox public APIs
- **Group badges** — Displays each account's primary group
- **Search & filter** — Filter by name/ID, tab by status (All/Online/Offline)
- **Refresh** — Manual refresh of selected or all accounts
- **Auto-refresh** — Configurable interval (30–300s) in Settings
- **License key** — Key-gated access with expiry support
- **Persistent storage** — Accounts and settings saved locally across sessions
- **System stats** — Live CPU% and RAM in the status bar
- **Session uptime** — Timer in the sidebar counting from app launch

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Starts the Vite dev server and launches Electron in development mode with hot-reload.

## Production Build

```bash
npm run dist
```

Builds the renderer with Vite, compiles the Electron main process, then packages a Windows `.exe` installer via `electron-builder`. Output goes to `release/`.

## License Keys

Keys use the format: `RDASH-XXXX-XXXX-XXXX-YYYYMMDD`

- `XXXX` — alphanumeric segments (uppercase)
- `YYYYMMDD` — expiry date embedded in the key

**Demo key for testing:** `RDASH-DEMO-0001-TEST-20271231`

To add production keys, edit `electron/key-validator.ts` and extend the `DEMO_KEYS` map, or replace the `validateKey` function body with a remote API call (the interface is already structured to support this).

## Project Structure

```
electron/
  main.ts              — Electron main process
  preload.ts           — Context bridge (exposes IPC to renderer)
  key-validator.ts     — License validation logic
  ipc/
    roblox.ts          — Roblox API calls (runs in main, avoids CORS)
    store.ts           — Persistent data IPC handlers
    system.ts          — CPU/RAM stats via os module
  store/
    index.ts           — JSON file-based store (userData directory)
src/
  App.tsx              — Root: license check → KeyScreen or Dashboard
  pages/
    KeyScreen.tsx      — License activation screen
    Dashboard.tsx      — Main layout (sidebar + content + status bar)
    AccountsPage.tsx   — Account list with add/refresh/remove
    SettingsPage.tsx   — Auto-refresh, accent color, danger zone
    LeaderboardPage.tsx
    AboutPage.tsx
  components/
    Sidebar.tsx        — Nav, stat cards, license footer
    TopBar.tsx         — Search, sort, refresh, add button
    FilterTabs.tsx     — All/Online/Offline filter
    AccountTable.tsx   — Table header + rows
    AccountRow.tsx     — Single account row
    AddAccountModal.tsx — Lookup + confirm modal
    StatusBar.tsx      — Selection count, CPU/RAM, total
  hooks/
    useUptime.ts       — Session uptime HH:MM:SS timer
    useSystemStats.ts  — Polls system:get-stats IPC
  types/
    index.ts           — All shared TypeScript types
```

## Roblox APIs Used

All requests are made from the Electron main process to avoid CORS:

| Endpoint | Purpose |
|---|---|
| `users.roblox.com/v1/usernames/users` | Resolve username → user ID |
| `users.roblox.com/v1/users/{id}` | Fetch profile details |
| `thumbnails.roblox.com/v1/users/avatar-headshot` | Avatar image URL |
| `presence.roblox.com/v1/presence/users` | Online/offline presence |
| `groups.roblox.com/v2/users/{id}/groups/roles` | Primary group name |
