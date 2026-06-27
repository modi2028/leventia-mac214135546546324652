import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { AppSettings, RobloxAccount, ServerDetail, ServerPlayerDetail } from '../types'
import mapFall from '../assets/maps/fall_blank.png'
import mapSnow from '../assets/maps/snow_blank.png'
import mapPostal from '../assets/maps/fall_postals.png'

interface Props { settings: AppSettings; onSave: (s: AppSettings) => void }

const POLL_MS = 8000

// Map a team (+ alt flag) to a legend category and color.
function catOf(team: string, isAlt: boolean): { id: string; label: string; color: string } {
  if (isAlt) return { id: 'alt', label: 'Your Alt', color: '#a78bfa' }
  if (team === 'Police' || team === 'Sheriff') return { id: 'leo', label: 'LEO', color: '#60a5fa' }
  if (team === 'Fire') return { id: 'fire', label: 'Fire/EMS', color: '#f87171' }
  if (team === 'Civilian') return { id: 'civ', label: 'Civilian', color: '#4ade80' }
  return { id: 'other', label: team || 'Other', color: '#fbbf24' }
}
function permBadge(perm: string): string | null {
  if (perm === 'Server Owner') return 'Owner'
  if (perm === 'Server Administrator') return 'Admin'
  if (perm === 'Server Moderator') return 'Mod'
  return null
}
function relTime(unix: number): string {
  if (!unix) return ''
  const s = Math.max(0, Math.floor(Date.now() / 1000 - unix))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const LEGEND = [
  { label: 'LEO', color: '#60a5fa' },
  { label: 'Fire/EMS', color: '#f87171' },
  { label: 'Civilian', color: '#4ade80' },
  { label: 'Your Alts', color: '#a78bfa' },
  { label: 'Other', color: '#fbbf24' },
]

// Official PRC Liberty County map imagery, bundled locally (downscaled from the api.erlc.gg CDN
// originals) so it loads instantly and offline instead of fetching ~6.5 MB each time.
const MAP_URLS: Record<'fall' | 'snow' | 'postal', string> = {
  fall: mapFall,
  snow: mapSnow,
  postal: mapPostal,
}
const SEASONS: { id: 'fall' | 'snow' | 'postal'; label: string }[] = [
  { id: 'fall', label: '🍂 Fall' },
  { id: 'snow', label: '❄️ Winter' },
  { id: 'postal', label: '📮 Postal' },
]
// World coordinates (LocationX/Z) → 0–100% across the square map image.
// ER:LC's world origin is NOT the map centre — spawn sits at roughly (+940, +2500) —
// so a symmetric range throws everything off. These defaults place spawn on River City;
// the in-map "Calibrate" tool lets each user lock it exactly to their own data.
export interface MapCal { xMin: number; xMax: number; zMin: number; zMax: number }
const DEFAULT_CAL: MapCal = { xMin: -1500, xMax: 4500, zMin: -1500, zMax: 4500 }
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
function worldToPercent(lx: number, lz: number, c: MapCal) {
  return {
    x: clamp(((lx - c.xMin) / (c.xMax - c.xMin)) * 100, 0, 100),
    y: clamp(((lz - c.zMin) / (c.zMax - c.zMin)) * 100, 0, 100),
  }
}

// ER:LC's API doesn't broadcast live coordinates, so we scatter each player to a
// stable pseudo-random spot on the island (24%–76%) keyed off their id, so the map
// looks alive and dots don't jump around between refreshes.
function scatterPos(seed: string): { x: number; y: number } {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  const a = ((h >>> 0) % 10000) / 10000
  const b = ((h >>> 13 >>> 0) % 10000) / 10000
  return { x: 24 + a * 52, y: 24 + b * 52 }
}

export function ServerManagementSection({ settings, onSave }: Props) {
  const [keyInput, setKeyInput] = useState(settings.autoAlt?.serverKey ?? '')
  const [data, setData] = useState<ServerDetail | null>(null)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [accounts, setAccounts] = useState<RobloxAccount[]>([])
  const [lastUpdate, setLastUpdate] = useState<number>(0)
  const [season, setSeason] = useState<'fall' | 'snow' | 'postal'>('fall')
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapErr, setMapErr] = useState(false)
  const [cursor, setCursor] = useState<{ x: number; z: number } | null>(null)
  const [calibrating, setCalibrating] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Active map calibration (persisted per user; falls back to the spawn-tuned default).
  const cal: MapCal = settings.mapCal ?? DEFAULT_CAL

  const altNames = useMemo(() => new Set(accounts.map(a => a.username.toLowerCase())), [accounts])

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }

  const refresh = useCallback(async (key: string) => {
    const r = await window.electron.serverMap.fetch(key)
    setData(r)
    setLastUpdate(Date.now())
    if (!r.ok) { setError(r.error ?? 'Could not connect.'); setConnected(false); stopPoll() }
    else { setError(''); setConnected(true) }
    return r
  }, [])

  const connect = async () => {
    const key = keyInput.trim()
    if (!key) return
    setLoading(true); setError('')
    onSave({ ...settings, autoAlt: { ...settings.autoAlt, serverKey: key } })
    const r = await refresh(key)
    setLoading(false)
    if (r.ok) { stopPoll(); pollRef.current = setInterval(() => refresh(key), POLL_MS) }
  }

  const disconnect = () => { stopPoll(); setConnected(false); setData(null); setError('') }

  // Auto-connect on mount if a key is already saved (keeps the panel live across tab switches).
  useEffect(() => {
    const key = (settings.autoAlt?.serverKey ?? '').trim()
    window.electron.store.getAccounts().then(setAccounts).catch(() => {})
    if (key) {
      setLoading(true)
      refresh(key).then(r => { setLoading(false); if (r.ok) { stopPoll(); pollRef.current = setInterval(() => refresh(key), POLL_MS) } })
    }
    return stopPoll
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──
  const players = useMemo(() => (data?.playerList ?? []).map(p => {
    const isAlt = altNames.has(p.name.toLowerCase())
    return { ...p, isAlt, cat: catOf(p.team, isAlt) }
  }), [data, altNames])

  const altCount = players.filter(p => p.isAlt).length
  const extraCount = players.filter(p => p.cat.id === 'other').length
  const sorted = [...players].sort((a, b) => Number(b.isAlt) - Number(a.isAlt) || a.name.localeCompare(b.name))
  // Every player gets a map position: real coords if the API ever provides them,
  // otherwise a stable scattered spot so the server still shows up on the map.
  const plotted = players.map(p => ({
    ...p,
    pos: (p.locationX != null && p.locationZ != null)
      ? worldToPercent(p.locationX, p.locationZ, cal)
      : scatterPos(`${p.name}:${p.userId}`),
  }))
  const tipFor = (p: typeof players[number]) =>
    [p.name, p.cat.label, p.callsign || null, p.street || null, p.postal ? `Postal ${p.postal}` : null, p.wanted ? `★${p.wanted} wanted` : null,
     p.locationX != null && p.locationZ != null ? `@ X ${Math.round(p.locationX)}, Z ${Math.round(p.locationZ)}` : null]
      .filter(Boolean).join('  ·  ')

  // Calibration reference = the real coords of your alts (or all plotted players if none).
  const calRef = (() => {
    const alts = plotted.filter(p => p.isAlt)
    const pool = alts.length ? alts : plotted
    if (!pool.length) return null
    return { x: pool.reduce((s, p) => s + (p.locationX ?? 0), 0) / pool.length, z: pool.reduce((s, p) => s + (p.locationZ ?? 0), 0) / pool.length }
  })()

  // One-click calibration: map the reference players' real coords onto the clicked pixel,
  // keeping the current span (scale). Persists so the map stays aligned across sessions.
  const calibrateAt = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!calibrating || !calRef) { setCalibrating(false); return }
    const r = e.currentTarget.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width
    const fz = (e.clientY - r.top) / r.height
    const spanX = cal.xMax - cal.xMin
    const spanZ = cal.zMax - cal.zMin
    const xMin = calRef.x - fx * spanX
    const zMin = calRef.z - fz * spanZ
    onSave({ ...settings, mapCal: { xMin, xMax: xMin + spanX, zMin, zMax: zMin + spanZ } })
    setCalibrating(false)
  }
  const resetCal = () => { onSave({ ...settings, mapCal: undefined }); setCalibrating(false) }

  // ── Connect gate ──
  if (!connected) {
    return (
      <div className="glass" style={{ padding: 28, maxWidth: 460, margin: '24px auto', textAlign: 'center' }}>
        <div className="glass-aurora" />
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(167,139,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <svg style={{ width: 24, height: 24, color: '#a78bfa' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" /></svg>
        </div>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: 0 }}>Server Management</h2>
        <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 6, lineHeight: 1.6 }}>Connect your ER:LC server key to see live players, queue, staff, your alts, and activity.</p>
        <input className="input-base w-full" style={{ marginTop: 16, marginBottom: 10, fontFamily: '"JetBrains Mono", monospace' }} placeholder="ER:LC server key" value={keyInput} onChange={e => setKeyInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && connect()} />
        {error && <p style={{ fontSize: 11, color: '#f87171', marginBottom: 10 }}>{error}</p>}
        <button className="btn-accent w-full" style={{ padding: '10px 0', justifyContent: 'center', gap: 6 }} onClick={connect} disabled={loading || !keyInput.trim()}>
          {loading ? <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spinSlow 0.7s linear infinite', display: 'inline-block' }} /> : null}
          {loading ? 'Connecting…' : 'Connect'}
        </button>
        <p style={{ fontSize: 9.5, color: 'oklch(0.66 0.03 280)', marginTop: 10 }}>Shares the key with Auto Alting. The map is a live data dashboard — ER:LC doesn't expose player coordinates.</p>
      </div>
    )
  }

  // ── Connected dashboard ──
  const StatChip = ({ icon, label, value, color }: { icon: string; label: string; value: React.ReactNode; color: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <div>
        <p style={{ fontSize: 8, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 14, fontWeight: 800, color, fontFamily: '"JetBrains Mono", monospace', lineHeight: 1.1, marginTop: 2 }}>{value}</p>
      </div>
    </div>
  )

  return (
    <>
      {/* Status bar */}
      <div className="glass" style={{ padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="glass-aurora" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', animation: 'glowPulse 1.6s ease-in-out infinite', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data?.name ?? 'Connected'}</p>
            <p style={{ fontSize: 9.5, color: 'oklch(0.7 0.035 281)', marginTop: 1 }}>Live · updated {relTime(Math.floor(lastUpdate / 1000)) || 'now'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <StatChip icon="🟢" label="Players" value={`${data?.players ?? 0}/${data?.maxPlayers ?? 0}`} color="#4ade80" />
          <StatChip icon="🕐" label="Queue" value={data?.queue ?? 0} color="#fbbf24" />
          <StatChip icon="👥" label="Alts" value={altCount} color="#c4b5fd" />
          <StatChip icon="🛡️" label="Staff" value={data?.staffCount ?? 0} color="#60a5fa" />
          <StatChip icon="➕" label="Extra" value={extraCount} color="#fb923c" />
          <button onClick={disconnect} title="Disconnect"
            style={{ padding: '7px 12px', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
            Disconnect
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)', gap: 12, alignItems: 'start' }}>
        {/* ── Live map (real PRC Liberty County imagery + real player positions) ── */}
        <div className="glass" style={{ position: 'relative', overflow: 'hidden', aspectRatio: '1 / 1', padding: 0, cursor: calibrating ? 'crosshair' : 'default' }}
          onClick={calibrateAt}
          onMouseMove={e => {
            const r = e.currentTarget.getBoundingClientRect()
            setCursor({
              x: Math.round(cal.xMin + ((e.clientX - r.left) / r.width) * (cal.xMax - cal.xMin)),
              z: Math.round(cal.zMin + ((e.clientY - r.top) / r.height) * (cal.zMax - cal.zMin)),
            })
          }}
          onMouseLeave={() => setCursor(null)}>
          {/* dark base + grid fallback (shown until/if the map image loads) */}
          <div style={{ position: 'absolute', inset: 0, background: '#07070e' }} />
          <div className="bg-grid" style={{ opacity: 0.4 }} />
          {/* official PRC map image */}
          {!mapErr && (
            <img src={MAP_URLS[season]} alt="Liberty County" draggable={false}
              onLoad={() => setMapLoaded(true)} onError={() => setMapErr(true)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', opacity: mapLoaded ? 1 : 0, transition: 'opacity .45s ease' }} />
          )}
          {/* vignette for marker contrast */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 58%, rgba(7,7,14,0.5))', boxShadow: 'inset 0 0 48px rgba(0,0,0,0.45)' }} />

          {/* live player markers */}
          {plotted.map(p => {
            const pos = p.pos
            const d = p.isAlt ? 13 : 9
            return (
              <div key={p.userId || p.name} title={tipFor(p)}
                style={{ position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%,-50%)', zIndex: p.isAlt ? 6 : 4, transition: 'left .8s ease, top .8s ease' }}>
                {p.isAlt && <span style={{ position: 'absolute', top: '50%', left: '50%', width: 22, height: 22, transform: 'translate(-50%,-50%)', borderRadius: '50%', border: '1.5px solid rgba(167,139,250,0.65)', animation: 'glowPulse 1.8s ease-in-out infinite' }} />}
                <span style={{ display: 'block', width: d, height: d, borderRadius: '50%', background: p.cat.color, border: p.wanted ? '1.5px solid #ef4444' : '1.5px solid rgba(0,0,0,0.65)', boxShadow: `0 0 7px ${p.cat.color}` }} />
              </div>
            )
          })}

          {/* season toggle */}
          <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 3, padding: 3, borderRadius: 9, background: 'rgba(8,6,20,0.72)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', zIndex: 10 }}>
            {SEASONS.map(s => (
              <button key={s.id} onClick={() => { setSeason(s.id); setMapLoaded(false); setMapErr(false) }}
                style={{ padding: '4px 9px', borderRadius: 6, fontSize: 10, fontWeight: 600, border: 'none', cursor: 'pointer', background: season === s.id ? 'rgba(124,58,237,0.45)' : 'transparent', color: season === s.id ? '#e0d7ff' : 'oklch(0.78 0.035 283)' }}>
                {s.label}
              </button>
            ))}
          </div>

          {/* player count */}
          <div style={{ position: 'absolute', top: 10, right: 10, padding: '5px 11px', borderRadius: 9, background: 'rgba(8,6,20,0.72)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', zIndex: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: '"JetBrains Mono", monospace' }}>{data?.players ?? 0}</span>
            <span style={{ fontSize: 11, color: 'oklch(0.7 0.035 281)' }}> / {data?.maxPlayers ?? 0}</span>
          </div>

          {/* legend */}
          <div style={{ position: 'absolute', bottom: 10, left: 10, display: 'flex', flexWrap: 'wrap', gap: '4px 10px', maxWidth: 230, padding: '8px 11px', borderRadius: 11, background: 'rgba(8,6,20,0.72)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
            {LEGEND.map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5, color: 'oklch(0.9 0.022 285)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: l.color, boxShadow: `0 0 5px ${l.color}` }} />
                {l.label}
              </div>
            ))}
          </div>

          {/* approximate-positions caption (ER:LC's API doesn't broadcast live coords) */}
          {data && data.players > 0 && (
            <div style={{ position: 'absolute', bottom: 10, right: 10, maxWidth: 150, padding: '6px 10px', borderRadius: 9, background: 'rgba(8,6,20,0.82)', border: '1px solid rgba(255,255,255,0.12)', fontSize: 8.5, lineHeight: 1.4, color: 'oklch(0.78 0.035 283)', zIndex: 10 }}>
              Approximate placement — ER:LC doesn't broadcast live coordinates
            </div>
          )}

          {/* live cursor coordinate readout (only meaningful when coords exist) */}
          {cursor && plotted.length > 0 && (
            <div style={{ position: 'absolute', bottom: 10, right: 10, padding: '4px 9px', borderRadius: 8, background: 'rgba(8,6,20,0.78)', border: '1px solid rgba(255,255,255,0.12)', fontSize: 9.5, fontFamily: '"JetBrains Mono", monospace', color: 'oklch(0.86 0.03 285)', zIndex: 10, pointerEvents: 'none' }}>
              X {cursor.x}  ·  Z {cursor.z}
            </div>
          )}

          {/* Calibrate control (top-centre) */}
          {calRef && (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5, zIndex: 11 }}>
              <button onClick={e => { e.stopPropagation(); setCalibrating(c => !c) }}
                style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, border: '1px solid ' + (calibrating ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.12)'), cursor: 'pointer', background: calibrating ? 'rgba(124,58,237,0.55)' : 'rgba(8,6,20,0.72)', color: calibrating ? '#fff' : 'oklch(0.9 0.022 285)', backdropFilter: 'blur(8px)' }}>
                {calibrating ? '✕ Cancel' : '📍 Calibrate'}
              </button>
              {settings.mapCal && !calibrating && (
                <button onClick={e => { e.stopPropagation(); resetCal() }} title="Reset to default"
                  style={{ padding: '4px 9px', borderRadius: 8, fontSize: 10, fontWeight: 600, border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', background: 'rgba(8,6,20,0.72)', color: 'oklch(0.78 0.035 283)', backdropFilter: 'blur(8px)' }}>
                  Reset
                </button>
              )}
            </div>
          )}

          {/* Calibration instruction banner */}
          {calibrating && (
            <div style={{ position: 'absolute', top: 44, left: '50%', transform: 'translateX(-50%)', maxWidth: 320, padding: '7px 13px', borderRadius: 9, background: 'rgba(124,58,237,0.92)', border: '1px solid rgba(167,139,250,0.7)', fontSize: 10.5, fontWeight: 600, color: '#fff', zIndex: 12, textAlign: 'center', lineHeight: 1.45, pointerEvents: 'none', boxShadow: '0 6px 20px rgba(0,0,0,0.4)' }}>
              Click the exact spot on the map where your alts are standing — I'll lock every marker to that.
            </div>
          )}
        </div>

        {/* ── Right column: players + activity ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {/* Players */}
          <div className="glass" style={{ display: 'flex', flexDirection: 'column', maxHeight: 372, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.78 0.035 283)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>Players · {players.length}</p>
              <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
                {(['list', 'grid'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)} title={v}
                    style={{ width: 24, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', cursor: 'pointer', background: view === v ? 'rgba(124,58,237,0.3)' : 'transparent', color: view === v ? '#c4b5fd' : 'oklch(0.7 0.035 281)' }}>
                    {v === 'list'
                      ? <svg style={{ width: 12, height: 12 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" /></svg>
                      : <svg style={{ width: 12, height: 12 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ overflowY: 'auto', padding: view === 'grid' ? 8 : 0 }}>
              {players.length === 0 ? (
                <p style={{ fontSize: 11, color: 'oklch(0.7 0.035 281)', textAlign: 'center', padding: '24px 0' }}>Server is empty.</p>
              ) : view === 'list' ? (
                sorted.map(p => {
                  const pb = permBadge(p.permission)
                  return (
                    <div key={p.userId || p.name} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: p.isAlt ? 'rgba(124,58,237,0.07)' : 'transparent' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.cat.color, boxShadow: `0 0 5px ${p.cat.color}`, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: '#e0d7ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}{p.callsign && <span style={{ color: 'oklch(0.7 0.035 281)', fontFamily: '"JetBrains Mono", monospace', fontWeight: 400, fontSize: 10 }}> · {p.callsign}</span>}
                      </span>
                      {p.isAlt && <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 6px', borderRadius: 99, background: 'rgba(167,139,250,0.2)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.4)' }}>ALT</span>}
                      {pb && <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 6px', borderRadius: 99, background: 'rgba(96,165,250,0.18)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.35)' }}>{pb}</span>}
                      <span style={{ fontSize: 9.5, color: p.cat.color, fontWeight: 600, flexShrink: 0 }}>{p.cat.label}</span>
                    </div>
                  )
                })
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {sorted.map(p => (
                    <div key={p.userId || p.name} style={{ padding: '8px 10px', borderRadius: 9, background: p.isAlt ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${p.isAlt ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.07)'}`, borderLeft: `3px solid ${p.cat.color}` }}>
                      <p style={{ fontSize: 11.5, fontWeight: 700, color: '#e0d7ff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                      <p style={{ fontSize: 9.5, color: p.cat.color, fontWeight: 600, marginTop: 2 }}>{p.cat.label}{permBadge(p.permission) ? ` · ${permBadge(p.permission)}` : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div className="glass" style={{ display: 'flex', flexDirection: 'column', maxHeight: 150, overflow: 'hidden' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.78 0.035 283)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0, padding: '12px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>Recent Activity</p>
            <div style={{ overflowY: 'auto' }}>
              {(data?.activity ?? []).length === 0 ? (
                <p style={{ fontSize: 11, color: 'oklch(0.7 0.035 281)', textAlign: 'center', padding: '18px 0' }}>No recent activity.</p>
              ) : (
                (data?.activity ?? []).map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ color: a.type === 'join' ? '#4ade80' : '#f87171', display: 'flex', flexShrink: 0 }}>
                      <svg style={{ width: 12, height: 12 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d={a.type === 'join' ? 'M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25' : 'M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25'} /></svg>
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: altNames.has(a.name.toLowerCase()) ? '#c4b5fd' : '#e0d7ff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name} <span style={{ color: 'oklch(0.7 0.035 281)', fontWeight: 400 }}>{a.type === 'join' ? 'joined' : 'left'}</span></span>
                    <span style={{ fontSize: 9.5, color: 'oklch(0.66 0.03 280)', fontFamily: '"JetBrains Mono", monospace', flexShrink: 0 }}>{relTime(a.timestamp)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
