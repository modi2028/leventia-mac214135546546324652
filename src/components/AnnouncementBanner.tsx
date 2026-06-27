import React, { useEffect, useState } from 'react'

// Floating broadcast banner. Polls the owner announcement (Supabase) on launch and
// every ~60s, and shows it to every user. Dismissals are remembered per-message (by
// the `at` timestamp) so a new/edited announcement re-appears but the same one won't
// nag. Set/cleared from the hidden Owner panel → "Announcement".

const DISMISS_KEY = 'lvnt-announcement-dismissed'

const LEVELS: Record<string, { grad: string; border: string; glow: string; icon: string; accent: string }> = {
  info:   { grad: 'linear-gradient(135deg, rgba(56,189,248,0.26), rgba(124,58,237,0.18))', border: 'rgba(56,189,248,0.5)',  glow: 'rgba(56,189,248,0.5)',  accent: '#7dd3fc', icon: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z' },
  warn:   { grad: 'linear-gradient(135deg, rgba(251,191,36,0.26), rgba(244,114,22,0.18))', border: 'rgba(251,191,36,0.5)',  glow: 'rgba(251,191,36,0.5)',  accent: '#fcd34d', icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z' },
  danger: { grad: 'linear-gradient(135deg, rgba(248,113,113,0.28), rgba(190,24,93,0.18))', border: 'rgba(248,113,113,0.55)', glow: 'rgba(239,68,68,0.55)',  accent: '#fca5a5', icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z' },
}

export function AnnouncementBanner() {
  const [ann, setAnn] = useState<{ text: string; level: string; at: string } | null>(null)

  useEffect(() => {
    let alive = true
    const check = async () => {
      try {
        const a = await window.electron.app.announcement()
        if (!alive) return
        if (!a?.text) { setAnn(null); return }
        const at = a.at || a.text   // identity for dismissal
        if (localStorage.getItem(DISMISS_KEY) === at) { setAnn(null); return }
        setAnn({ text: a.text, level: a.level || 'info', at })
      } catch { /* offline / not configured → no banner */ }
    }
    check()
    const t = setInterval(check, 60_000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  if (!ann) return null

  const lv = LEVELS[ann.level] ?? LEVELS.info
  const dismiss = () => { try { localStorage.setItem(DISMISS_KEY, ann.at) } catch {}; setAnn(null) }

  return (
    <div className="animate-slide-up" style={{
      position: 'fixed', top: 46, left: '50%', transform: 'translateX(-50%)', zIndex: 9996,
      display: 'inline-flex', alignItems: 'center', gap: 11, maxWidth: 620, padding: '10px 14px', borderRadius: 12,
      background: lv.grad, border: `1px solid ${lv.border}`, color: '#fff', fontSize: 12.5, fontWeight: 600,
      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: `0 12px 34px -10px ${lv.glow}`,
    }}>
      <svg style={{ width: 17, height: 17, color: lv.accent, flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={lv.icon} />
      </svg>
      <span style={{ lineHeight: 1.45, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{ann.text}</span>
      <button onClick={dismiss} title="Dismiss" style={{ flexShrink: 0, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, border: 'none', background: 'transparent', color: lv.accent, cursor: 'pointer' }}>
        <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  )
}
