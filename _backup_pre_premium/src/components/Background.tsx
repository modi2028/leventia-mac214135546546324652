import React, { useEffect, useState } from 'react'
import logoUrl from '../assets/logo.svg'
import type { AppSettings } from '../types'

type BgState = { type: AppSettings['bgType']; color: string; media: string }

// Background media is served via the lvnt-media:// protocol (raw file:// is blocked
// in the packaged build). Legacy file:// URLs from older versions are converted.
function toMediaUrl(u: string): string {
  if (!u || u.startsWith('lvnt-media://')) return u
  if (u.startsWith('file:')) {
    try {
      const p = decodeURIComponent(new URL(u).pathname).replace(/^\/+/, '')
      return `lvnt-media://bg/?p=${encodeURIComponent(p)}`
    } catch { return u }
  }
  return u
}

export function Background() {
  const [bg, setBg] = useState<BgState>({ type: 'default', color: '#07070e', media: '' })

  useEffect(() => {
    const load = () => window.electron.store.getSettings()
      .then(s => setBg({ type: s.bgType ?? 'default', color: s.bgColor ?? '#07070e', media: s.bgMedia ?? '' }))
      .catch(() => {})
    load()
    // SettingsPage dispatches this when the background changes, for live updates.
    window.addEventListener('lvnt:bg-changed', load)
    return () => window.removeEventListener('lvnt:bg-changed', load)
  }, [])

  const isImage = bg.type === 'image' && !!bg.media
  const isVideo = bg.type === 'video' && !!bg.media
  const isMedia = isImage || isVideo
  const src = toMediaUrl(bg.media)

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: -10, pointerEvents: 'none', overflow: 'hidden',
        background: bg.type === 'color' ? bg.color : 'oklch(0.13 0.01 260)',
      }}>
        {/* Default animated aurora */}
        {bg.type === 'default' && (<>
          <div className="bg-grid" />
          <div className="aurora-a" />
          <div className="aurora-b" />
          <div className="aurora-c" />
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 20%, oklch(0.13 0.01 260 / 0.85) 100%)' }} />
        </>)}

        {/* Image — cover, re-flows with the window */}
        {isImage && (
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `url("${src}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        )}

        {/* Looping muted video — object-fit cover keeps it filling any window size */}
        {isVideo && (
          <video key={src} autoPlay loop muted playsInline
            onError={() => setBg(b => ({ ...b, type: 'default' }))}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}>
            <source src={src} />
          </video>
        )}

        {/* Adaptive Leventia overlay — dim + center-focus vignette for readability,
            plus subtle violet/cyan brand tints so media blends with the UI. */}
        {(isMedia || bg.type === 'color') && (
          <div style={{
            position: 'absolute', inset: 0,
            background: isMedia
              ? `radial-gradient(ellipse 96% 86% at 50% 42%, transparent 26%, rgba(7,7,14,0.80) 100%),
                 linear-gradient(to bottom, rgba(7,7,14,0.42), rgba(7,7,14,0.64)),
                 radial-gradient(circle at 0% 0%, rgba(124,58,237,0.20), transparent 42%),
                 radial-gradient(circle at 100% 100%, rgba(34,211,238,0.14), transparent 44%)`
              : 'linear-gradient(to bottom, rgba(7,7,14,0.55), rgba(7,7,14,0.74))',
            backdropFilter: isMedia ? 'blur(2px) saturate(118%)' : 'none',
            WebkitBackdropFilter: isMedia ? 'blur(2px) saturate(118%)' : 'none',
          }} />
        )}
      </div>

      {/* Leventia watermark — only on the default background; hidden for custom
          color/image/video backgrounds where it clipped through panels. */}
      {bg.type === 'default' && (
        <div style={{
          position: 'fixed', bottom: 12, right: 14, zIndex: 9000, pointerEvents: 'none', userSelect: 'none',
          display: 'flex', alignItems: 'center', gap: 6, opacity: 0.32,
        }}>
          <img src={logoUrl} width={15} height={15} alt="" style={{ filter: 'drop-shadow(0 0 4px rgba(124,58,237,0.6))' }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', color: '#fff', textTransform: 'uppercase', textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>Leventia</span>
        </div>
      )}
    </>
  )
}
