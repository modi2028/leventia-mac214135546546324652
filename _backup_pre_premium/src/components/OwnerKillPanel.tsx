import React, { useEffect, useState } from 'react'

// Hidden owner-only panel to flip the global kill-switch. Opening it is gated by a
// secret key combo (handled in App), but the REAL gate is the owner secret, which
// is verified server-side and never stored in the app — so even a staff member who
// discovers the combo can't disable/enable the program without it.
export function OwnerKillPanel({ onClose }: { onClose: () => void }) {
  const [secret, setSecret] = useState('')
  const [killed, setKilled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pubVer, setPubVer] = useState('')
  const [pubUrl, setPubUrl] = useState('')
  const [pubMsg, setPubMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    window.electron.app.status().then(s => setKilled(s.killed)).catch(() => {})
    // Keep the badge live if the state flips elsewhere while the panel is open.
    return window.electron.app.onKillChanged(k => setKilled(k))
  }, [])

  const apply = async (next: boolean) => {
    if (!secret.trim() || busy) return
    setBusy(true); setMsg(null)
    try {
      const r = await window.electron.app.setKill(secret.trim(), next)
      if (r.ok) { setKilled(r.killed ?? next); setMsg({ ok: true, text: next ? 'Program DISABLED for all users.' : 'Program REACTIVATED for all users.' }) }
      else setMsg({ ok: false, text: r.error ?? 'Failed.' })
    } catch { setMsg({ ok: false, text: 'Could not reach the server.' }) }
    finally { setBusy(false) }
  }

  const publish = async () => {
    if (!secret.trim() || !pubVer.trim() || busy) return
    setBusy(true); setPubMsg(null)
    try {
      const r = await window.electron.app.setVersion(secret.trim(), pubVer.trim(), pubUrl.trim())
      if (r.ok) setPubMsg({ ok: true, text: `Published v${r.version} — clients will see the update notice.` })
      else setPubMsg({ ok: false, text: r.error ?? 'Failed.' })
    } catch { setPubMsg({ ok: false, text: 'Could not reach the server.' }) }
    finally { setBusy(false) }
  }

  const overlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,3,10,0.78)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }

  return (
    <div style={overlay} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="glass animate-scale-in" style={{ width: 400, padding: 24, border: '1px solid rgba(248,113,113,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171' }}>
            <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" /></svg>
          </div>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0 }}>Master Control</h2>
            <p style={{ fontSize: 10, color: 'oklch(0.74 0.035 282)', margin: '2px 0 0' }}>Owner-only · global kill-switch</p>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99, letterSpacing: '0.04em',
            background: killed ? 'rgba(239,68,68,0.16)' : 'rgba(34,197,94,0.16)',
            border: `1px solid ${killed ? 'rgba(248,113,113,0.4)' : 'rgba(74,222,128,0.4)'}`,
            color: killed ? '#fca5a5' : '#86efac' }}>
            {killed === null ? '…' : killed ? 'DISABLED' : 'LIVE'}
          </div>
        </div>

        <input
          type="password"
          className="input-base"
          placeholder="Owner secret"
          value={secret}
          autoFocus
          onChange={e => setSecret(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') apply(!killed) }}
          style={{ width: '100%', marginTop: 14, fontFamily: '"JetBrains Mono", monospace' }}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => apply(true)}
            disabled={busy || !secret.trim() || killed === true}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: '1px solid rgba(248,113,113,0.55)', background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: '#fff',
              opacity: (busy || !secret.trim() || killed === true) ? 0.45 : 1 }}>
            Disable everyone
          </button>
          <button
            onClick={() => apply(false)}
            disabled={busy || !secret.trim() || killed === false}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: '1px solid rgba(74,222,128,0.5)', background: 'linear-gradient(135deg, oklch(0.74 0.18 150), oklch(0.62 0.2 150))', color: '#fff',
              opacity: (busy || !secret.trim() || killed === false) ? 0.45 : 1 }}>
            Reactivate
          </button>
        </div>

        {msg && (
          <p className="animate-fade-in" style={{ fontSize: 11, fontWeight: 600, margin: '12px 0 0', color: msg.ok ? '#4ade80' : '#f87171' }}>{msg.text}</p>
        )}

        <p style={{ fontSize: 10, color: 'oklch(0.66 0.035 282)', lineHeight: 1.5, margin: '12px 0 0' }}>
          Applies to <b style={{ color: 'oklch(0.82 0.035 284)' }}>every user instantly</b>. Disabling stops all automation, closes every running alt, and blocks new launches until reactivated. The secret is verified server-side and never stored in the app.
        </p>

        {/* Publish update — sets the version + download link clients are notified about */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>Publish update</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input-base" placeholder="Version e.g. 2.6.0" value={pubVer} onChange={e => setPubVer(e.target.value)} style={{ width: 130, fontFamily: '"JetBrains Mono", monospace' }} />
            <input className="input-base" placeholder="Download URL" value={pubUrl} onChange={e => setPubUrl(e.target.value)} style={{ flex: 1 }} />
          </div>
          <button onClick={publish} disabled={busy || !secret.trim() || !pubVer.trim()}
            style={{ width: '100%', marginTop: 8, padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
              background: 'linear-gradient(135deg,#7c3aed,#22d3ee)', color: '#fff', opacity: (busy || !secret.trim() || !pubVer.trim()) ? 0.45 : 1 }}>
            Publish version
          </button>
          {pubMsg && <p className="animate-fade-in" style={{ fontSize: 11, fontWeight: 600, margin: '8px 0 0', color: pubMsg.ok ? '#4ade80' : '#f87171' }}>{pubMsg.text}</p>}
          <p style={{ fontSize: 9.5, color: 'oklch(0.62 0.03 280)', margin: '8px 0 0', lineHeight: 1.5 }}>Uses the owner secret above. Every client below this version sees an "Update available" notice with a Download button.</p>
        </div>

        <button className="btn-ghost" style={{ width: '100%', marginTop: 12 }} onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
