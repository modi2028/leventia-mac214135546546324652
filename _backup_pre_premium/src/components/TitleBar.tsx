import React, { useEffect, useState } from 'react'
import logoUrl from '../assets/logo.svg'

// Electron's draggable-region flag isn't in React's CSSProperties typings.
type DragStyle = React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' }

const bar: DragStyle = {
  height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  background: 'rgba(10,8,20,0.9)', borderBottom: '1px solid rgba(255,255,255,0.06)',
  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  position: 'relative', zIndex: 9999, userSelect: 'none', WebkitAppRegion: 'drag',
}
const ctrl: DragStyle = {
  width: 46, height: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: 'none', color: 'oklch(0.86 0.03 285)', cursor: 'pointer',
  transition: 'background .15s, color .15s', WebkitAppRegion: 'no-drag', padding: 0,
}

export function TitleBar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    window.electron.window.isMaximized().then(setMaximized).catch(() => {})
    return window.electron.window.onMaximizeChange(setMaximized)
  }, [])

  const hoverNeutral = (on: boolean) => (e: React.MouseEvent) => {
    const el = e.currentTarget as HTMLElement
    el.style.background = on ? 'rgba(255,255,255,0.08)' : 'transparent'
    el.style.color = on ? '#fff' : 'oklch(0.86 0.03 285)'
  }
  const hoverClose = (on: boolean) => (e: React.MouseEvent) => {
    const el = e.currentTarget as HTMLElement
    el.style.background = on ? '#e81123' : 'transparent'
    el.style.color = on ? '#fff' : 'oklch(0.86 0.03 285)'
  }

  return (
    <div style={bar}>
      {/* Brand (part of the drag region) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12 }}>
        <img src={logoUrl} width={16} height={16} alt="" style={{ filter: 'drop-shadow(0 0 6px rgba(124,58,237,0.6))' }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: '#c4b5fd', letterSpacing: '0.1em' }}>LEVENTIA</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'oklch(0.7 0.035 281)', letterSpacing: '0.12em' }}>ALTING</span>
      </div>

      {/* Window controls */}
      <div style={{ display: 'flex', alignItems: 'stretch', height: '100%' }}>
        <button title="Minimize" style={ctrl} onClick={() => window.electron.window.minimize()}
          onMouseEnter={hoverNeutral(true)} onMouseLeave={hoverNeutral(false)}>
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M5 12h14" /></svg>
        </button>

        <button title={maximized ? 'Restore' : 'Maximize'} style={ctrl}
          onClick={async () => { try { setMaximized(await window.electron.window.maximize()) } catch {} }}
          onMouseEnter={hoverNeutral(true)} onMouseLeave={hoverNeutral(false)}>
          {maximized ? (
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="8" y="3" width="13" height="13" rx="1.5" /><path d="M16 16v3.5A1.5 1.5 0 0114.5 21h-11A1.5 1.5 0 012 19.5v-11A1.5 1.5 0 013.5 7H7" />
            </svg>
          ) : (
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="4" y="4" width="16" height="16" rx="1.5" />
            </svg>
          )}
        </button>

        <button title="Close" style={ctrl} onClick={() => window.electron.window.close()}
          onMouseEnter={hoverClose(true)} onMouseLeave={hoverClose(false)}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    </div>
  )
}
