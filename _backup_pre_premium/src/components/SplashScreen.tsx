import React, { useEffect, useState } from 'react'
import splashVideo from '../assets/splash.mp4'

interface Props {
  done: boolean
}

export function SplashScreen({ done }: Props) {
  const [progress, setProgress] = useState(0)
  const [hidden, setHidden]     = useState(false)

  // Smoothly fill toward ~96% over ~7s using one CSS transition (no chunky steps —
  // the browser interpolates every frame, so it rises continuously ~pixel by pixel).
  useEffect(() => {
    const t = setTimeout(() => setProgress(96), 40)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!done) return
    setProgress(100)
    const t = setTimeout(() => setHidden(true), 600)
    return () => clearTimeout(t)
  }, [done])

  if (hidden) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--app-bg)',
      transition: 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1)',
      opacity: done ? 0 : 1,
      transform: done ? 'scale(1.06)' : 'scale(1)',
      pointerEvents: done ? 'none' : 'auto',
      userSelect: 'none',
    }}>
      {/* Animated video background */}
      <video src={splashVideo} autoPlay loop muted playsInline
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
      {/* Dark scrim for contrast */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1,
        background: 'radial-gradient(120% 95% at 50% 45%, rgba(7,7,14,0.32) 0%, rgba(7,7,14,0.74) 70%, rgba(7,7,14,0.92) 100%)' }} />

      {/* Bottom block — loading bar stacked directly above the title */}
      <div style={{ position: 'absolute', bottom: 30, left: 0, right: 0, zIndex: 2,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {/* Loading bar */}
        <div style={{ width: 240, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 99, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{
            height: '100%', width: `${progress}%`, borderRadius: 99,
            background: 'linear-gradient(90deg, oklch(0.66 0.22 285), oklch(0.74 0.16 220))',
            transition: done ? 'width 0.3s ease' : 'width 6.9s linear',
            boxShadow: '0 0 10px rgba(124,58,237,0.6)',
          }} />
        </div>
        {/* Title */}
        <p style={{ margin: 0,
          fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.14em', textTransform: 'uppercase',
          textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
          Leventia Alting Manager
        </p>
      </div>
    </div>
  )
}
