import type { ServerDetail, ServerPlayerDetail, ServerActivity } from '../src/types/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// ERLC (Emergency Response: Liberty County) PRC API client
//
// GET https://api.erlc.gg/v2/server          — live server status
// GET https://api.erlc.gg/v2/server/players   — current player list
//
// Both require the server key in the `server-key` header.
// ─────────────────────────────────────────────────────────────────────────────

interface ServerStatus {
  ok: boolean
  players: number
  maxPlayers: number
  names: string[]   // lowercase usernames currently in the server
  name?: string
  error?: string
}

interface PrcServerResponse {
  Name?: string
  CurrentPlayers?: number
  MaxPlayers?: number
}

// PRC's v2 dropped /server/players (404s); v1 is the stable surface that returns
// the player list. NOTE: the API does NOT expose player coordinates on any version,
// so the live map shows the roster/teams, not real position markers.
const BASE = 'https://api.erlc.gg/v1'

async function prcFetch(path: string, serverKey: string): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    headers: {
      'server-key': serverKey,
      'Accept': 'application/json',
    },
  })
}

// Pull a username out of a player entry regardless of shape
function extractName(p: unknown): string {
  if (typeof p === 'string') return p.split(':')[0].trim().toLowerCase()
  if (p && typeof p === 'object') {
    const o = p as Record<string, unknown>
    const raw = (o.Player ?? o.player ?? o.Name ?? o.name ?? o.Username ?? o.username ?? '') as string
    return String(raw).split(':')[0].trim().toLowerCase()
  }
  return ''
}

export async function getServerStatus(serverKey: string): Promise<ServerStatus> {
  const key = serverKey.trim()
  if (!key) return { ok: false, players: 0, maxPlayers: 0, names: [], error: 'No server key provided.' }

  try {
    const [statusRes, playersRes] = await Promise.all([
      prcFetch('/server', key),
      prcFetch('/server/players', key),
    ])

    if (statusRes.status === 401 || statusRes.status === 403 || playersRes.status === 401 || playersRes.status === 403) {
      return { ok: false, players: 0, maxPlayers: 0, names: [], error: 'Invalid server key.' }
    }
    if (statusRes.status === 429 || playersRes.status === 429) {
      return { ok: false, players: 0, maxPlayers: 0, names: [], error: 'Rate limited by PRC — slow down.' }
    }

    // ── Player list (the source of truth for the count) ──────────────────────
    let names: string[] = []
    let playersOk = false
    if (playersRes.ok) {
      try {
        const data = await playersRes.json() as unknown
        const arr = Array.isArray(data)
          ? data
          : ((data as Record<string, unknown>)?.players ?? (data as Record<string, unknown>)?.Players ?? []) as unknown[]
        names = (arr as unknown[]).map(extractName).filter(Boolean)
        playersOk = true
      } catch { /* unparseable */ }
    }

    // ── Server status (name, max, fallback count) ────────────────────────────
    let maxPlayers = 40
    let currentFromStatus: number | undefined
    let serverName: string | undefined
    if (statusRes.ok) {
      try {
        const s = await statusRes.json() as PrcServerResponse & Record<string, unknown>
        maxPlayers = (s.MaxPlayers ?? (s.maxPlayers as number) ?? (s.max_players as number) ?? 40) as number
        currentFromStatus = (s.CurrentPlayers ?? (s.currentPlayers as number) ?? (s.current_players as number)) as number | undefined
        serverName = s.Name ?? (s.name as string)
      } catch { /* unparseable */ }
    }

    // Couldn't determine anything → treat as failure so the engine doesn't deploy blindly
    if (!playersOk && currentFromStatus === undefined) {
      return { ok: false, players: 0, maxPlayers, names: [], error: `PRC unreachable (HTTP ${statusRes.status}/${playersRes.status}).` }
    }

    // Prefer the actual player-list length; fall back to the status count
    const players = playersOk ? names.length : (currentFromStatus ?? 0)

    return { ok: true, players, maxPlayers, names, name: serverName }
  } catch (err) {
    return { ok: false, players: 0, maxPlayers: 0, names: [], error: err instanceof Error ? err.message : 'Network error.' }
  }
}

// ── Rich live snapshot for the Server Management dashboard ────────────────────
const EMPTY_DETAIL = (error?: string): ServerDetail =>
  ({ ok: false, players: 0, maxPlayers: 0, queue: 0, staffCount: 0, playerList: [], activity: [], error })

