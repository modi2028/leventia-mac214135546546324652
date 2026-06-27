import { ipcMain, dialog, app } from 'electron'
import fs from 'node:fs'
import {
  getAccounts, addAccount, removeAccounts, updateAccount, clearAccounts, setAccounts,
  getSettings, saveSettings,
  getLicense, saveLicense, clearLicense,
  getKeyDatabase, addKeyRecord, revokeKey,
  getUpdates, addUpdate, deleteUpdate,
} from '../store/index.js'
import { validateKey, generateLocalKey } from '../key-validator.js'
import {
  supabaseEnabled, supabaseActivate, supabaseLookupUser,
  supabaseResetHwid, supabaseRevoke, supabaseEnable, supabaseSetRole, supabaseExtend,
  supabaseIssueKey, supabaseListKeys,
  supabaseGetUpdates, supabasePostUpdate, supabaseDeleteUpdate,
  supabaseLeaderboard,
  supabaseAppStatus, supabaseSetKill,
  supabaseLatestVersion, supabaseSetVersion,
  supabaseGetAnnouncement, supabaseSetAnnouncement,
} from '../supabase.js'
import { getHwid } from '../hwid.js'
import { startHeartbeat, stopHeartbeat } from '../heartbeat.js'
import type { RobloxAccount, AppSettings, KeyRecord, UpdatePost, UpdateCategory, IssueKeyPayload } from '../../src/types/index.js'
import crypto from 'node:crypto'

