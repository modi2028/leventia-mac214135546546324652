import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { RobloxAccount, AppSettings, LicenseData, KeyRecord, UpdatePost } from '../../src/types/index.js'

const STORAGE_SECRET = 'rdash-storage-v1-Xk9#mP$qN!vL@wZ*rY%tU'

interface StoreData {
  accounts:      RobloxAccount[]
  settings:      AppSettings
  licenseBlob:   string | null   // AES-256-GCM encrypted LicenseData
  keyDatabase:   KeyRecord[]     // issued basic keys (managed by staff)
  updates:       UpdatePost[]    // changelog / announcements posted by staff
}

const DEFAULT_SETTINGS: AppSettings = {
  autoRefreshEnabled: false,
  autoRefreshInterval: 60,
  accentColor: '#7c3aed',
  theme: 'dark',
  uiTheme: 'default',
  uiDesign: 'classic',
  antiAfkEnabled: false,
  antiAfkInterval: 5,
  antiAfkAction: 'jump',
  antiAfkAccountIds: [],
  antiAfkMinimize: false,
  antiAfkMute: false,
  lowGpuEnabled: false,
  fpsCap: 0,
  disableTextures: false,
  minimalLighting: false,
  skipSplash: false,
  muteMusic: false,
  healthSweepEnabled: false,
  healthSweepInterval: 30,
  customTags: [],
  bgType: 'default',
  bgColor: '#07070e',
  bgMedia: '',
  webhookEnabled: false,
  webhookUrl: '',
  webhookEvents: { deploy: true, remove: true, serverFull: true, cookieExpired: true },
  autoRejoinEnabled: false,
  autoAltSchedule: { enabled: false, disconnectOnEnd: false, windows: [] },
  autoJail: false,
  jailDelaySec: 3,
  jailBackoffSec: 10,
  autoTrim: false,
  pixelReduceEnabled: false,
  pixelReduceSize: 100,
  ramLimitEnabled: false,
  ramLimitMb: 400,
  autoAlt: {
    serverKey: '',
    serverCode: '',
    deployBelow: 32,
    deployCount: 4,
    removeAt: 39,
    removeCount: 2,
    interval: 30,
    launchDelay: 5,
    accountIds: [],
  },
}

let storePath: string
let encKey: Buffer
let data: StoreData = {
  accounts:    [],
  settings:    { ...DEFAULT_SETTINGS },
  licenseBlob: null,
  keyDatabase: [],
  updates:     [],
}

// ── Encryption ────────────────────────────────────────────────────────────────

function deriveKey(appDataPath: string): Buffer {
  return crypto.createHash('sha256').update(STORAGE_SECRET + ':' + appDataPath).digest()
}

function encryptLicense(license: LicenseData): string {
  const iv  = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv)
  const ct  = Buffer.concat([cipher.update(JSON.stringify(license), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct]).toString('base64')
}

function decryptLicense(blob: string): LicenseData | null {
  try {
    const buf = Buffer.from(blob, 'base64')
    if (buf.length < 28) return null
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, buf.subarray(0, 12))
    decipher.setAuthTag(buf.subarray(12, 28))
    return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8')) as LicenseData
  } catch { return null }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export function initStore(): void {
  const userDataPath = app.getPath('userData')
  storePath = path.join(userDataPath, 'dashboard-data.json')
  encKey    = deriveKey(userDataPath)

  if (fs.existsSync(storePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf-8')) as Partial<StoreData>
      data = {
        accounts:    parsed.accounts    ?? [],
        settings:    { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
        licenseBlob: parsed.licenseBlob ?? null,
        keyDatabase: parsed.keyDatabase ?? [],
        updates:     parsed.updates     ?? [],
      }
    } catch {
      data = { accounts: [], settings: { ...DEFAULT_SETTINGS }, licenseBlob: null, keyDatabase: [], updates: [] }
    }
  }
}

function persist(): void {
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8')
}

// ── Accounts ──────────────────────────────────────────────────────────────────
export const getAccounts    = ()                               => data.accounts
export const addAccount     = (a: RobloxAccount)              => { data.accounts.push(a); persist() }
export const removeAccounts = (ids: string[])                  => { data.accounts = data.accounts.filter(a => !ids.includes(a.id)); persist() }
export const updateAccount  = (id: string, u: Partial<RobloxAccount>) => {
  const i = data.accounts.findIndex(a => a.id === id)
  if (i !== -1) { data.accounts[i] = { ...data.accounts[i], ...u }; persist() }
}
export const clearAccounts  = ()                               => { data.accounts = []; persist() }
export const setAccounts    = (accounts: RobloxAccount[])      => { data.accounts = accounts; persist() }

// ── Settings ──────────────────────────────────────────────────────────────────
export const getSettings  = ()                  => data.settings
export const saveSettings = (s: AppSettings)    => { data.settings = s; persist() }

// ── License (encrypted) ───────────────────────────────────────────────────────
export const getLicense   = (): LicenseData | null => data.licenseBlob ? decryptLicense(data.licenseBlob) : null
export const saveLicense  = (l: LicenseData)       => { data.licenseBlob = encryptLicense(l); persist() }
export const clearLicense = ()                     => { data.licenseBlob = null; persist() }

// ── Key database (staff issues / revokes basic keys) ──────────────────────────
export const getKeyDatabase = (): KeyRecord[]                 => data.keyDatabase
export const addKeyRecord   = (r: KeyRecord)                  => { data.keyDatabase.push(r); persist() }
export const revokeKey      = (key: string): boolean          => {
  const r = data.keyDatabase.find(k => k.key === key.toUpperCase())
  if (!r || r.revoked) return false
  r.revoked   = true
  r.revokedAt = new Date().toISOString()
  persist()
  return true
}

// ── Updates feed (staff posts, everyone reads) ────────────────────────────────
export const getUpdates   = (): UpdatePost[]      => data.updates
export const addUpdate    = (u: UpdatePost)        => { data.updates.unshift(u); persist() }
export const deleteUpdate = (id: string): boolean  => {
  const before = data.updates.length
  data.updates = data.updates.filter(u => u.id !== id)
  if (data.updates.length === before) return false
  persist()
  return true
}
