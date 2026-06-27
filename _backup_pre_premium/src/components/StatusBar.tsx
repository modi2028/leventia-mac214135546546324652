import React from 'react'

interface Props {
  selectedCount: number
  totalCount: number
  cpuUsage: number
  usedRam: number
  totalRam: number
}

const labelColor = 'oklch(0.72 0.035 281)'

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ width: 30, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
    </div>
  )
}

function Chip({ icon, label, value, color, children }: { icon: React.ReactNode; label: string; value: string; color: string; children?: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 11px', borderRadius: 8, whiteSpace: 'nowrap',
      background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)',
    }}>
      <span style={{ color, display: 'flex' }}>{icon}</span>
      <span style={{ color: labelColor, fontSize: 10, letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#e7e2ff', fontWeight: 700, fontSize: 11 }}>{value}</span>
      {children}
    </span>
  )
}

const ICON = { width: 12, height: 12, display: 'block' as const }

export function StatusBar({ selectedCount, totalCount, cpuUsage, usedRam, totalRam }: Props) {
  const ramPct   = totalRam > 0 ? (usedRam / totalRam) * 100 : 0
  const cpuColor = cpuUsage >= 80 ? '#f87171' : cpuUsage >= 50 ? '#fbbf24' : '#4ade80'
  const selected = selectedCount > 0

  return (
    <div className="glass" style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 14px', flexShrink: 0, lineHeight: 1, whiteSpace: 'nowrap',
      borderTop: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div className="glass-aurora" />

      {/* Selection state */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: selected ? '#a78bfa' : 'oklch(0.62 0.03 280)',
          boxShadow: selected ? '0 0 7px rgba(167,139,250,0.8)' : 'none',
          transition: 'all 0.2s ease',
        }} />
        <span style={{ color: selected ? '#c4b5fd' : labelColor, fontWeight: selected ? 600 : 400, transition: 'color 0.2s ease' }}>
          {selected ? `${selectedCount} selected` : 'No selection'}
        </span>
      </span>

      {/* Metrics */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Chip color={cpuColor} label="CPU" value={`${cpuUsage}%`}
          icon={<svg style={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" /></svg>}>
          <MiniBar pct={cpuUsage} color={cpuColor} />
        </Chip>

        <Chip color="#67e8f9" label="RAM" value={`${usedRam}/${totalRam} GB`}
          icon={<svg style={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>}>
          <MiniBar pct={ramPct} color="#67e8f9" />
        </Chip>

        <Chip color="#a78bfa" label="Accounts" value={String(totalCount)}
          icon={<svg style={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>} />
      </div>
    </div>
  )
}
