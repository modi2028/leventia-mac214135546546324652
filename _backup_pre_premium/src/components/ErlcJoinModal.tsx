import React, { useState, useEffect, useRef } from 'react'
import type { RobloxAccount } from '../types'
import { isAccountTooNew } from '../account-age'

interface Props {
  accounts: RobloxAccount[]
  selected: Set<string>
  onClose: () => void
}

type Phase = 'idle' | 'resolving' | 'joining' | 'done'

interface AccountResult {
  account: RobloxAccount
  status: 'pending' | 'launching' | 'success' | 'failed' | 'no-cookie' | 'too-new'
  error?: string
}

interface Preset { name: string; code: string }
const PRESETS_KEY = 'erlc-presets-v2'
const loadPresets = (): Preset[] => { try { return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '[]') } catch { return [] } }
const savePresets = (p: Preset[]) => localStorage.setItem(PRESETS_KEY, JSON.stringify(p))

// Remember the batch rate between sessions so it doesn't reset to defaults each open.
const BATCH_KEY = 'erlc-batch-v1'
const loadBatch = (): { size: number; delay: number } => {
  try { const b = JSON.parse(localStorage.getItem(BATCH_KEY) ?? '{}'); return { size: b.size ?? 5, delay: b.delay ?? 10 } }
  catch { return { size: 5, delay: 10 } }
}

