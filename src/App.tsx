import React, { useState, useEffect } from 'react'
import { SplashScreen } from './components/SplashScreen'
import { KeyScreen } from './pages/KeyScreen'
import { Dashboard } from './pages/Dashboard'
import { OwnerKillPanel } from './components/OwnerKillPanel'
import { UpdateBanner } from './components/UpdateBanner'
import { AnnouncementBanner } from './components/AnnouncementBanner'
import { TitleBar } from './components/TitleBar'
import { applyUiTheme, applyUiDesign } from './ui-themes'
import type { LicenseData } from './types'

// Minimum time the splash stays up, even if everything loads instantly
const MIN_SPLASH_MS = 7000

export default function App() {
  const [license, setLicense]       = useState<LicenseData | null | undefined>(undefined)
  const [minElapsed, setMinElapsed] = useState(false)
  const [killed, setKilled]         = useState(false)   // global owner kill-switch
  const [ownerPanel, setOwnerPanel] = useState(false)   // hidden master-control panel
  const [panic, setPanic]           = useState(false)   // panic-hotkey confirmation

  // Apply the saved UI theme + design language as early as possible (covers splash
  // + KeyScreen) so there's no flash of the wrong skin.
  useEffect(() => {
    window.electron.store.getSettings()
      .then(s => { applyUiTheme(s.uiTheme); applyUiDesign(s.uiDesign) })
      .catch(() => {})
  }, [])

  // Re-validate the stored license against the server while the splash plays.
  // This re-binds the HWID if it was reset, and enforces revocation/expiry.
  useEffect(() => {
    window.electron.store.revalidateLicense()
      .then(l => setLicense(l && new Date(l.expiresAt) > new Date() ? l : null))
      .catch(() => setLicense(null))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS)
    return () => clearTimeout(t)
  }, [])

  // Poll the global kill-switch (owner can disable the app for everyone). On
  // launch + every 30s. Fails open server-side, so an outage never locks anyone.
  // We ALSO listen for the main process's instant broadcast (app:kill-changed)
  // so the lockout flips the moment the owner toggles it — no 30s wait.
  useEffect(() => {
    let alive = true
    const check = () => window.electron.app.status().then(s => { if (alive) setKilled(s.killed) }).catch(() => {})
    check()
    const id = setInterval(check, 12000)
    const off = window.electron.app.onKillChanged(k => { if (alive) setKilled(k) })
    return () => { alive = false; clearInterval(id); off() }
  }, [])

  // Hidden owner trigger — Ctrl+Alt+Shift+K opens the master-control panel. No UI
  // hint; and the panel still requires the owner secret to do anything.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.shiftKey && (e.key === 'K' || e.key === 'k')) {
        e.preventDefault()
        setOwnerPanel(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Panic hotkey (Ctrl+Alt+Shift+Q, handled globally in main) → brief confirmation.
  useEffect(() => {
    return window.electron.app.onPanic(() => {
      setPanic(true)
      window.setTimeout(() => setPanic(false), 3500)
    })
  }, [])

  // Re-validate periodically while the app is open so a key that gets revoked or
  // expires mid-session (or has its HWID transferred by staff) locks the app
  // within minutes — not only at the next launch. The main process treats a
  // server outage as "keep access" (see store:revalidate-license), so a network
  // blip won't kick a paying user; only a real rejection returns null here.
  useEffect(() => {
    if (!license) return
    const REVALIDATE_MS = 10 * 60 * 1000
    const id = setInterval(() => {
      window.electron.store.revalidateLicense()
        .then(l => { if (!l || new Date(l.expiresAt) <= new Date()) setLicense(null) })
        .catch(() => { /* keep access on a renderer-side error */ })
    }, REVALIDATE_MS)
    return () => clearInterval(id)
  }, [license])

  // Ready only when the minimum time has passed AND the license check finished
  const ready = minElapsed && license !== undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Custom frameless title bar with minimize / maximize / close */}
      <TitleBar />

      {/* App content fills the rest below the title bar. It eases in (opacity +
          slight zoom) as the splash eases out → a smooth crossfade, not a hard cut. */}
      <div style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        opacity: ready ? 1 : 0,
        transform: ready ? 'scale(1)' : 'scale(0.985)',
        transition: 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1)',
      }}>
        {ready && (license
          ? <Dashboard license={license} onLogout={() => setLicense(null)} />
          : <KeyScreen onValidated={setLicense} />)}
      </div>

      {/* "Update available" notice — only once past the splash + licensed */}
      {ready && license && <UpdateBanner />}

      {/* Owner broadcast announcement banner */}
      {ready && license && <AnnouncementBanner />}

      {/* Splash overlay — fades out once ready, then unmounts itself */}
      <SplashScreen done={ready} />

      {/* Global kill-switch lockout — covers everything, makes the app unusable */}
      {killed && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
          background: 'radial-gradient(120% 120% at 50% 30%, #14101f, #050308)', color: '#fff', textAlign: 'center', padding: 24, WebkitUserSelect: 'none', userSelect: 'none' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171' }}>
            <svg style={{ width: 28, height: 28 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" /></svg>
          </div>
          <h1 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>Leventia is temporarily unavailable</h1>
          <p style={{ fontSize: 12.5, color: 'oklch(0.8 0.035 283)', maxWidth: 360, lineHeight: 1.6, margin: 0 }}>
            Service has been paused by the administrator. Please check back later.
          </p>
        </div>
      )}

      {/* Hidden owner master-control panel (Ctrl+Alt+Shift+K) — renders above the lockout */}
      {ownerPanel && <OwnerKillPanel onClose={() => setOwnerPanel(false)} />}

      {/* Panic confirmation toast */}
      {panic && (
        <div className="animate-slide-up" style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 9998,
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(239,68,68,0.22), rgba(185,28,28,0.22))', border: '1px solid rgba(248,113,113,0.5)',
          color: '#fecaca', fontSize: 12.5, fontWeight: 600, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
          boxShadow: '0 10px 30px -10px rgba(239,68,68,0.55)' }}>
          <svg style={{ width: 15, height: 15, color: '#f87171' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" /></svg>
          Panic — stopped auto-alting & closed all Roblox instances
        </div>
      )}
    </div>
  )
}
