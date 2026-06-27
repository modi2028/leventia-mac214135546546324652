import React from 'react'
import type { Page } from '../types'
import logoUrl from '../assets/logo.svg'

interface Props {
  activePage: Page
  onNavigate: (p: Page) => void
  accountCount: number
  uptime: string
  licenseKey: string
  expiresAt: string
  licenseType?: string
  discordUsername?: string
  hasPremium?: boolean
}

const NAV: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'home',        label: 'Overview',    icon: <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg> },
  { id: 'accounts',    label: 'Accounts',    icon: <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg> },
  { id: 'premium',     label: 'Premium',     icon: <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg> },
  { id: 'updates',     label: 'Updates',     icon: <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" /></svg> },
  { id: 'settings',    label: 'Settings',    icon: <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  { id: 'leaderboard', label: 'Leaderboard', icon: <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg> },
  { id: 'about',       label: 'About',       icon: <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg> },
]

const STAFF_NAV = {
  id: 'staff' as Page,
  label: 'Management',
  icon: <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>,
}

export function Sidebar({ activePage, onNavigate, accountCount, uptime, licenseKey, expiresAt, licenseType, discordUsername, hasPremium }: Props) {
  const isStaff = licenseType === 'staff'
  // Premium tab is hidden for standard (basic) users until staff grant access.
  const visibleNav = hasPremium ? NAV : NAV.filter(n => n.id !== 'premium')
  const nav = isStaff ? [...visibleNav, STAFF_NAV] : visibleNav
  const expiry   = new Date(expiresAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'2-digit' })
  // Staff → just the STAFF badge. Linked Discord → show the username. Otherwise → the full key.
  const hasDiscord = !isStaff && !!discordUsername
  const identityLabel = hasDiscord ? 'Discord' : 'License'

  return (
    <aside className="glass" style={{
      width: 200,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      <div className="glass-aurora" />

      {/* Logo / Brand */}
      <div style={{
        padding: '22px 16px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* soft brand glow behind the header */}
        <div style={{ position: 'absolute', top: -30, left: -10, width: 120, height: 120, background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)', filter: 'blur(12px)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: -7, background: 'radial-gradient(circle, rgba(124,58,237,0.45) 0%, transparent 70%)', filter: 'blur(8px)', borderRadius: '50%' }} className="animate-glow-pulse" />
            <img src={logoUrl} width={40} height={40} alt="Leventia" style={{ position: 'relative', filter: 'drop-shadow(0 0 12px rgba(124,58,237,0.6))' }} />
          </div>
          <div style={{ lineHeight: 1 }}>
            <div style={{
              fontSize: 19,
              fontWeight: 800,
              background: 'linear-gradient(110deg, #e9d5ff 0%, #c4b5fd 40%, #93c5fd 70%, #67e8f9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '0.01em',
            }}>
              Leventia
            </div>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'oklch(0.6 0.04 280)',
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              marginTop: 5,
            }}>
              Alting
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
        <p style={{ fontSize: '8.5px', fontWeight: 600, color: 'oklch(0.68 0.035 280)', textTransform: 'uppercase', letterSpacing: '0.18em', padding: '4px 8px 8px' }}>
          Navigation
        </p>
        <ul className="stagger" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {nav.map(item => {
            const active = activePage === item.id
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className="lift"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 10px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: active ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
                    background: active
                      ? 'linear-gradient(90deg, rgba(124,58,237,0.25), rgba(34,211,238,0.15))'
                      : 'transparent',
                    color: active ? '#c4b5fd' : 'oklch(0.86 0.03 285)',
                    boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.1)' : 'none',
                  }}
                  onMouseEnter={e => { if (!active) Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(255,255,255,0.04)', color: 'oklch(0.96 0.01 260)' }) }}
                  onMouseLeave={e => { if (!active) Object.assign((e.currentTarget as HTMLElement).style, { background: 'transparent', color: 'oklch(0.86 0.03 285)' }) }}
                >
                  <span style={{ opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                  {active && <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'linear-gradient(135deg,#a78bfa,#67e8f9)', flexShrink: 0 }} />}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Stat cards + license */}
      <div style={{ padding: '0 8px 10px', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          {[
            { label: 'Accounts', value: String(accountCount), mono: false, tint: '167,139,250',
              icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /> },
            { label: 'Uptime',   value: uptime,               mono: true,  tint: '103,232,249',
              icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /> },
          ].map(s => (
            <div key={s.label} className="glass" style={{ position: 'relative', overflow: 'hidden', padding: '10px 11px', borderRadius: 12, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)' }}>
              <div className="glass-aurora" />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ width: 18, height: 18, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: `rgba(${s.tint},0.15)`, border: `1px solid rgba(${s.tint},0.3)`, color: `rgb(${s.tint})` }}>
                  <svg style={{ width: 11, height: 11 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>{s.icon}</svg>
                </span>
                <p style={{ fontSize: '8px', color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.14em', margin: 0 }}>{s.label}</p>
              </div>
              <p style={{ position: 'relative', fontSize: s.mono ? '13px' : '17px', fontWeight: 800, color: '#fff', fontFamily: s.mono ? '"JetBrains Mono",monospace' : 'inherit', lineHeight: 1 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* License — membership card */}
        <div className="glass" style={{ position: 'relative', overflow: 'hidden', padding: '10px 11px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 9,
          border: isStaff ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(255,255,255,0.08)' }}>
          <div className="glass-aurora" />
          <div style={{ position: 'relative', width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(140deg, rgba(124,58,237,0.5), rgba(103,232,249,0.22))', border: '1px solid rgba(167,139,250,0.4)',
            boxShadow: '0 2px 10px -3px rgba(124,58,237,0.6), inset 0 1px 0 rgba(255,255,255,0.2)' }}>
            <svg style={{ width: 14, height: 14, color: '#fff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>
          </div>
          <div style={{ position: 'relative', minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
              <p style={{ fontSize: '8px', color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>{identityLabel}</p>
              {isStaff && <span style={{ fontSize: '7px', fontWeight: 800, padding: '1px 6px', borderRadius: 99, background: 'rgba(124,58,237,0.28)', color: '#d6c8ff', border: '1px solid rgba(167,139,250,0.45)', letterSpacing: '0.12em' }}>STAFF</span>}
            </div>
            {isStaff ? (
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#d6c8ff', margin: 0 }}>Staff Access</p>
            ) : hasDiscord ? (
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'oklch(0.88 0.05 280)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={discordUsername}>{discordUsername}</p>
            ) : (
              <p style={{ fontSize: '8.5px', color: 'oklch(0.88 0.025 285)', fontFamily: '"JetBrains Mono",monospace', margin: 0, wordBreak: 'break-all', lineHeight: 1.35, userSelect: 'text', cursor: 'text' }}>{licenseKey}</p>
            )}
            <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '8px', color: 'oklch(0.7 0.035 281)', marginTop: 3 }}>
              <svg style={{ width: 9, height: 9 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
              Expires {expiry}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