// ── Status icon ───────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: AccountResult['status'] }) {
  if (status === 'launching') return (
    <span className="w-3.5 h-3.5 border-2 border-[#e63946] border-t-transparent rounded-full animate-spin inline-block flex-shrink-0" />
  )
  if (status === 'success') return (
    <svg className="w-3.5 h-3.5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
  if (status === 'failed') return (
    <svg className="w-3.5 h-3.5 text-[#e63946] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
  if (status === 'no-cookie') return (
    <svg className="w-3.5 h-3.5 text-[#333] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  )
  if (status === 'too-new') return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#fbbf24' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
  return <span className="w-1.5 h-1.5 rounded-full bg-[#333] inline-block flex-shrink-0 mt-1" />
}

// ── Main component ────────────────────────────────────────────────────────────

export function ErlcJoinModal({ accounts, selected, onClose }: Props) {
  const [serverCode, setServerCode] = useState('')
  const [target, setTarget]         = useState<'selected' | 'all'>(selected.size > 0 ? 'selected' : 'all')
  const [batchSize, setBatchSize]   = useState(() => loadBatch().size)
  const [batchDelay, setBatchDelay] = useState(() => loadBatch().delay)
  const [phase, setPhase]           = useState<Phase>('idle')
  const [results, setResults]       = useState<AccountResult[]>([])
  const [presets, setPresets]       = useState<Preset[]>(loadPresets)
  const [selectedPreset, setSelectedPreset] = useState('')
  const [showSaveInput, setShowSaveInput]   = useState(false)
  const [presetName, setPresetName]         = useState('')
  const [setup, setSetup]           = useState<{ found: boolean; type: string | null; multiInstance: boolean; multiExe?: boolean } | null>(null)
  const abortRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    window.electron.roblox.checkSetup().then(setSetup).catch(() => {})
  }, [])

  // Persist the batch rate so it's remembered next time.
  useEffect(() => {
    localStorage.setItem(BATCH_KEY, JSON.stringify({ size: batchSize, delay: batchDelay }))
  }, [batchSize, batchDelay])

  const targetAccounts  = accounts.filter(a => target === 'all' ? true : selected.has(a.id))
  const withCookie      = targetAccounts.filter(a => !!a.cookie)
  // Accounts under 3 days old are blocked (Roblox bans/captchas fresh accounts).
  const cookieAccounts  = withCookie.filter(a => !isAccountTooNew(a.created))
  const tooNewCount     = withCookie.length - cookieAccounts.length
  const noCookieCount   = targetAccounts.length - withCookie.length

  // ── Presets ────────────────────────────────────────────────────────────────

  const applyPreset = (name: string) => {
    const p = presets.find(x => x.name === name)
    if (p) { setServerCode(p.code); setSelectedPreset(name) }
  }
  const handleSavePreset = () => {
    if (!presetName.trim() || !serverCode.trim()) return
    const updated = [...presets.filter(p => p.name !== presetName.trim()), { name: presetName.trim(), code: serverCode.trim() }]
    savePresets(updated); setPresets(updated)
    setSelectedPreset(presetName.trim()); setShowSaveInput(false); setPresetName('')
  }
  const handleDeletePreset = () => {
    if (!selectedPreset) return
    const updated = presets.filter(p => p.name !== selectedPreset)
    savePresets(updated); setPresets(updated); setSelectedPreset('')
  }

  // ── Launch ─────────────────────────────────────────────────────────────────

  const handleLaunch = async () => {
    const code = serverCode.trim()
    if (!code || cookieAccounts.length === 0) return
    abortRef.current = false
    setPhase('resolving')

    // Resolve ERLC code → placeId + accessCode/linkCode
    let placeId    = '2534724415'
    let accessCode: string | undefined
    let linkCode: string | undefined = code

    const resolved = await window.electron.roblox.resolveErlcCode(code)
    if (resolved) {
      placeId    = resolved.placeId
      accessCode = resolved.accessCode
      linkCode   = resolved.linkCode ?? code
    }

    // Build initial results list
    const initial: AccountResult[] = [
      ...cookieAccounts.map(a => ({ account: a, status: 'pending' as const })),
      ...withCookie.filter(a => isAccountTooNew(a.created)).map(a => ({ account: a, status: 'too-new' as const, error: 'Under 3 days old — can\'t launch yet' })),
      ...targetAccounts.filter(a => !a.cookie).map(a => ({ account: a, status: 'no-cookie' as const })),
    ]
    setResults(initial)
    setPhase('joining')

    // Launch in batches
    for (let i = 0; i < cookieAccounts.length; i += batchSize) {
      if (abortRef.current) break
      const batch = cookieAccounts.slice(i, i + batchSize)

      await Promise.all(batch.map(async account => {
        setResults(prev => prev.map(r => r.account.id === account.id ? { ...r, status: 'launching' } : r))

        const res = await window.electron.roblox.joinErlc(
          account.cookie!,
          placeId,
          accessCode,
          linkCode,
          account.id,
        )

        setResults(prev => prev.map(r =>
          r.account.id === account.id
            ? { ...r, status: res.success ? 'success' : 'failed', error: res.error }
            : r
        ))
      }))

      // Delay between batches (not after the last one)
      if (i + batchSize < cookieAccounts.length && !abortRef.current) {
        await new Promise(r => setTimeout(r, batchDelay * 1000))
      }
    }

    setPhase('done')
  }

  const handleAbort = () => { abortRef.current = true }
  const handleReset = () => { setPhase('idle'); setResults([]); abortRef.current = false }

  const successCount = results.filter(r => r.status === 'success').length
  const failedCount  = results.filter(r => r.status === 'failed').length
  const launchingCount = results.filter(r => r.status === 'launching' || r.status === 'pending').length

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={e => e.key === 'Escape' && phase === 'idle' && onClose()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={phase === 'idle' || phase === 'done' ? onClose : undefined} />

      {/* Modal — explicit flex column so footer is always pinned */}
      <div
        className="relative w-full max-w-[460px] animate-slide-up"
        style={{
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'min(85vh, 640px)',
          background: 'linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          boxShadow: '0 32px 64px rgba(0,0,0,0.8)',
        }}
      >
        {/* ── Header ── */}
        <div style={{ flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '18px 20px 14px' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Join ERLC Server</h2>
              {target === 'selected' && selected.size > 0 && (
                <p className="text-[10px] text-[#444] mt-0.5">{selected.size} account{selected.size > 1 ? 's' : ''} selected</p>
              )}
            </div>
            <button
              className="w-6 h-6 flex items-center justify-center rounded transition-all"
              style={{ color: '#444', background: 'transparent' }}
              onClick={onClose}
              disabled={phase === 'joining'}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* ── Setup status banner ── */}
          {setup && (
            <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid', ...(
              !setup.found
                ? { background: 'rgba(248,113,113,0.07)', borderColor: 'rgba(248,113,113,0.25)' }
                : setup.multiInstance
                  ? { background: 'rgba(74,222,128,0.06)', borderColor: 'rgba(74,222,128,0.2)' }
                  : { background: 'rgba(251,191,36,0.06)', borderColor: 'rgba(251,191,36,0.2)' }
            )}}>
              {!setup.found && (
                <p style={{ fontSize: 11, color: '#f87171', margin: 0 }}>
                  ✗ Roblox not found. Make sure Roblox or{' '}
                  <span style={{ fontWeight: 700 }}>Bloxstrap</span> is installed.
                </p>
              )}
              {setup.found && setup.type === 'bloxstrap' && (
                <p style={{ fontSize: 11, color: '#4ade80', margin: 0 }}>
                  ✓ Bloxstrap detected — multi-instance supported natively.
                </p>
              )}
              {setup.found && setup.type === 'roblox' && setup.multiExe && (
                <p style={{ fontSize: 11, color: '#4ade80', margin: 0 }}>
                  ✓ Roblox + multi.exe ready — multi-instance mutex bypass active.
                </p>
              )}
              {setup.found && setup.type === 'roblox' && !setup.multiExe && (
                <div>
                  <p style={{ fontSize: 11, color: '#fbbf24', margin: '0 0 4px' }}>
                    ⚠ Standard Roblox found, but multi.exe is missing.
                  </p>
                  <p style={{ fontSize: 10, color: 'rgba(251,191,36,0.7)', margin: 0 }}>
                    Multi-instance may not work. Install <span style={{ fontWeight: 700 }}>Bloxstrap</span> for reliable multi-account support.
                  </p>
                </div>
              )}
            </div>
          )}


          {/* Config — only when idle */}
          {phase === 'idle' && (<>
            {/* Presets */}
            <div>
              <label className="block text-[9px] font-semibold text-[#333] uppercase tracking-widest mb-1.5">Presets</label>
              <div className="flex gap-1.5">
                <select
                  className="input-base flex-1 cursor-pointer"
                  value={selectedPreset}
                  onChange={e => applyPreset(e.target.value)}
                >
                  <option value="">— Presets —</option>
                  {presets.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
                <button className="btn-ghost px-2.5" title="Save preset" onClick={() => setShowSaveInput(s => !s)}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2m10-10l-4-4m0 0L7 6m4-4v12" />
                  </svg>
                </button>
                {selectedPreset && (
                  <button className="btn-ghost px-2.5" style={{ color: '#e63946', borderColor: 'rgba(230,57,70,0.3)' }} title="Delete preset" onClick={handleDeletePreset}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {showSaveInput && (
                <div className="flex gap-1.5 mt-1.5">
                  <input
                    className="input-base flex-1"
                    placeholder="Preset name…"
                    value={presetName}
                    onChange={e => setPresetName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSavePreset()}
                    autoFocus
                  />
                  <button className="btn-accent px-3" onClick={handleSavePreset} disabled={!presetName.trim() || !serverCode.trim()}>Save</button>
                </div>
              )}
            </div>

            {/* Server code */}
            <div>
              <label className="block text-[9px] font-semibold text-[#333] uppercase tracking-widest mb-1.5">ERLC Private Server Code</label>
              <input
                ref={inputRef}
                className="input-base w-full font-mono tracking-widest"
                placeholder="e.g. ABC123XYZ or aBc123xYz"
                value={serverCode}
                onChange={e => setServerCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLaunch()}
                spellCheck={false}
                autoComplete="off"
              />
            </div>

            {/* Target */}
            <div>
              <label className="block text-[9px] font-semibold text-[#333] uppercase tracking-widest mb-1.5">Target</label>
              <select className="input-base w-full cursor-pointer" value={target} onChange={e => setTarget(e.target.value as 'selected' | 'all')}>
                {selected.size > 0 && <option value="selected">Selected accounts only</option>}
                <option value="all">All accounts</option>
              </select>
            </div>

            {/* Batch rate: how many accounts boot per wave, and the gap between waves */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-semibold text-[#333] uppercase tracking-widest mb-1.5">Accounts per batch</label>
                <input
                  type="number"
                  min={1} max={20}
                  className="input-base w-full"
                  value={batchSize}
                  onChange={e => setBatchSize(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                />
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-[#333] uppercase tracking-widest mb-1.5">Every (seconds)</label>
                <input
                  type="number"
                  min={3} max={120}
                  className="input-base w-full"
                  value={batchDelay}
                  onChange={e => setBatchDelay(Math.max(3, Math.min(120, Number(e.target.value) || 3)))}
                />
              </div>
            </div>
            <p className="text-[10px] text-[#444] -mt-1">Boots {batchSize} account{batchSize > 1 ? 's' : ''} every {batchDelay}s — lower the rate if you hit Roblox rate limits (429/529).</p>

            {/* Account summary */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '10px 12px' }}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: '#444' }}>Target accounts</span>
                <span className="font-medium text-white">{targetAccounts.length}</span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: '#444' }}>Ready <span style={{ color: '#2a2a2a' }}>(can join)</span></span>
                <span style={{ color: cookieAccounts.length > 0 ? '#4ade80' : '#555' }} className="font-medium">{cookieAccounts.length}</span>
              </div>
              {tooNewCount > 0 && (
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: '#333' }}>Under 3 days old (blocked)</span>
                  <span style={{ color: '#fbbf24' }}>{tooNewCount}</span>
                </div>
              )}
              {noCookieCount > 0 && (
                <div className="flex justify-between text-xs">
                  <span style={{ color: '#333' }}>No cookie (skipped)</span>
                  <span style={{ color: '#e63946' }}>{noCookieCount}</span>
                </div>
              )}
            </div>
          </>)}

          {/* Resolving spinner */}
          {phase === 'resolving' && (
            <div className="flex items-center gap-2 text-xs py-2" style={{ color: '#555' }}>
              <span className="w-4 h-4 border-2 border-[#e63946] border-t-transparent rounded-full animate-spin flex-shrink-0" />
              Resolving server code via erlc.xyz…
            </div>
          )}

          {/* Account results */}
          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {results.map(r => (
                <div
                  key={r.account.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{
                    background: r.status === 'success'   ? 'rgba(34,197,94,0.05)'  :
                                r.status === 'failed'    ? 'rgba(230,57,70,0.05)'  :
                                r.status === 'launching' ? 'rgba(230,57,70,0.08)'  :
                                r.status === 'no-cookie' ? 'rgba(255,255,255,0.01)' :
                                'rgba(255,255,255,0.02)',
                    border: `1px solid ${
                                r.status === 'success'   ? 'rgba(34,197,94,0.15)'  :
                                r.status === 'failed'    ? 'rgba(230,57,70,0.15)'  :
                                r.status === 'launching' ? 'rgba(230,57,70,0.2)'   :
                                'rgba(255,255,255,0.05)'}`,
                    opacity: r.status === 'no-cookie' ? 0.4 : 1,
                  }}
                >
                  {r.account.avatarUrl
                    ? <img src={r.account.avatarUrl} alt="" className="w-6 h-6 rounded flex-shrink-0" />
                    : <div className="w-6 h-6 rounded flex-shrink-0" style={{ background: 'rgba(255,255,255,0.04)' }} />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: r.status === 'launching' ? '#e63946' : '#ccc' }}>
                      {r.account.username}
                    </p>
                    {r.status === 'failed' && r.error && (
                      <p className="text-[10px] truncate" style={{ color: '#e63946' }}>{r.error}</p>
                    )}
                    {r.status === 'launching' && (
                      <p className="text-[10px]" style={{ color: '#666' }}>Authenticating…</p>
                    )}
                    {r.status === 'no-cookie' && (
                      <p className="text-[10px]" style={{ color: '#333' }}>No cookie — skipped</p>
                    )}
                    {r.status === 'too-new' && (
                      <p className="text-[10px]" style={{ color: '#fbbf24' }}>Can't launch — account is under 3 days old</p>
                    )}
                  </div>
                  <StatusIcon status={r.status} />
                </div>
              ))}

              {/* Summary when done */}
              {phase === 'done' && (
                <div className="flex items-center gap-3 pt-2 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  {successCount > 0 && <span className="text-xs font-medium" style={{ color: '#4ade80' }}>✓ {successCount} launched</span>}
                  {failedCount  > 0 && <span className="text-xs" style={{ color: '#e63946' }}>{failedCount} failed</span>}
                  {results.filter(r => r.status === 'no-cookie').length > 0 && (
                    <span className="text-xs" style={{ color: '#333' }}>{results.filter(r => r.status === 'no-cookie').length} skipped</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer — always pinned at bottom ── */}
        <div style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 20px', display: 'flex', gap: '10px' }}>
          {phase === 'idle' && (<>
            <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
            <button
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: cookieAccounts.length === 0 || !serverCode.trim()
                  ? 'rgba(34,197,94,0.2)'
                  : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: cookieAccounts.length === 0 || !serverCode.trim() ? 'not-allowed' : 'pointer',
                opacity: cookieAccounts.length === 0 || !serverCode.trim() ? 0.4 : 1,
                transition: 'all 0.15s',
                boxShadow: cookieAccounts.length === 0 || !serverCode.trim() ? 'none' : '0 4px 16px rgba(34,197,94,0.2)',
              }}
              onClick={handleLaunch}
              disabled={!serverCode.trim() || cookieAccounts.length === 0}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Launch {cookieAccounts.length > 0 ? `(${cookieAccounts.length})` : ''}
            </button>
          </>)}

          {(phase === 'joining' || phase === 'resolving') && (
            <button className="btn-ghost flex-1" onClick={handleAbort}>
              Abort ({launchingCount} remaining)
            </button>
          )}

          {phase === 'done' && (<>
            <button className="btn-ghost flex-1" onClick={onClose}>Close</button>
            <button className="btn-accent flex-1" onClick={handleReset}>Launch Again</button>
          </>)}
        </div>
      </div>
    </div>
  )
}
