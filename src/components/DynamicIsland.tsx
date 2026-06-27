import React, { useEffect, useState } from 'react'
import type { UpdatePost, UpdateCategory } from '../types'

interface Props {
  update: UpdatePost
  onClick: () => void
  onDismiss: () => void
}

const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
const DURATION = 7000   // visible time before it auto-collapses

// Per-category styling + icon.
const CATS: Record<UpdateCategory, { label: string; color: string; glow: string; icon: React.ReactNode }> = {
  feature: {
    label: 'New Feature', color: '#a78bfa', glow: 'rgba(167,139,250,0.55)',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 15, height: 15 }}><path d="M9.5 3l1.6 4.4L15.5 9l-4.4 1.6L9.5 15l-1.6-4.4L3.5 9l4.4-1.6L9.5 3zm8 9l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9.9-2.5z" /></svg>,
  },
  fix: {
    label: 'Fix', color: '#4ade80', glow: 'rgba(74,222,128,0.55)',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} style={{ width: 15, height: 15 }}><path strokeLinecap="round" strokeLinejoin="round" d="M11.5 6.5l3.5-3.5a4 4 0 015 5l-3.5 3.5M6.5 11.5L3 15a4 4 0 005 5l3.5-3.5M9 9l6 6" /></svg>,
  },
  announcement: {
    label: 'Announcement', color: '#38bdf8', glow: 'rgba(56,189,248,0.55)',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 15, height: 15 }}><path strokeLinecap="round" strokeLinejoin="round" d="M3 11l16-7v16L3 13v-2zm0 0v5m4-3.5V18a2 2 0 002 2h1" /></svg>,
  },
}

export function DynamicIsland({ update, onClick, onDismiss }: Props) {
  const [phase, setPhase] = useState<'enter' | 'open' | 'leave'>('enter')

  useEffect(() => {
    setPhase('enter')
    const t1 = setTimeout(() => setPhase('open'),  50)
    const t2 = setTimeout(() => setPhase('leave'), DURATION)
    const t3 = setTimeout(() => onDismiss(),       DURATION + 480)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [update.id])

  const open = phase === 'open'
  const cat  = CATS[update.category] ?? CATS.announcement

  const close = () => { setPhase('leave'); setTimeout(onDismiss, 440) }

  return (
    <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'none' }}>
      <div
        onClick={() => { onClick(); close() }}
        style={{
          pointerEvents: 'auto', cursor: 'pointer', position: 'relative', overflow: 'hidden',
          display: 'flex', alignItems: 'center', gap: open ? 12 : 9,
          width:  open ? 384 : 168,
          height: open ? 74  : 40,
          padding: open ? '0 18px 0 14px' : '0 12px',
          borderRadius: open ? 26 : 20,
          // Liquid-glass surface: translucent, edge-lit, category-tinted, heavy blur.
          background: `linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.02) 46%), radial-gradient(150% 140% at 0% 0%, ${cat.color}24, transparent 55%), linear-gradient(150deg, rgba(34,28,58,0.5), rgba(10,9,20,0.5))`,
          border: `1px solid rgba(255,255,255,0.18)`,
          backdropFilter: 'blur(40px) saturate(185%) brightness(1.06)',
          WebkitBackdropFilter: 'blur(40px) saturate(185%) brightness(1.06)',
          boxShadow: `0 20px 56px -12px ${cat.glow}, inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 1px rgba(0,0,0,0.25)`,
          opacity: phase === 'enter' ? 0 : phase === 'leave' ? 0 : 1,
          transform: phase === 'open' ? 'translateY(0) scale(1)' : 'translateY(-14px) scale(0.85)',
          transition:
            `width 0.55s ${SPRING}, height 0.55s ${SPRING}, border-radius 0.5s ${SPRING}, ` +
            `padding 0.5s ${SPRING}, gap 0.5s ${SPRING}, transform 0.45s ${SPRING}, opacity 0.4s ease`,
        }}
      >
        {/* glowing icon orb */}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: open ? 46 : 26, height: open ? 46 : 26, borderRadius: '50%',
          background: `radial-gradient(circle at 32% 28%, ${cat.color}, ${cat.color}33)`,
          color: '#fff', boxShadow: `0 0 16px ${cat.glow}`,
          transition: `all 0.55s ${SPRING}`,
        }}>
          <span style={{ animation: 'islandPulse 2s ease-in-out infinite', display: 'flex' }}>{cat.icon}</span>
        </div>

        {/* text — fades/slides in once expanded */}
        <div style={{
          flex: 1, minWidth: 0, overflow: 'hidden',
          opacity: open ? 1 : 0,
          transform: open ? 'translateX(0)' : 'translateX(-6px)',
          transition: open ? 'opacity 0.35s ease 0.18s, transform 0.35s ease 0.18s' : 'opacity 0.15s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.11em', whiteSpace: 'nowrap' }}>{cat.label}</span>
            {update.version && (
              <span style={{ fontSize: 8.5, fontWeight: 700, color: 'oklch(0.82 0.035 284)', fontFamily: '"JetBrains Mono", monospace', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 5, padding: '1px 5px', whiteSpace: 'nowrap' }}>{update.version}</span>
            )}
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{update.title}</p>
        </div>

        {/* dismiss */}
        {open && (
          <button
            onClick={e => { e.stopPropagation(); close() }}
            aria-label="Dismiss"
            style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} style={{ width: 11, height: 11 }}><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}

        {/* countdown bar */}
        {open && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, height: 2.5, borderRadius: 2, background: cat.color, boxShadow: `0 0 8px ${cat.glow}`, animation: `islandCountdown ${DURATION}ms linear forwards` }} />
        )}
      </div>
    </div>
  )
}
