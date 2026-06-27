import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { AppSettings, AutoAltConfig, AutoAltStatus, RobloxAccount, AutoAltSchedule, AutoAltScheduleStatus, AutoJailStatus } from '../types'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const EMPTY_SCHEDULE: AutoAltSchedule = { enabled: false, disconnectOnEnd: false, windows: [] }

interface Props {
  settings: AppSettings
  onSave: (next: AppSettings) => void
  accounts?: RobloxAccount[]
  embedded?: boolean   // when rendered as its own tab, drop the top margin
}

function NumberField({ label, hint, value, onChange, min = 0, max = 100 }: {
  label: string; hint: string; value: number; onChange: (v: number) => void; min?: number; max?: number
}) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#e0d7ff', display: 'block' }}>{label}</label>
      <p style={{ fontSize: 10, color: 'oklch(0.7 0.035 281)', margin: '2px 0 6px' }}>{hint}</p>
      <input
        type="number" min={min} max={max} value={value}
        onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        className="input-base" style={{ width: '100%' }}
      />
    </div>
  )
}

export function AutoAltingSection({ settings, onSave, accounts = [], embedded }: Props) {
  const [cfg, setCfg]       = useState<AutoAltConfig>(settings.autoAlt)
  const [status, setStatus] = useState<AutoAltStatus | null>(null)
  const [schedStatus, setSchedStatus] = useState<AutoAltScheduleStatus | null>(null)
  const [jailStatus, setJailStatus] = useState<AutoJailStatus | null>(null)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [busy, setBusy]     = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const schedule: AutoAltSchedule = settings.autoAltSchedule ?? EMPTY_SCHEDULE

  useEffect(() => {
    const poll = () => {
      window.electron.autoAlt.status().then(setStatus).catch(() => {})
      window.electron.autoAlt.scheduleStatus().then(setSchedStatus).catch(() => {})
      window.electron.autoAlt.jailStatus().then(setJailStatus).catch(() => {})
    }
    poll()
    pollRef.current = setInterval(poll, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // Persist a schedule change and re-evaluate it immediately so toggles apply now.
  const saveSchedule = useCallback((next: AutoAltSchedule) => {
    onSave({ ...settings, autoAltSchedule: next })
    window.electron.autoAlt.scheduleRefresh().then(setSchedStatus).catch(() => {})
  }, [settings, onSave])

  const addWindow = () => saveSchedule({
    ...schedule,
    windows: [...schedule.windows, { id: Math.random().toString(36).slice(2, 9), start: '18:00', end: '23:00', days: [] }],
  })
  const updateWindow = (id: string, patch: Partial<AutoAltSchedule['windows'][number]>) =>
    saveSchedule({ ...schedule, windows: schedule.windows.map(w => w.id === id ? { ...w, ...patch } : w) })
  const removeWindow = (id: string) =>
    saveSchedule({ ...schedule, windows: schedule.windows.filter(w => w.id !== id) })
  const toggleDay = (id: string, day: number) => {
    const w = schedule.windows.find(x => x.id === id)
    if (!w) return
    const set = new Set(w.days)
    if (set.has(day)) set.delete(day); else set.add(day)
    updateWindow(id, { days: [...set].sort((a, b) => a - b) })
  }

  // Persist config to settings (debounced-ish: on change)
  const update = useCallback((patch: Partial<AutoAltConfig>) => {
    const next = { ...cfg, ...patch }
    setCfg(next)
    onSave({ ...settings, autoAlt: next })
  }, [cfg, settings, onSave])

  const running = status?.running ?? false

  const handleToggle = async () => {
    if (running) { await window.electron.autoAlt.stop() }
    else {
      const res = await window.electron.autoAlt.start(cfg)
      if (!res.ok) { setTestMsg({ ok: false, text: res.error ?? 'Failed to start.' }); return }
    }
    window.electron.autoAlt.status().then(setStatus).catch(() => {})
  }

  const handleTest = async () => {
    setTesting(true); setTestMsg(null)
    try {
      const r = await window.electron.autoAlt.testKey(cfg.serverKey)
      if (r.ok) setTestMsg({ ok: true, text: `Connected: ${r.name ?? 'server'} — ${r.players}/${r.maxPlayers} players` })
      else setTestMsg({ ok: false, text: r.error ?? 'Failed.' })
    } finally { setTesting(false) }
  }

  const handleDeploy = async () => { setBusy('deploy'); try { await window.electron.autoAlt.deployNow(cfg) } finally { setBusy('') } }
  const handleRemove = async () => { setBusy('remove'); try { await window.electron.autoAlt.removeNow(cfg) } finally { setBusy('') } }

  return (
    <div style={{ marginTop: embedded ? 0 : 24 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            Auto Alting
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)', color: '#67e8f9', letterSpacing: '0.1em' }}>ERLC</span>
          </h2>
          <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3 }}>Auto-deploy alts based on live PRC player count</p>
        </div>
        <button onClick={handleToggle}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', transition: 'all 0.2s',
            background: running ? 'rgba(248,113,113,0.15)' : 'linear-gradient(135deg, oklch(0.74 0.18 150), oklch(0.65 0.20 150))',
            color: running ? '#f87171' : '#fff',
            boxShadow: running ? 'none' : '0 4px 16px -4px rgba(34,197,94,0.5)',
            ...(running ? { border: '1px solid rgba(248,113,113,0.3)' } : {}),
          }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: running ? '#f87171' : '#fff', animation: running ? 'glowPulse 1.5s ease-in-out infinite' : 'none' }} />
          {running ? 'Stop Automation' : 'Start Automation'}
        </button>
      </div>

      {/* Live status strip */}
      {running && status && (
        <div className="glass" style={{ padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 18 }}>
          <div className="glass-aurora" />
          {[
            { label: 'Players', value: `${status.players}/${status.maxPlayers}`, color: '#67e8f9' },
            { label: 'Our alts', value: String(status.ourAlts), color: '#c4b5fd' },
            { label: 'Available', value: String(status.available), color: '#4ade80' },
          ].map(s => (
            <div key={s.label}>
              <p style={{ fontSize: 8, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{s.label}</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: '"JetBrains Mono", monospace', lineHeight: 1.2 }}>{s.value}</p>
            </div>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', animation: 'glowPulse 1.5s ease-in-out infinite' }} />
            Active
          </span>
        </div>
      )}

      {/* Connection */}
      <div className="glass" style={{ padding: 16, marginBottom: 12 }}>
        <div className="glass-aurora" />
        <p style={{ fontSize: 9, fontWeight: 700, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 10 }}>Connection</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 10, color: 'oklch(0.74 0.035 282)', display: 'block', marginBottom: 4 }}>ERLC Server Key</label>
            <input className="input-base" style={{ width: '100%' }} type="password" placeholder="server-key" value={cfg.serverKey} onChange={e => update({ serverKey: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'oklch(0.74 0.035 282)', display: 'block', marginBottom: 4 }}>Server Code (join)</label>
            <input className="input-base" style={{ width: '100%' }} placeholder="e.g. ocrps" value={cfg.serverCode} onChange={e => update({ serverCode: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn-ghost" onClick={handleTest} disabled={testing || !cfg.serverKey.trim()}>
            {testing ? 'Testing…' : 'Test Key'}
          </button>
          {testMsg && <span style={{ fontSize: 11, color: testMsg.ok ? '#4ade80' : '#f87171' }}>{testMsg.text}</span>}
        </div>
      </div>

      {/* Configuration */}
      <div className="glass" style={{ padding: 16, marginBottom: 12 }}>
        <div className="glass-aurora" />
        <p style={{ fontSize: 9, fontWeight: 700, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12 }}>Configuration</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <NumberField label="Deploy Below" hint="Deploy when players drop below this" value={cfg.deployBelow} onChange={v => update({ deployBelow: v })} max={100} />
          <NumberField label="Deploy Count" hint="Alts per wave" value={cfg.deployCount} onChange={v => update({ deployCount: v })} min={1} max={20} />
          <NumberField label="Remove At" hint="Remove when players reach this" value={cfg.removeAt} onChange={v => update({ removeAt: v })} max={100} />
          <NumberField label="Remove Count" hint="Alts to remove per wave" value={cfg.removeCount} onChange={v => update({ removeCount: v })} min={1} max={20} />
          <NumberField label="Check Interval (s)" hint="PRC polling frequency" value={cfg.interval} onChange={v => update({ interval: v })} min={10} max={300} />
          <NumberField label="Launch Delay (s)" hint="Delay between alt launches" value={cfg.launchDelay} onChange={v => update({ launchDelay: v })} min={0} max={60} />
        </div>
      </div>

      {/* Schedule */}
      <div className="glass" style={{ padding: 16, marginBottom: 12 }}>
        <div className="glass-aurora" />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: 8 }}>
              Schedule
              <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(167,139,250,0.3)', color: '#c4b5fd', letterSpacing: '0.08em' }}>AUTO</span>
            </p>
            <p style={{ fontSize: 10, color: 'oklch(0.74 0.035 282)', marginTop: 4, maxWidth: 420, lineHeight: 1.5 }}>
              Automatically run Auto Alting inside daily time windows (uses the connection + config above). Overnight windows are supported. Only fires while the app is open.
            </p>
          </div>
          <button onClick={() => saveSchedule({ ...schedule, enabled: !schedule.enabled })}
            style={{ flexShrink: 0, width: 38, height: 21, padding: 0, borderRadius: 99, position: 'relative', border: 'none', cursor: 'pointer',
              background: schedule.enabled ? 'var(--grad-btn)' : 'rgba(255,255,255,0.08)',
              boxShadow: schedule.enabled ? '0 2px 8px rgba(124,58,237,0.4)' : 'none', transition: 'background 0.2s' }}>
            <span style={{ position: 'absolute', top: 2, left: schedule.enabled ? 19 : 2, width: 17, height: 17, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
          </button>
        </div>

        {schedule.enabled && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, marginBottom: 10,
            color: schedStatus?.active ? '#4ade80' : 'oklch(0.66 0.03 280)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: schedStatus?.active ? '#4ade80' : '#555', boxShadow: schedStatus?.active ? '0 0 6px #4ade80' : 'none', animation: schedStatus?.active ? 'glowPulse 1.5s ease-in-out infinite' : 'none' }} />
            {schedStatus?.active ? 'Window active — automation running on schedule' : 'No active window right now'}
          </div>
        )}

        <div style={{ display: 'grid', gap: 8 }}>
          {schedule.windows.length === 0 && (
            <p style={{ fontSize: 11, color: 'oklch(0.66 0.03 280)' }}>No windows yet — add one to schedule automation.</p>
          )}
          {schedule.windows.map(w => (
            <div key={w.id} style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input type="time" className="input-base" style={{ width: 118 }} value={w.start} onChange={e => updateWindow(w.id, { start: e.target.value })} />
                <span style={{ fontSize: 12, color: 'oklch(0.7 0.03 281)' }}>→</span>
                <input type="time" className="input-base" style={{ width: 118 }} value={w.end} onChange={e => updateWindow(w.id, { end: e.target.value })} />
                <button className="btn-ghost" style={{ marginLeft: 'auto', color: '#f87171', borderColor: 'rgba(248,113,113,0.3)', fontSize: 10, padding: '4px 9px' }} onClick={() => removeWindow(w.id)}>Remove</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {DAY_LABELS.map((lbl, day) => {
                  const on = w.days.length === 0 || w.days.includes(day)
                  return (
                    <button key={day} onClick={() => toggleDay(w.id, day)}
                      style={{ width: 26, height: 26, borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                        border: `1px solid ${on ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.06)'}`,
                        background: on ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.02)',
                        color: on ? '#e0d7ff' : 'oklch(0.6 0.03 280)', transition: 'all 0.12s' }}>
                      {lbl}
                    </button>
                  )
                })}
                <span style={{ marginLeft: 8, fontSize: 9, color: 'oklch(0.6 0.03 280)' }}>{w.days.length === 0 ? 'every day' : ''}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <button className="btn-ghost" style={{ fontSize: 11 }} onClick={addWindow}>+ Add window</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={schedule.disconnectOnEnd} onChange={e => saveSchedule({ ...schedule, disconnectOnEnd: e.target.checked })} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
            <span style={{ fontSize: 11, color: 'oklch(0.8 0.035 283)' }}>Disconnect all alts when a window ends</span>
          </label>
        </div>
      </div>

      {/* Auto Jail */}
      <div className="glass" style={{ padding: 16, marginBottom: 12 }}>
        <div className="glass-aurora" />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4, gap: 12 }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: 8 }}>
              Auto Jail
              <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(167,139,250,0.3)', color: '#c4b5fd', letterSpacing: '0.08em' }}>AUTO</span>
            </p>
            <p style={{ fontSize: 10, color: 'oklch(0.74 0.035 282)', marginTop: 4, maxWidth: 440, lineHeight: 1.5 }}>
              Automatically runs the in-game <code style={{ color: '#c4b5fd' }}>:jail &lt;username&gt;</code> command on each deployed alt, locking them in the jail cell so they stay off the streets and off the live map. Re-jails any alt that rejoins.
            </p>
          </div>
          <button onClick={() => onSave({ ...settings, autoJail: !settings.autoJail })}
            style={{ flexShrink: 0, width: 38, height: 21, padding: 0, borderRadius: 99, position: 'relative', border: 'none', cursor: 'pointer',
              background: settings.autoJail ? 'var(--grad-btn)' : 'rgba(255,255,255,0.08)',
              boxShadow: settings.autoJail ? '0 2px 8px rgba(124,58,237,0.4)' : 'none', transition: 'background 0.2s' }}>
            <span style={{ position: 'absolute', top: 2, left: settings.autoJail ? 19 : 2, width: 17, height: 17, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
          </button>
        </div>
        {settings.autoJail && (
          <>
            {/* Jail queue pacing — keeps :jail commands under PRC's rate limit */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <label style={{ fontSize: 10, color: 'oklch(0.78 0.035 283)' }}>Delay between jails</label>
                <input type="number" min={1} max={60} className="input-base" style={{ width: 62 }}
                  value={settings.jailDelaySec}
                  onChange={e => onSave({ ...settings, jailDelaySec: Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 3)) })} />
                <span style={{ fontSize: 10, color: 'oklch(0.7 0.035 281)' }}>sec</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <label style={{ fontSize: 10, color: 'oklch(0.78 0.035 283)' }}>Wait after PRC error</label>
                <input type="number" min={3} max={120} className="input-base" style={{ width: 62 }}
                  value={settings.jailBackoffSec}
                  onChange={e => onSave({ ...settings, jailBackoffSec: Math.max(3, Math.min(120, parseInt(e.target.value, 10) || 10)) })} />
                <span style={{ fontSize: 10, color: 'oklch(0.7 0.035 281)' }}>sec</span>
              </div>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, marginTop: 10,
              color: jailStatus?.running ? '#4ade80' : 'oklch(0.66 0.03 280)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: jailStatus?.running ? '#4ade80' : '#555', boxShadow: jailStatus?.running ? '0 0 6px #4ade80' : 'none', animation: jailStatus?.running ? 'glowPulse 1.5s ease-in-out infinite' : 'none' }} />
              {jailStatus?.running
                ? `Jailing active — ${jailStatus.jailedCount} in jail${jailStatus.queued ? `, ${jailStatus.queued} queued` : ''}`
                : 'Will activate when automation starts'}
            </div>
            {jailStatus?.lastError && (
              <p style={{ fontSize: 10, color: '#fbbf24', margin: '6px 0 0' }}>⚠ Last PRC issue: {jailStatus.lastError} — holding the queue, retrying every {settings.jailBackoffSec}s.</p>
            )}
          </>
        )}
      </div>

      {/* Alts to use */}
      {(() => {
        const pool = accounts.filter(a => !!a.cookie)
        const picked = cfg.accountIds ?? []
        const toggle = (id: string) => {
          const set = new Set(picked)
          if (set.has(id)) set.delete(id); else set.add(id)
          update({ accountIds: [...set] })
        }
        return (
          <div className="glass" style={{ padding: 16, marginBottom: 12 }}>
            <div className="glass-aurora" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Alts to use</p>
                <p style={{ fontSize: 10, color: 'oklch(0.74 0.035 282)', marginTop: 4 }}>Pick which alts auto-alting deploys. Leave all unticked to use every account.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd', fontFamily: '"JetBrains Mono", monospace' }}>{picked.length}/{pool.length}</span>
                {picked.length > 0 && (
                  <button className="btn-ghost" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => update({ accountIds: [] })}>Clear</button>
                )}
              </div>
            </div>
            {pool.length === 0 ? (
              <p style={{ fontSize: 11, color: 'oklch(0.66 0.03 280)' }}>No accounts with cookies yet.</p>
            ) : (
              <div style={{ maxHeight: 190, overflowY: 'auto', display: 'grid', gap: 3 }}>
                {pool.map(a => {
                  const checked = picked.includes(a.id)
                  return (
                    <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 8px', borderRadius: 8, cursor: 'pointer',
                      background: checked ? 'rgba(124,58,237,0.14)' : 'rgba(255,255,255,0.02)', border: `1px solid ${checked ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.05)'}`, transition: 'all 0.12s' }}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(a.id)} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                      {a.avatarUrl
                        ? <img src={a.avatarUrl} alt="" style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0 }} />
                        : <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />}
                      <span style={{ fontSize: 12, color: checked ? '#e0d7ff' : 'oklch(0.9 0.022 285)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.username}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* Manual controls */}
      <div className="glass" style={{ padding: 16, marginBottom: 12 }}>
        <div className="glass-aurora" />
        <p style={{ fontSize: 9, fontWeight: 700, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 10 }}>Manual Controls</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-accent" style={{ flex: 1, justifyContent: 'center', background: 'linear-gradient(135deg, oklch(0.74 0.18 150), oklch(0.65 0.20 150))', boxShadow: '0 4px 16px -4px rgba(34,197,94,0.4)' }} onClick={handleDeploy} disabled={busy === 'deploy'}>
            {busy === 'deploy' ? 'Deploying…' : `Deploy Now (${cfg.deployCount})`}
          </button>
          <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center', color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }} onClick={handleRemove} disabled={busy === 'remove'}>
            {busy === 'remove' ? 'Removing…' : `Remove Now (${cfg.removeCount})`}
          </button>
        </div>
      </div>

      {/* Activity log */}
      <div className="glass" style={{ padding: 16 }}>
        <div className="glass-aurora" />
        <p style={{ fontSize: 9, fontWeight: 700, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 10 }}>Activity Log</p>
        <div style={{ maxHeight: 180, overflowY: 'auto', background: 'rgba(0,0,0,0.25)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', padding: 10 }}>
          {status && status.log.length > 0 ? status.log.map((line, i) => (
            <p key={i} style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: line.includes('Failed') || line.includes('failed') ? '#f87171' : line.includes('Deployed') || line.includes('Connected') ? '#4ade80' : 'oklch(0.85 0.03 284)', margin: '0 0 3px', lineHeight: 1.5 }}>
              {line}
            </p>
          )) : (
            <p style={{ fontSize: 11, color: 'oklch(0.66 0.03 280)', fontFamily: '"JetBrains Mono", monospace', margin: 0 }}>No activity yet.</p>
          )}
        </div>
      </div>

      {/* Best practices */}
      <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Best Practices</p>
        <ul style={{ fontSize: 11, color: 'oklch(0.8 0.035 283)', lineHeight: 1.8, margin: 0, paddingLeft: 16 }}>
          <li>Set deploy threshold 5–8 below max capacity</li>
          <li>Use 15–20s launch delay to avoid rate limits</li>
          <li>Keep 5+ spare accounts for mid-session replacements</li>
        </ul>
      </div>
    </div>
  )
}
