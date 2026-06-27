import React, { useState, useEffect } from 'react'
import type { AppSettings, WebhookEvents } from '../types'

interface Props { onAccountsCleared: () => void; onLogout: () => void }

const WEBHOOK_EVENTS: Array<{ key: keyof WebhookEvents; label: string; desc: string }> = [
  { key: 'deploy',        label: 'Alts deployed',   desc: 'When alts launch into a server' },
  { key: 'remove',        label: 'Alts removed',    desc: 'When alts are pulled to free slots' },
  { key: 'serverFull',    label: 'Server busy',     desc: 'When real players hit the threshold' },
  { key: 'cookieExpired', label: 'Expired cookies', desc: 'When a health sweep finds dead cookies' },
]

// ── Reusable bits ─────────────────────────────────────────────────────────────

function Section({ title, icon, danger, full, children }: { title: string; icon: React.ReactNode; danger?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 16, gridColumn: full ? '1 / -1' : undefined, border: danger ? '1px solid rgba(248,113,113,0.18)' : undefined }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 9, fontWeight: 700, color: danger ? '#f87171' : 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 14 }}>
        <span style={{ color: danger ? '#f87171' : '#a78bfa', display: 'flex' }}>{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  )
}

function Row({ title, desc, children, divider }: { title: string; desc: string; children: React.ReactNode; divider?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      paddingTop: divider ? 14 : 0, marginTop: divider ? 14 : 0, borderTop: divider ? '1px solid rgba(255,255,255,0.05)' : undefined }}>
      <div>
        <p style={{ fontSize: 12, color: '#e0d7ff', fontWeight: 500, margin: 0 }}>{title}</p>
        <p style={{ fontSize: 10, color: 'oklch(0.78 0.035 283)', marginTop: 3 }}>{desc}</p>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: 36, height: 20, padding: 0, boxSizing: 'border-box', borderRadius: 99, position: 'relative', border: 'none', cursor: 'pointer',
      transition: 'background 0.2s, box-shadow 0.2s',
      background: on ? 'var(--grad-btn)' : 'rgba(255,255,255,0.08)',
      boxShadow: on ? '0 2px 8px rgba(124,58,237,0.4)' : 'none',
    }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
    </button>
  )
}