type Loose = Record<string, any>
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

// Map one raw PRC player object → our detail shape (handles "name:id" + nested Location).
function mapPlayer(p: Loose): ServerPlayerDetail {
  const [name, idStr] = String(p.Player ?? p.player ?? '').split(':')
  const loc: Loose = (p.Location ?? p.location ?? {}) as Loose
  return {
    name: (name ?? '').trim(),
    userId: parseInt(idStr ?? '0', 10) || 0,
    permission: String(p.Permission ?? 'Normal'),
    team: String(p.Team ?? 'Civilian'),
    callsign: (p.Callsign as string) ?? null,
    locationX: numOrNull(loc.LocationX ?? loc.X ?? loc.x),
    locationZ: numOrNull(loc.LocationZ ?? loc.Z ?? loc.z),
    street: (loc.StreetName ?? loc.Street) ?? null,
    postal: loc.PostalCode != null ? String(loc.PostalCode) : null,
    wanted: typeof p.WantedStars === 'number' ? p.WantedStars : 0,
  }
}

export async function getServerDetail(serverKey: string): Promise<ServerDetail> {
  const key = serverKey.trim()
  if (!key) return EMPTY_DETAIL('No server key provided.')

  try {
    // PRC v2: one combined call returns server info + players (with Location coords) + queue + join logs.
    const res = await prcFetch('/server?Players=true&Queue=true&JoinLogs=true', key)
    if (res.status === 401 || res.status === 403) return EMPTY_DETAIL('Invalid server key.')
    if (res.status === 429) return EMPTY_DETAIL('Rate limited by PRC — slow down.')

    let combined: Loose = {}
    if (res.ok) { try { combined = (await res.json()) as Loose } catch {} }

    const maxPlayers = numOrNull(combined.MaxPlayers ?? combined.maxPlayers) ?? 40
    const serverName = (combined.Name ?? combined.name) as string | undefined
    const currentPlayers = numOrNull(combined.CurrentPlayers ?? combined.currentPlayers) ?? 0

    let rawPlayers: Loose[] = Array.isArray(combined.Players) ? combined.Players : []
    let rawQueue: unknown = combined.Queue
    let rawJoins: Loose[] = Array.isArray(combined.JoinLogs) ? combined.JoinLogs : []

    // Fallback: if the combined call didn't embed players (older API), pull the dedicated endpoints.
    if (rawPlayers.length === 0 && currentPlayers > 0) {
      const [pRes, qRes, jRes] = await Promise.all([
        prcFetch('/server/players', key),
        prcFetch('/server/queue', key),
        prcFetch('/server/joinlogs', key),
      ])
      if (pRes.ok) { try { const a = await pRes.json(); if (Array.isArray(a)) rawPlayers = a } catch {} }
      if (rawQueue === undefined && qRes.ok) { try { rawQueue = await qRes.json() } catch {} }
      if (rawJoins.length === 0 && jRes.ok) { try { const a = await jRes.json(); if (Array.isArray(a)) rawJoins = a } catch {} }
    }

    const playerList: ServerPlayerDetail[] = rawPlayers.map(mapPlayer)
    const queue = Array.isArray(rawQueue) ? rawQueue.length : 0

    const activity: ServerActivity[] = (Array.isArray(rawJoins) ? rawJoins : [])
      .sort((a, b) => ((b.Timestamp as number) ?? 0) - ((a.Timestamp as number) ?? 0))
      .slice(0, 40)
      .map((l: Loose) => {
        const [name, idStr] = String(l.Player ?? '').split(':')
        return { type: l.Join ? 'join' as const : 'leave' as const, name: (name ?? '').trim(), userId: parseInt(idStr ?? '0', 10) || 0, timestamp: (l.Timestamp as number) ?? 0 }
      })

    if (!res.ok && rawPlayers.length === 0) {
      return { ...EMPTY_DETAIL(`PRC unreachable (HTTP ${res.status}).`), maxPlayers, queue }
    }

    const staffCount = playerList.filter(p => p.permission && p.permission !== 'Normal').length
    const players = playerList.length || currentPlayers
    return { ok: true, name: serverName, players, maxPlayers, queue, staffCount, playerList, activity }
  } catch (err) {
    return EMPTY_DETAIL(err instanceof Error ? err.message : 'Network error.')
  }
}

export type { ServerStatus }
