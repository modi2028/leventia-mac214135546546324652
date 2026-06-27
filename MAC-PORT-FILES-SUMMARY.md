# macOS Port - Complete File Reference

## All Files Created/Modified

Use this reference to recreate files if needed when copying to Mac.

---

## New Files (Create on Mac)

### electron/platform/types.ts
```typescript
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
```

### electron/platform/index.ts (FIXED VERSION)
```typescript
// Platform abstraction layer - exports appropriate implementation for current platform
import launcher from './win32/index.js'
import darwinLauncher from './darwin/index.js'

// Select launcher based on platform
const selectedLauncher = process.platform === 'darwin' ? darwinLauncher : launcher

export default selectedLauncher
export type { RobloxLauncher, PlatformLauncher } from './types.js'
```

### electron/platform/darwin/index.ts (FULL FILE)
```typescript
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
  ]

  for (const appPath of candidates) {
    if (fs.existsSync(appPath)) {
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
      const proc = spawn('open', ['-n', player.path, '--args', ...args], {
        detached: true,
        stdio: 'ignore'
      })

      return { pid: proc.pid }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }

  killProcess(pid: number): boolean {
    try {
      spawn('kill', ['-9', String(pid)], { stdio: 'ignore' })
      return true
    } catch { return false }
  }

  killAllRoblox(): boolean {
    try {
      spawn('pkill', ['-9', '-f', 'Roblox'], { stdio: 'ignore' })
      return true
    } catch { return false }
  }

  async ensureMultiInstance(): Promise<boolean> {
    return true // macOS doesn't need mutex handling
  }

  getCookiePath(): string {
    const supportPath = path.join(os.homedir(), 'Library', 'Application Support', 'Roblox')
    return path.join(supportPath, 'LocalStorage', 'RobloxCookies.dat')
  }

  getClientSettingsPath(exePath: string): string | null {
    try {
      const supportPath = path.join(os.homedir(), 'Library', 'Application Support', 'Roblox')
      const settingsPath = path.join(supportPath, 'ClientSettings', 'ClientAppSettings.json')
      if (fs.existsSync(path.dirname(settingsPath))) return settingsPath
    } catch {}
    return null
  }

  getRunningPids(): number[] {
    try {
      const out = execFileSync('pgrep', ['-f', 'Roblox'], { encoding: 'utf8' })
      return out.split('\n').filter(Boolean).map(Number).filter(n => !isNaN(n))
    } catch {
      return []
    }
  }
}

export const launcher = new DarwinLauncher()
export default launcher
```

---

## Modified Files (Key Changes)

### electron/hwid.ts
```typescript
// Add at line ~14:
if (process.platform === 'darwin') {
  try {
    const out = execSync('ioreg -rd1 -c IOPlatformExpertDevice', { encoding: 'utf8' })
    const m = out.match(/"IOPlatformUUID" = "([^"]+)"/)
    if (m) raw = m[1]
  } catch { /* ioreg unavailable */ }
} else {
  // ... existing Windows code
}
```

### electron/main.ts
```typescript
// Add after imports:
const ICON_EXT = process.platform === 'darwin' ? 'icns' : 'ico'

// In createWindow(), change:
icon: path.join(VITE_PUBLIC, `icon.${ICON_EXT}`)
```

### electron/multi-instance.ts
```typescript
// Add at top:
const IS_MAC = process.platform === 'darwin'

// In closeRobloxSingleton, add:
if (IS_MAC) return true

// In holdRobloxMutex, add:
if (IS_MAC) { console.log('[multi] macOS - mutex not needed'); return }

// In lockRobloxCookies, add:
if (IS_MAC) return
```

### electron/anti-afk.ts
```typescript
// Replace leaveAll() function:
const isMac = process.platform === 'darwin'
const tk = spawn(
  isMac ? 'pkill' : 'taskkill',
  isMac ? ['-9', '-f', 'Roblox'] : ['/F', '/IM', 'RobloxPlayerBeta.exe'],
  { stdio: ['ignore', 'pipe', 'pipe'] }
)
```

### electron/low-gpu.ts
```typescript
// Replace line ~133:
const local = process.platform === 'darwin'
  ? path.join(os.homedir(), 'Library', 'Application Support', 'Roblox')
  : (process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'))
```

### package.json
```json
"mac": {
  "target": ["dmg", "zip"],
  "icon": "public/icon.icns",
  "category": "public.app-category.games",
  "hardenedRuntime": true,
  "gatekeeperAssess": false
},
"dmg": {
  "contents": [
    { "x": 130, "y": 220 },
    { "x": 410, "y": 220, "type": "link", "path": "/Applications" }
  ]
}
```

---

## Quick Copy Command (On Windows)

```bash
# Create a clean copy without node_modules
robocopy C:\Users\birk\roblox-account-dashboard C:\Users\birk\Desktop\Leventia-Mac /E /XD node_modules dist dist-electron release .git
```

Then copy `Leventia-Mac` folder to your Mac.

---

## On Mac: Build Instructions

```bash
cd ~/path/to/Leventia-Mac
npm install
npm run make-icon  # Generate .icns
npm run build      # Build renderer
npm run dist       # Build .app

# Output: release/Leventia Alting.app
```
