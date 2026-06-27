import type {
  RobloxAccount,
  AppSettings,
  LicenseData,
  SystemStats,
  RobloxUserResponse,
  RobloxPresenceResponse,
  ValidatedCookieUser,
  ValidationResult,
  KeyRecord,
  UpdatePost,
  UpdateCategory,
  AntiAfkStatus,
  AutoAltConfig,
  AutoAltStatus,
  AutoAltScheduleStatus,
  AutoJailStatus,
  ResourceTrimStatus,
  HealthCheckStatus,
  UserLookupResult,
  IssueKeyPayload,
  LeaderboardMetric,
  LeaderboardEntry,
} from './types/index.js'

type ErlcServerStatus = { ok: boolean; players: number; maxPlayers: number; names: string[]; name?: string; error?: string }

declare global {
  interface Window {
    electron: {
      roblox: {
        getUserByUsername(username: string): Promise<{ id: number; name: string; displayName: string } | null>
        getUserById(id: number): Promise<RobloxUserResponse | null>
        getAvatarUrl(userId: number): Promise<string | null>
        getPresence(userIds: number[]): Promise<RobloxPresenceResponse[]>
        getGroup(userId: number): Promise<string>
        validateCookie(cookie: string): Promise<ValidatedCookieUser | null>
        browserLogin(): Promise<ValidatedCookieUser | null>
        importCookiesFile(): Promise<string[]>
        checkSetup(): Promise<{ found: boolean; type: 'bloxstrap' | 'roblox' | null; path: string | null; multiInstance: boolean }>
        resolveErlcCode(serverCode: string): Promise<{ placeId: string; accessCode?: string; linkCode?: string } | null>
        joinErlc(cookie: string, placeId: string, accessCode: string | undefined, linkCode: string | undefined, accountId: string): Promise<{ success: boolean; error?: string }>
        getRunning(): Promise<string[]>
        disconnect(accountId: string): Promise<{ success: boolean; error?: string }>
        disconnectAll(): Promise<{ success: boolean; count: number }>
        loginWithCookie(cookie: string): Promise<{ success: boolean; userId?: number; username?: string; cookie?: string; error?: string }>
      }
      store: {
        getAccounts(): Promise<RobloxAccount[]>
        addAccount(account: RobloxAccount): Promise<void>
        removeAccounts(ids: string[]): Promise<void>
        updateAccount(id: string, updates: Partial<RobloxAccount>): Promise<void>
        getSettings(): Promise<AppSettings>
        saveSettings(settings: AppSettings): Promise<void>
        getLicense(): Promise<LicenseData | null>
        revalidateLicense(): Promise<LicenseData | null>
        saveLicense(key: string): Promise<LicenseData>
        clearLicense(): Promise<boolean>
        getHwid(): Promise<string>
        clearAccounts(): Promise<void>
        validateKey(key: string): Promise<ValidationResult>
        // Staff-only
        issueKey(payload: IssueKeyPayload): Promise<KeyRecord>
        getKeys(): Promise<KeyRecord[]>
        revokeKey(key: string): Promise<{ success: boolean }>
        getUpdates(): Promise<UpdatePost[]>
        postUpdate(payload: { title: string; body: string; version?: string; category: UpdateCategory }): Promise<UpdatePost>
        deleteUpdate(id: string): Promise<{ success: boolean }>
        supabaseEnabled(): Promise<boolean>
        leaderboard(metric: LeaderboardMetric): Promise<LeaderboardEntry[]>
        lookupUser(query: string): Promise<UserLookupResult>
        resetHwid(key: string): Promise<{ success: boolean }>
        extendLicense(key: string, days: number): Promise<{ success: boolean }>
        revokeLicense(key: string): Promise<{ success: boolean }>
        enableLicense(key: string): Promise<{ success: boolean }>
        setRole(key: string, role: string): Promise<{ success: boolean }>
        exportBackup(): Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string; accounts?: number }>
        importBackup(): Promise<{ success: boolean; canceled?: boolean; error?: string; accounts?: RobloxAccount[]; settings?: AppSettings }>
      }
      system: {
        getStats(): Promise<SystemStats>
      }
      antiAfk: {
        start(minutes?: number): Promise<boolean>
        stop(): Promise<boolean>
        setInterval(minutes: number): Promise<boolean>
        status(): Promise<AntiAfkStatus>
        leaveAll(): Promise<number>
        setMute(mute: boolean): Promise<boolean>
      }
      autoAlt: {
        testKey(serverKey: string): Promise<ErlcServerStatus>
        start(config: AutoAltConfig): Promise<{ ok: boolean; error?: string }>
        stop(): Promise<boolean>
        status(): Promise<AutoAltStatus>
        deployNow(config: AutoAltConfig): Promise<void>
        removeNow(config: AutoAltConfig): Promise<void>
        scheduleStatus(): Promise<AutoAltScheduleStatus>
        scheduleRefresh(): Promise<AutoAltScheduleStatus>
        jailStatus(): Promise<AutoJailStatus>
      }
      lowGpu: {
        apply(): Promise<boolean>
        restore(): Promise<boolean>
        status(): Promise<{ applied: boolean }>
      }
      trim: {
        now(): Promise<ResourceTrimStatus>
        status(): Promise<ResourceTrimStatus>
      }
      health: {
        start(): Promise<boolean>
        status(): Promise<HealthCheckStatus>
        sweepStart(minutes: number): Promise<boolean>
        sweepStop(): Promise<boolean>
      }
      bg: {
        pick(kind: 'image' | 'video'): Promise<{ success: boolean; canceled?: boolean; url?: string; error?: string }>
        clear(): Promise<{ success: boolean }>
      }
      serverMap: {
        fetch(serverKey: string): Promise<import('./types/index.js').ServerDetail>
      }
      webhook: {
        test(url: string): Promise<{ ok: boolean; error?: string }>
      }
      app: {
        status(): Promise<{ killed: boolean }>
        setKill(ownerSecret: string, killed: boolean): Promise<{ ok: boolean; killed?: boolean; error?: string }>
        onPanic(cb: () => void): () => void
        onKillChanged(cb: (killed: boolean) => void): () => void
        version(): Promise<string>
        latestVersion(): Promise<{ version?: string; url?: string }>
        setVersion(ownerSecret: string, version: string, url: string): Promise<{ ok: boolean; version?: string; url?: string; error?: string }>
        announcement(): Promise<{ text?: string; level?: string; at?: string }>
        setAnnouncement(ownerSecret: string, text: string, level: string): Promise<{ ok: boolean; text?: string; error?: string }>
      }
      window: {
        minimize(): Promise<void>
        maximize(): Promise<boolean>
        close(): Promise<void>
        isMaximized(): Promise<boolean>
        onMaximizeChange(cb: (maximized: boolean) => void): () => void
      }
    }
  }
}
