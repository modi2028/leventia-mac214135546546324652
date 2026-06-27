import React from 'react'
import type { RobloxAccount } from '../types'
import { tagColors } from './AccountContextMenu'
import { isAccountTooNew, ageLabel } from '../account-age'

interface Props {
  account: RobloxAccount
  selected: boolean
  onToggle: () => void
  onContextMenu: (x: number, y: number) => void
  isRefreshing: boolean
  isRunning: boolean
  isEven: boolean
}

function StatusPill({ status }: { status: RobloxAccount['status'] }) {
  const cfg = {
    online:   { cls: 'status-online',  dot: 'oklch(0.74 0.18 150)', label: 'Online',  pulse: true },
    'in-game':{ cls: 'status-ingame',  dot: '#60a5fa',              label: 'In Game', pulse: true },
    studio:   { cls: 'status-studio',  dot: '#fb923c',              label: 'Studio',  pulse: false },
    offline:  { cls: 'status-offline', dot: 'oklch(0.68 0.035 280)', label: 'Offline', pulse: false },
    unknown:  { cls: 'status-offline', dot: 'oklch(0.68 0.035 280)', label: 'Unknown', pulse: false },
  }[status] ?? { cls: 'status-offline', dot: 'oklch(0.68 0.035 280)', label: 'Unknown', pulse: false }

  return (
    <span className={cfg.cls}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
        background: cfg.dot,
        boxShadow: cfg.pulse ? `0 0 6px ${cfg.dot}` : 'none',
        animation: cfg.pulse ? 'glowPulse 2s ease-in-out infinite' : 'none',
      }} />
      {cfg.label}
    </span>
  )
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) }
  catch { return '—' }
}

