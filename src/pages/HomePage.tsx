import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { LicenseData, Page, RobloxAccount, AutoAltStatus, AutoAltScheduleStatus } from '../types'
import { useSystemStats } from '../hooks/useSystemStats'

interface Props {
  license: LicenseData
  onNavigate: (p: Page) => void
}

const ICONS: Record<string, React.ReactNode> = {
  accounts: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />,
  healthy: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />,
  expired: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />,
  running: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />,
}

// ── Overview / Home — at-a-glance status the moment the app opens ───────────────
// Live account health, running alts, auto-alt + schedule state, a quick-deploy box,
// and recent automation activity. All data comes from existing IPC (poll every 3s).
export function HomePage({ license, onNavigate }: Props) {
  const [accounts, setAccounts] = useState<RobloxAccount[]>([])
  const [running, setRunning]   = useState<string[]>([])
  const [alt, setAlt]           = useState<AutoAltStatus | null>(null)
  const [sched, setSched]       = useState<AutoAltScheduleStatus | null>(null)
  const [now, setNow]           = useState(() => new Date())
  const stats = useSystemStats()

  const [code, setCode]   = useState('')
  const [count, setCount] = useState(4)
  const [deploying, setDeploying] = useState(false)
  const [deployMsg, setDeployMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const poll = () => {
      window.electron.store.getAccounts().then(setAccounts).catch(() => {})
      window.electron.roblox.getRunning().then(setRunning).catch(() => {})
      window.electron.autoAlt.status().then(setAlt).catch(() => {})
      window.electron.autoAlt.scheduleStatus().then(setSched).catch(() => {})
    }
    poll()
    pollRef.current = setInterval(poll, 3000)
    const clock = setInterval(() => setNow(new Date()), 1000)
    return () => { if (pollRef.current) clearInterval(pollRef.current); clearInterval(clock) }
  }, [])

  const total    = accounts.length
  const withCk   = accounts.filter(a => !!a.cookie)
  const expired  = accounts.filter(a => a.cookieStatus === 'expired').length
  const healthy  = accounts.filter(a => !!a.cookie && a.cookieStatus !== 'expired').length
  const noCookie = total - withCk.length
  const runCount = running.length

  const quickDeploy = useCallback(async () => {
    const c = code.trim()
    if (!c || deploying) return
    setDeploying(true); setDeployMsg(null)
    try {
      const s = await window.electron.store.getSettings()
      await window.electron.autoAlt.deployNow({ ...s.autoAlt, serverCode: c, deployCount: count })
      setDeployMsg({ ok: true, text: `Deploy started for "${c}" — watch the activity log below.` })
    } catch (e) {
      setDeployMsg({ ok: false, text: e instanceof Error ? e.message : 'Deploy failed.' })
    } finally { setDeploying(false) }
  }, [code, count, deploying])

  const greeting = (() => {
    const h = now.getHours()
    return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  })()
  const who = license.type === 'staff' ? 'Staff' : (license.discordUsername || 'Operator')
  const clock = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  // Live system summary for the hero status pill.
  const healthPct = total ? Math.round((healthy / total) * 100) : 0
  const sysText  = total === 0 ? 'No accounts yet'
                 : runCount > 0 ? `${runCount} alt${runCount === 1 ? '' : 's'} running`
                 : alt?.running ? 'Automation active' : 'Idle — ready to deploy'
  const sysColor = runCount > 0 || alt?.running ? '#4ade80' : total === 0 ? '#fbbf24' : '#c4b5fd'

  const tiles = [
    { key: 'accounts', label: 'Accounts', value: total,   tint: '167,139,250', pct: total ? 100 : 0,                       sub: noCookie > 0 ? `${noCookie} without cookie` : 'all have cookies' },
    { key: 'healthy',  label: 'Healthy',  value: healthy, tint: '74,222,128',  pct: healthPct,                              sub: total ? `${healthPct}% of fleet` : 'cookies valid' },
    { key: 'expired',  label: 'Expired',  value: expired, tint: '248,113,113', pct: total ? Math.round((expired / total) * 100) : 0,  sub: expired > 0 ? 'need a refresh' : 'all good' },
    { key: 'running',  label: 'Running',  value: runCount, tint: '103,232,249', pct: total ? Math.min(100, Math.round((runCount / total) * 100)) : 0, sub: runCount === 1 ? 'alt launched' : 'alts launched' },
  ]

  // Fleet-health bar segments (only the non-zero ones render).
  const seg = [
    { label: 'Healthy',   n: healthy,  color: '#4ade80' },
    { label: 'Expired',   n: expired,  color: '#f87171' },
    { label: 'No cookie', n: noCookie, color: 'oklch(0.5 0.02 280)' },
  ]

  const card: React.CSSProperties = { position: 'relative', overflow: 'hidden', padding: 16, borderRadius: 14 }
  const heading: React.CSSProperties = { fontSize: 9, fontWeight: 700, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12 }

  return (
    <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', paddingRight: 6, paddingBottom: 24 }}>
      <style>{`
        @keyframes lvntFade { from { opacity: 0 } to { opacity: 1 } }
        .lvnt-rise { animation: lvntFade 0.5s ease both }
      `}</style>

      {/* Hero — greeting, live status pill, version, clock */}
      <div className="glass lvnt-rise" style={{ position: 'relative', overflow: 'hidden', padding: '20px 22px', borderRadius: 18, marginBottom: 14, border: '1px solid rgba(167,139,250,0.18)' }}>
        <div className="glass-aurora" />
        {/* soft gradient glow */}
        <div style={{ position: 'absolute', top: -70, right: -50, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.28), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 240 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600, color: sysColor, padding: '3px 10px', borderRadius: 99, background: `rgba(${sysColor === '#4ade80' ? '74,222,128' : sysColor === '#fbbf24' ? '251,191,36' : '196,181,253'},0.12)`, border: `1px solid rgba(${sysColor === '#4ade80' ? '74,222,128' : sysColor === '#fbbf24' ? '251,191,36' : '196,181,253'},0.3)` }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: sysColor, boxShadow: `0 0 7px ${sysColor}`, animation: 'glowPulse 1.6s ease-in-out infinite' }} />
                {sysText}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: '#c4b5fd', padding: '3px 9px', borderRadius: 99, background: 'rgba(124,58,237,0.14)', border: '1px solid rgba(167,139,250,0.3)', fontFamily: '"JetBrains Mono", monospace' }}>V2.3</span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.015em' }}>
              {greeting}, <span style={{ background: 'linear-gradient(110deg,#e9d5ff,#c4b5fd 45%,#93c5fd 75%,#67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{who}</span>
            </h1>
            <p style={{ fontSize: 12, color: 'oklch(0.74 0.035 283)', marginTop: 6 }}>
              {runCount > 0
                ? <>You have <b style={{ color: '#67e8f9' }}>{runCount}</b> alt{runCount === 1 ? '' : 's'} running · <b style={{ color: '#4ade80' }}>{healthy}</b> healthy of <b style={{ color: '#fff' }}>{total}</b>.</>
                : <>Fleet at a glance — <b style={{ color: '#4ade80' }}>{healthy}</b> healthy of <b style={{ color: '#fff' }}>{total}</b> account{total === 1 ? '' : 's'}.</>}
            </p>
          </div>
          <div className="glass" style={{ padding: '11px 16px', borderRadius: 13, textAlign: 'right', flexShrink: 0, border: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: '"JetBrains Mono", monospace', lineHeight: 1, margin: 0, letterSpacing: '0.02em' }}>{clock}</p>
            <p style={{ fontSize: 9.5, color: 'oklch(0.68 0.035 281)', marginTop: 5 }}>{today}</p>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
        {tiles.map((t, i) => (
          <div key={t.key} className="glass lift lvnt-rise" style={{ ...card, animationDelay: `${0.06 * (i + 1)}s` }}>
            <div className="glass-aurora" />
            {/* top accent strip in the tile tint */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, rgba(${t.tint},0.9), rgba(${t.tint},0))` }} />
            {/* soft tint glow behind the number */}
            <div style={{ position: 'absolute', bottom: -30, left: -20, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle, rgba(${t.tint},0.16), transparent 70%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 9, color: 'oklch(0.72 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.14em', margin: '2px 0 0' }}>{t.label}</p>
              <span style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: `rgba(${t.tint},0.14)`, border: `1px solid rgba(${t.tint},0.32)`, color: `rgb(${t.tint})`, boxShadow: `0 2px 12px -4px rgba(${t.tint},0.5)` }}>
                <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>{ICONS[t.key]}</svg>
              </span>
            </div>
            <p style={{ position: 'relative', fontSize: 36, fontWeight: 800, color: `rgb(${t.tint})`, fontFamily: '"JetBrains Mono", monospace', lineHeight: 1, margin: '10px 0 4px', textShadow: `0 0 24px rgba(${t.tint},0.35)` }}>{t.value}</p>
            <p style={{ fontSize: 9.5, color: 'oklch(0.66 0.03 280)', margin: '0 0 10px' }}>{t.sub}</p>
            {/* proportion bar in the tile tint */}
            <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${t.pct}%`, borderRadius: 99, background: `linear-gradient(90deg, rgba(${t.tint},0.5), rgb(${t.tint}))`, boxShadow: `0 0 8px rgba(${t.tint},0.6)`, transition: 'width 0.5s ease' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Fleet health bar */}
      <div className="glass lvnt-rise" style={{ ...card, marginBottom: 12, animationDelay: '0.34s' }}>
        <div className="glass-aurora" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ ...heading, margin: 0 }}>Fleet Health</p>
          <button className="btn-ghost" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => onNavigate('accounts')}>Manage accounts →</button>
        </div>
        {total === 0 ? (
          <p style={{ fontSize: 11, color: 'oklch(0.62 0.03 280)' }}>No accounts yet — add some on the Accounts page to see fleet health.</p>
        ) : (
          <>
            <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {seg.filter(s => s.n > 0).map(s => (
                <div key={s.label} title={`${s.label}: ${s.n}`} style={{ width: `${(s.n / total) * 100}%`, background: s.color, transition: 'width 0.4s ease' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 10, flexWrap: 'wrap' }}>
              {seg.map(s => (
                <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'oklch(0.78 0.03 283)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: s.color }} />
                  {s.label} <b style={{ color: '#fff', fontFamily: '"JetBrains Mono", monospace' }}>{s.n}</b>
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="lvnt-rise" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, animationDelay: '0.4s' }}>
        {/* Quick Deploy */}
        <div className="glass" style={card}>
          <div className="glass-aurora" />
          <p style={heading}>Quick Deploy</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input className="input-base" style={{ flex: 1 }} placeholder="ERLC server code" value={code}
              onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && quickDeploy()} spellCheck={false} />
            <input className="input-base" type="number" min={1} max={20} style={{ width: 64, textAlign: 'center' }} value={count}
              onChange={e => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} />
          </div>
          <button className="btn-accent" style={{ width: '100%', justifyContent: 'center', gap: 7,
            background: 'linear-gradient(135deg, oklch(0.74 0.18 150), oklch(0.65 0.20 150))', boxShadow: '0 4px 16px -4px rgba(34,197,94,0.45)' }}
            onClick={quickDeploy} disabled={deploying || !code.trim() || withCk.length === 0}>
            <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>
            {deploying ? 'Deploying…' : `Deploy ${count} alt${count === 1 ? '' : 's'}`}
          </button>
          {withCk.length === 0
            ? <p style={{ fontSize: 10, color: '#f87171', marginTop: 8 }}>No accounts with cookies yet — add some on the Accounts page.</p>
            : <p style={{ fontSize: 10, color: 'oklch(0.66 0.03 280)', marginTop: 8 }}>{withCk.length} account{withCk.length === 1 ? '' : 's'} ready to deploy.</p>}
          {deployMsg && <p style={{ fontSize: 10.5, color: deployMsg.ok ? '#4ade80' : '#f87171', marginTop: 6 }}>{deployMsg.text}</p>}
          <p style={{ fontSize: 9.5, color: 'oklch(0.6 0.03 280)', marginTop: 10, lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 9 }}>
            Uses your saved Auto Alting settings. For thresholds + scheduling, open <button onClick={() => onNavigate('premium')} style={{ color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 9.5, textDecoration: 'underline' }}>Premium → Auto Alting</button>.
          </p>
        </div>

        {/* Automation status */}
        <div className="glass" style={card}>
          <div className="glass-aurora" />
          <p style={heading}>Automation</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <StatusRow label="Auto Alting" on={!!alt?.running} onText={alt?.running ? `Active · ${alt.players}/${alt.maxPlayers} · ${alt.ourAlts} alts` : 'Stopped'} />
            <StatusRow label="Schedule" on={!!sched?.active} warn={!!sched?.enabled && !sched?.active}
              onText={sched?.enabled ? (sched.active ? 'Window active' : 'Enabled · idle') : 'Off'} />
            <StatusRow label="CPU" on={false} neutral onText={`${stats.cpuUsage}%`} />
            <StatusRow label="Memory" on={false} neutral onText={`${stats.usedRam} / ${stats.totalRam} GB`} />
          </div>
          <button className="btn-ghost" style={{ width: '100%', marginTop: 12, fontSize: 11 }} onClick={() => onNavigate('premium')}>Open Auto Alting</button>
        </div>
      </div>

      {/* Recent activity */}
      <div className="glass lvnt-rise" style={{ ...card, marginTop: 12, animationDelay: '0.46s' }}>
        <div className="glass-aurora" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
          <span style={{ display: 'inline-flex', gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f87171' }} />
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fbbf24' }} />
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80' }} />
          </span>
          <p style={{ ...heading, margin: 0 }}>Recent Activity</p>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', padding: 12, maxHeight: 168, overflowY: 'auto' }}>
          {alt && alt.log.length > 0 ? alt.log.slice(0, 9).map((line, i) => (
            <p key={i} style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', margin: '0 0 4px', lineHeight: 1.55,
              color: /fail|✗|✖/i.test(line) ? '#f87171' : /launch|deploy|connect|✓/i.test(line) ? '#86efac' : 'oklch(0.82 0.03 284)' }}>{line}</p>
          )) : (
            <p style={{ fontSize: 11, color: 'oklch(0.6 0.03 280)', fontFamily: '"JetBrains Mono", monospace', margin: 0 }}>No automation activity yet — deploy some alts to see live events here.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusRow({ label, on, onText, warn, neutral }: { label: string; on: boolean; onText: string; warn?: boolean; neutral?: boolean }) {
  const color = on ? '#4ade80' : warn ? '#fbbf24' : neutral ? '#c4b5fd' : 'oklch(0.62 0.03 280)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: 11, color: 'oklch(0.76 0.035 282)' }}>{label}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, color, fontFamily: neutral ? '"JetBrains Mono", monospace' : 'inherit' }}>
        {!neutral && <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: on ? `0 0 6px ${color}` : 'none', animation: on ? 'glowPulse 1.5s ease-in-out infinite' : 'none' }} />}
        {onText}
      </span>
    </div>
  )
}