function PillButton({ label, onClick, tone = 'neutral' }: { label: string; onClick: () => void; tone?: 'neutral' | 'danger' | 'good' }) {
  const c = tone === 'danger' ? { color: '#f87171', border: 'rgba(248,113,113,0.3)' }
          : tone === 'good'   ? { color: '#4ade80', border: 'rgba(34,197,94,0.3)' }
          :                     { color: 'oklch(0.86 0.03 285)', border: 'rgba(255,255,255,0.15)' }
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
      background: tone === 'good' ? 'rgba(34,197,94,0.1)' : 'transparent',
      border: `1px solid ${c.border}`, color: c.color,
    }}
      onMouseEnter={e => { if (tone === 'neutral') { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#fff' } }}
      onMouseLeave={e => { if (tone === 'neutral') { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'oklch(0.86 0.03 285)' } }}
    >{label}</button>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const ic = { width: 13, height: 13 }
const IconGeneral = <svg style={ic} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
const IconPerf = <svg style={ic} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
const IconAccount = <svg style={ic} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
const IconDanger = <svg style={ic} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
const IconBackup = <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
const IconBell = <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
const IconLoop = <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>

// ── Page ──────────────────────────────────────────────────────────────────────

export function SettingsPage({ onAccountsCleared, onLogout }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [gfxRestored, setGfxRestored] = useState(false)
  const [backup, setBackup] = useState<{ msg: string; ok: boolean } | null>(null)
  const [webhookTest, setWebhookTest] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    window.electron.store.getSettings().then(s => {
      setSettings(s)
      document.documentElement.style.setProperty('--accent', s.accentColor)
    }).catch(() => {})
  }, [])

  const save = async (next: AppSettings) => {
    setSettings(next)
    try { await window.electron.store.saveSettings(next); setSaved(true); setTimeout(() => setSaved(false), 1500) } catch {}
  }

  // ── Backup ────────────────────────────────────────────────────────────────────
  const doExport = async () => {
    const r = await window.electron.store.exportBackup()
    if (r.canceled) return
    setBackup(r.success ? { msg: `Exported ${r.accounts ?? 0} account${r.accounts === 1 ? '' : 's'}`, ok: true } : { msg: r.error ?? 'Export failed', ok: false })
    setTimeout(() => setBackup(null), 4000)
  }
  const doImport = async () => {
    const r = await window.electron.store.importBackup()
    if (r.canceled) return
    if (r.success) {
      if (r.settings) { setSettings(r.settings); window.dispatchEvent(new Event('lvnt:bg-changed')) }
      setBackup({ msg: `Imported ${r.accounts?.length ?? 0} accounts — open the Accounts page to see them`, ok: true })
    } else {
      setBackup({ msg: r.error ?? 'Import failed', ok: false })
    }
    setTimeout(() => setBackup(null), 5000)
  }

  const doTestWebhook = async () => {
    if (!settings) return
    setWebhookTest({ msg: 'Sending…', ok: true })
    const r = await window.electron.webhook.test(settings.webhookUrl).catch(() => ({ ok: false, error: 'Failed to send.' }))
    setWebhookTest(r.ok ? { msg: '✓ Test sent — check your Discord channel', ok: true } : { msg: r.error ?? 'Failed', ok: false })
    setTimeout(() => setWebhookTest(null), 4000)
  }

  const handleClear = async () => {
    if (!confirmClear) { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); return }
    await window.electron.store.clearAccounts().catch(() => {})
    onAccountsCleared(); setCleared(true); setTimeout(() => setCleared(false), 2000); setConfirmClear(false)
  }

  if (!settings) return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 20, height: 20, border: '2px solid rgba(124,58,237,0.4)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spinSlow 0.7s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>Settings</h1>
            <p style={{ fontSize: 11, color: 'oklch(0.82 0.035 284)', marginTop: 4 }}>Configure your preferences</p>
          </div>
          {saved && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#4ade80' }} className="animate-fade-in">
              <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              Saved
            </div>
          )}
        </div>

        {/* Two-per-row grid; tall/footer sections span full width */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, alignItems: 'start' }}>

        {/* General */}
        <Section title="General" icon={IconGeneral}>
          <Row title="Auto Refresh" desc="Periodically re-fetch account presence">
            <Toggle on={settings.autoRefreshEnabled} onClick={() => save({ ...settings, autoRefreshEnabled: !settings.autoRefreshEnabled })} />
          </Row>
          {settings.autoRefreshEnabled && (
            <div style={{ paddingTop: 14, marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 10, color: 'oklch(0.78 0.035 283)' }}>Refresh interval</label>
                <span style={{ fontSize: 11, color: '#c4b5fd', fontFamily: '"JetBrains Mono", monospace', fontWeight: 600 }}>{settings.autoRefreshInterval}s</span>
              </div>
              <input type="range" min={30} max={300} step={30} value={settings.autoRefreshInterval}
                onChange={e => save({ ...settings, autoRefreshInterval: Number(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }} />
            </div>
          )}
        </Section>

        {/* Performance */}
        <Section title="Performance" icon={IconPerf}>
          <Row title="Restore Graphics" desc="Reset Roblox graphics if Low GPU got stuck after a crash">
            <PillButton
              tone={gfxRestored ? 'good' : 'neutral'}
              label={gfxRestored ? '✓ Restored' : 'Restore'}
              onClick={async () => { await window.electron.lowGpu.restore(); setGfxRestored(true); setTimeout(() => setGfxRestored(false), 2000) }}
            />
          </Row>
        </Section>

        {/* Account */}
        <Section title="Account" icon={IconAccount}>
          <Row title="Log Out" desc="Deactivate your license on this device and return to the key screen">
            <PillButton label="Log Out" onClick={async () => { await window.electron.store.clearLicense().catch(() => {}); onLogout() }} />
          </Row>
        </Section>

        {/* Backup */}
        <Section title="Backup" icon={IconBackup}>
          <Row title="Export Backup" desc="Save your accounts + settings to a .json file">
            <PillButton label="Export" onClick={doExport} />
          </Row>
          <Row title="Import Backup" desc="Restore accounts + settings from a backup file" divider>
            <PillButton label="Import" onClick={doImport} />
          </Row>
          {backup && (
            <p className="animate-fade-in" style={{ fontSize: 10.5, marginTop: 12, color: backup.ok ? '#4ade80' : '#f87171', fontWeight: 500 }}>{backup.msg}</p>
          )}
        </Section>

        {/* Notifications (full width — expands with webhook config) */}
        <Section title="Notifications" icon={IconBell} full>
          <Row title="Discord Webhook" desc="Post alerts to a Discord channel (deploys, removals, server busy, expired cookies)">
            <Toggle on={settings.webhookEnabled} onClick={() => save({ ...settings, webhookEnabled: !settings.webhookEnabled })} />
          </Row>
          {settings.webhookEnabled && (
            <div style={{ paddingTop: 14, marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <label style={{ fontSize: 10, color: 'oklch(0.78 0.035 283)', display: 'block', marginBottom: 6 }}>Webhook URL</label>
              <input
                className="input-base"
                type="text"
                placeholder="https://discord.com/api/webhooks/…"
                value={settings.webhookUrl}
                onChange={e => save({ ...settings, webhookUrl: e.target.value })}
                style={{ width: '100%', fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <PillButton label="Send test" onClick={doTestWebhook} />
                {webhookTest && (
                  <span className="animate-fade-in" style={{ fontSize: 10.5, fontWeight: 500, color: webhookTest.ok ? '#4ade80' : '#f87171' }}>{webhookTest.msg}</span>
                )}
              </div>

              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'grid', gap: 12 }}>
                {WEBHOOK_EVENTS.map(ev => {
                  const on = settings.webhookEvents?.[ev.key] !== false
                  return (
                    <Row key={ev.key} title={ev.label} desc={ev.desc}>
                      <Toggle on={on} onClick={() => save({ ...settings, webhookEvents: { ...settings.webhookEvents, [ev.key]: !on } })} />
                    </Row>
                  )
                })}
              </div>
            </div>
          )}
        </Section>

        {/* Danger zone (full width footer) */}
        <Section title="Danger Zone" icon={IconDanger} danger full>
          <Row title="Clear All Accounts" desc={confirmClear ? 'Click again to confirm — cannot be undone.' : 'Remove all tracked accounts.'}>
            <PillButton
              tone={cleared ? 'good' : 'danger'}
              label={cleared ? '✓ Cleared' : confirmClear ? 'Confirm' : 'Clear All'}
              onClick={handleClear}
            />
          </Row>
        </Section>

        </div>
      </div>
    </div>
  )
}
