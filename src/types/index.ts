export type KeyType = 'staff' | 'basic'

export type UpdateCategory = 'feature' | 'fix' | 'announcement'

export interface UpdatePost {
  id: string
  title: string
  body: string
  version?: string
  category: UpdateCategory
  author: string
  postedAt: string
}

export interface KeyRecord {
  key: string
  type: KeyType
  issuedAt: string
  expiresAt: string
  months: number
  revoked: boolean
  revokedAt?: string
  discordUsername?: string
  discordId?: string
  role?: string
}

export interface IssueKeyPayload {
  months: 1 | 3
  discordUsername?: string
  discordId?: string
  role?: string   // standard | club33 | staff
}

export interface RobloxAccount {
  id: string
  userId: number
  username: string
  displayName: string
  avatarUrl: string
  status: 'online' | 'offline' | 'in-game' | 'studio' | 'unknown'
  presenceType: number
  lastLocation?: string
  gameId?: string
  cookie?: string
  cookieStatus?: 'valid' | 'expired' | 'unknown'
  group: string
  favorite?: boolean   // pinned to the top of the list
  tag?: string         // label: 'Moderator perms' | 'Admin perms' | a custom group
  created?: string     // Roblox account creation date (ISO) — used for the age gate
  addedAt: string
  refreshedAt: string
}

export interface HealthCheckStatus {
  running: boolean
  total: number
  done: number
  valid: number
  expired: number
  unknown: number
  log: string[]
}

export interface AppSettings {
  autoRefreshEnabled: boolean
  autoRefreshInterval: number
  accentColor: string
  theme: 'dark'
  uiTheme: string           // UI style skin id (see src/ui-themes.ts)
  uiDesign: 'classic' | 'modern'   // overall design language (see [data-design] in index.css)
  antiAfkEnabled: boolean
  antiAfkInterval: number   // minutes between wiggles (Roblox kicks at 20)
  antiAfkAction: AntiAfkAction
  antiAfkAccountIds: string[]   // opt-in: only these accounts receive anti-AFK input
  antiAfkMinimize: boolean      // keep Roblox minimized between wiggles (saves performance)
  antiAfkMute: boolean          // mute every Roblox instance's audio
  autoAlt: AutoAltConfig
  lowGpuEnabled: boolean    // apply low-graphics FastFlags during launch
  fpsCap: number            // cap every Roblox client's FPS (0 = unlimited); applied via FastFlag
  disableTextures: boolean  // FastFlag: force textures to minimum quality (saves VRAM) — applied on launch
  minimalLighting: boolean  // FastFlag: kill post-FX / shadows / dynamic lights (saves GPU) — applied on launch
  skipSplash: boolean       // FastFlag: strip the loading/teleport screen blur so alts load in faster
  muteMusic: boolean        // mute each alt's Roblox audio session (no music/SFX while alting)
  healthSweepEnabled: boolean
  healthSweepInterval: number   // minutes between background health sweeps
  customTags: string[]          // reusable account labels the user created
  bgType: 'default' | 'color' | 'image' | 'video'   // app background mode
  bgColor: string               // solid background color (bgType 'color')
  bgMedia: string               // file:// URL of the chosen image/video (bgType image/video)
  mapCal?: { xMin: number; xMax: number; zMin: number; zMax: number }  // Server Management map projection calibration
  webhookEnabled: boolean       // post event alerts to a Discord webhook
  webhookUrl: string            // Discord webhook URL
  webhookEvents: WebhookEvents  // which events to post
  autoRejoinEnabled: boolean    // Premium: re-queue in-game alts that drop
  autoAltSchedule: AutoAltSchedule   // Premium: run auto-alting on a daily time schedule
  autoJail: boolean             // Premium: auto-run :jail <user> on deployed alts so they sit in the in-game jail
  jailDelaySec: number          // seconds between queued :jail commands (paced to dodge PRC rate limits)
  jailBackoffSec: number        // seconds to wait + retry after a PRC rate-limit/error while jailing
  autoTrim: boolean             // Premium: periodically minimize + low-priority + RAM-trim running alts (24/7 spec saver)
  pixelReduceEnabled: boolean   // Premium: shrink each alt's window to a tiny size so Roblox renders fewer pixels
  pixelReduceSize: number       // window width/height in px when pixelReduce is on (min 100)
  ramLimitEnabled: boolean      // Premium: hard-cap each alt's working set (RAM) per account
  ramLimitMb: number            // working-set cap per alt in MB (recommended 300–400)
}

// ── Scheduled auto-alting ───────────────────────────────────────────────────────
// One recurring daily window. While "now" falls inside an enabled window, the
// auto-alting engine runs with the saved AutoAltConfig; when the window ends it
// stops again. Times are local "HH:MM" (24h). Overnight windows (start > end,
// e.g. 22:00→02:00) are supported. `days` is 0=Sun..6=Sat; empty = every day.
export interface AutoAltScheduleWindow {
  id: string
  start: string   // "HH:MM"
  end: string     // "HH:MM"
  days: number[]  // 0–6 (empty = every day)
}

export interface AutoAltSchedule {
  enabled: boolean          // master switch for the whole schedule
  disconnectOnEnd: boolean  // also close all running alts when a window ends
  windows: AutoAltScheduleWindow[]
}

export interface AutoAltScheduleStatus {
  enabled: boolean
  active: boolean   // a window is live right now
  running: boolean  // the auto-alting engine is currently running
}

