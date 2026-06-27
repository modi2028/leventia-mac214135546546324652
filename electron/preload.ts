import { contextBridge, ipcRenderer } from 'electron'
import type {
  RobloxAccount,
  AppSettings,
  LicenseData,
  SystemStats,
  RobloxUserResponse,
  RobloxPresenceResponse,
  ValidatedCookieUser,
} from '../src/types/index.js'

const robloxApi = {
  // Public profile
  getUserByUsername: (username: string): Promise<{ id: number; name: string; displayName: string } | null> =>
    ipcRenderer.invoke('roblox:get-user-by-username', username),
  getUserById: (id: number): Promise<RobloxUserResponse | null> =>
    ipcRenderer.invoke('roblox:get-user-by-id', id),
  getAvatarUrl: (userId: number): Promise<string | null> =>
    ipcRenderer.invoke('roblox:get-avatar-url', userId),
  getPresence: (userIds: number[]): Promise<RobloxPresenceResponse[]> =>
    ipcRenderer.invoke('roblox:get-presence', userIds),
  getGroup: (userId: number): Promise<string> =>
    ipcRenderer.invoke('roblox:get-group', userId),

  // Cookie-based auth
  validateCookie: (cookie: string): Promise<ValidatedCookieUser | null> =>
    ipcRenderer.invoke('roblox:validate-cookie', cookie),
  browserLogin: (): Promise<ValidatedCookieUser | null> =>
    ipcRenderer.invoke('roblox:browser-login'),
  importCookiesFile: (): Promise<string[]> =>
    ipcRenderer.invoke('roblox:import-cookies-file'),

  // ERLC
  checkSetup: (): Promise<{ found: boolean; type: 'bloxstrap' | 'fishstrap' | 'roblox' | null; path: string | null; multiInstance: boolean; multiExe?: boolean }> =>
    ipcRenderer.invoke('roblox:check-setup'),
  resolveErlcCode: (serverCode: string): Promise<{ placeId: string; accessCode?: string; linkCode?: string } | null> =>
    ipcRenderer.invoke('roblox:resolve-erlc-code', serverCode),
  joinErlc: (cookie: string, placeId: string, accessCode: string | undefined, linkCode: string | undefined, accountId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('roblox:join-erlc', cookie, placeId, accessCode, linkCode, accountId),
  getRunning: (): Promise<string[]> =>
    ipcRenderer.invoke('roblox:get-running'),
  disconnect: (accountId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('roblox:disconnect', accountId),
  disconnectAll: (): Promise<{ success: boolean; count: number }> =>
    ipcRenderer.invoke('roblox:disconnect-all'),

  // Legacy
  loginWithCookie: (cookie: string): Promise<{ success: boolean; userId?: number; username?: string; cookie?: string; error?: string }> =>
    ipcRenderer.invoke('roblox:login-with-cookie', cookie),
}

const storeApi = {
  getAccounts: (): Promise<RobloxAccount[]> =>
    ipcRenderer.invoke('store:get-accounts'),
  addAccount: (account: RobloxAccount): Promise<void> =>
    ipcRenderer.invoke('store:add-account', account),
  removeAccounts: (ids: string[]): Promise<void> =>
    ipcRenderer.invoke('store:remove-accounts', ids),
  updateAccount: (id: string, updates: Partial<RobloxAccount>): Promise<void> =>
    ipcRenderer.invoke('store:update-account', id, updates),
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke('store:get-settings'),
  saveSettings: (settings: AppSettings): Promise<void> =>
    ipcRenderer.invoke('store:save-settings', settings),
  getLicense: (): Promise<LicenseData | null> =>
    ipcRenderer.invoke('store:get-license'),
  revalidateLicense: (): Promise<LicenseData | null> =>
    ipcRenderer.invoke('store:revalidate-license'),
  saveLicense: (key: string): Promise<LicenseData> =>
    ipcRenderer.invoke('store:save-license', key),
  clearLicense: (): Promise<boolean> =>
    ipcRenderer.invoke('store:clear-license'),
  getHwid: (): Promise<string> =>
    ipcRenderer.invoke('store:get-hwid'),
  clearAccounts: (): Promise<void> =>
    ipcRenderer.invoke('store:clear-accounts'),
  validateKey: (key: string): Promise<{ valid: boolean; error?: string; expiresAt?: Date }> =>
    ipcRenderer.invoke('store:validate-key', key),
  // Staff-only
  issueKey: (payload: import('../src/types/index.js').IssueKeyPayload): Promise<import('../src/types/index.js').KeyRecord> =>
    ipcRenderer.invoke('store:issue-key', payload),
  getKeys: (): Promise<import('../src/types/index.js').KeyRecord[]> =>
    ipcRenderer.invoke('store:get-keys'),
  revokeKey: (key: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('store:revoke-key', key),
  // Updates feed
  getUpdates: (): Promise<import('../src/types/index.js').UpdatePost[]> =>
    ipcRenderer.invoke('store:get-updates'),
  postUpdate: (payload: { title: string; body: string; version?: string; category: import('../src/types/index.js').UpdateCategory }): Promise<import('../src/types/index.js').UpdatePost> =>
    ipcRenderer.invoke('store:post-update', payload),
  deleteUpdate: (id: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('store:delete-update', id),
  // Supabase User Lookup + license management (staff)
  supabaseEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke('store:supabase-enabled'),
  leaderboard: (metric: import('../src/types/index.js').LeaderboardMetric): Promise<import('../src/types/index.js').LeaderboardEntry[]> =>
    ipcRenderer.invoke('store:leaderboard', metric),
  lookupUser: (query: string): Promise<import('../src/types/index.js').UserLookupResult> =>
    ipcRenderer.invoke('store:lookup-user', query),
  resetHwid: (key: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('store:reset-hwid', key),
  extendLicense: (key: string, days: number): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('store:extend-license', key, days),
  revokeLicense: (key: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('store:revoke-license', key),
  enableLicense: (key: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('store:enable-license', key),
  setRole: (key: string, role: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('store:set-role', key, role),
  // Backup
  exportBackup: (): Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string; accounts?: number }> =>
    ipcRenderer.invoke('store:export-backup'),
  importBackup: (): Promise<{ success: boolean; canceled?: boolean; error?: string; accounts?: RobloxAccount[]; settings?: AppSettings }> =>
    ipcRenderer.invoke('store:import-backup'),
}

const systemApi = {
  getStats: (): Promise<SystemStats> =>
    ipcRenderer.invoke('system:get-stats'),
}

const antiAfkApi = {
  start: (minutes?: number): Promise<boolean> =>
    ipcRenderer.invoke('antiafk:start', minutes),
  stop: (): Promise<boolean> =>
    ipcRenderer.invoke('antiafk:stop'),
  setInterval: (minutes: number): Promise<boolean> =>
    ipcRenderer.invoke('antiafk:set-interval', minutes),
  status: (): Promise<import('../src/types/index.js').AntiAfkStatus> =>
    ipcRenderer.invoke('antiafk:status'),
  leaveAll: (): Promise<number> =>
    ipcRenderer.invoke('antiafk:leave-all'),
  setMute: (mute: boolean): Promise<boolean> =>
    ipcRenderer.invoke('antiafk:set-mute', mute),
}

type AutoAltConfig = import('../src/types/index.js').AutoAltConfig
type AutoAltStatus = import('../src/types/index.js').AutoAltStatus
type ServerStatus = { ok: boolean; players: number; maxPlayers: number; names: string[]; name?: string; error?: string }

const lowGpuApi = {
  apply: (): Promise<boolean> => ipcRenderer.invoke('lowgpu:apply'),
  restore: (): Promise<boolean> => ipcRenderer.invoke('lowgpu:restore'),
  status: (): Promise<{ applied: boolean }> => ipcRenderer.invoke('lowgpu:status'),
}

const trimApi = {
  now: (): Promise<import('../src/types/index.js').ResourceTrimStatus> =>
    ipcRenderer.invoke('trim:now'),
  status: (): Promise<import('../src/types/index.js').ResourceTrimStatus> =>
    ipcRenderer.invoke('trim:status'),
}

const healthApi = {
  start: (): Promise<boolean> => ipcRenderer.invoke('health:start'),
  status: (): Promise<import('../src/types/index.js').HealthCheckStatus> => ipcRenderer.invoke('health:status'),
  sweepStart: (minutes: number): Promise<boolean> => ipcRenderer.invoke('health:sweep-start', minutes),
  sweepStop: (): Promise<boolean> => ipcRenderer.invoke('health:sweep-stop'),
}

const bgApi = {
  pick: (kind: 'image' | 'video'): Promise<{ success: boolean; canceled?: boolean; url?: string; error?: string }> =>
    ipcRenderer.invoke('bg:pick', kind),
  clear: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('bg:clear'),
}

const serverMapApi = {
  fetch: (serverKey: string): Promise<import('../src/types/index.js').ServerDetail> =>
    ipcRenderer.invoke('servermap:fetch', serverKey),
}

const webhookApi = {
  test: (url: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('webhook:test', url),
}

const appApi = {
  status: (): Promise<{ killed: boolean }> =>
    ipcRenderer.invoke('app:status'),
  setKill: (ownerSecret: string, killed: boolean): Promise<{ ok: boolean; killed?: boolean; error?: string }> =>
    ipcRenderer.invoke('app:set-kill', ownerSecret, killed),
  // In-app updates
  version: (): Promise<string> =>
    ipcRenderer.invoke('app:version'),
  latestVersion: (): Promise<{ version?: string; url?: string }> =>
    ipcRenderer.invoke('app:latest-version'),
  setVersion: (ownerSecret: string, version: string, url: string): Promise<{ ok: boolean; version?: string; url?: string; error?: string }> =>
    ipcRenderer.invoke('app:set-version', ownerSecret, version, url),
  // Owner announcement (broadcast banner)
  announcement: (): Promise<{ text?: string; level?: string; at?: string }> =>
    ipcRenderer.invoke('app:announcement'),
  setAnnouncement: (ownerSecret: string, text: string, level: string): Promise<{ ok: boolean; text?: string; error?: string }> =>
    ipcRenderer.invoke('app:set-announcement', ownerSecret, text, level),
  onPanic: (cb: () => void): (() => void) => {
    const handler = () => cb()
    ipcRenderer.on('panic:triggered', handler)
    return () => ipcRenderer.removeListener('panic:triggered', handler)
  },
  // Fired the instant the main-process killswitch poller sees a state change, so
  // the lockout appears immediately instead of waiting for the 30s status poll.
  onKillChanged: (cb: (killed: boolean) => void): (() => void) => {
    const handler = (_e: unknown, killed: boolean) => cb(!!killed)
    ipcRenderer.on('app:kill-changed', handler)
    return () => ipcRenderer.removeListener('app:kill-changed', handler)
  },
}

const windowApi = {
  minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  maximize: (): Promise<boolean> => ipcRenderer.invoke('window:maximize'),
  close: (): Promise<void> => ipcRenderer.invoke('window:close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
  onMaximizeChange: (cb: (maximized: boolean) => void): (() => void) => {
    const handler = (_e: unknown, m: boolean) => cb(m)
    ipcRenderer.on('window:maximized-changed', handler)
    return () => ipcRenderer.removeListener('window:maximized-changed', handler)
  },
}

const autoAltApi = {
  testKey: (serverKey: string): Promise<ServerStatus> =>
    ipcRenderer.invoke('autoalt:test-key', serverKey),
  start: (config: AutoAltConfig): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('autoalt:start', config),
  stop: (): Promise<boolean> =>
    ipcRenderer.invoke('autoalt:stop'),
  status: (): Promise<AutoAltStatus> =>
    ipcRenderer.invoke('autoalt:status'),
  deployNow: (config: AutoAltConfig): Promise<void> =>
    ipcRenderer.invoke('autoalt:deploy-now', config),
  removeNow: (config: AutoAltConfig): Promise<void> =>
    ipcRenderer.invoke('autoalt:remove-now', config),
  // Scheduled auto-alting (the schedule lives in settings; these re-evaluate it
  // immediately after an edit and report live status).
  scheduleStatus: (): Promise<import('../src/types/index.js').AutoAltScheduleStatus> =>
    ipcRenderer.invoke('autoalt:schedule-status'),
  scheduleRefresh: (): Promise<import('../src/types/index.js').AutoAltScheduleStatus> =>
    ipcRenderer.invoke('autoalt:schedule-refresh'),
  // Auto Jail live status (the toggle is saved via store.saveSettings).
  jailStatus: (): Promise<import('../src/types/index.js').AutoJailStatus> =>
    ipcRenderer.invoke('autoalt:jail-status'),
}

contextBridge.exposeInMainWorld('electron', {
  roblox: robloxApi,
  store: storeApi,
  system: systemApi,
  antiAfk: antiAfkApi,
  autoAlt: autoAltApi,
  lowGpu: lowGpuApi,
  trim: trimApi,
  health: healthApi,
  bg: bgApi,
  serverMap: serverMapApi,
  webhook: webhookApi,
  app: appApi,
  window: windowApi,
})

export type ElectronAPI = {
  roblox: typeof robloxApi
  store: typeof storeApi
  system: typeof systemApi
  antiAfk: typeof antiAfkApi
  autoAlt: typeof autoAltApi
  lowGpu: typeof lowGpuApi
  trim: typeof trimApi
  health: typeof healthApi
  bg: typeof bgApi
  serverMap: typeof serverMapApi
  webhook: typeof webhookApi
  app: typeof appApi
  window: typeof windowApi
}
