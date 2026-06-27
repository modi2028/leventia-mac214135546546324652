import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { RobloxAccount, ValidatedCookieUser } from '../types'

interface Props {
  onAdd: (accounts: RobloxAccount[]) => void
  onClose: () => void
  existingIds: number[]
}

type Tab = 'cookie' | 'file' | 'bulk' | 'login'

// ── Helpers ──────────────────────────────────────────────────────────────────

function presenceToStatus(type: number): RobloxAccount['status'] {
  switch (type) { case 1: return 'online'; case 2: return 'in-game'; case 3: return 'studio'; default: return 'offline' }
}

function makeAccount(user: ValidatedCookieUser): RobloxAccount {
  const now = new Date().toISOString()
  return {
    id: `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId: user.id,
    username: user.name,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    status: 'offline',
    presenceType: 0,
    group: user.group,
    cookie: user.cookie,
    created: user.created,
    addedAt: now,
    refreshedAt: now,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function UserCard({ user, onRemove }: { user: ValidatedCookieUser; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-3 p-2.5 bg-bg-secondary rounded-lg border border-border-dim">
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-bg-hover flex-shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-tx-primary truncate">{user.name}</p>
        <p className="text-[10px] text-tx-muted font-mono">#{user.id}</p>
        {user.group !== 'None' && (
          <span className="text-[9px] px-1.5 py-px bg-blue/10 text-blue border border-blue/20 rounded-full inline-block mt-0.5">{user.group}</span>
        )}
      </div>
      {onRemove && (
        <button className="text-tx-muted hover:text-accent transition-colors p-1 flex-shrink-0" onClick={onRemove}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

function InfoBox({ children, color = 'accent' }: { children: React.ReactNode; color?: 'accent' | 'blue' }) {
  const cls = color === 'blue'
    ? 'bg-blue/8 border-blue/20 text-blue'
    : 'bg-accent/8 border-accent/20 text-accent'
  return (
    <div className={`px-3 py-2.5 border rounded-lg text-xs leading-relaxed ${cls}`}>
      {children}
    </div>
  )
}

// ── Cookie Tab ────────────────────────────────────────────────────────────────

function CookieTab({ existingIds, onValidated }: {
  existingIds: number[]
  onValidated: (user: ValidatedCookieUser) => void
}) {
  const [cookie, setCookie] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { ref.current?.focus() }, [])

  const handleValidate = async () => {
    const raw = cookie.trim()
    if (!raw) return
    setLoading(true); setError('')
    try {
      const user = await window.electron.roblox.validateCookie(raw)
      if (!user) { setError('Invalid or expired cookie.'); return }
      if (existingIds.includes(user.id)) { setError(`${user.name} is already in your list.`); return }
      onValidated(user)
      setCookie('')
    } catch { setError('Failed to validate cookie.') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      <InfoBox>
        Paste one <span className="font-mono">.ROBLOSECURITY</span> cookie. Username and avatar are fetched automatically.
      </InfoBox>

      <div>
        <label className="text-[10px] text-tx-muted uppercase tracking-wider block mb-1.5">.ROBLOSECURITY Cookie</label>
        <textarea
          ref={ref}
          className="input-base w-full resize-none font-mono text-[11px] leading-relaxed"
          rows={3}
          placeholder="_|WARNING:–DO-NOT-SHARE-THIS.–Sharing-this-will-allow-someone-to-log-in-as-you…"
          value={cookie}
          onChange={e => { setCookie(e.target.value); setError('') }}
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {error && <p className="text-accent text-xs flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
        {error}
      </p>}

      <p className="text-[10px] text-tx-muted flex items-center gap-1.5">
        <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
        Stored locally only. Never share your cookies.
      </p>

      <button
        className="btn-accent w-full flex items-center justify-center gap-2"
        onClick={handleValidate}
        disabled={loading || !cookie.trim()}
        style={{ opacity: !cookie.trim() ? 0.5 : 1 }}
      >
        {loading && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
        {loading ? 'Validating…' : 'Validate & Add'}
      </button>
    </div>
  )
}

// ── Bulk Tab ──────────────────────────────────────────────────────────────────

function BulkTab({ existingIds, onBulkValidated }: {
  existingIds: number[]
  onBulkValidated: (users: ValidatedCookieUser[]) => void
}) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; errors: number } | null>(null)

  const parseCookies = (raw: string): string[] => {
    const lines = raw.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean)
    const cookies: string[] = []
    for (const line of lines) {
      const eqMatch = line.match(/\.ROBLOSECURITY=([^\s,;]+)/)
      if (eqMatch) { cookies.push(eqMatch[1]); continue }
      if (line.startsWith('_|WARNING') || (line.length > 50 && /^[A-Za-z0-9_|%+/=\-]+$/.test(line))) {
        cookies.push(line.replace(/^\.ROBLOSECURITY=/, ''))
      }
    }
    return [...new Set(cookies)]
  }

  const handleValidate = async () => {
    const cookies = parseCookies(text)
    if (!cookies.length) return
    setLoading(true)
    setProgress({ done: 0, total: cookies.length, errors: 0 })
    const valid: ValidatedCookieUser[] = []
    let errors = 0

    for (const cookie of cookies) {
      try {
        const user = await window.electron.roblox.validateCookie(cookie)
        if (user && !existingIds.includes(user.id) && !valid.some(v => v.id === user.id)) {
          valid.push(user)
        } else {
          errors++
        }
      } catch { errors++ }
      setProgress(p => p ? { ...p, done: p.done + 1, errors } : null)
    }

    setLoading(false)
    if (valid.length) onBulkValidated(valid)
  }

  const count = parseCookies(text).length

  return (
    <div className="space-y-3">
      <InfoBox>
        Paste multiple cookies — one per line. Each is validated and added automatically.
      </InfoBox>

      <div>
        <label className="text-[10px] text-tx-muted uppercase tracking-wider block mb-1.5">
          Cookies <span className="text-tx-primary">{count > 0 ? `(${count} detected)` : ''}</span>
        </label>
        <textarea
          className="input-base w-full resize-none font-mono text-[11px] leading-relaxed"
          rows={5}
          placeholder={"_|WARNING:–DO-NOT-SHARE…\n_|WARNING:–DO-NOT-SHARE…\n.ROBLOSECURITY=…"}
          value={text}
          onChange={e => setText(e.target.value)}
          spellCheck={false}
        />
      </div>

      {loading && progress && (
        <div>
          <div className="flex justify-between text-[10px] text-tx-muted mb-1">
            <span>Validating {progress.done}/{progress.total}</span>
            {progress.errors > 0 && <span className="text-accent">{progress.errors} invalid</span>}
          </div>
          <div className="h-1 bg-bg-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-200"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <button
        className="btn-accent w-full flex items-center justify-center gap-2"
        onClick={handleValidate}
        disabled={loading || count === 0}
        style={{ opacity: count === 0 ? 0.5 : 1 }}
      >
        {loading && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
        {loading ? 'Validating…' : `Validate ${count > 0 ? count : ''} Cookies`}
      </button>
    </div>
  )
}

// ── File Tab ──────────────────────────────────────────────────────────────────

function FileTab({ existingIds, onBulkValidated }: {
  existingIds: number[]
  onBulkValidated: (users: ValidatedCookieUser[]) => void
}) {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; errors: number } | null>(null)

  const handleImport = async () => {
    setLoading(true)
    try {
      const cookies = await window.electron.roblox.importCookiesFile()
      if (!cookies.length) { setLoading(false); return }

      setProgress({ done: 0, total: cookies.length, errors: 0 })
      const valid: ValidatedCookieUser[] = []
      let errors = 0

      for (const cookie of cookies) {
        try {
          const user = await window.electron.roblox.validateCookie(cookie)
          if (user && !existingIds.includes(user.id) && !valid.some(v => v.id === user.id)) {
            valid.push(user)
          } else errors++
        } catch { errors++ }
        setProgress(p => p ? { ...p, done: p.done + 1, errors } : null)
      }

      if (valid.length) onBulkValidated(valid)
    } finally { setLoading(false); setProgress(null) }
  }

  return (
    <div className="space-y-3">
      <InfoBox>
        Import a <span className="font-mono">.txt</span> or <span className="font-mono">.csv</span> file with one cookie per line. Both raw cookie values and <span className="font-mono">.ROBLOSECURITY=VALUE</span> formats are supported.
      </InfoBox>

      {loading && progress ? (
        <div className="py-4">
          <div className="flex justify-between text-[10px] text-tx-muted mb-2">
            <span>Validating {progress.done}/{progress.total}</span>
            {progress.errors > 0 && <span className="text-accent">{progress.errors} invalid</span>}
          </div>
          <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-200"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      ) : (
        <button
          className="w-full flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border-base rounded-lg hover:border-border-light hover:bg-bg-hover transition-all cursor-pointer"
          onClick={handleImport}
          disabled={loading}
        >
          <svg className="w-8 h-8 text-tx-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <div className="text-center">
            <p className="text-xs font-medium text-tx-primary">Click to select file</p>
            <p className="text-[10px] text-tx-muted mt-0.5">.txt or .csv — one cookie per line</p>
          </div>
        </button>
      )}
    </div>
  )
}

// ── Login Tab ─────────────────────────────────────────────────────────────────

function LoginTab({ existingIds, onValidated }: {
  existingIds: number[]
  onValidated: (user: ValidatedCookieUser) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleBrowserLogin = async () => {
    setLoading(true); setError('')
    try {
      const user = await window.electron.roblox.browserLogin()
      if (!user) { setError('Login window was closed without signing in.'); return }
      if (existingIds.includes(user.id)) { setError(`${user.name} is already in your list.`); return }
      onValidated(user)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed.')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <InfoBox color="blue">
        <span className="font-semibold">Browser Login</span> — Opens a real Chromium window to roblox.com.
        Log in with your username + password (or social login). The cookie is extracted automatically after sign-in.
        No CAPTCHA issues since it's a real browser.
      </InfoBox>

      <div className="flex flex-col items-center py-6 gap-4">
        <div className="w-16 h-16 bg-blue/10 border border-blue/20 rounded-2xl flex items-center justify-center">
          <svg className="w-8 h-8 text-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253M3 12c0 .778.099 1.533.284 2.253" />
          </svg>
        </div>

        {error && <p className="text-accent text-xs text-center">{error}</p>}

        <button
          className="flex items-center gap-2 px-5 py-2.5 bg-blue/90 hover:bg-blue text-white text-xs font-semibold rounded-lg transition-colors"
          onClick={handleBrowserLogin}
          disabled={loading}
        >
          {loading
            ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3" /></svg>
          }
          {loading ? 'Waiting for login…' : 'Open Roblox Login'}
        </button>
      </div>
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'cookie', label: 'Cookie' },
  { id: 'file',   label: 'File' },
  { id: 'bulk',   label: 'Bulk' },
  { id: 'login',  label: '⊕ Login' },
]

export function AddAccountModal({ onAdd, onClose, existingIds }: Props) {
  const [tab, setTab] = useState<Tab>('cookie')
  const [staged, setStaged] = useState<ValidatedCookieUser[]>([])
  const [flash, setFlash] = useState<string | null>(null)

  // Small green confirmation inside the modal the moment an account is staged.
  const showFlash = useCallback((msg: string) => {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 2500)
  }, [])

  const addToStaged = useCallback((user: ValidatedCookieUser) => {
    setStaged(prev => prev.some(u => u.id === user.id) ? prev : [...prev, user])
    showFlash(`Added ${user.name}`)
  }, [showFlash])

  const addBulkToStaged = useCallback((users: ValidatedCookieUser[]) => {
    setStaged(prev => {
      const existing = new Set(prev.map(u => u.id))
      const newOnes = users.filter(u => !existing.has(u.id))
      return [...prev, ...newOnes]
    })
    if (users.length) showFlash(`Added ${users.length} account${users.length > 1 ? 's' : ''}`)
  }, [showFlash])

  const handleCommit = () => {
    if (!staged.length) return
    onAdd(staged.map(makeAccount))
  }

  // Don't discard staged-but-not-added accounts on an accidental dismiss. Once
  // anything is staged, closing requires an explicit Cancel/✕ (clicking outside
  // or Escape is ignored) so you don't lose accounts you just added.
  const tryClose = useCallback(() => { if (staged.length === 0) onClose() }, [staged.length, onClose])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') tryClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={handleKeyDown}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={tryClose} />

      <div className="relative w-full max-w-md bg-bg-card border border-border-base rounded-xl shadow-2xl animate-slide-up flex flex-col max-h-[85vh]">
        {/* Staged confirmation */}
        {flash && (
          <div className="absolute left-1/2 -translate-x-1/2 top-2 z-10 animate-fade-in inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(34,197,94,0.18)', border: '1px solid rgba(74,222,128,0.5)', color: '#bbf7d0', fontSize: 11, fontWeight: 600,
              boxShadow: '0 8px 24px -10px rgba(34,197,94,0.6)' }}>
            <svg className="w-3.5 h-3.5" style={{ color: '#4ade80' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            {flash}
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
          <h2 className="text-sm font-semibold text-tx-primary">Add Account</h2>
          <button
            className="w-6 h-6 flex items-center justify-center text-tx-muted hover:text-tx-primary hover:bg-bg-hover rounded transition-all"
            onClick={onClose}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 px-5 pb-3 flex-shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`flex-1 py-1.5 text-xs rounded-md transition-all ${
                tab === t.id
                  ? 'bg-accent text-white font-medium'
                  : 'text-tx-secondary hover:text-tx-primary hover:bg-bg-hover'
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-5 pb-3 flex-1 overflow-y-auto">
          {tab === 'cookie' && (
            <CookieTab existingIds={[...existingIds, ...staged.map(u => u.id)]} onValidated={addToStaged} />
          )}
          {tab === 'file' && (
            <FileTab existingIds={[...existingIds, ...staged.map(u => u.id)]} onBulkValidated={addBulkToStaged} />
          )}
          {tab === 'bulk' && (
            <BulkTab existingIds={[...existingIds, ...staged.map(u => u.id)]} onBulkValidated={addBulkToStaged} />
          )}
          {tab === 'login' && (
            <LoginTab existingIds={[...existingIds, ...staged.map(u => u.id)]} onValidated={addToStaged} />
          )}
        </div>

        {/* Staged accounts */}
        {staged.length > 0 && (
          <div className="px-5 pb-3 flex-shrink-0 border-t border-border-dim pt-3">
            <p className="text-[10px] text-tx-muted uppercase tracking-wider mb-2">
              Ready to add ({staged.length})
            </p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {staged.map(u => (
                <UserCard
                  key={u.id}
                  user={u}
                  onRemove={() => setStaged(prev => prev.filter(x => x.id !== u.id))}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-border-dim flex-shrink-0">
          <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn-accent flex-1 flex items-center justify-center gap-1.5"
            onClick={handleCommit}
            disabled={staged.length === 0}
            style={{ opacity: staged.length === 0 ? 0.5 : 1 }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {staged.length === 0 ? '+ Add Account' : `+ Add ${staged.length} Account${staged.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