// Which app events get posted to the Discord webhook (all default on).
export interface WebhookEvents {
  deploy: boolean        // alts launched (auto-alt or manual)
  remove: boolean        // alts removed to free slots
  serverFull: boolean    // real players reached the busy threshold
  cookieExpired: boolean // a health sweep found expired cookies
}

export type AntiAfkAction = 'jump' | 'ws' | 'zoom'

export interface AntiAfkStatus {
  running: boolean
  intervalMinutes: number
  windowCount: number
  lastWiggle: string | null
}

export interface AutoAltConfig {
  serverKey: string
  serverCode: string
  deployBelow: number
  deployCount: number
  removeAt: number
  removeCount: number
  interval: number      // PRC poll frequency (seconds)
  launchDelay: number   // delay between alt launches (seconds)
  accountIds?: string[] // opt-in: only auto-alt with these accounts (empty = all)
}

export interface AutoAltStatus {
  running: boolean
  players: number
  maxPlayers: number
  ourAlts: number
  available: number
  lastCheck: string | null
  log: string[]
}

// Auto Jail — locks our deployed alts in the in-game ER:LC jail (via :jail <user>)
// while Auto Alting runs (see electron/auto-jail.ts). `running` = Auto Jail is live
// (automation is running); `enabled` = the autoJail setting is on.
export interface AutoJailStatus {
  running: boolean
  enabled: boolean
  jailedCount: number    // alts currently held in the in-game jail
  queued: number         // alts waiting in the jail queue (paced to dodge PRC rate limits)
  lastJail: string | null
  lastError: string | null
}

// Resource Trim — periodically minimizes + low-priorities + RAM-trims running
// alts to cut CPU/RAM for 24/7 alting (see electron/resource-trim.ts).
export interface ResourceTrimStatus {
  enabled: boolean
  trimmedCount: number   // alts trimmed on the last sweep
  freedMb: number        // approx RAM reclaimed on the last sweep (MB)
  lastTrim: string | null
}

export interface LicenseData {
  key: string
  type: KeyType
  role?: string        // standard | club33 | staff (from Supabase)
  discordUsername?: string   // linked Discord username (from the licenses table)
  hwid?: string
  expiresAt: string
  validatedAt: string
}

export type ValidationResult =
  | { valid: true; expiresAt: Date; type: KeyType; role?: string; discordUsername?: string }
  | { valid: false; error: string }

export interface UserLookupResult {
  found: boolean
  discordId?: string
  discordUsername?: string
  role: string
  license?: {
    key: string
    plan: string
    expiresAt: string
    status: string   // active | revoked | expired
  }
  hardware?: {
    hwid: string | null
    lastHeartbeat: string | null
    appVersion: string | null
  }
  cookies?: {
    total: number
    healthy: number
    expired: number
    lastCheck: string | null
  }
  session: 'live' | 'last-known' | 'offline'
}

export interface SystemStats {
  cpuUsage: number
  totalRam: number
  usedRam: number
}

export interface RobloxUserResponse {
  id: number
  name: string
  displayName: string
  description: string
  created: string
  isBanned: boolean
}

export interface RobloxPresenceResponse {
  userPresenceType: number
  lastLocation?: string
  gameId?: string
  rootPlaceId?: number
  userId: number
  lastOnline: string
}

export interface ValidatedCookieUser {
  id: number
  name: string
  displayName: string
  avatarUrl: string
  group: string
  cookie: string
  created?: string   // Roblox account creation date (ISO)
}

export interface LoginResult {
  success: boolean
  userId?: number
  username?: string
  cookie?: string
  requiresTwoStep?: boolean
  twoStepTicket?: string
  twoStepType?: string
  error?: string
}

export interface ErlcJoinResult {
  accountId: string
  username: string
  success: boolean
  error?: string
}

export type LeaderboardMetric = 'launches' | 'hours' | 'streak' | 'maxsession'

export interface LeaderboardEntry {
  username: string
  role: string | null
  value: number
  discordId?: string | null   // for the Discord avatar URL
  avatar?: string | null      // Discord avatar hash
}

// ── Server Management (ER:LC live dashboard) ────────────────────────────────────
export interface ServerPlayerDetail {
  name: string
  userId: number
  permission: string   // 'Normal' | 'Server Moderator' | 'Server Administrator' | 'Server Owner'
  team: string         // 'Civilian' | 'Police' | 'Sheriff' | 'Fire' | 'DOT' | 'Jail'
  callsign: string | null
  locationX?: number | null   // Roblox world X (PRC v2 Location.LocationX) — null if unavailable
  locationZ?: number | null   // Roblox world Z (PRC v2 Location.LocationZ)
  street?: string | null      // Location.StreetName
  postal?: string | null      // Location.PostalCode
  wanted?: number             // WantedStars 0–5
}
export interface ServerActivity {
  type: 'join' | 'leave'
  name: string
  userId: number
  timestamp: number    // unix seconds
}
export interface ServerDetail {
  ok: boolean
  name?: string
  players: number
  maxPlayers: number
  queue: number
  staffCount: number
  playerList: ServerPlayerDetail[]
  activity: ServerActivity[]
  error?: string
}

export type Page = 'home' | 'accounts' | 'premium' | 'updates' | 'settings' | 'leaderboard' | 'about' | 'staff'
