import React, { useEffect, useState } from 'react'
import logoUrl from '../assets/logo.svg'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 9, fontWeight: 700, color: 'oklch(0.74 0.035 282)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 14 }}>
      {children}
    </p>
  )
}

type Feat = { label: string; desc: string; icon: React.ReactNode; tint: string }

const FEATURES: Feat[] = [
  { label: 'Multi-Account', desc: 'Manage unlimited Roblox alts in one place', tint: '167,139,250',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /> },
  { label: 'ERLC Launch', desc: 'One-click join into private ERLC servers', tint: '74,222,128',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /> },
  { label: 'Live Presence', desc: 'Real-time status & in-game monitoring', tint: '103,232,249',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /> },
  { label: 'Auto-Alting', desc: 'Keep servers filled automatically', tint: '251,191,36',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /> },
  { label: 'Anti-AFK', desc: 'Stay in-game without getting kicked', tint: '244,114,182',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" /> },
  { label: 'Webhook Alerts', desc: 'Monitor your PC from Discord', tint: '88,101,242',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /> },
]

const CONTRIBUTORS = [
  { name: '_moderation', role: 'Main Developer' },
  { name: 'premium_str', role: 'Contributor' },
  { name: '2c7o', role: 'Backend Developer' },
]

export function AboutPage() {
  const [accounts, setAccounts] = useState<number | null>(null)

  useEffect(() => {
    window.electron.store.getAccounts().then(a => setAccounts(a.length)).catch(() => {})
  }, [])

  const stats = [
    { label: 'Version', value: 'V2.2' },
    { label: 'Accounts', value: accounts === null ? '—' : String(accounts) },
    { label: 'Status', value: 'Operational', dot: true },
  ]

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div className="glass animate-scale-in" style={{ position: 'relative', overflow: 'hidden', marginBottom: 14 }}>
          <div className="glass-aurora" />
          {/* gradient banner */}
          <div style={{ position: 'absolute', inset: '0 0 auto 0', height: 150,
            background: 'radial-gradient(120% 140% at 50% -40%, rgba(124,58,237,0.45), transparent 60%), linear-gradient(180deg, rgba(103,232,249,0.10), transparent)' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 22, padding: '30px 30px' }}>
            {/* Logo with rings */}
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 104, height: 104 }}>
              <div style={{ position: 'absolute', width: 104, height: 104, borderRadius: '50%', border: '1px solid rgba(167,139,250,0.18)', animation: 'spinSlow 12s linear infinite' }} />
              <div style={{ position: 'absolute', width: 84, height: 84, borderRadius: '50%', border: '1px dashed rgba(103,232,249,0.16)', animation: 'spinSlow 8s linear infinite reverse' }} />
              <div style={{ position: 'absolute', width: 86, height: 86, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.4) 0%, transparent 70%)', filter: 'blur(14px)', animation: 'glowPulse 2.6s ease-in-out infinite' }} />
              <img src={logoUrl} width={58} height={58} alt="Leventia"
                style={{ position: 'relative', filter: 'drop-shadow(0 0 18px rgba(124,58,237,0.65))', animation: 'float 3.4s ease-in-out infinite' }} />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 4px', letterSpacing: '0.02em',
                background: 'linear-gradient(135deg, #c4b5fd 0%, #93c5fd 55%, #67e8f9 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Leventia Alting
              </h1>
              <p style={{ fontSize: 12, color: 'oklch(0.78 0.035 283)', margin: '0 0 16px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Premium Roblox Account Manager
              </p>

              {/* Stat strip */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {stats.map(s => (
                  <div key={s.label} style={{ flex: '1 1 120px', minWidth: 110, padding: '10px 14px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p style={{ fontSize: 9, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.14em', margin: '0 0 4px' }}>{s.label}</p>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontFamily: '"JetBrains Mono", monospace' }}>
                      {s.dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'oklch(0.74 0.18 150)', boxShadow: '0 0 8px oklch(0.74 0.18 150 / 0.8)', animation: 'glowPulse 2s ease-in-out infinite' }} />}
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Description ───────────────────────────────────────────────────── */}
        <div className="glass" style={{ position: 'relative', padding: '20px 22px', marginBottom: 14 }}>
          <div className="glass-aurora" />
          <SectionLabel>About</SectionLabel>
          <p style={{ fontSize: 12.5, color: 'oklch(0.88 0.025 285)', lineHeight: 1.75, margin: 0 }}>
            Leventia Alting is a premium desktop dashboard built for managing multiple Roblox accounts with ease.
            Launch alts into ERLC private servers, monitor presence in real time, automate server population,
            and keep everything under control — all from one sleek, fast interface.
          </p>
        </div>

        {/* ── Features ──────────────────────────────────────────────────────── */}
        <div className="glass" style={{ position: 'relative', padding: '20px 22px', marginBottom: 14 }}>
          <div className="glass-aurora" />
          <SectionLabel>What it does</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {FEATURES.map(f => (
              <div key={f.label} className="about-feat" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 14px', borderRadius: 14,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', transition: 'transform .2s ease, border-color .2s ease, background .2s ease' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.borderColor = `rgba(${f.tint},0.4)`; el.style.background = `rgba(${f.tint},0.06)` }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.borderColor = 'rgba(255,255,255,0.07)'; el.style.background = 'rgba(255,255,255,0.03)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `rgba(${f.tint},0.14)`, border: `1px solid rgba(${f.tint},0.3)`, color: `rgb(${f.tint})` }}>
                  <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{f.icon}</svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: 'oklch(0.96 0.01 260)', margin: '1px 0 3px' }}>{f.label}</p>
                  <p style={{ fontSize: 10.5, color: 'oklch(0.76 0.035 282)', margin: 0, lineHeight: 1.45 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Contributors ──────────────────────────────────────────────────── */}
        <div className="glass" style={{ position: 'relative', padding: '20px 22px', marginBottom: 14 }}>
          <div className="glass-aurora" />
          <SectionLabel>Contributors</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {CONTRIBUTORS.map(c => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14,
                background: 'rgba(88,101,242,0.09)', border: '1px solid rgba(88,101,242,0.22)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(88,101,242,0.2)', border: '1px solid rgba(88,101,242,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg style={{ width: 18, height: 18, color: '#7289da' }} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: 'oklch(0.96 0.01 260)', margin: 0, fontFamily: '"JetBrains Mono", monospace' }}>{c.name}</p>
                  <p style={{ fontSize: 10, color: 'oklch(0.7 0.035 281)', margin: '2px 0 0' }}>{c.role}</p>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: 'rgba(88,101,242,0.16)', color: '#8b9bf0', border: '1px solid rgba(88,101,242,0.28)', letterSpacing: '0.06em', flexShrink: 0 }}>
                  Discord
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tech Stack ────────────────────────────────────────────────────── */}
        <div className="glass" style={{ position: 'relative', padding: '20px 22px', marginBottom: 14 }}>
          <div className="glass-aurora" />
          <SectionLabel>Built With</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['Electron', 'React 18', 'TypeScript', 'Vite', 'Tailwind CSS', 'Node.js', 'Supabase'].map(t => (
              <div key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 99, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'linear-gradient(135deg, #c4b5fd, #67e8f9)', flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: 'oklch(0.88 0.025 285)', fontWeight: 500 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', padding: '6px 0 8px' }}>
          <p style={{ fontSize: 10, color: 'oklch(0.62 0.03 280)', letterSpacing: '0.08em' }}>
            © 2026 Leventia Alting · All rights reserved
          </p>
        </div>

      </div>
    </div>
  )
}
