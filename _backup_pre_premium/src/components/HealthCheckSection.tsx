import React, { useState, useEffect, useRef } from 'react'
import type { AppSettings, HealthCheckStatus } from '../types'

interface Props {
  settings: AppSettings
  onSave: (next: AppSettings) => void
}

const SWEEP_INTERVALS = [15, 30, 60, 120] as const

export function HealthCheckSection({ settings, onSave }: Props) {
  const [status, setStatus] = useState<HealthCheckStatus | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const poll = () => window.electron.health.status().then(setStatus).catch(() => {})
    poll()
    pollRef.current = setInterval(poll, 1500)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const running = status?.running ?? false
  const pct = status && status.total > 0 ? Math.round((status.done / status.total) * 100) : 0

  const handleRun = () => { window.electron.health.start().then(() => window.electron.health.status().then(setStatus)) }

  const toggleSweep = async () => {
    const next = { ...settings, healthSweepEnabled: !settings.healthSweepEnabled }
    onSave(next)
    if (next.healthSweepEnabled) await window.electron.health.sweepStart(next.healthSweepInterval)
    else                        await window.electron.health.sweepStop()
  }

  const setSweepInterval = async (m: number) => {
    const next = { ...settings, healthSweepInterval: m }
    onSave(next)
    if (next.healthSweepEnabled) await window.electron.health.sweepStart(m)
  }

  return (
    <>
      {/* Run card */}
      <div className="glass" style={{ padding: 18, marginBottom: 12 }}>
        <div className="glass-aurora" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              Health Check
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', letterSpacing: '0.1em' }}>COOKIES</span>
            </h2>
            <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3 }}>Validate every cookie — refreshes valid ones, flags expired ones red</p>
          </div>
          <button
            onClick={handleRun}
            disabled={running}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: running ? 'not-allowed' : 'pointer', border: 'none', transition: 'all 0.2s',
              background: 'linear-gradient(135deg, oklch(0.74 0.18 150), oklch(0.65 0.20 150))', color: '#fff',
              boxShadow: '0 4px 16px -4px rgba(34,197,94,0.5)', opacity: running ? 0.6 : 1,
            }}>
            {/* heartbeat icon */}
            <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h3l2.25-6 4.5 12 2.25-6h4.5" />
            </svg>
            {running ? 'Checking…' : 'Run Health Check'}
          </button>
        </div>

        {/* Progress */}
        {status && status.total > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'oklch(0.74 0.035 282)', marginBottom: 6 }}>
              <span>{running ? `Checking ${status.done}/${status.total}` : `Last run: ${status.done}/${status.total} checked`}</span>
              <span>{pct}%</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: 'linear-gradient(90deg, oklch(0.74 0.18 150), oklch(0.65 0.20 150))', transition: 'width 0.4s' }} />
            </div>

            {/* Result chips */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {[
                { label: 'Valid', value: status.valid, color: '#4ade80', bg: 'rgba(34,197,94,0.1)', bd: 'rgba(34,197,94,0.25)' },
                { label: 'Expired', value: status.expired, color: '#f87171', bg: 'rgba(248,113,113,0.1)', bd: 'rgba(248,113,113,0.25)' },
                { label: 'Unknown', value: status.unknown, color: 'oklch(0.82 0.035 284)', bg: 'rgba(255,255,255,0.04)', bd: 'rgba(255,255,255,0.1)' },
              ].map(c => (
                <div key={c.label} style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 10, background: c.bg, border: `1px solid ${c.bd}` }}>
                  <p style={{ fontSize: 18, fontWeight: 800, color: c.color, fontFamily: '"JetBrains Mono", monospace', lineHeight: 1 }}>{c.value}</p>
                  <p style={{ fontSize: 9, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>{c.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Background sweep */}
      <div className="glass" style={{ padding: 18, marginBottom: 12 }}>
        <div className="glass-aurora" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: settings.healthSweepEnabled ? 14 : 0 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0 }}>Background Health Sweep</p>
            <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3 }}>Automatically health-check all cookies on a schedule</p>
          </div>
          <button onClick={toggleSweep}
            style={{ width: 44, height: 24, padding: 0, boxSizing: 'border-box', borderRadius: 99, flexShrink: 0, position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s',
              background: settings.healthSweepEnabled ? 'linear-gradient(135deg, oklch(0.62 0.22 280), oklch(0.55 0.24 295))' : 'rgba(255,255,255,0.1)',
              boxShadow: settings.healthSweepEnabled ? '0 2px 10px rgba(124,58,237,0.45)' : 'none' }}>
            <span style={{ position: 'absolute', top: 3, left: settings.healthSweepEnabled ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
          </button>
        </div>
        {settings.healthSweepEnabled && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: 'oklch(0.74 0.035 282)' }}>Sweep every</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd', fontFamily: '"JetBrains Mono", monospace' }}>{settings.healthSweepInterval} min</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {SWEEP_INTERVALS.map(m => (
                <button key={m} onClick={() => setSweepInterval(m)}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                    background: settings.healthSweepInterval === m ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${settings.healthSweepInterval === m ? 'rgba(167,139,250,0.45)' : 'rgba(255,255,255,0.08)'}`,
                    color: settings.healthSweepInterval === m ? '#c4b5fd' : 'oklch(0.82 0.035 284)' }}>
                  {m}m
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Activity log */}
      {status && status.log.length > 0 && (
        <div className="glass" style={{ padding: 16, marginBottom: 12 }}>
          <div className="glass-aurora" />
          <p style={{ fontSize: 9, fontWeight: 700, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 10 }}>Activity Log</p>
          <div style={{ maxHeight: 160, overflowY: 'auto', background: 'rgba(0,0,0,0.25)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', padding: 10 }}>
            {status.log.map((line, i) => (
              <p key={i} style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: line.includes('expired') || line.includes('Rate') ? '#fbbf24' : line.includes('valid') ? '#4ade80' : 'oklch(0.85 0.03 284)', margin: '0 0 3px', lineHeight: 1.5 }}>{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>How it works</p>
        <p style={{ fontSize: 11, color: 'oklch(0.8 0.035 283)', lineHeight: 1.7, margin: 0 }}>
          Each cookie is validated against Roblox in batches of 5 (1.5s between accounts, 5s between batches, rate-limit retries).
          Valid cookies have their username, avatar and group refreshed; expired cookies are marked red on the Accounts page.
          For ~30 accounts a full check takes roughly 1–2 minutes.
        </p>
      </div>
    </>
  )
}
