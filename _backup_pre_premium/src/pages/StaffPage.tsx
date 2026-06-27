import React, { useState, useEffect, useCallback } from 'react'
import type { KeyRecord, UserLookupResult } from '../types'

// ── Shared helpers ────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}
function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function keyStatus(r: KeyRecord): 'active' | 'expired' | 'revoked' {
  if (r.revoked) return 'revoked'
  if (new Date(r.expiresAt) < new Date()) return 'expired'
  return 'active'
}
function maskKey(key: string) {
  const p = key.split('-')
  if (p.length < 4) return key
  return `${p[0]}-${p[1]}-****-****-${p[p.length - 1]}`
}
// 'club33' is the Premium tier; 'standard' is Basic (no Premium category).
function roleLabel(role: string) {
  return role === 'club33' ? 'Premium' : role === 'staff' ? 'Staff' : 'Basic'
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="glass" style={{ padding: '14px 18px', borderRadius: 14, flex: 1 }}>
      <div className="glass-aurora" />
      <p style={{ fontSize: 9, fontWeight: 700, color: 'oklch(0.74 0.035 282)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 800, color, fontFamily: '"JetBrains Mono", monospace', lineHeight: 1 }}>{value}</p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// KEYS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function IssueModal({ onClose, onIssued }: { onClose: () => void; onIssued: (r: KeyRecord) => void }) {
  const [months, setMonths]   = useState<1 | 3>(1)
  const [username, setUsername] = useState('')
  const [discordId, setDiscordId] = useState('')
  const [role, setRole]       = useState('standard')
  const [loading, setLoading] = useState(false)
  const [issued, setIssued]   = useState<KeyRecord | null>(null)
  const [copied, setCopied]   = useState(false)
  const [error, setError]     = useState('')

  const handleIssue = async () => {
    setLoading(true); setError('')
    try {
      const r = await window.electron.store.issueKey({
        months,
        discordUsername: username.trim() || undefined,
        discordId: discordId.trim() || undefined,
        role,
      })
      setIssued(r); onIssued(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to issue key.')
    } finally { setLoading(false) }
  }
  const copy = () => { if (issued) navigator.clipboard.writeText(issued.key).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={e => e.key === 'Escape' && !issued && onClose()}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={issued ? undefined : onClose} />
      <div className="glass animate-slide-up relative w-full max-w-sm" style={{ borderRadius: 20 }}>
        <div className="glass-aurora" />
        <div style={{ padding: '24px 24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>Issue New Key</h2>
            {!issued && <button onClick={onClose} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: 'none', color: 'oklch(0.74 0.035 282)', cursor: 'pointer' }}><svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>}
          </div>
          {!issued ? (<>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'oklch(0.74 0.035 282)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Duration</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {([1, 3] as const).map(m => (
                <button key={m} onClick={() => setMonths(m)} style={{ padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', border: months === m ? '1px solid rgba(167,139,250,0.5)' : '1px solid rgba(255,255,255,0.1)', background: months === m ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.03)', color: months === m ? '#c4b5fd' : 'oklch(0.82 0.035 284)' }}>
                  {m} Month{m > 1 ? 's' : ''}
                </button>
              ))}
            </div>
            {/* Recipient (optional but recommended — enables User Lookup) */}
            <p style={{ fontSize: 10, fontWeight: 600, color: 'oklch(0.74 0.035 282)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Recipient <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></p>
            <input className="input-base w-full" style={{ marginBottom: 8 }} placeholder="Discord username" value={username} onChange={e => setUsername(e.target.value)} />
            <input className="input-base w-full" style={{ marginBottom: 12 }} placeholder="Discord ID (numbers)" value={discordId} onChange={e => setDiscordId(e.target.value)} />

            <p style={{ fontSize: 10, fontWeight: 600, color: 'oklch(0.74 0.035 282)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Tier</p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
              {['standard', 'club33'].map(r => (
                <button key={r} onClick={() => setRole(r)} style={{ flex: 1, padding: '8px 0', borderRadius: 9, fontSize: 11, fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer', transition: 'all 0.15s',
                  border: role === r ? '1px solid rgba(167,139,250,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  background: role === r ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.03)',
                  color: role === r ? '#c4b5fd' : 'oklch(0.82 0.035 284)' }}>{roleLabel(r)}</button>
              ))}
            </div>

            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 14 }}>
              <p style={{ fontSize: 11, color: 'oklch(0.82 0.035 284)', margin: 0 }}>Expires <strong style={{ color: '#c4b5fd' }}>{new Date(Date.now() + months * 30 * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong></p>
            </div>

            {error && <p style={{ fontSize: 11, color: '#f87171', marginBottom: 12 }}>{error}</p>}

            <button className="btn-accent w-full" style={{ padding: '10px 0', fontSize: 13 }} onClick={handleIssue} disabled={loading}>
              {loading ? <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spinSlow 0.7s linear infinite', display: 'inline-block' }} /> : <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>}
              {loading ? 'Generating…' : 'Generate Key'}
            </button>
          </>) : (<>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><svg style={{ width: 20, height: 20, color: '#4ade80' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg></div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>Key Generated!</p>
              <p style={{ fontSize: 11, color: 'oklch(0.82 0.035 284)', margin: 0 }}>Expires {fmtDate(issued.expiresAt)}</p>
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 14, wordBreak: 'break-all', userSelect: 'text' }}>
              <p style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: '#c4b5fd', fontWeight: 600, margin: 0, letterSpacing: '0.04em' }}>{issued.key}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost flex-1" onClick={copy} style={{ justifyContent: 'center', gap: 6 }}>
                {copied ? '✓ Copied!' : 'Copy Key'}
              </button>
              <button className="btn-accent flex-1" style={{ justifyContent: 'center' }} onClick={onClose}>Done</button>
            </div>
          </>)}
        </div>
      </div>
    </div>
  )
}

function KeysTab() {
  const [keys, setKeys]           = useState<KeyRecord[]>([])
  const [loading, setLoading]     = useState(true)
  const [showIssue, setShowIssue] = useState(false)
  const [revoking, setRevoking]   = useState<string | null>(null)
  const [extending, setExtending] = useState<string | null>(null)
  const [filter, setFilter]       = useState<'all' | 'active' | 'expired' | 'revoked'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try { setKeys(await window.electron.store.getKeys()) } catch {} finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const handleRevoke = async (key: string) => {
    setRevoking(key)
    try { await window.electron.store.revokeKey(key); setKeys(prev => prev.map(r => r.key === key ? { ...r, revoked: true, revokedAt: new Date().toISOString() } : r)) }
    catch {} finally { setRevoking(null) }
  }

  const handleExtend = async (key: string, days: number) => {
    const id = key + days
    setExtending(id)
    try { await window.electron.store.extendLicense(key, days); await load() }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed to extend key.') }
    finally { setExtending(null) }
  }

  const active  = keys.filter(r => keyStatus(r) === 'active').length
  const expired = keys.filter(r => keyStatus(r) === 'expired').length
  const revoked = keys.filter(r => keyStatus(r) === 'revoked').length
  const filtered = filter === 'all' ? keys : keys.filter(r => keyStatus(r) === filter)

  return (<>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
      <button className="btn-accent" style={{ gap: 6 }} onClick={() => setShowIssue(true)}>
        <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        Issue Key
      </button>
    </div>

    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
      <Stat label="Total" value={keys.length} color="oklch(0.96 0.01 260)" />
      <Stat label="Active" value={active} color="#4ade80" />
      <Stat label="Expired" value={expired} color="oklch(0.82 0.035 284)" />
      <Stat label="Revoked" value={revoked} color="#f87171" />
    </div>

    <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
      {(['all', 'active', 'expired', 'revoked'] as const).map(f => (
        <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', border: 'none', background: filter === f ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.03)', color: filter === f ? '#c4b5fd' : 'oklch(0.82 0.035 284)' }}>
          {f.charAt(0).toUpperCase() + f.slice(1)}
        </button>
      ))}
    </div>

    <div className="glass" style={{ overflow: 'hidden' }}>
      <div className="glass-aurora" />
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div style={{ width: 20, height: 20, border: '2px solid rgba(124,58,237,0.4)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spinSlow 0.7s linear infinite' }} /></div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'oklch(0.74 0.035 282)', fontSize: 13 }}>No keys {filter !== 'all' ? `with status "${filter}"` : 'issued yet'}.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {['Key', 'Recipient', 'Duration', 'Issued', 'Expires', 'Status', ''].map(c => <th key={c} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'oklch(0.78 0.035 283)', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>{c}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map((r, i) => {
              const s = keyStatus(r)
              const c = { active: '#4ade80', expired: 'oklch(0.78 0.035 283)', revoked: '#f87171' }[s]
              const bg = { active: 'rgba(34,197,94,0.1)', expired: 'rgba(255,255,255,0.04)', revoked: 'rgba(248,113,113,0.1)' }[s]
              const bd = { active: 'rgba(34,197,94,0.25)', expired: 'rgba(255,255,255,0.08)', revoked: 'rgba(248,113,113,0.25)' }[s]
              return (
                <tr key={r.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i % 2 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: 'oklch(0.91 0.02 285)', fontWeight: 500, userSelect: 'text' }} title={r.key}>{maskKey(r.key)}</span>
                    {r.role && r.role !== 'standard' && <span style={{ marginLeft: 7, fontSize: 8.5, fontWeight: 800, padding: '1px 6px', borderRadius: 99, background: r.role === 'staff' ? 'rgba(96,165,250,0.18)' : 'rgba(167,139,250,0.2)', color: r.role === 'staff' ? '#93c5fd' : '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{roleLabel(r.role)}</span>}
                  </td>
                  <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, color: r.discordUsername ? 'oklch(0.91 0.02 285)' : 'oklch(0.66 0.03 280)' }}>{r.discordUsername ?? '—'}</span></td>
                  <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, color: 'oklch(0.86 0.03 285)' }}>{r.months} mo</span></td>
                  <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: 'oklch(0.82 0.035 284)' }}>{fmtDate(r.issuedAt)}</span></td>
                  <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: 'oklch(0.82 0.035 284)' }}>{fmtDate(r.expiresAt)}</span></td>
                  <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: bg, color: c, border: `1px solid ${bd}`, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s}</span></td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>{s === 'active' && (<span style={{ display: 'inline-flex', gap: 5 }}>
                    <button onClick={() => handleExtend(r.key, 30)} disabled={!!extending} title="Extend 1 month" style={{ fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 7, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80', cursor: 'pointer' }}>{extending === r.key + 30 ? '…' : '+1m'}</button>
                    <button onClick={() => handleExtend(r.key, 90)} disabled={!!extending} title="Extend 3 months" style={{ fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 7, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80', cursor: 'pointer' }}>{extending === r.key + 90 ? '…' : '+3m'}</button>
                    <button onClick={() => handleRevoke(r.key)} disabled={revoking === r.key} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 7, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', cursor: 'pointer' }}>{revoking === r.key ? '…' : 'Revoke'}</button>
                  </span>)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>

    {showIssue && <IssueModal onClose={() => setShowIssue(false)} onIssued={r => setKeys(prev => [r, ...prev])} />}
  </>)
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER LOOKUP TAB
// ═══════════════════════════════════════════════════════════════════════════════

function InfoRow({ label, value, mono, color }: { label: string; value: React.ReactNode; mono?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: 11, color: 'oklch(0.76 0.035 282)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: color ?? 'oklch(0.93 0.018 285)', fontFamily: mono ? '"JetBrains Mono", monospace' : 'inherit', textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}

function LookupSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass" style={{ padding: '14px 18px', marginBottom: 10 }}>
      <div className="glass-aurora" />
      <p style={{ fontSize: 9, fontWeight: 700, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>{title}</p>
      {children}
    </div>
  )
}

function LookupTab() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [query, setQuery]     = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<UserLookupResult | null>(null)
  const [error, setError]     = useState('')
  const [busy, setBusy]       = useState('')

  useEffect(() => { window.electron.store.supabaseEnabled().then(setEnabled).catch(() => setEnabled(false)) }, [])

  const lookup = async () => {
    if (!query.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await window.electron.store.lookupUser(query.trim())
      if (!r.found) setError('No user found for that Discord ID or username.')
      else setResult(r)
    } catch (e) { setError(e instanceof Error ? e.message : 'Lookup failed.') }
    finally { setLoading(false) }
  }

  // Staff action wrapper — runs, then re-fetches
  const act = async (label: string, fn: () => Promise<unknown>) => {
    if (!result?.license) return
    setBusy(label)
    try { await fn(); await lookup() }
    catch (e) { setError(e instanceof Error ? e.message : 'Action failed.') }
    finally { setBusy('') }
  }

  if (enabled === false) {
    return (
      <div className="glass" style={{ padding: 32, textAlign: 'center' }}>
        <div className="glass-aurora" />
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <svg style={{ width: 24, height: 24, color: '#fbbf24' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
        </div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Supabase not configured</p>
        <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 6, lineHeight: 1.6 }}>
          Add your project URL + key in <span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#c4b5fd' }}>electron/supabase-config.ts</span><br />and run <span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#c4b5fd' }}>supabase-schema.sql</span> to enable User Lookup.
        </p>
      </div>
    )
  }

  const sessionMeta = {
    'live':       { label: 'Live', color: '#4ade80', bg: 'rgba(34,197,94,0.12)', bd: 'rgba(34,197,94,0.3)' },
    'last-known': { label: 'Last known', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', bd: 'rgba(251,191,36,0.3)' },
    'offline':    { label: 'Offline', color: 'oklch(0.74 0.035 282)', bg: 'rgba(255,255,255,0.05)', bd: 'rgba(255,255,255,0.1)' },
  }[result?.session ?? 'offline']

  return (<>
    {/* Search */}
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <input className="input-base" style={{ flex: 1 }} placeholder="Discord ID or username…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookup()} />
      <button className="btn-accent" style={{ gap: 6 }} onClick={lookup} disabled={loading || !query.trim()}>
        {loading ? <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spinSlow 0.7s linear infinite', display: 'inline-block' }} /> : <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>}
        Lookup
      </button>
    </div>

    {error && <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', marginBottom: 12 }}><p style={{ fontSize: 11, color: '#f87171', margin: 0 }}>{error}</p></div>}

    {result?.found && result.license && (
      <div className="animate-fade-in">
        {/* Identity header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>{result.discordUsername ?? 'Unknown user'}</p>
            <p style={{ fontSize: 11, color: 'oklch(0.74 0.035 282)', fontFamily: '"JetBrains Mono", monospace' }}>{result.discordId ?? '—'}</p>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 99, background: sessionMeta.bg, color: sessionMeta.color, border: `1px solid ${sessionMeta.bd}`, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: sessionMeta.color, boxShadow: result.session === 'live' ? `0 0 6px ${sessionMeta.color}` : 'none', animation: result.session === 'live' ? 'glowPulse 1.5s ease-in-out infinite' : 'none' }} />
            {sessionMeta.label}
          </span>
        </div>

        <LookupSection title="License">
          <InfoRow label="Plan" value={result.license.plan} color="#c4b5fd" />
          <InfoRow label="Key" value={result.license.key} mono />
          <InfoRow label="Expires" value={fmtDateTime(result.license.expiresAt)} />
          <InfoRow label="Status" value={<span style={{ color: result.license.status === 'active' ? '#4ade80' : result.license.status === 'revoked' ? '#f87171' : 'oklch(0.78 0.035 283)', textTransform: 'capitalize', fontWeight: 600 }}>{result.license.status}</span>} />
          <InfoRow label="Tier" value={<span style={{ color: result.role === 'standard' ? 'oklch(0.85 0.03 284)' : '#c4b5fd', fontWeight: 600 }}>{roleLabel(result.role)}</span>} />
        </LookupSection>

        <LookupSection title="Hardware">
          <InfoRow label="HWID" value={result.hardware?.hwid ?? <span style={{ color: 'oklch(0.7 0.035 281)' }}>Not bound</span>} mono />
          <InfoRow label="Last heartbeat" value={fmtDateTime(result.hardware?.lastHeartbeat)} />
          <InfoRow label="App version" value={result.hardware?.appVersion ?? '—'} mono />
        </LookupSection>

        <LookupSection title={`Cookies · ${result.session === 'live' ? 'live' : 'last known'}`}>
          <InfoRow label="Total" value={result.cookies?.total ?? 0} mono />
          <InfoRow label="Healthy" value={<span style={{ color: '#4ade80' }}>{result.cookies?.healthy ?? 0}</span>} mono />
          <InfoRow label="Expired" value={<span style={{ color: '#f87171' }}>{result.cookies?.expired ?? 0}</span>} mono />
          <InfoRow label="Last check" value={fmtDateTime(result.cookies?.lastCheck)} />
        </LookupSection>

        {/* Staff actions */}
        <LookupSection title="Staff Actions">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            <ActionBtn label="Reset HWID" busy={busy === 'hwid'} color="#a78bfa"
              onClick={() => act('hwid', () => window.electron.store.resetHwid(result.license!.key))} />
            <ActionBtn label="+1 Month" busy={busy === 'ext30'} color="#4ade80"
              onClick={() => act('ext30', () => window.electron.store.extendLicense(result.license!.key, 30))} />
            <ActionBtn label="+3 Months" busy={busy === 'ext90'} color="#4ade80"
              onClick={() => act('ext90', () => window.electron.store.extendLicense(result.license!.key, 90))} />
            {result.license.status === 'revoked'
              ? <ActionBtn label="Enable" busy={busy === 'enable'} color="#4ade80" onClick={() => act('enable', () => window.electron.store.enableLicense(result.license!.key))} />
              : <ActionBtn label="Revoke" busy={busy === 'revoke'} color="#f87171" onClick={() => act('revoke', () => window.electron.store.revokeLicense(result.license!.key))} />}
          </div>
          {/* Access tier — "Premium" unlocks the Premium category for a Basic user */}
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 10, color: 'oklch(0.74 0.035 282)', marginBottom: 6 }}>
              Access tier <span style={{ color: 'oklch(0.66 0.03 280)' }}>· Premium unlocks the Premium category</span>
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              {([['standard', 'Basic'], ['club33', 'Premium'], ['staff', 'Staff']] as const).map(([role, label]) => (
                <button key={role} disabled={busy === 'role-' + role || result.role === role}
                  onClick={() => act('role-' + role, () => window.electron.store.setRole(result.license!.key, role))}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: result.role === role ? 'default' : 'pointer', transition: 'all 0.15s',
                    border: result.role === role ? '1px solid rgba(167,139,250,0.5)' : '1px solid rgba(255,255,255,0.1)',
                    background: result.role === role ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.03)',
                    color: result.role === role ? '#c4b5fd' : 'oklch(0.82 0.035 284)' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </LookupSection>
      </div>
    )}
  </>)
}

function ActionBtn({ label, color, busy, onClick }: { label: string; color: string; busy: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={busy} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: `${color}1a`, border: `1px solid ${color}40`, color }}>
      {busy ? '…' : label}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGEMENT PAGE (tabs)
// ═══════════════════════════════════════════════════════════════════════════════

export function StaffPage() {
  const [tab, setTab] = useState<'keys' | 'lookup'>('keys')

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 760 }}>
        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🛡️</span> Management
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(167,139,250,0.3)', color: '#c4b5fd', letterSpacing: '0.1em' }}>STAFF</span>
          </h1>
          <p style={{ fontSize: 11, color: 'oklch(0.82 0.035 284)', marginTop: 4 }}>Issue keys and manage users</p>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 0 }}>
          {([['keys', 'Keys'], ['lookup', 'User Lookup']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none',
                color: tab === id ? '#c4b5fd' : 'oklch(0.78 0.035 283)',
                borderBottom: tab === id ? '2px solid #a78bfa' : '2px solid transparent', marginBottom: -1, transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'keys' ? <KeysTab /> : <LookupTab />}
      </div>
    </div>
  )
}
