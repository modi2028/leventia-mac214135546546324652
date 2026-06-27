import React, { useState, useEffect, useCallback } from 'react'
import type { LeaderboardMetric, LeaderboardEntry } from '../types'

const TABS: { id: LeaderboardMetric; label: string; unit: string }[] = [
  { id: 'launches',   label: 'Launches',    unit: 'launches' },
  { id: 'hours',      label: 'Hours',       unit: 'hours' },
  { id: 'streak',     label: 'Streak',      unit: 'days' },
  { id: 'maxsession', label: 'Max Session', unit: 'alts' },
]

const MEDAL = ['#fbbf24', '#cbd5e1', '#d8884a'] // gold, silver, bronze

function initial(name: string) { return (name?.[0] ?? '?').toUpperCase() }

function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return `hsl(${h} 55% 45%)`
}

// Build a Discord CDN avatar URL from the user's id + avatar hash. Falls back to
// Discord's default avatar (by id) when there's no custom one.
function discordAvatarUrl(id?: string | null, hash?: string | null): string | null {
  if (!id) return null
  if (hash) {
    const ext = hash.startsWith('a_') ? 'gif' : 'png'
    return `https://cdn.discordapp.com/avatars/${id}/${hash}.${ext}?size=128`
  }
  try { return `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(id) >> 22n) % 6n)}.png` } catch { return null }
}

function Avatar({ name, size, url }: { name: string; size: number; url?: string | null }) {
  const [failed, setFailed] = useState(false)
  if (url && !failed) {
    return (
      <img src={url} alt={name} onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)' }} />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.42, border: '1px solid rgba(255,255,255,0.12)',
    }}>
      {initial(name)}
    </div>
  )
}

function RoleBadge({ role }: { role: string | null }) {
  if (!role || role === 'standard') return null
  const map: Record<string, { label: string; color: string; bg: string }> = {
    staff:  { label: 'STAFF',  color: '#c4b5fd', bg: 'rgba(124,58,237,0.2)' },
    club33: { label: 'CLUB33', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  }
  const m = map[role]
  if (!m) return null
  return <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: m.bg, color: m.color, letterSpacing: '0.08em' }}>{m.label}</span>
}

