import React, { useEffect, useState, useCallback } from 'react'

// Hidden owner-only panel to flip the global kill-switch + publish updates. Opening
// it is gated by a secret key combo (handled in App), but the REAL gate is the owner
// secret, verified server-side and never stored in the app — so even a staff member
// who discovers the combo can't do anything without it.
export function OwnerKillPanel({ onClose }: { onClose: () => void }) {
  const [secret, setSecret] = useState('')
  const [killed, setKilled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pubVer, setPubVer] = useState('')
  const [pubUrl, setPubUrl] = useState('')
  const [pubMsg, setPubMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Live state for the readouts: this build's version + what's currently published.
  const [buildVer, setBuildVer] = useState('')
  const [published, setPublished] = useState<{ version?: string; url?: string } | null>(null)
  const [diag, setDiag] = useState(false)   // secret diagnostics reveal

  // Broadcast announcement.
  const [annText, setAnnText] = useState('')
  const [annLevel, setAnnLevel] = useState('info')
  const [annMsg, setAnnMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [annLive, setAnnLive] = useState<{ text?: string; level?: string; at?: string } | null>(null)

  const refreshPublished = useCallback(() => {
    window.electron.app.latestVersion().then(setPublished).catch(() => setPublished(null))
  }, [])
  const refreshAnnouncement = useCallback(() => {
    window.electron.app.announcement().then(a => { setAnnLive(a); if (a?.text) { setAnnText(a.text); setAnnLevel(a.level || 'info') } }).catch(() => setAnnLive(null))
  }, [])

  useEffect(() => {
    window.electron.app.status().then(s => setKilled(s.killed)).catch(() => {})
    window.electron.app.version().then(setBuildVer).catch(() => {})
    refreshPublished()
    refreshAnnouncement()
    return window.electron.app.onKillChanged(k => setKilled(k))
  }, [refreshPublished, refreshAnnouncement])

  const apply = async (next: boolean) => {
    if (!secret.trim() || busy) return
    setBusy(true); setMsg(null)
    try {
      const r = await window.electron.app.setKill(secret.trim(), next)
      if (r.ok) { setKilled(r.killed ?? next); setMsg({ ok: true, text: next ? 'Program DISABLED for all users.' : 'Program REACTIVATED for all users.' }) }
      else setMsg({ ok: false, text: friendly(r.error) })
    } catch { setMsg({ ok: false, text: 'Could not reach the server.' }) }
    finally { setBusy(false) }
  }

  const publish = async () => {
    if (!secret.trim() || !pubVer.trim() || busy) return
    setBusy(true); setPubMsg(null)
    try {
      const r = await window.electron.app.setVersion(secret.trim(), pubVer.trim(), pubUrl.trim())
      if (r.ok) { setPubMsg({ ok: true, text: `Published v${r.version} — clients below it will see the update notice.` }); refreshPublished() }
      else setPubMsg({ ok: false, text: friendly(r.error) })
    } catch { setPubMsg({ ok: false, text: 'Could not reach the server.' }) }
    finally { setBusy(false) }
  }

  const sendAnnouncement = async () => {
    if (!secret.trim() || !annText.trim() || busy) return
    setBusy(true); setAnnMsg(null)
    try {
      const r = await window.electron.app.setAnnouncement(secret.trim(), annText.trim(), annLevel)
      if (r.ok) { setAnnMsg({ ok: true, text: 'Announcement broadcast to all users.' }); refreshAnnouncement() }
      else setAnnMsg({ ok: false, text: friendly(r.error) })
    } catch { setAnnMsg({ ok: false, text: 'Could not reach the server.' }) }
    finally { setBusy(false) }
  }

  const clearAnnouncement = async () => {
    if (!secret.trim() || busy) return
    setBusy(true); setAnnMsg(null)
    try {
      const r = await window.electron.app.setAnnouncement(secret.trim(), '', annLevel)
      if (r.ok) { setAnnMsg({ ok: true, text: 'Announcement cleared.' }); setAnnText(''); refreshAnnouncement() }
      else setAnnMsg({ ok: false, text: friendly(r.error) })
    } catch { setAnnMsg({ ok: false, text: 'Could not reach the server.' }) }
    finally { setBusy(false) }
  }

  // Turn a raw server error into something actionable. The #1 cause of "it doesn't
  // work" is the relevant RPC not being installed in Supabase yet.
  const friendly = (err?: string): string => {
    const e = err ?? 'Failed.'
    if (/function|schema cache|404|not found/i.test(e)) return 'Not installed — run the SQL migration (app-version.sql / announcement.sql) in Supabase, then retry.'
    if (/denied/i.test(e)) return 'Owner secret rejected.'
    return e
  }

  const overlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,3,10,0.82)', backdropFilter: 'blur(9px)', WebkitBackdropFilter: 'blur(9px)' }
  const fieldLabel: React.CSSProperties = { fontSize: 9, fontWeight: 700, color: 'oklch(0.66 0.035 282)', textTransform: 'uppercase', letterSpacing: '0.14em', margin: '0 0 5px' }

  const upToDate = !!published?.version && !!buildVer && cmp(published.version, buildVer) <= 0

  return (
    <div style={overlay} onClick={onClose}>
      <style>{`
        @keyframes lvntScan { 0% { background-position: 0 0 } 100% { background-position: 0 8px } }
        @keyframes lvntOwnerGlow { 0%,100% { box-shadow: 0 0 0 1px rgba(248,113,113,0.3), 0 0 34px -8px rgba(239,68,68,0.55) } 50% { box-shadow: 0 0 0 1px rgba(248,113,113,0.5), 0 0 52px -6px rgba(239,68,68,0.8) } }
      `}</style>
      <div onClick={e => e.stopPropagation()} className="glass animate-scale-in" style={{ position: 'relative', overflow: 'hidden', width: 430, padding: 24, borderRadius: 18, animation: 'lvntOwnerGlow 3s ease-in-out infinite' }}>
        {/* secret-panel scanline overlay */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5, background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 4px)', animation: 'lvntScan 0.6s linear infinite' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171', boxShadow: '0 0 16px -4px rgba(239,68,68,0.6)' }}>
            <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" /></svg>
          </div>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '0.01em' }}>Master Control</h2>
            <button onClick={() => setDiag(d => !d)} title="Toggle diagnostics" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: '#fca5a5', margin: '2px 0 0', textTransform: 'uppercase' }}>
              ◈ Owner Access
            </button>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99, letterSpacing: '0.04em', fontFamily: '"JetBrains Mono", monospace',
            background: killed ? 'rgba(239,68,68,0.16)' : 'rgba(34,197,94,0.16)',
            border: `1px solid ${killed ? 'rgba(248,113,113,0.4)' : 'rgba(74,222,128,0.4)'}`,
            color: killed ? '#fca5a5' : '#86efac' }}>
            {killed === null ? '…' : killed ? 'DISABLED' : 'LIVE'}
          </div>
        </div>

        {/* Secret diagnostics (click "Owner Access" to reveal) */}
        {diag && (
          <div className="animate-fade-in" style={{ position: 'relative', marginTop: 12, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.07)', fontFamily: '"JetBrains Mono", monospace' }}>
            <DiagRow k="this build" v={buildVer ? `v${buildVer}` : '—'} />
            <DiagRow k="published" v={published?.version ? `v${published.version}` : 'none'} tint={published?.version ? (upToDate ? '#4ade80' : '#fbbf24') : undefined} />
            <DiagRow k="kill-switch" v={killed === null ? '…' : killed ? 'DISABLED' : 'LIVE'} tint={killed ? '#f87171' : '#4ade80'} />
            <DiagRow k="backend" v={killed === null ? 'unreachable' : 'connected'} tint={killed === null ? '#f87171' : '#4ade80'} />
          </div>
        )}

        <input
          type="password" className="input-base" placeholder="Owner secret" value={secret} autoFocus
          onChange={e => setSecret(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') apply(!killed) }}
          style={{ position: 'relative', width: '100%', marginTop: 14, fontFamily: '"JetBrains Mono", monospace' }}
        />

        <div style={{ position: 'relative', display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => apply(true)} disabled={busy || !secret.trim() || killed === true}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: '1px solid rgba(248,113,113,0.55)', background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: '#fff',
              opacity: (busy || !secret.trim() || killed === true) ? 0.45 : 1 }}>
            Disable everyone
          </button>
          <button onClick={() => apply(false)} disabled={busy || !secret.trim() || killed === false}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: '1px solid rgba(74,222,128,0.5)', background: 'linear-gradient(135deg, oklch(0.74 0.18 150), oklch(0.62 0.2 150))', color: '#fff',
              opacity: (busy || !secret.trim() || killed === false) ? 0.45 : 1 }}>
            Reactivate
          </button>
        </div>

        {msg && <p className="animate-fade-in" style={{ position: 'relative', fontSize: 11, fontWeight: 600, margin: '12px 0 0', color: msg.ok ? '#4ade80' : '#f87171' }}>{msg.text}</p>}

        <p style={{ position: 'relative', fontSize: 10, color: 'oklch(0.66 0.035 282)', lineHeight: 1.5, margin: '12px 0 0' }}>
          Applies to <b style={{ color: 'oklch(0.82 0.035 284)' }}>every user instantly</b>. Disabling stops all automation, closes every running alt, and blocks new launches until reactivated.
        </p>

        {/* Publish update */}
        <div style={{ position: 'relative', marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#fff', margin: 0 }}>Publish update</p>
            {/* live published state — confirms the channel works */}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5, fontFamily: '"JetBrains Mono", monospace', color: published?.version ? '#86efac' : 'oklch(0.6 0.03 280)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: published?.version ? '#4ade80' : '#555', boxShadow: published?.version ? '0 0 6px #4ade80' : 'none' }} />
              {published?.version ? `live: v${published.version}` : 'none published'}
            </span>
          </div>

          <p style={fieldLabel}>Version</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input-base" placeholder="e.g. 2.3.0" value={pubVer} onChange={e => setPubVer(e.target.value)} style={{ width: 130, fontFamily: '"JetBrains Mono", monospace' }} />
            {buildVer && (
              <button onClick={() => { setPubVer(buildVer); setPubUrl(`https://your-host/Setup Leventia Alting Program V${buildVer.split('.').slice(0, 2).join('.')}.exe`) }}
                style={{ fontSize: 10, padding: '0 11px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap', color: '#c4b5fd', background: 'rgba(124,58,237,0.14)', border: '1px solid rgba(167,139,250,0.3)' }}>
                Use build v{buildVer}
              </button>
            )}
          </div>
          <input className="input-base" placeholder="Download URL" value={pubUrl} onChange={e => setPubUrl(e.target.value)} style={{ width: '100%', marginTop: 8 }} />

          <button onClick={publish} disabled={busy || !secret.trim() || !pubVer.trim()}
            style={{ width: '100%', marginTop: 8, padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
              background: 'linear-gradient(135deg,#7c3aed,#22d3ee)', color: '#fff', opacity: (busy || !secret.trim() || !pubVer.trim()) ? 0.45 : 1 }}>
            {busy ? 'Working…' : 'Publish version'}
          </button>
          {pubMsg && <p className="animate-fade-in" style={{ fontSize: 11, fontWeight: 600, margin: '8px 0 0', color: pubMsg.ok ? '#4ade80' : '#f87171' }}>{pubMsg.text}</p>}
        </div>

        {/* Announcement broadcast */}
        <div style={{ position: 'relative', marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#fff', margin: 0 }}>Announcement</p>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5, fontFamily: '"JetBrains Mono", monospace', color: annLive?.text ? '#7dd3fc' : 'oklch(0.6 0.03 280)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: annLive?.text ? '#38bdf8' : '#555', boxShadow: annLive?.text ? '0 0 6px #38bdf8' : 'none' }} />
              {annLive?.text ? `live · ${annLive.level ?? 'info'}` : 'none active'}
            </span>
          </div>
          <textarea className="input-base" rows={2} placeholder="Message shown as a banner to every user…" value={annText}
            onChange={e => setAnnText(e.target.value)} style={{ width: '100%', resize: 'vertical', minHeight: 46, fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {([['info', 'Info', '#38bdf8'], ['warn', 'Warning', '#fbbf24'], ['danger', 'Critical', '#f87171']] as const).map(([id, label, c]) => {
              const on = annLevel === id
              return (
                <button key={id} onClick={() => setAnnLevel(id)}
                  style={{ flex: 1, padding: '5px 0', borderRadius: 8, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${on ? c : 'rgba(255,255,255,0.12)'}`, background: on ? `${c}22` : 'rgba(255,255,255,0.03)', color: on ? c : 'oklch(0.7 0.03 281)' }}>
                  {label}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={sendAnnouncement} disabled={busy || !secret.trim() || !annText.trim()}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                background: 'linear-gradient(135deg,#38bdf8,#7c3aed)', color: '#fff', opacity: (busy || !secret.trim() || !annText.trim()) ? 0.45 : 1 }}>
              {busy ? 'Working…' : 'Broadcast'}
            </button>
            <button onClick={clearAnnouncement} disabled={busy || !secret.trim() || !annLive?.text}
              style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#f87171',
                border: '1px solid rgba(248,113,113,0.4)', background: 'transparent', opacity: (busy || !secret.trim() || !annLive?.text) ? 0.45 : 1 }}>
              Clear
            </button>
          </div>
          {annMsg && <p className="animate-fade-in" style={{ fontSize: 11, fontWeight: 600, margin: '8px 0 0', color: annMsg.ok ? '#4ade80' : '#f87171' }}>{annMsg.text}</p>}
        </div>

        <button className="btn-ghost" style={{ position: 'relative', width: '100%', marginTop: 14 }} onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

function DiagRow({ k, v, tint }: { k: string; v: string; tint?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '2px 0' }}>
      <span style={{ color: 'oklch(0.6 0.03 280)' }}>{k}</span>
      <span style={{ color: tint ?? 'oklch(0.85 0.03 284)' }}>{v}</span>
    </div>
  )
}

// Compare dotted versions numerically. >0 if a is newer than b.
function cmp(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0)
  const pb = b.split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}
