// macOS-specific Roblox launcher implementation
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn, execFileSync } from 'node:child_process'
import type { RobloxLauncher } from '../types.js'

// ── Roblox client discovery (macOS) ─────────────────────────────────────────

type RobloxLauncherType = 'roblox'

// Find Roblox.app on macOS
function findRobloxApp(): { type: RobloxLauncherType; path: string } | null {
  const candidates = [
    '/Applications/Roblox.app',
    path.join(os.homedir(), 'Applications', 'Roblox.app'),
    // Check user Applications folder (~/Applications)
  ]

  for (const appPath of candidates) {
    if (fs.existsSync(appPath)) {
      // Verify it's actually an app bundle
      const exePath = path.join(appPath, 'Contents', 'MacOS', 'RobloxPlayer')
      if (fs.existsSync(exePath)) {
        return { type: 'roblox', path: appPath }
      }
    }
  }

  return null
}

// ── macOS Roblox Launcher Implementation ────────────────────────────────────

class DarwinLauncher implements RobloxLauncher {
  findPlayer(): { type: string; path: string } | null {
    return findRobloxApp()
  }

  async launchPlayer(args: string[]): Promise<{ pid?: number; error?: string }> {
    const player = this.findPlayer()
    if (!player) {
      return { error: 'Roblox.app not found. Please install Roblox from www.roblox.com' }
    }

    try {
      // macOS: Use `open -n` to force a NEW instance (multi-instance support built-in)
      // The --args flag passes arguments to the app
      const proc = spawn('open', ['-n', player.path, '--args', ...args], {
        detached: true,
        stdio: 'ignore'
      })

      // Note: `open` exits immediately after launching, so proc.pid is not the Roblox process
      // We'll need to find the actual Roblox process later if needed
      return { pid: proc.pid } // This is the `open` process PID, not Roblox's
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }

  killProcess(pid: number): boolean {
    try {
      // On macOS, use `kill` command
      spawn('kill', ['-9', String(pid)], { stdio: 'ignore' })
      return true
    } catch { return false }
  }

  // Kill all Roblox processes (for "Disconnect All")
  killAllRoblox(): boolean {
    try {
      // Use pkill to find and kill all Roblox processes
      spawn('pkill', ['-9', '-f', 'Roblox'], { stdio: 'ignore' })
      return true
    } catch { return false }
  }

  async ensureMultiInstance(): Promise<boolean> {
    // macOS Roblox already supports multi-instance via `open -n`
    // No mutex handling needed!
    return true
  }

  getCookiePath(): string {
    // macOS Roblox stores cookies in:
    // ~/Library/Application Support/Roblox/LocalStorage/RobloxCookies.dat
    // OR: ~/Library/Containers/com.roblox.RobloxPlayer/Data/Library/Application Support/Roblox/...
    const supportPath = path.join(os.homedir(), 'Library', 'Application Support', 'Roblox')
    const cookiePath = path.join(supportPath, 'LocalStorage', 'RobloxCookies.dat')
    return cookiePath
  }

  getClientSettingsPath(exePath: string): string | null {
    // On macOS, Roblox.app bundle structure:
    // Roblox.app/Contents/MacOS/RobloxPlayer
    // Settings might be in: ~/Library/Application Support/Roblox/ClientSettings/ClientAppSettings.json
    try {
      const supportPath = path.join(os.homedir(), 'Library', 'Application Support', 'Roblox')
      const settingsPath = path.join(supportPath, 'ClientSettings', 'ClientAppSettings.json')
      if (fs.existsSync(path.dirname(settingsPath))) return settingsPath
    } catch {}
    return null
  }

  // Get running Roblox PIDs on macOS
  getRunningPids(): number[] {
    try {
      const out = execFileSync('pgrep', ['-f', 'Roblox'], { encoding: 'utf8' })
      return out.split('\n').filter(Boolean).map(Number).filter(n => !isNaN(n))
    } catch {
      return []
    }
  }
}

// Export singleton instance
export const launcher = new DarwinLauncher()
export default launcher