export function AccountRow({ account, selected, onToggle, onContextMenu, isRefreshing, isRunning, isEven }: Props) {
  // If we launched this account, show it as in-game immediately without waiting for presence API
  const displayStatus: RobloxAccount['status'] = isRunning ? 'in-game' : account.status
  return (
    <tr
      onClick={onToggle}
      onContextMenu={e => { e.preventDefault(); onContextMenu(e.clientX, e.clientY) }}
      style={{
        cursor: 'pointer',
        transition: 'background 0.2s ease',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: selected
          ? 'rgba(124,58,237,0.1)'
          : isRunning
            ? 'rgba(34,197,94,0.04)'
            : isEven ? 'transparent' : 'rgba(255,255,255,0.01)',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = isRunning ? 'rgba(34,197,94,0.07)' : 'rgba(255,255,255,0.04)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = selected ? 'rgba(124,58,237,0.1)' : isRunning ? 'rgba(34,197,94,0.04)' : isEven ? 'transparent' : 'rgba(255,255,255,0.01)' }}
    >
      {/* Checkbox */}
      <td style={{ paddingLeft: 16, paddingRight: 8, paddingTop: 10, paddingBottom: 10, width: 40 }} onClick={e => e.stopPropagation()}>
        <div onClick={onToggle} style={{
          width: 14, height: 14, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s',
          background: selected ? 'linear-gradient(135deg, oklch(0.62 0.22 280), oklch(0.55 0.24 295))' : 'transparent',
          border: selected ? 'none' : '1px solid rgba(255,255,255,0.18)',
          boxShadow: selected ? '0 2px 8px rgba(124,58,237,0.5)' : 'none',
        }}>
          {selected && <svg style={{ width: 10, height: 10, color: 'white' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
        </div>
      </td>

      {/* Avatar */}
      <td style={{ padding: '8px', width: 44 }}>
        <div style={{ position: 'relative', width: 32, height: 32 }}>
          {account.avatarUrl ? (
            <img src={account.avatarUrl} alt={account.username} loading="lazy"
              style={{ width: 32, height: 32, borderRadius: 10, objectFit: 'cover', border: '1px solid rgba(167,139,250,0.25)' }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg style={{ width: 14, height: 14, color: 'rgba(167,139,250,0.5)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
            </div>
          )}
          {isRefreshing && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'rgba(8,6,20,0.75)' }}>
              <div style={{ width: 12, height: 12, border: '1.5px solid #a78bfa', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spinSlow 0.7s linear infinite' }} />
            </div>
          )}
          {/* Live indicator dot — top-right corner of avatar */}
          {isRunning && !isRefreshing && (
            <div style={{
              position: 'absolute', top: -3, right: -3,
              width: 9, height: 9, borderRadius: '50%',
              background: 'oklch(0.74 0.18 150)',
              border: '2px solid rgba(8,6,20,0.9)',
              boxShadow: '0 0 6px oklch(0.74 0.18 150 / 0.8)',
              animation: 'glowPulse 1.5s ease-in-out infinite',
              zIndex: 2,
            }} />
          )}
        </div>
      </td>

      {/* Username */}
      <td style={{ padding: '10px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {account.favorite && (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-label="Favorite" style={{ width: 13, height: 13, color: '#fbbf24', flexShrink: 0, filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.5))' }}>
              <path d="M11.48 3.5a.56.56 0 011.04 0l2.12 5.11a.56.56 0 00.48.35l5.52.44c.5.04.7.66.32.99l-4.2 3.6a.56.56 0 00-.18.56l1.28 5.38a.56.56 0 01-.84.61l-4.72-2.88a.56.56 0 00-.59 0l-4.72 2.88a.56.56 0 01-.84-.61l1.28-5.38a.56.56 0 00-.18-.56l-4.2-3.6a.56.56 0 01.32-.99l5.52-.44a.56.56 0 00.48-.35L11.48 3.5z" />
            </svg>
          )}
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{account.username}</p>
            {account.displayName !== account.username && <p style={{ fontSize: 11, color: 'oklch(0.82 0.035 284)', marginTop: 3 }}>{account.displayName}</p>}
          </div>
          {account.tag && (
            <span style={{
              flexShrink: 0, fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: 99,
              whiteSpace: 'nowrap', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis',
              background: tagColors(account.tag).bg, color: tagColors(account.tag).fg, border: `1px solid ${tagColors(account.tag).bd}`,
            }}>{account.tag}</span>
          )}
          {isAccountTooNew(account.created) && (
            <span title={`Under 3 days old (${ageLabel(account.created)}) — can't join yet`} style={{
              flexShrink: 0, fontSize: '9px', fontWeight: 800, padding: '2px 7px', borderRadius: 99, letterSpacing: '0.04em',
              background: 'rgba(251,191,36,0.14)', color: '#fcd34d', border: '1px solid rgba(251,191,36,0.4)',
            }}>NEW</span>
          )}
        </div>
      </td>

      {/* User ID */}
      <td style={{ padding: '10px 8px' }}>
        <span style={{ fontSize: 12, fontFamily: '"JetBrains Mono",monospace', color: 'oklch(0.88 0.025 285)', fontWeight: 500 }}>#{account.userId}</span>
      </td>

      {/* Group */}
      <td style={{ padding: '10px 8px' }}>
        {account.group && account.group !== 'None' ? (
          <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: 'rgba(59,130,246,0.18)', color: '#bfdbfe', border: '1px solid rgba(59,130,246,0.35)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {account.group}
          </span>
        ) : <span style={{ color: 'oklch(0.74 0.03 282)', fontSize: 14 }}>—</span>}
      </td>

      {/* Status */}
      <td style={{ padding: '10px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StatusPill status={displayStatus} />
          {account.cookie && (
            <span
              title={account.cookieStatus === 'expired' ? 'Cookie expired — re-add this account' : account.cookieStatus === 'unknown' ? 'Cookie status unknown' : 'Cookie stored — can join servers'}
              style={{ color: account.cookieStatus === 'expired' ? '#f87171' : account.cookieStatus === 'unknown' ? '#fbbf24' : 'oklch(0.74 0.18 150)', opacity: account.cookieStatus === 'expired' ? 0.9 : 0.55 }}
            >
              <svg style={{ width: 10, height: 10 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>
            </span>
          )}
          {account.cookieStatus === 'expired' && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Expired
            </span>
          )}
        </div>
      </td>

      {/* Added */}
      <td style={{ padding: '10px 8px' }}>
        <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono",monospace', color: 'oklch(0.86 0.03 285)', fontWeight: 500 }}>{fmtDate(account.addedAt)}</span>
      </td>

      {/* Refreshed */}
      <td style={{ padding: '10px 16px 10px 8px' }}>
        <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono",monospace', color: 'oklch(0.86 0.03 285)', fontWeight: 500 }}>{fmtDate(account.refreshedAt)}</span>
      </td>
    </tr>
  )
}
