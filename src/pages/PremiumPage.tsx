import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { AppSettings, AntiAfkStatus, RobloxAccount, ResourceTrimStatus } from '../types'
import { AutoAltingSection } from '../components/AutoAltingSection'
import { HealthCheckSection } from '../components/HealthCheckSection'
import { ServerManagementSection } from '../components/ServerManagementSection'
import { UI_THEMES, applyUiTheme, applyUiDesign, type UiDesign } from '../ui-themes'

const INTERVALS = [1, 3, 5, 10, 15] as const

type PremiumTab = 'antiafk' | 'lowgpu' | 'autoalt' | 'servermap' | 'health' | 'themes' | 'background'

export function PremiumPage() {
  const [tab, setTab]           = useState<PremiumTab>('antiafk')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [status, setStatus]     = useState<AntiAfkStatus | null>(null)
  const [leaving, setLeaving]   = useState(false)
  const [leftCount, setLeftCount] = useState<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [accounts, setAccounts]   = useState<RobloxAccount[]>([])
  const [runningIds, setRunningIds] = useState<string[]>([])
  const [fpsDraft, setFpsDraft]   = useState<string | null>(null)   // custom FPS input draft
  const [trimStatus, setTrimStatus] = useState<ResourceTrimStatus | null>(null)

  // Load settings + start status polling
  useEffect(() => {
    window.electron.store.getSettings().then(setSettings).catch(() => {})
    window.electron.store.getAccounts().then(setAccounts).catch(() => {})
    const poll = () => {
      window.electron.antiAfk.status().then(setStatus).catch(() => {})
      window.electron.roblox.getRunning().then(setRunningIds).catch(() => {})
      window.electron.trim.status().then(setTrimStatus).catch(() => {})
    }
    poll()
    pollRef.current = setInterval(poll, 4000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const saveSettings = useCallback(async (next: AppSettings) => {
    setSettings(next)
    await window.electron.store.saveSettings(next).catch(() => {})
  }, [])

  const selectUiTheme = async (id: string) => {
    if (!settings) return
    applyUiTheme(id)                        // reskin immediately
    await saveSettings({ ...settings, uiTheme: id })
  }

  const selectUiDesign = async (mode: UiDesign) => {
    if (!settings) return
    applyUiDesign(mode)                     // restyle immediately
    await saveSettings({ ...settings, uiDesign: mode })
  }

  // ── Background ──
  const saveBg = (partial: Partial<AppSettings>) => {
    if (!settings) return
    saveSettings({ ...settings, ...partial })
    window.dispatchEvent(new Event('lvnt:bg-changed'))
  }
  const pickMedia = async (kind: 'image' | 'video') => {
    const r = await window.electron.bg.pick(kind)
    if (r.success && r.url) saveBg({ bgType: kind, bgMedia: r.url })
  }
  const clearMedia = async () => {
    await window.electron.bg.clear().catch(() => {})
    saveBg({ bgType: 'default', bgMedia: '' })
  }

  // Write the combined performance state (low-graphics preset + FPS cap), or restore
  // originals when neither is active. apply() reads the freshly-saved settings.
  const applyPerf = async (next: AppSettings) => {
    if (next.lowGpuEnabled || (next.fpsCap ?? 0) > 0 || next.disableTextures || next.minimalLighting || next.skipSplash)
      await window.electron.lowGpu.apply().catch(() => {})
    else
      await window.electron.lowGpu.restore().catch(() => {})
  }

  const toggleTextures = async () => {
    if (!settings) return
    const next = { ...settings, disableTextures: !settings.disableTextures }
    await saveSettings(next); await applyPerf(next)
  }
  const toggleLighting = async () => {
    if (!settings) return
    const next = { ...settings, minimalLighting: !settings.minimalLighting }
    await saveSettings(next); await applyPerf(next)
  }
  const toggleSplash = async () => {
    if (!settings) return
    const next = { ...settings, skipSplash: !settings.skipSplash }
    await saveSettings(next); await applyPerf(next)
  }
  const toggleMusic = async () => {
    if (!settings) return
    const next = { ...settings, muteMusic: !settings.muteMusic }
    await saveSettings(next)
    // Apply now to running alts (mutes/unmutes their Roblox audio session immediately).
    await window.electron.antiAfk.setMute(next.muteMusic).catch(() => {})
  }

  const toggleLowGpu = async () => {
    if (!settings) return
    const next = { ...settings, lowGpuEnabled: !settings.lowGpuEnabled }
    await saveSettings(next)
    await applyPerf(next)
  }

  const toggleTrim = async () => {
    if (!settings) return
    const next = { ...settings, autoTrim: !settings.autoTrim }
    await saveSettings(next)
    // Kick an immediate sweep when turning it on so the user sees it work right away.
    if (next.autoTrim) window.electron.trim.now().then(setTrimStatus).catch(() => {})
  }

  const togglePixel = async () => {
    if (!settings) return
    const next = { ...settings, pixelReduceEnabled: !settings.pixelReduceEnabled }
    await saveSettings(next)
    if (next.pixelReduceEnabled) window.electron.trim.now().then(setTrimStatus).catch(() => {})
  }
  const setPixelSize = async (px: number) => {
    if (!settings) return
    const size = Math.max(100, Math.min(2000, Math.round(px || 100)))
    const next = { ...settings, pixelReduceSize: size }
    await saveSettings(next)
    if (settings.pixelReduceEnabled) window.electron.trim.now().then(setTrimStatus).catch(() => {})
  }

  const toggleRam = async () => {
    if (!settings) return
    const next = { ...settings, ramLimitEnabled: !settings.ramLimitEnabled }
    await saveSettings(next)
    if (next.ramLimitEnabled) window.electron.trim.now().then(setTrimStatus).catch(() => {})
  }
  const setRamMb = async (mb: number) => {
    if (!settings) return
    const v = Math.max(150, Math.min(4000, Math.round(mb || 350)))
    const next = { ...settings, ramLimitMb: v }
    await saveSettings(next)
    if (settings.ramLimitEnabled) window.electron.trim.now().then(setTrimStatus).catch(() => {})
  }

  const setFpsCap = async (fps: number) => {
    if (!settings) return
    const cap = Math.max(0, Math.min(1000, Math.round(fps || 0)))
    const next = { ...settings, fpsCap: cap }
    await saveSettings(next)
    await applyPerf(next)
  }

  const toggleEnabled = async () => {
    if (!settings) return
    const next = { ...settings, antiAfkEnabled: !settings.antiAfkEnabled }
    await saveSettings(next)
    if (next.antiAfkEnabled) await window.electron.antiAfk.start(next.antiAfkInterval)
    else                     await window.electron.antiAfk.stop()
    window.electron.antiAfk.status().then(setStatus).catch(() => {})
  }

  const setInterval_ = async (minutes: number) => {
    if (!settings) return
    await saveSettings({ ...settings, antiAfkInterval: minutes })
    await window.electron.antiAfk.setInterval(minutes)
    window.electron.antiAfk.status().then(setStatus).catch(() => {})
  }

  const setAction = async (action: AppSettings['antiAfkAction']) => {
    if (!settings) return
    await saveSettings({ ...settings, antiAfkAction: action })
  }

  const toggleAccount = async (id: string) => {
    if (!settings) return
    const cur = settings.antiAfkAccountIds ?? []
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
    await saveSettings({ ...settings, antiAfkAccountIds: next })
  }

  const setAllAccounts = async (ids: string[]) => {
    if (!settings) return
    await saveSettings({ ...settings, antiAfkAccountIds: ids })
  }

  const handleLeaveAll = async () => {
    setLeaving(true)
    try {
      const killed = await window.electron.antiAfk.leaveAll()
      setLeftCount(killed)
      setTimeout(() => setLeftCount(null), 3000)
      window.electron.antiAfk.status().then(setStatus).catch(() => {})
    } finally { setLeaving(false) }
  }

  if (!settings) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 20, height: 20, border: '2px solid rgba(124,58,237,0.4)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spinSlow 0.7s linear infinite' }} />
      </div>
    )
  }

  const running = status?.running ?? false
  const windows = status?.windowCount ?? 0

  const TABS: { id: PremiumTab; label: string }[] = [
    { id: 'antiafk', label: 'Anti-AFK' },
    { id: 'lowgpu',  label: 'Performance' },
    { id: 'autoalt', label: 'Auto Alting' },
    { id: 'servermap', label: 'Server Management' },
    { id: 'health',  label: 'Health Check' },
    { id: 'themes',  label: 'Themes' },
    { id: 'background', label: 'Background' },
  ]

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: tab === 'servermap' ? 920 : 560 }}>

        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>✦</span> Premium
          </h1>
          <p style={{ fontSize: 11, color: 'oklch(0.82 0.035 284)', marginTop: 4 }}>Power tools for running your alts</p>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none',
                color: tab === t.id ? '#c4b5fd' : 'rgba(255,255,255,0.9)',
                textShadow: '0 1px 3px rgba(0,0,0,0.65)',
                borderBottom: tab === t.id ? '2px solid #a78bfa' : '2px solid transparent', marginBottom: -1, transition: 'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ════════════ ANTI-AFK TAB ════════════ */}
        {tab === 'antiafk' && (<>

        {/* Live status banner */}
        <div className="glass" style={{ padding: '18px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="glass-aurora" />
          <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
              background: running ? 'radial-gradient(circle, rgba(34,197,94,0.3) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
              filter: 'blur(6px)', animation: running ? 'glowPulse 2s ease-in-out infinite' : 'none' }} />
            <div style={{ position: 'relative', width: 44, height: 44, borderRadius: '50%',
              background: running ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${running ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.1)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg style={{ width: 22, height: 22, color: running ? '#4ade80' : 'oklch(0.7 0.035 281)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              </svg>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                {running ? 'Anti-AFK Active' : 'Anti-AFK Idle'}
              </span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: running ? '#4ade80' : 'oklch(0.62 0.03 280)', boxShadow: running ? '0 0 6px #4ade80' : 'none', animation: running ? 'glowPulse 1.5s ease-in-out infinite' : 'none' }} />
            </div>
            <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3 }}>
              {windows > 0
                ? `Keeping ${windows} Roblox window${windows > 1 ? 's' : ''} active every ${settings.antiAfkInterval} min`
                : 'Idle — your focused window is always skipped; all other Roblox windows get kept active'}
            </p>
          </div>

          {/* Window count chip */}
          <div style={{ textAlign: 'center', padding: '8px 16px', borderRadius: 12, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#c4b5fd', fontFamily: '"JetBrains Mono", monospace', lineHeight: 1 }}>{windows}</p>
            <p style={{ fontSize: 8, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 4 }}>Active</p>
          </div>
        </div>

        {/* Master toggle */}
        <div className="glass" style={{ padding: 18, marginBottom: 12 }}>
          <div className="glass-aurora" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0 }}>Enable Anti-AFK</p>
              <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3 }}>
                Master toggle — turn on to keep your alts un-kicked
              </p>
            </div>
            <button
              onClick={toggleEnabled}
              style={{
                width: 44, height: 24, padding: 0, boxSizing: 'border-box', borderRadius: 99, flexShrink: 0, position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s, box-shadow 0.2s',
                background: settings.antiAfkEnabled ? 'linear-gradient(135deg, oklch(0.62 0.22 280), oklch(0.55 0.24 295))' : 'rgba(255,255,255,0.1)',
                boxShadow: settings.antiAfkEnabled ? '0 2px 10px rgba(124,58,237,0.45)' : 'none',
              }}
            >
              <span style={{ position: 'absolute', top: 3, left: settings.antiAfkEnabled ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
            </button>
          </div>
        </div>

        {/* Interval */}
        <div className="glass" style={{ padding: 18, marginBottom: 12, opacity: settings.antiAfkEnabled ? 1 : 0.5, pointerEvents: settings.antiAfkEnabled ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
          <div className="glass-aurora" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0 }}>Interval</p>
              <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3 }}>How often to wiggle — Roblox kicks at 20 min</p>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#c4b5fd', fontFamily: '"JetBrains Mono", monospace' }}>{settings.antiAfkInterval} min</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {INTERVALS.map(m => {
              const active = settings.antiAfkInterval === m
              return (
                <button key={m} onClick={() => setInterval_(m)}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                    background: active ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? 'rgba(167,139,250,0.45)' : 'rgba(255,255,255,0.08)'}`,
                    color: active ? '#c4b5fd' : 'oklch(0.82 0.035 284)' }}>
                  {m}m
                </button>
              )
            })}
          </div>
        </div>

        {/* Action */}
        <div className="glass" style={{ padding: 18, marginBottom: 12, opacity: settings.antiAfkEnabled ? 1 : 0.5, pointerEvents: settings.antiAfkEnabled ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
          <div className="glass-aurora" />
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0 }}>Action</p>
            <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3 }}>What each alt does to stay un-kicked</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {([
              { id: 'jump', label: 'Jump',            desc: 'Tap Space',  recommended: true },
              { id: 'ws',   label: 'Forward + Back',  desc: 'Tap W then S', recommended: false },
              { id: 'zoom', label: 'Zoom In/Out',     desc: 'Tap I then O', recommended: false },
            ] as const).map(a => {
              const current = settings.antiAfkAction === 'jump' || settings.antiAfkAction === 'zoom' ? settings.antiAfkAction : 'ws'
              const active = current === a.id
              const rec = a.recommended
              return (
                <button key={a.id} onClick={() => setAction(a.id)}
                  style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                    gridColumn: rec ? '1 / -1' : undefined,
                    background: active ? 'rgba(124,58,237,0.22)' : rec ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.03)',
                    border: rec
                      ? `1.5px solid ${active ? 'rgba(167,139,250,0.8)' : 'rgba(167,139,250,0.5)'}`
                      : `1px solid ${active ? 'rgba(167,139,250,0.45)' : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: rec ? '0 2px 16px rgba(124,58,237,0.2)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: active ? '#c4b5fd' : '#e0d7ff', margin: 0 }}>{a.label}</p>
                    {rec && <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#c4b5fd', background: 'rgba(167,139,250,0.18)', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 99, padding: '2px 7px' }}>Recommended</span>}
                  </div>
                  <p style={{ fontSize: 10, color: 'oklch(0.74 0.035 282)', marginTop: 2 }}>{a.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Performance: minimize while running */}
        <div className="glass" style={{ padding: 18, marginBottom: 12 }}>
          <div className="glass-aurora" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0 }}>Minimize Roblox while running</p>
              <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3, maxWidth: 360, lineHeight: 1.5 }}>
                Keeps alt windows minimized between wiggles so Roblox throttles them — big CPU/performance savings. Each window is briefly restored to receive the action, then minimized again.
              </p>
            </div>
            <button onClick={() => saveSettings({ ...settings, antiAfkMinimize: !settings.antiAfkMinimize })}
              style={{ flexShrink: 0, width: 38, height: 21, padding: 0, borderRadius: 99, position: 'relative', border: 'none', cursor: 'pointer',
                background: settings.antiAfkMinimize ? 'var(--grad-btn)' : 'rgba(255,255,255,0.08)',
                boxShadow: settings.antiAfkMinimize ? '0 2px 8px rgba(124,58,237,0.4)' : 'none', transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: 2, left: settings.antiAfkMinimize ? 19 : 2, width: 17, height: 17, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0 }}>Mute all alts</p>
              <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3, maxWidth: 360, lineHeight: 1.5 }}>
                Silences every Roblox instance's audio so 10+ alts don't blast sound. Re-applied each cycle to catch newly-launched ones.
              </p>
            </div>
            <button onClick={() => { const next = !settings.antiAfkMute; saveSettings({ ...settings, antiAfkMute: next }); window.electron.antiAfk.setMute(next).catch(() => {}) }}
              style={{ flexShrink: 0, width: 38, height: 21, padding: 0, borderRadius: 99, position: 'relative', border: 'none', cursor: 'pointer',
                background: settings.antiAfkMute ? 'var(--grad-btn)' : 'rgba(255,255,255,0.08)',
                boxShadow: settings.antiAfkMute ? '0 2px 8px rgba(124,58,237,0.4)' : 'none', transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: 2, left: settings.antiAfkMute ? 19 : 2, width: 17, height: 17, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
            </button>
          </div>
        </div>

        {/* Accounts to keep active */}
        <div className="glass" style={{ padding: 18, marginBottom: 12 }}>
          <div className="glass-aurora" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0 }}>Limit to specific alts <span style={{ fontSize: 10, fontWeight: 500, color: 'oklch(0.7 0.035 281)' }}>(optional)</span></p>
              <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3 }}>
                Leave all unticked to keep every alt active. The window you're actively using is always skipped, so your main is never touched.
              </p>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd', fontFamily: '"JetBrains Mono", monospace', flexShrink: 0 }}>
              {(settings.antiAfkAccountIds ?? []).length}/{accounts.length}
            </span>
          </div>

          {accounts.length === 0 ? (
            <p style={{ fontSize: 11, color: 'oklch(0.7 0.035 281)', textAlign: 'center', padding: '14px 0' }}>
              No accounts added yet — add accounts first, then pick which ones to keep active.
            </p>
          ) : (<>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <button onClick={() => setAllAccounts(accounts.map(a => a.id))}
                style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'oklch(0.82 0.035 284)' }}>
                Select all
              </button>
              <button onClick={() => setAllAccounts([])}
                style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'oklch(0.82 0.035 284)' }}>
                Clear
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
              {accounts.map(a => {
                const checked = (settings.antiAfkAccountIds ?? []).includes(a.id)
                const isRunning = runningIds.includes(a.id)
                return (
                  <button key={a.id} onClick={() => toggleAccount(a.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      background: checked ? 'rgba(124,58,237,0.14)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${checked ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.07)'}`, transition: 'all 0.15s' }}>
                    <span style={{ width: 16, height: 16, borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: checked ? 'linear-gradient(135deg, oklch(0.62 0.22 280), oklch(0.55 0.24 295))' : 'transparent',
                      border: `1.5px solid ${checked ? 'transparent' : 'rgba(255,255,255,0.25)'}` }}>
                      {checked && <svg style={{ width: 11, height: 11, color: '#fff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                    </span>
                    {a.avatarUrl
                      ? <img src={a.avatarUrl} alt="" style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.05)' }} />
                      : <span style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.06)' }} />}
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#e0d7ff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.username}
                    </span>
                    <span title={isRunning ? 'Running' : 'Not running'} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: isRunning ? '#4ade80' : 'oklch(0.66 0.03 280)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: isRunning ? '#4ade80' : 'oklch(0.62 0.03 280)', boxShadow: isRunning ? '0 0 5px #4ade80' : 'none' }} />
                      {isRunning ? 'Live' : 'Offline'}
                    </span>
                  </button>
                )
              })}
            </div>
          </>)}
        </div>

        {/* Leave All */}
        <div className="glass" style={{ padding: 18, border: '1px solid rgba(248,113,113,0.18)' }}>
          <div className="glass-aurora" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0 }}>Leave All</p>
              <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3 }}>
                {leftCount !== null
                  ? `Closed ${leftCount} Roblox instance${leftCount !== 1 ? 's' : ''}.`
                  : 'Stop Anti-AFK and close every running Roblox window'}
              </p>
            </div>
            <button
              onClick={handleLeaveAll}
              disabled={leaving}
              style={{
                flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10,
                background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.22)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.12)' }}
            >
              {leaving
                ? <span style={{ width: 13, height: 13, border: '2px solid rgba(248,113,113,0.4)', borderTopColor: '#f87171', borderRadius: '50%', animation: 'spinSlow 0.7s linear infinite', display: 'inline-block' }} />
                : <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
              }
              Leave All
            </button>
          </div>
        </div>

        {/* How it works */}
        <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>How it works</p>
          <p style={{ fontSize: 11, color: 'oklch(0.8 0.035 283)', lineHeight: 1.7, margin: 0 }}>
            Anti-AFK briefly brings each Roblox window — except the one you're using — to the foreground, sends real movement/jump input (Roblox only registers real input, not background messages), then returns focus to you.
            Expect a quick flash of those windows at each interval. The window you're actively in is always skipped, so your main is never disturbed.
          </p>
        </div>

        </>)}

        {/* ════════════ PERFORMANCE TAB ════════════ */}
        {tab === 'lowgpu' && (<>
        {/* ── FPS Cap ── */}
        <div className="glass" style={{ padding: 18, marginBottom: 12 }}>
          <div className="glass-aurora" />
          <div style={{ marginBottom: 13 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              FPS Cap
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(103,232,249,0.15)', border: '1px solid rgba(103,232,249,0.3)', color: '#67e8f9', letterSpacing: '0.1em' }}>LOWERS USAGE</span>
            </h2>
            <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3 }}>
              Limit the frame rate of every alt you launch. Lower FPS = far less GPU &amp; CPU per instance. Applies on the next launch.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            {([['1', 1], ['5', 5], ['10', 10], ['20', 20], ['30', 30], ['60', 60], ['Unlimited', 0]] as const).map(([label, v]) => {
              const active = (settings.fpsCap ?? 0) === v
              return (
                <button key={label} onClick={() => { setFpsDraft(null); setFpsCap(v) }}
                  style={{ padding: '7px 13px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    border: `1px solid ${active ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.12)'}`,
                    background: active ? 'var(--grad-btn)' : 'rgba(255,255,255,0.04)',
                    color: active ? '#fff' : 'oklch(0.88 0.025 285)' }}>
                  {label}
                </button>
              )
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              <input type="number" min={0} max={1000} placeholder="Custom"
                className="input-base" style={{ width: 92 }}
                value={fpsDraft ?? (settings.fpsCap ? String(settings.fpsCap) : '')}
                onChange={e => setFpsDraft(e.target.value)}
                onBlur={() => { if (fpsDraft !== null) { setFpsCap(parseInt(fpsDraft || '0', 10) || 0); setFpsDraft(null) } }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
              <span style={{ fontSize: 11, color: 'oklch(0.74 0.035 282)' }}>FPS</span>
            </div>
          </div>
          <p style={{ fontSize: 10.5, color: 'oklch(0.74 0.035 282)', marginTop: 11, marginBottom: 0 }}>
            Current cap: <strong style={{ color: '#c4b5fd' }}>{(settings.fpsCap ?? 0) > 0 ? `${settings.fpsCap} FPS` : 'Unlimited'}</strong>
          </p>
        </div>

        {/* ── Low GPU graphics ── */}
        <div className="glass" style={{ padding: 18 }}>
          <div className="glass-aurora" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: settings.lowGpuEnabled ? 14 : 0 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                Low GPU Mode
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', letterSpacing: '0.1em' }}>SAVES VRAM</span>
              </h2>
              <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3 }}>Reduce graphics per instance. Turn on, then launch your alts.</p>
            </div>
            <button onClick={toggleLowGpu}
              style={{ width: 44, height: 24, padding: 0, boxSizing: 'border-box', borderRadius: 99, flexShrink: 0, position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s',
                background: settings.lowGpuEnabled ? 'linear-gradient(135deg, oklch(0.62 0.22 280), oklch(0.55 0.24 295))' : 'rgba(255,255,255,0.1)',
                boxShadow: settings.lowGpuEnabled ? '0 2px 10px rgba(124,58,237,0.45)' : 'none' }}>
              <span style={{ position: 'absolute', top: 3, left: settings.lowGpuEnabled ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
            </button>
          </div>

          {settings.lowGpuEnabled && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', paddingTop: 4 }}>
              {[
                ['Render resolution', 'Minimum'],
                ['Graphics quality', 'Level 1'],
                ['Shadows / lighting', 'Off'],
                ['Grass / wind', 'Off'],
                ['Texture quality', 'Lowest'],
                ['Anti-aliasing', 'Off'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ color: 'oklch(0.78 0.035 283)' }}>{k}</span>
                  <span style={{ color: '#fbbf24', fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Disable Roblox Textures (FastFlag) ── */}
        <div className="glass" style={{ padding: 18, marginTop: 12 }}>
          <div className="glass-aurora" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                Disable Roblox Textures
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', letterSpacing: '0.1em' }}>SAVES VRAM</span>
              </h2>
              <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3, maxWidth: 460, lineHeight: 1.5 }}>
                Strip texture assets to bare minimum — cuts VRAM use per alt. Applies on the next launch (FastFlag).
              </p>
            </div>
            <button onClick={toggleTextures}
              style={{ width: 44, height: 24, padding: 0, boxSizing: 'border-box', borderRadius: 99, flexShrink: 0, position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s',
                background: settings.disableTextures ? 'linear-gradient(135deg, oklch(0.62 0.22 280), oklch(0.55 0.24 295))' : 'rgba(255,255,255,0.1)',
                boxShadow: settings.disableTextures ? '0 2px 10px rgba(124,58,237,0.45)' : 'none' }}>
              <span style={{ position: 'absolute', top: 3, left: settings.disableTextures ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
            </button>
          </div>
        </div>

        {/* ── Force Minimal Lighting (FastFlag) ── */}
        <div className="glass" style={{ padding: 18, marginTop: 12 }}>
          <div className="glass-aurora" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                Force Minimal Lighting
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', letterSpacing: '0.1em' }}>SAVES GPU</span>
              </h2>
              <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3, maxWidth: 460, lineHeight: 1.5 }}>
                Turn off post-processing, shadows, dynamic lights and wind — big GPU savings on dense servers. Applies on the next launch (FastFlag).
              </p>
            </div>
            <button onClick={toggleLighting}
              style={{ width: 44, height: 24, padding: 0, boxSizing: 'border-box', borderRadius: 99, flexShrink: 0, position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s',
                background: settings.minimalLighting ? 'linear-gradient(135deg, oklch(0.62 0.22 280), oklch(0.55 0.24 295))' : 'rgba(255,255,255,0.1)',
                boxShadow: settings.minimalLighting ? '0 2px 10px rgba(124,58,237,0.45)' : 'none' }}>
              <span style={{ position: 'absolute', top: 3, left: settings.minimalLighting ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
            </button>
          </div>
        </div>

        {/* ── Skip Roblox Splash Screen (FastFlag) ── */}
        <div className="glass" style={{ padding: 18, marginTop: 12 }}>
          <div className="glass-aurora" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                Skip Roblox Splash Screen
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(103,232,249,0.15)', border: '1px solid rgba(103,232,249,0.3)', color: '#67e8f9', letterSpacing: '0.1em' }}>FASTER JOINS</span>
              </h2>
              <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3, maxWidth: 460, lineHeight: 1.5 }}>
                Strips the loading/teleport screen blur &amp; effects so alts render into the game faster and use less GPU during the join. Applies on the next launch (FastFlag).
              </p>
            </div>
            <button onClick={toggleSplash}
              style={{ width: 44, height: 24, padding: 0, boxSizing: 'border-box', borderRadius: 99, flexShrink: 0, position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s',
                background: settings.skipSplash ? 'linear-gradient(135deg, oklch(0.62 0.22 280), oklch(0.55 0.24 295))' : 'rgba(255,255,255,0.1)',
                boxShadow: settings.skipSplash ? '0 2px 10px rgba(124,58,237,0.45)' : 'none' }}>
              <span style={{ position: 'absolute', top: 3, left: settings.skipSplash ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
            </button>
          </div>
        </div>

        {/* ── Disable In-Game Music (audio-session mute) ── */}
        <div className="glass" style={{ padding: 18, marginTop: 12 }}>
          <div className="glass-aurora" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                Disable In-Game Music
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', letterSpacing: '0.1em' }}>SILENCES ALTS</span>
              </h2>
              <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3, maxWidth: 460, lineHeight: 1.5 }}>
                Mutes each alt's Roblox audio so there's no music while alting. Applied per-process via Windows audio sessions (Roblox doesn't expose music separately, so it silences the alt's audio). Takes effect immediately on running alts.
              </p>
            </div>
            <button onClick={toggleMusic}
              style={{ width: 44, height: 24, padding: 0, boxSizing: 'border-box', borderRadius: 99, flexShrink: 0, position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s',
                background: settings.muteMusic ? 'linear-gradient(135deg, oklch(0.74 0.18 150), oklch(0.65 0.20 150))' : 'rgba(255,255,255,0.1)',
                boxShadow: settings.muteMusic ? '0 2px 10px rgba(34,197,94,0.4)' : 'none' }}>
              <span style={{ position: 'absolute', top: 3, left: settings.muteMusic ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
            </button>
          </div>
        </div>

        {/* ── Resource Trim (memory / CPU saver) ── */}
        <div className="glass" style={{ padding: 18, marginTop: 12 }}>
          <div className="glass-aurora" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: settings.autoTrim ? 14 : 0 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                Resource Trim
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', letterSpacing: '0.1em' }}>SAVES RAM &amp; CPU</span>
              </h2>
              <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3, maxWidth: 460, lineHeight: 1.5 }}>
                For 24/7 alting. Every minute, minimizes idle alts (Roblox stops rendering them), drops them to low CPU priority, and trims their RAM back to the OS — so you can run more bots. Leaves the window you're actively using alone.
              </p>
            </div>
            <button onClick={toggleTrim}
              style={{ width: 44, height: 24, padding: 0, boxSizing: 'border-box', borderRadius: 99, flexShrink: 0, position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s',
                background: settings.autoTrim ? 'linear-gradient(135deg, oklch(0.74 0.18 150), oklch(0.65 0.20 150))' : 'rgba(255,255,255,0.1)',
                boxShadow: settings.autoTrim ? '0 2px 10px rgba(34,197,94,0.4)' : 'none' }}>
              <span style={{ position: 'absolute', top: 3, left: settings.autoTrim ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
            </button>
          </div>

          {settings.autoTrim && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, paddingTop: 4 }}>
              <div>
                <p style={{ fontSize: 8, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Alts trimmed</p>
                <p style={{ fontSize: 17, fontWeight: 800, color: '#4ade80', fontFamily: '"JetBrains Mono", monospace', lineHeight: 1.2 }}>{trimStatus?.trimmedCount ?? 0}</p>
              </div>
              <div>
                <p style={{ fontSize: 8, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>RAM reclaimed (last sweep)</p>
                <p style={{ fontSize: 17, fontWeight: 800, color: '#67e8f9', fontFamily: '"JetBrains Mono", monospace', lineHeight: 1.2 }}>{trimStatus?.freedMb ? `${trimStatus.freedMb} MB` : '—'}</p>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: trimStatus?.lastTrim ? '#4ade80' : 'oklch(0.66 0.03 280)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: trimStatus?.lastTrim ? '#4ade80' : '#555', boxShadow: trimStatus?.lastTrim ? '0 0 6px #4ade80' : 'none', animation: trimStatus?.lastTrim ? 'glowPulse 1.5s ease-in-out infinite' : 'none' }} />
                {trimStatus?.lastTrim ? 'Active — re-trims every 60s' : 'Waiting for first sweep…'}
              </span>
            </div>
          )}
        </div>

        {/* ── Pixel Size Reduction (tiny render window) ── */}
        <div className="glass" style={{ padding: 18, marginTop: 12 }}>
          <div className="glass-aurora" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: settings.pixelReduceEnabled ? 14 : 0 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                Pixel Size Reduction
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(103,232,249,0.15)', border: '1px solid rgba(103,232,249,0.3)', color: '#67e8f9', letterSpacing: '0.1em' }}>SAVES GPU</span>
              </h2>
              <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3, maxWidth: 460, lineHeight: 1.5 }}>
                Shrinks each alt's window to a tiny size. Roblox renders to the window, so fewer pixels = far less GPU/CPU — while the client stays active (not minimized). Minimum 100&nbsp;px.
              </p>
            </div>
            <button onClick={togglePixel}
              style={{ width: 44, height: 24, padding: 0, boxSizing: 'border-box', borderRadius: 99, flexShrink: 0, position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s',
                background: settings.pixelReduceEnabled ? 'linear-gradient(135deg, oklch(0.62 0.22 280), oklch(0.55 0.24 295))' : 'rgba(255,255,255,0.1)',
                boxShadow: settings.pixelReduceEnabled ? '0 2px 10px rgba(124,58,237,0.45)' : 'none' }}>
              <span style={{ position: 'absolute', top: 3, left: settings.pixelReduceEnabled ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
            </button>
          </div>
          {settings.pixelReduceEnabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
              <label style={{ fontSize: 11, color: 'oklch(0.8 0.035 283)' }}>Window size</label>
              <input type="number" min={100} max={2000} className="input-base" style={{ width: 96 }}
                value={settings.pixelReduceSize}
                onChange={e => setPixelSize(parseInt(e.target.value, 10) || 100)} />
              <span style={{ fontSize: 11, color: 'oklch(0.74 0.035 282)' }}>px ({settings.pixelReduceSize}×{settings.pixelReduceSize})</span>
            </div>
          )}
        </div>

        {/* ── RAM Limit per account ── */}
        <div className="glass" style={{ padding: 18, marginTop: 12 }}>
          <div className="glass-aurora" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: settings.ramLimitEnabled ? 14 : 0 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                Roblox RAM Cap per Instance (MB)
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', letterSpacing: '0.1em' }}>CAPS RAM</span>
              </h2>
              <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3, maxWidth: 460, lineHeight: 1.5 }}>
                Hard cap: each Roblox instance is limited to this many MB of RAM (recommended: 400). Lower can cause stutter on busy alts.
              </p>
            </div>
            <button onClick={toggleRam}
              style={{ width: 44, height: 24, padding: 0, boxSizing: 'border-box', borderRadius: 99, flexShrink: 0, position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s',
                background: settings.ramLimitEnabled ? 'linear-gradient(135deg, oklch(0.74 0.18 150), oklch(0.65 0.20 150))' : 'rgba(255,255,255,0.1)',
                boxShadow: settings.ramLimitEnabled ? '0 2px 10px rgba(34,197,94,0.4)' : 'none' }}>
              <span style={{ position: 'absolute', top: 3, left: settings.ramLimitEnabled ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
            </button>
          </div>
          {settings.ramLimitEnabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
              <label style={{ fontSize: 11, color: 'oklch(0.8 0.035 283)' }}>Cap per alt</label>
              <input type="number" min={300} max={400} step={10} className="input-base" style={{ width: 96 }}
                value={settings.ramLimitMb}
                onChange={e => setRamMb(parseInt(e.target.value, 10) || 350)} />
              <span style={{ fontSize: 11, color: 'oklch(0.74 0.035 282)' }}>MB / alt</span>
            </div>
          )}
        </div>

        <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>How it works</p>
          <p style={{ fontSize: 11, color: 'oklch(0.8 0.035 283)', lineHeight: 1.7, margin: 0 }}>
            The <strong>FPS cap</strong> and <strong>Low GPU</strong> graphics settings are written as Roblox FastFlags (your
            originals are backed up first). FastFlags are read when a client <strong>starts</strong>, so set these <strong>before</strong> launching —
            they won't change instances already running. The FPS cap is the most reliable way to cut GPU/CPU usage. Setting the cap
            to <strong>Unlimited</strong> and Low GPU <strong>off</strong> restores your original graphics. Those cut <strong>GPU</strong> at launch;
            <strong> Resource Trim</strong> then cuts <strong>CPU &amp; RAM</strong> on already-running alts — use both together for the lowest 24/7 footprint.
          </p>
        </div>
        </>)}

        {/* ════════════ AUTO ALTING TAB ════════════ */}
        {tab === 'autoalt' && (<>
          {/* Auto-Rejoin */}
          <div className="glass" style={{ position: 'relative', padding: '16px 18px', marginBottom: 14 }}>
            <div className="glass-aurora" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <svg style={{ width: 14, height: 14, color: '#a78bfa' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                  Auto-Rejoin on Kick
                </p>
                <p style={{ fontSize: 11, color: 'oklch(0.8 0.035 283)', margin: '5px 0 0', lineHeight: 1.5, maxWidth: 380 }}>
                  Every 60s, re-queues any alt this app launched that leaves the game, with the same server code. Only works while the app is open; a rejoin fails if the cookie expired or the server code changed.
                </p>
              </div>
              <button
                onClick={() => saveSettings({ ...settings, autoRejoinEnabled: !settings.autoRejoinEnabled })}
                style={{ flexShrink: 0, width: 38, height: 21, padding: 0, borderRadius: 99, position: 'relative', border: 'none', cursor: 'pointer',
                  background: settings.autoRejoinEnabled ? 'var(--grad-btn)' : 'rgba(255,255,255,0.08)',
                  boxShadow: settings.autoRejoinEnabled ? '0 2px 8px rgba(124,58,237,0.4)' : 'none', transition: 'background 0.2s' }}>
                <span style={{ position: 'absolute', top: 2, left: settings.autoRejoinEnabled ? 19 : 2, width: 17, height: 17, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
              </button>
            </div>
          </div>

          <AutoAltingSection settings={settings} onSave={saveSettings} accounts={accounts} embedded />
        </>)}

        {/* ════════════ SERVER MANAGEMENT TAB ════════════ */}
        {tab === 'servermap' && (
          <ServerManagementSection settings={settings} onSave={saveSettings} />
        )}

        {/* ════════════ HEALTH CHECK TAB ════════════ */}
        {tab === 'health' && (
          <HealthCheckSection settings={settings} onSave={saveSettings} />
        )}

        {/* ════════════ THEMES TAB ════════════ */}
        {tab === 'themes' && (<>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0 }}>Themes</h2>
            <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3 }}>Reskin the whole dashboard — changes apply instantly and are saved.</p>
          </div>

          {/* ── Design language: Classic vs Modern (live, fully reversible) ── */}
          <p style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.74 0.035 282)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 9 }}>Design</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {([
              { id: 'classic', name: 'Classic', desc: 'The original liquid-glass aurora look.' },
              { id: 'modern',  name: 'Modern',  desc: 'Crisp, flat, low-blur clean dashboard.' },
            ] as const).map(d => {
              const active = (settings.uiDesign ?? 'classic') === d.id
              const modern = d.id === 'modern'
              return (
                <button key={d.id} onClick={() => selectUiDesign(d.id)}
                  style={{ textAlign: 'left', padding: 10, borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s',
                    background: active ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.08)'}` }}>
                  <div style={{ height: 70, borderRadius: 10, position: 'relative', overflow: 'hidden', background: 'oklch(0.13 0.01 260)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {!modern && (<>
                      <div style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', top: -42, left: -22, background: 'radial-gradient(circle, rgba(167,139,250,0.5), transparent 65%)' }} />
                      <div style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', bottom: -50, right: -22, background: 'radial-gradient(circle, rgba(34,211,238,0.34), transparent 65%)' }} />
                    </>)}
                    <div style={{ position: 'absolute', inset: 12, borderRadius: modern ? 9 : 13,
                      background: modern ? 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.018))' : 'linear-gradient(160deg, rgba(44,36,74,0.55), rgba(12,10,26,0.66))',
                      border: `1px solid ${modern ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.18)'}`,
                      boxShadow: modern ? '0 8px 20px -14px rgba(0,0,0,0.85)' : 'inset 0 1px 0 rgba(255,255,255,0.22)' }} />
                    <div style={{ position: 'absolute', left: 18, bottom: 16, width: 42, height: 9, borderRadius: modern ? 5 : 99, background: 'linear-gradient(135deg, oklch(0.66 0.23 282), oklch(0.58 0.25 300))' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: active ? '#c4b5fd' : '#fff', margin: 0 }}>{d.name}</p>
                    {active && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#4ade80', fontWeight: 600 }}>
                        <svg style={{ width: 12, height: 12 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        Active
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 10, color: 'oklch(0.76 0.035 282)', marginTop: 2 }}>{d.desc}</p>
                </button>
              )
            })}
          </div>

          <p style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.74 0.035 282)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 9 }}>Color theme</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {UI_THEMES.map(t => {
              const active = (settings.uiTheme ?? 'default') === t.id
              return (
                <button key={t.id} onClick={() => selectUiTheme(t.id)}
                  style={{ textAlign: 'left', padding: 10, borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s',
                    background: active ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.08)'}` }}>
                  {/* live-ish preview built from the theme's own tokens */}
                  <div style={{ height: 70, borderRadius: 10, position: 'relative', overflow: 'hidden', background: t.vars['--app-bg'], border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ position: 'absolute', inset: 12, borderRadius: 9, background: t.vars['--glass-bg'], border: `1px solid ${t.vars['--glass-border']}` }} />
                    <div style={{ position: 'absolute', left: 18, bottom: 16, width: 44, height: 9, borderRadius: 99, background: t.vars['--grad-btn'], boxShadow: `0 2px 10px ${t.vars['--accent-glow']}` }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: active ? '#c4b5fd' : '#fff', margin: 0 }}>{t.name}</p>
                    {active && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#4ade80', fontWeight: 600 }}>
                        <svg style={{ width: 12, height: 12 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        Active
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 10, color: 'oklch(0.76 0.035 282)', marginTop: 2 }}>{t.desc}</p>
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>About</p>
            <p style={{ fontSize: 11, color: 'oklch(0.8 0.035 283)', lineHeight: 1.7, margin: 0 }}>
              Themes restyle every panel by swapping the glass + accent tokens. <strong>Frosted Glass</strong> is the full glassmorphism look (heavy blur, translucent panels); <strong>Midnight</strong> drops the blur for the lightest GPU load.
            </p>
          </div>
        </>)}

        {/* ════════════ BACKGROUND TAB ════════════ */}
        {tab === 'background' && (<>
          <div className="glass" style={{ padding: 18 }}>
            <div className="glass-aurora" />
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0 }}>Background</h2>
              <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3 }}>Set a color, image, or looping video. Changes apply instantly.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
              {([['default', 'Aurora'], ['color', 'Color'], ['image', 'Image'], ['video', 'Video']] as const).map(([id, label]) => {
                const active = settings.bgType === id
                return (
                  <button key={id} onClick={() => {
                    if (id === 'image' || id === 'video') pickMedia(id)
                    else if (id === 'color') saveBg({ bgType: 'color' })
                    else saveBg({ bgType: 'default' })
                  }}
                    style={{ padding: '9px 0', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                      background: active ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${active ? 'rgba(167,139,250,0.45)' : 'rgba(255,255,255,0.08)'}`,
                      color: active ? '#c4b5fd' : 'oklch(0.85 0.03 284)' }}>
                    {label}
                  </button>
                )
              })}
            </div>

            {settings.bgType === 'color' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#fff', margin: 0 }}>Background color</p>
                  <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 3 }}>Pick any solid color</p>
                </div>
                <input type="color" value={settings.bgColor} onChange={e => saveBg({ bgColor: e.target.value })}
                  style={{ width: 44, height: 30, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 9, background: 'transparent', cursor: 'pointer', padding: 2 }} />
              </div>
            )}

            {(settings.bgType === 'image' || settings.bgType === 'video') && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 14, marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#fff', margin: 0 }}>{settings.bgType === 'video' ? 'Background video' : 'Background image'}</p>
                  <p style={{ fontSize: 11, color: settings.bgMedia ? '#4ade80' : 'oklch(0.78 0.035 283)', marginTop: 3 }}>{settings.bgMedia ? (settings.bgType === 'video' ? 'Video loaded · loops muted' : 'Image loaded') : 'No file chosen yet'}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => pickMedia(settings.bgType as 'image' | 'video')} style={{ padding: '7px 14px', fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: 'pointer', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(167,139,250,0.35)', color: '#c4b5fd' }}>Choose…</button>
                  {settings.bgMedia && <button onClick={clearMedia} style={{ padding: '7px 14px', fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: 'pointer', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>Clear</button>}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.7 0.035 281)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>How it works</p>
            <p style={{ fontSize: 11, color: 'oklch(0.8 0.035 283)', lineHeight: 1.7, margin: 0 }}>
              Pick a solid color, an image, or a looping MP4. Videos play muted and fill the window; a dim, brand-tinted overlay keeps the interface readable. A subtle Leventia watermark stays visible on every background.
            </p>
          </div>
        </>)}

      </div>
    </div>
  )
}
