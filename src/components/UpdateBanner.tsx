import React, { useEffect, useState } from 'react'

// Compare dotted versions numerically. Returns >0 if a is newer than b.
function cmpVersion(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0)
  const pb = b.split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d > 0 ? 1 : -1
  }
  return 0
}

const DISMISS_KEY = 'lvnt-update-dismissed'

// Floating "update available" notice. Checks the published version (Supabase) on
// mount and, if newer than this build, shows a toast with a Download button that
// opens the release URL in the browser (handled by the main window's
// setWindowOpenHandler → shell.openExternal). Dismissals are remembered per
// version so it won't nag for the same release.
export function UpdateBanner() {
  const [info, setInfo] = useState<{ version: string; url: string } | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [current, latest] = await Promise.all([
          window.electron.app.version(),
          window.electron.app.latestVersion(),
        ])
        if (!alive || !latest?.version) return
        if (cmpVersion(latest.version, current) <= 0) return          // up to date
        if (localStorage.getItem(DISMISS_KEY) === latest.version) return // already dismissed this one
        setInfo({ version: latest.version, url: latest.url || '' })
      } catch { /* offline / not configured → no banner */ }
    })()
    return () => { alive = false }
  }, [])

  if (!info) return null

  const dismiss = () => { try { localStorage.setItem(DISMISS_KEY, info.version) } catch {}; setInfo(null) }
  const download = () => { if (info.url) window.open(info.url, '_blank') }

  return (
    <div className="animate-slide-up" style={{
      position: 'fixed', top: 46, left: '50%', transform: 'translateX(-50%)', zIndex: 9997,
      display: 'inline-flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12,
      background: 'linear-gradient(135deg, rgba(124,58,237,0.28), rgba(34,211,238,0.20))',
      border: '1px solid rgba(167,139,250,0.5)', color: '#ede9fe', fontSize: 12.5, fontWeight: 600,
      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: '0 12px 34px -10px rgba(124,58,237,0.6)',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <svg style={{ width: 16, height: 16, color: '#c4b5fd' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        Update available — <b style={{ color: '#fff' }}>v{info.version}</b>
      </span>
      {info.url && (
        <button onClick={download} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
          border: 'none', background: 'linear-gradient(135deg,#7c3aed,#22d3ee)', color: '#fff' }}>
          Download
        </button>
      )}
      <button onClick={dismiss} title="Dismiss" style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, border: 'none', background: 'transparent', color: '#c4b5fd', cursor: 'pointer' }}>
        <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  )
}