// ── Podium column for one of the top 3 ────────────────────────────────────────
const SHADOW = '0 1px 5px rgba(0,0,0,0.85)'   // keeps text readable over any background
function Podium({ entry, place, unit }: { entry: LeaderboardEntry; place: 0 | 1 | 2; unit: string }) {
  const heights = [120, 92, 76]            // 1st tallest
  const order   = place === 0 ? 2 : place === 1 ? 1 : 3   // 1st in the middle
  const size    = place === 0 ? 62 : 50
  const medal   = MEDAL[place]
  return (
    <div style={{ order, display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
      {/* medal */}
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: medal, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a1a1a', fontWeight: 800, fontSize: 13, marginBottom: 8, boxShadow: `0 0 14px ${medal}aa, 0 2px 6px rgba(0,0,0,0.5)` }}>
        {place + 1}
      </div>
      <div style={{ borderRadius: '50%', boxShadow: `0 0 0 2px ${medal}, 0 4px 14px rgba(0,0,0,0.5)` }}>
        <Avatar name={entry.username} size={size} url={discordAvatarUrl(entry.discordId, entry.avatar)} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 9, maxWidth: '100%' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', textShadow: SHADOW, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.username}</span>
        <RoleBadge role={entry.role} />
      </div>
      <p style={{ fontSize: place === 0 ? 26 : 19, fontWeight: 800, color: '#e9e2ff', fontFamily: '"JetBrains Mono", monospace', margin: '6px 0 0', lineHeight: 1, textShadow: '0 0 14px rgba(167,139,250,0.7), 0 1px 4px rgba(0,0,0,0.8)' }}>
        {entry.value}
      </p>
      <p style={{ fontSize: 8.5, fontWeight: 700, color: '#cbb9ff', textTransform: 'uppercase', letterSpacing: '0.16em', marginTop: 5, textShadow: SHADOW }}>{unit}</p>
      {/* pedestal */}
      <div style={{
        position: 'relative', width: '82%', height: heights[place], marginTop: 12, borderRadius: '12px 12px 0 0',
        background: `linear-gradient(180deg, ${medal}40 0%, ${medal}10 45%, rgba(124,58,237,0.06) 100%)`,
        border: `1px solid ${medal}55`, borderBottom: 'none',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflow: 'hidden',
      }}>
        <span style={{ fontSize: place === 0 ? 40 : 30, fontWeight: 900, color: `${medal}3a`, marginTop: 10, fontFamily: '"JetBrains Mono", monospace', lineHeight: 1 }}>{place + 1}</span>
      </div>
    </div>
  )
}

export function LeaderboardPage() {
  const [metric, setMetric]   = useState<LeaderboardMetric>('launches')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (m: LeaderboardMetric, silent = false) => {
    if (!silent) setLoading(true)
    try { setEntries(await window.electron.store.leaderboard(m)) }
    catch { if (!silent) setEntries([]) }
    finally { if (!silent) setLoading(false) }
  }, [])

  // Load on metric change, then silently auto-refresh every 20s so the board
  // updates live as people launch / climb — no spinner flicker on refresh.
  useEffect(() => {
    load(metric)
    const id = setInterval(() => load(metric, true), 20000)
    return () => clearInterval(id)
  }, [metric, load])

  const unit = TABS.find(t => t.id === metric)!.unit
  const top3 = entries.slice(0, 3)
  const rest = entries.slice(3)

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '0.02em' }}>Leaderboard</h1>
            <p style={{ fontSize: 10, color: 'oklch(0.7 0.035 281)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.18em' }}>Global Rankings · All Alting Users</p>
          </div>
          <button className="btn-ghost" onClick={() => load(metric)}>Refresh</button>
        </div>

        {/* Tabs */}
        <div className="glass" style={{ display: 'flex', gap: 2, padding: 4, marginBottom: 20 }}>
          <div className="glass-aurora" />
          {TABS.map(t => {
            const active = metric === t.id
            return (
              <button key={t.id} onClick={() => setMetric(t.id)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  background: active ? 'var(--grad-btn)' : 'rgba(255,255,255,0.04)',
                  color: active ? '#fff' : 'oklch(0.9 0.022 285)',
                  boxShadow: active ? '0 2px 12px rgba(124,58,237,0.45)' : 'none' }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'; (e.currentTarget as HTMLElement).style.color = '#fff' } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = 'oklch(0.9 0.022 285)' } }}>
                {t.label}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ width: 22, height: 22, border: '2px solid rgba(124,58,237,0.4)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spinSlow 0.7s linear infinite' }} />
          </div>
        ) : entries.length === 0 ? (
          <div className="glass" style={{ padding: 50, textAlign: 'center' }}>
            <div className="glass-aurora" />
            <p style={{ fontSize: 14, fontWeight: 600, color: 'oklch(0.78 0.035 283)' }}>No rankings yet</p>
            <p style={{ fontSize: 11, color: 'oklch(0.66 0.03 280)', marginTop: 6 }}>Launch some alts to climb the board.</p>
          </div>
        ) : (<>
          {/* Podium — on a glass backing so names/scores stay readable over the bg */}
          {top3.length > 0 && (
            <div className="glass" style={{ position: 'relative', overflow: 'hidden', padding: '22px 16px 0', marginBottom: 16 }}>
              <div className="glass-aurora" />
              <p style={{ position: 'relative', fontSize: 9, fontWeight: 700, color: 'oklch(0.78 0.035 283)', textTransform: 'uppercase', letterSpacing: '0.18em', textAlign: 'center', margin: '0 0 14px' }}>
                Top 3 · {unit}
              </p>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                {top3.map((e, i) => <Podium key={e.username + i} entry={e} place={i as 0 | 1 | 2} unit={unit} />)}
              </div>
            </div>
          )}

          {/* List #4+ */}
          {rest.length > 0 && (
            <div className="glass" style={{ overflow: 'hidden' }}>
              <div className="glass-aurora" />
              {rest.map((e, i) => (
                <div key={e.username + i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderBottom: i < rest.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'oklch(0.7 0.035 281)', width: 28, fontFamily: '"JetBrains Mono", monospace' }}>#{i + 4}</span>
                  <Avatar name={e.username} size={30} url={discordAvatarUrl(e.discordId, e.avatar)} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#e0d7ff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.username}</span>
                  <RoleBadge role={e.role} />
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)', fontFamily: '"JetBrains Mono", monospace' }}>
                    {e.value}{metric === 'streak' ? ' days' : metric === 'maxsession' ? ' alts' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>)}
      </div>
    </div>
  )
}
