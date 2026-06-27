import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
import os from 'node:os'

// Stable per-machine hardware ID.
// Primary source: Windows MachineGuid (unique per OS install, survives reboots).
// Fallback: hostname + CPU model + total RAM. Hashed so the raw GUID is never exposed.

let cached: string | null = null

export function getHwid(): string {
  if (cached) return cached

  let raw = ''

  // macOS: Use IOPlatformUUID from IORegistry
  if (process.platform === 'darwin') {
    try {
      const out = execSync('ioreg -rd1 -c IOPlatformExpertDevice', { encoding: 'utf8' })
      const m = out.match(/"IOPlatformUUID" = "([^"]+)"/)
      if (m) raw = m[1]
    } catch { /* ioreg unavailable */ }
  }
  // Windows: Use MachineGuid from registry
  else {
    try {
      const out = execSync(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
        { encoding: 'utf8', windowsHide: true }
      )
      const m = out.match(/MachineGuid\s+REG_SZ\s+([\w-]+)/i)
      if (m) raw = m[1]
    } catch { /* registry unavailable */ }
  }

  if (!raw) {
    raw = [os.hostname(), os.cpus()[0]?.model ?? '', os.totalmem(), os.platform()].join('|')
  }

  cached = crypto.createHash('sha256').update('lvnt-hwid-v1:' + raw).digest('hex').slice(0, 32).toUpperCase()
  return cached
}