export function registerStoreHandlers(): void {
  // ── Accounts ────────────────────────────────────────────────────────────────
  ipcMain.handle('store:get-accounts',    ()                            => getAccounts())
  ipcMain.handle('store:add-account',     (_e, a: RobloxAccount)        => addAccount(a))
  ipcMain.handle('store:remove-accounts', (_e, ids: string[])           => removeAccounts(ids))
  ipcMain.handle('store:update-account',  (_e, id, u)                  => updateAccount(id, u))
  ipcMain.handle('store:clear-accounts',  ()                            => clearAccounts())

  // ── Settings ─────────────────────────────────────────────────────────────────
  ipcMain.handle('store:get-settings',    ()                            => getSettings())
  ipcMain.handle('store:save-settings',   (_e, s: AppSettings)          => saveSettings(s))

  // ── Owner kill-switch ────────────────────────────────────────────────────────
  ipcMain.handle('app:status',   async () => supabaseEnabled() ? supabaseAppStatus() : { killed: false })
  ipcMain.handle('app:set-kill', (_e, ownerSecret: string, killed: boolean) => supabaseSetKill(ownerSecret, killed))

  // ── In-app updates (version notice + download link) ───────────────────────────
  ipcMain.handle('app:version',        () => app.getVersion())
  ipcMain.handle('app:latest-version', async () => supabaseEnabled() ? supabaseLatestVersion() : {})
  ipcMain.handle('app:set-version',    (_e, ownerSecret: string, version: string, url: string) => supabaseSetVersion(ownerSecret, version, url))

  // ── Owner announcement (broadcast banner) ─────────────────────────────────────
  ipcMain.handle('app:announcement',     async () => supabaseEnabled() ? supabaseGetAnnouncement() : {})
  ipcMain.handle('app:set-announcement', (_e, ownerSecret: string, text: string, level: string) => supabaseSetAnnouncement(ownerSecret, text, level))

  // ── Backup: export / import accounts + settings ──────────────────────────────
  ipcMain.handle('store:export-backup', async () => {
    const res = await dialog.showSaveDialog({
      title: 'Export Leventia Backup',
      defaultPath: `leventia-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'Leventia Backup', extensions: ['json'] }],
    })
    if (res.canceled || !res.filePath) return { success: false, canceled: true }
    try {
      const payload = { app: 'leventia', version: 1, exportedAt: new Date().toISOString(), accounts: getAccounts(), settings: getSettings() }
      fs.writeFileSync(res.filePath, JSON.stringify(payload, null, 2), 'utf-8')
      return { success: true, path: res.filePath, accounts: getAccounts().length }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('store:import-backup', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Import Leventia Backup',
      filters: [{ name: 'Leventia Backup', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (res.canceled || !res.filePaths[0]) return { success: false, canceled: true }
    try {
      const parsed = JSON.parse(fs.readFileSync(res.filePaths[0], 'utf-8'))
      if (parsed?.app !== 'leventia' || !Array.isArray(parsed.accounts)) {
        return { success: false, error: 'Not a valid Leventia backup file.' }
      }
      setAccounts(parsed.accounts)
      if (parsed.settings && typeof parsed.settings === 'object') {
        saveSettings({ ...getSettings(), ...parsed.settings })
      }
      return { success: true, accounts: getAccounts(), settings: getSettings() }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Could not read backup file.' }
    }
  })

  // ── License / key activation ─────────────────────────────────────────────────
  ipcMain.handle('store:get-license', () => getLicense())

  // Re-validate the stored license against the server on launch. This:
  //   • re-binds the current HWID if staff reset it (DB hwid was null)
  //   • enforces revocation / expiry / HWID transfers every time the app opens
  // Falls back to the locally stored license when Supabase isn't configured.
  ipcMain.handle('store:revalidate-license', async () => {
    const lic = getLicense()
    if (!lic) return null

    if (supabaseEnabled()) {
      const result = await supabaseActivate(lic.key)   // rpc_activate re-binds HWID when null
      // Server unreachable (network/5xx) → keep the stored license, just enforce
      // local expiry. A transient blip or Supabase downtime must NOT lock out a
      // paying user; only a definitive server rejection (below) clears the key.
      if (result.reachable === false) {
        if (new Date(lic.expiresAt) < new Date()) { stopHeartbeat(); clearLicense(); return null }
        return lic
      }
      if (!result.valid) { stopHeartbeat(); clearLicense(); return null }
      const updated = {
        key: lic.key, type: result.type, role: result.role ?? lic.role,
        discordUsername: result.discordUsername ?? lic.discordUsername,
        hwid: getHwid(), expiresAt: result.expiresAt.toISOString(), validatedAt: new Date().toISOString(),
      }
      saveLicense(updated)
      if (result.type !== 'staff') startHeartbeat(lic.key)
      return updated
    }

    // Local-only: just enforce expiry
    if (new Date(lic.expiresAt) < new Date()) { clearLicense(); return null }
    return lic
  })

  ipcMain.handle('store:save-license', async (_e, key: string) => {
    const normKey = key.trim().toUpperCase()

    // When Supabase is configured it is the ONLY authority — staff AND basic keys
    // are validated entirely server-side (secrets live only in the DB), so no
    // signing secret in this app can be used to forge access.
    if (supabaseEnabled()) {
      const result = await supabaseActivate(normKey)
      if (!result.valid) throw new Error(result.error)
      const license = {
        key: normKey, type: result.type, role: result.role ?? 'standard',
        discordUsername: result.discordUsername,
        hwid: getHwid(), expiresAt: result.expiresAt.toISOString(), validatedAt: new Date().toISOString(),
      }
      saveLicense(license)
      if (result.type !== 'staff') startHeartbeat(normKey)
      return license
    }

    // Local-only fallback (no Supabase configured) — HMAC + local key database.
    const local = await validateKey(normKey, getKeyDatabase())
    if (!local.valid) throw new Error(local.error)
    const license = {
      key: normKey, type: local.type, role: local.type === 'staff' ? 'staff' : 'standard',
      hwid: getHwid(), expiresAt: local.expiresAt.toISOString(), validatedAt: new Date().toISOString(),
    }
    saveLicense(license)
    return license
  })

  ipcMain.handle('store:clear-license', () => { stopHeartbeat(); clearLicense(); return true })

  ipcMain.handle('store:get-hwid', () => getHwid())

  ipcMain.handle('store:validate-key', async (_e, key: string) => {
    return validateKey(key, getKeyDatabase())
  })

  // ── Staff: key management ────────────────────────────────────────────────────
  // All staff handlers verify the caller holds a staff license before executing.

  // Returns the current staff license key (for authorizing server-side staff RPCs)
  function staffKey(): string {
    const lic = getLicense()
    if (lic?.type !== 'staff') throw new Error('Staff access required.')
    return lic.key
  }
  function assertStaff(): void { staffKey() }

  ipcMain.handle('store:issue-key', async (_e, payload: IssueKeyPayload): Promise<KeyRecord> => {
    const sk = staffKey()
    const months = payload.months
    const role   = payload.role || 'standard'

    if (supabaseEnabled()) {
      // Key is generated + signed entirely server-side; the secret never leaves the DB.
      const record = await supabaseIssueKey(sk, months, role, payload.discordId, payload.discordUsername)
      if (!record) throw new Error('Failed to issue key on the server.')
      return record
    }

    // Local-only fallback (no Supabase) — non-authoritative key stored locally.
    const key = generateLocalKey(months)
    const expiry = new Date(); expiry.setMonth(expiry.getMonth() + months)
    const record: KeyRecord = {
      key, type: 'basic', issuedAt: new Date().toISOString(), expiresAt: expiry.toISOString(),
      months, revoked: false, discordUsername: payload.discordUsername, discordId: payload.discordId, role,
    }
    addKeyRecord(record)
    return record
  })

  ipcMain.handle('store:get-keys', async (): Promise<KeyRecord[]> => {
    const sk = staffKey()
    if (supabaseEnabled()) return supabaseListKeys(sk)
    return getKeyDatabase()
  })

  ipcMain.handle('store:revoke-key', async (_e, key: string) => {
    const sk = staffKey()
    if (supabaseEnabled()) {
      if (!(await supabaseRevoke(sk, key))) throw new Error('Failed to revoke key.')
      return { success: true }
    }
    const ok = revokeKey(key)
    if (!ok) throw new Error('Key not found or already revoked.')
    return { success: true }
  })

  // ── Updates feed ─────────────────────────────────────────────────────────────
  // Reading is open to everyone; posting/deleting requires a staff license.

  ipcMain.handle('store:get-updates', async () => {
    // Shared via the DB so every user sees announcements regardless of version/device
    if (supabaseEnabled()) return supabaseGetUpdates()
    return getUpdates()
  })

  ipcMain.handle('store:post-update', async (_e, payload: { title: string; body: string; version?: string; category: UpdateCategory }) => {
    const sk = staffKey()
    const title = (payload.title ?? '').trim()
    const body  = (payload.body ?? '').trim()
    if (!title) throw new Error('Title is required.')
    if (!body)  throw new Error('Body is required.')
    const data = { title, body, version: payload.version?.trim() || undefined, category: payload.category ?? 'announcement' as UpdateCategory }

    if (supabaseEnabled()) {
      const post = await supabasePostUpdate(sk, data)
      if (!post) throw new Error('Failed to post update to the server.')
      return post
    }

    const post: UpdatePost = {
      id: crypto.randomBytes(8).toString('hex'),
      author: 'Leventia Staff', postedAt: new Date().toISOString(), ...data,
    }
    addUpdate(post)
    return post
  })

  ipcMain.handle('store:delete-update', async (_e, id: string) => {
    const sk = staffKey()
    if (supabaseEnabled()) {
      if (!(await supabaseDeleteUpdate(sk, id))) throw new Error('Failed to delete update.')
      return { success: true }
    }
    const ok = deleteUpdate(id)
    if (!ok) throw new Error('Update not found.')
    return { success: true }
  })

  // ── Staff: Supabase User Lookup + license management ─────────────────────────

  ipcMain.handle('store:supabase-enabled', () => supabaseEnabled())

  // Public leaderboard (no staff key needed)
  ipcMain.handle('store:leaderboard', (_e, metric: 'launches' | 'hours' | 'streak' | 'maxsession') => {
    if (!supabaseEnabled()) return []
    return supabaseLeaderboard(metric)
  })

  ipcMain.handle('store:lookup-user', async (_e, query: string) => {
    const sk = staffKey()
    if (!supabaseEnabled()) throw new Error('Supabase is not configured. Add credentials in supabase-config.ts.')
    return supabaseLookupUser(sk, query)
  })

  ipcMain.handle('store:reset-hwid', async (_e, key: string) => {
    const sk = staffKey()
    if (!(await supabaseResetHwid(sk, key))) throw new Error('Failed to reset HWID.')
    return { success: true }
  })

  ipcMain.handle('store:extend-license', async (_e, key: string, days: number) => {
    const sk = staffKey()
    if (!(await supabaseExtend(sk, key, days))) throw new Error('Failed to extend license.')
    return { success: true }
  })

  ipcMain.handle('store:revoke-license', async (_e, key: string) => {
    const sk = staffKey()
    if (!(await supabaseRevoke(sk, key))) throw new Error('Failed to revoke license.')
    return { success: true }
  })

  ipcMain.handle('store:enable-license', async (_e, key: string) => {
    const sk = staffKey()
    if (!(await supabaseEnable(sk, key))) throw new Error('Failed to enable license.')
    return { success: true }
  })

  ipcMain.handle('store:set-role', async (_e, key: string, role: string) => {
    const sk = staffKey()
    if (!(await supabaseSetRole(sk, key, role))) throw new Error('Failed to set role.')
    return { success: true }
  })
}
