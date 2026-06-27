import React from 'react'

export type FilterType = 'all' | 'online' | 'offline' | 'ready' | 'new'

interface Props {
  filter: FilterType
  onFilterChange: (f: FilterType) => void
  counts: { all: number; online: number; offline: number; ready: number; new: number }
}

const tabs: { id: FilterType; label: string; dot?: string }[] = [
  { id: 'all',     label: 'All' },
  { id: 'online',  label: 'Online',  dot: 'oklch(0.74 0.18 150)' },
  { id: 'offline', label: 'Offline', dot: 'oklch(0.68 0.035 280)' },
  { id: 'ready',   label: 'Ready',   dot: 'oklch(0.74 0.18 150)' },   // ≥3 days — safe to join
  { id: 'new',     label: 'New',     dot: 'oklch(0.7 0.2 30)' },      // <3 days — blocked from joining
]

export function FilterTabs({ filter, onFilterChange, counts }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
      {tabs.map(tab => {
        const active = filter === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onFilterChange(tab.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 8,
              fontSize: 11, fontWeight: active ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.2s ease',
              border: active ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
              background: active
                ? 'linear-gradient(90deg, rgba(124,58,237,0.22), rgba(34,211,238,0.12))'
                : 'transparent',
              color: active ? '#c4b5fd' : 'oklch(0.86 0.03 285)',
            }}
            onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = 'oklch(0.96 0.01 260)' } }}
            onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'oklch(0.86 0.03 285)' } }}
          >
            {tab.dot && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: active && tab.id === 'online' ? 'oklch(0.74 0.18 150)' : tab.dot, flexShrink: 0, boxShadow: active && tab.id === 'online' ? '0 0 6px oklch(0.74 0.18 150 / 0.6)' : 'none' }} />
            )}
            {tab.label}
            <span style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 99,
              background: active ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)',
              color: active ? '#c4b5fd' : 'oklch(0.68 0.035 280)',
            }}>
              {counts[tab.id]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
