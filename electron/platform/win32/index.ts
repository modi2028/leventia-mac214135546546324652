// Windows-specific Roblox launcher implementation
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn, execFileSync } from 'node:child_process'
import type { RobloxLauncher } from '../types.js'

// Re-export the existing Windows functions from multi-instance.ts
export {
  holdRobloxMutex,
  releaseRobloxMutex,
  ensureRobloxMutex,
  closeRobloxSingleton,
  lockRobloxCookies,
  unlockRobloxCookies
} from '../../multi-instance.js'

// ── Roblox client discovery (Windows) ────────────────────────────────────────

type RobloxLauncherType = 'roblox' | 'bloxstrap' | 'fishstrap'

// Find RobloxPlayerBeta.exe via Windows Registry (authoritative)
function playerFromProtocol(): string | null {
  try {
    const out = execFileSync(
      'reg',
      ['query', 'HKCU\\Software\\Classes\\roblox-player\\shell\\open\\command', '/ve'],
      { encoding: 'utf8', windowsHide: true },
    )
    const m = out.match(/[A-Za-z]:\\[^"\r\n]*?RobloxPlayerBeta\.exe/i)
    if (m && fs.existsSync(m[0])) return m[0]
  } catch { /* protocol not registered */ }
  return null
}

// Find Roblox by scanning version folders (fallback)
function findPlayerByScanning(): { type: RobloxLauncherType; path: string } | null {
  const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local')
  const bases: Array<{ type: RobloxLauncherType; dir: string }> = [
    { type: 'bloxstrap', dir: path.join(local, 'Bloxstrap', 'Versions') },
    { type: 'fishstrap', dir: path.join(local, 'Fishstrap', 'Versions') },
    { type: 'roblox',    dir: path.join(local, 'Roblox', 'Versions') },
    { type: 'roblox',    dir: path.join(local, 'Programs', 'Roblox', 'Versions') },
  ]

  const candidates: Array<{ type: RobloxLauncherType; path: string; installed: number }> = []
  for (const base of bases) {
    try {
      for (const d of fs.readdirSync(base.dir)) {
        const dir = path.join(base.dir, d)
        const exePath = path.join(dir, 'RobloxPlayerBeta.exe')
        try {
          const exeStat = fs.statSync(exePath)
          let installed: number
          try { const ds = fs.statSync(dir); installed = ds.birthtimeMs || ds.mtimeMs } catch { installed = exeStat.mtimeMs }
          candidates.push({ type: base.type, path: exePath, installed })
        } catch {}
      }
    } catch {}
  }

  if (!candidates.length) return null
  candidates.sort((a, b) => b.installed - a.installed)
  return { type: candidates[0].type, path: candidates[0].path }
}

// ── Windows Roblox Launcher Implementation ─────────────────────────────────

class WindowsLauncher implements RobloxLauncher {
  findPlayer(): { type: string; path: string } | null {
    const fromReg = playerFromProtocol()
    if (fromReg) return { type: 'roblox', path: fromReg }
    return findPlayerByScanning()
  }

  async launchPlayer(args: string[]): Promise<{ pid?: number; error?: string }> {
    const player = this.findPlayer()
    if (!player) return { error: 'RobloxPlayerBeta.exe not found' }

    try {
      const proc = spawn(player.path, args, { detached: true, stdio: 'ignore', windowsHide: false })
      proc.on('error', (e) => console.error('[Windows] spawn error:', e))
      return { pid: proc.pid }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }

  killProcess(pid: number): boolean {
    try {
      spawn('taskkill', ['/F', '/T', '/PID', String(pid)], { windowsHide: true })
      return true
    } catch { return false }
  }

  async ensureMultiInstance(): Promise<boolean> {
    // Dynamic import to avoid circular dependency
    const { ensureRobloxMutex } = await import('../../multi-instance.js')
    return ensureRobloxMutex()
  }

  getCookiePath(): string {
    const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local')
    return path.join(local, 'Roblox', 'LocalStorage', 'RobloxCookies.dat')
  }

  getClientSettingsPath(exePath: string): string | null {
    // RobloxPlayerBeta.exe is in: version-hash\RobloxPlayerBeta.exe
    // ClientSettings is in: version-hash\ClientSettings\ClientAppSettings.json
    try {
      const versionDir = path.dirname(exePath)
      const settingsPath = path.join(versionDir, 'ClientSettings', 'ClientAppSettings.json')
      if (fs.existsSync(path.dirname(settingsPath))) return settingsPath
    } catch {}
    return null
  }
}

// Export singleton instance
export const launcher = new WindowsLauncher()
export default launcher
