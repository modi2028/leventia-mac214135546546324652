// Platform-agnostic interface for Roblox launching operations
export interface RobloxLauncher {
  /** Locate the Roblox client executable/app bundle */
  findPlayer(): { type: string; path: string } | null

  /** Launch Roblox with the given arguments */
  launchPlayer(args: string[]): Promise<{ pid?: number; error?: string }>

  /** Kill a Roblox process by PID */
  killProcess(pid: number): boolean

  /** Ensure multi-instance capability (no-op on macOS, mutex on Windows) */
  ensureMultiInstance(): Promise<boolean>

  /** Get path to Roblox cookies file */
  getCookiePath(): string

  /** Get path to Roblox client settings folder (for FastFlags) */
  getClientSettingsPath(exePath: string): string | null
}

export type PlatformLauncher = RobloxLauncher
