import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { TopBar } from '../components/TopBar'
import { FilterTabs } from '../components/FilterTabs'
import { AccountTable } from '../components/AccountTable'
import { AddAccountModal } from '../components/AddAccountModal'
import { ErlcJoinModal } from '../components/ErlcJoinModal'
import { AccountContextMenu } from '../components/AccountContextMenu'
import { BringModal } from '../components/BringModal'
import type { RobloxAccount, AppSettings } from '../types'
import type { FilterType } from '../components/FilterTabs'
import { isAccountTooNew } from '../account-age'

type SortType = 'name-asc' | 'name-desc' | 'added-desc' | 'added-asc' | 'status'

interface Props {
  accounts: RobloxAccount[]
  onAccountsChange: (accounts: RobloxAccount[]) => void
  onSelectionChange: (count: number) => void
}

function presenceToStatus(type: number): RobloxAccount['status'] {
  switch (type) { case 1: return 'online'; case 2: return 'in-game'; case 3: return 'studio'; default: return 'offline' }
}

function copyText(text: string) {
  try { if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(text); return } } catch {}
  const ta = document.createElement('textarea')
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
  document.body.appendChild(ta); ta.focus(); ta.select()
  try { document.execCommand('copy') } catch {}
  document.body.removeChild(ta)
}

export function AccountsPage({ accounts, onAccountsChange, onSelectionChange }: Props) {
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [search, setSearch]           = useState('')
  const [filter, setFilter]           = useState<FilterType>('all')
  const [sort, setSort]               = useState<SortType>('added-desc')
  const [addOpen, setAddOpen]         = useState(false)
  const [erlcOpen, setErlcOpen]       = useState(false)
  const [bringOpen, setBringOpen]     = useState(false)
  const [refreshing, setRefreshing]   = useState(false)
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set())
  const [settings, setSettings]       = useState<AppSettings | null>(null)
  const [runningIds, setRunningIds]   = useState<Set<string>>(new Set())
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [ctxMenu, setCtxMenu] = useState<{ account: RobloxAccount; x: number; y: number } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2600)
  }, [])

  useEffect(() => {
    window.electron.store.getSettings().then(setSettings).catch(() => {})
  }, [])

  // Poll running processes every 3 seconds to keep the live indicator accurate
  useEffect(() => {
    const poll = async () => {
      try {
        const ids = await window.electron.roblox.getRunning()
        setRunningIds(new Set(ids))
      } catch {}
    }
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [])

  // Auto-refresh
  useEffect(() => {
    if (!settings?.autoRefreshEnabled || accounts.length === 0) return
    const ms = (settings.autoRefreshInterval ?? 60) * 1000
    const id = setInterval(() => doRefresh(accounts.map(a => a.id)), ms)
    return () => clearInterval(id)
  }, [settings, accounts.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateSelected = useCallback((next: Set<string>) => {
    setSelected(next)
    onSelectionChange(next.size)
  }, [onSelectionChange])

  // An account is "online" if its Roblox presence says so OR we actively launched it (in-game via our launcher)
  const isOnline = (a: RobloxAccount) => runningIds.has(a.id) || (a.status !== 'offline' && a.status !== 'unknown')

  const filtered = useMemo(() => {
    let list = [...accounts]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.username.toLowerCase().includes(q) ||
        a.displayName.toLowerCase().includes(q) ||
        String(a.userId).includes(q)
      )
    }
    if (filter === 'online') list = list.filter(isOnline)
    else if (filter === 'offline') list = list.filter(a => !isOnline(a))
    else if (filter === 'new') list = list.filter(a => isAccountTooNew(a.created))      // <3 days — can't join
    else if (filter === 'ready') list = list.filter(a => !isAccountTooNew(a.created))    // ≥3 days (or unknown) — joinable

    list.sort((a, b) => {
      const fav = Number(!!b.favorite) - Number(!!a.favorite)
      if (fav !== 0) return fav   // favorites pinned to the top
      switch (sort) {
        case 'name-asc':   return a.username.localeCompare(b.username)
        case 'name-desc':  return b.username.localeCompare(a.username)
        case 'added-asc':  return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()
        case 'added-desc': return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
        case 'status':     return b.presenceType - a.presenceType
        default:           return 0
      }
    })
    return list
  }, [accounts, search, filter, sort])

  const doRefresh = async (ids: string[]) => {
    if (!ids.length) return
    setRefreshingIds(new Set(ids))
    setRefreshing(true)
    try {
      // Source from the PERSISTED store, not the in-memory closure. Auto-refresh
      // runs on an interval that captures a stale `accounts` array, so building
      // the update from the closure wiped recent changes (labels/tags, favorites)
      // on the next tick. The store always has the latest, so nothing is lost.
      const current = await window.electron.store.getAccounts()
      const toRefresh = current.filter(a => ids.includes(a.id))
      if (!toRefresh.length) return
      const presences = await window.electron.roblox.getPresence(toRefresh.map(a => a.userId))
      const now = new Date().toISOString()
      const updated = current.map(a => {
        const pres = presences.find(p => p.userId === a.userId)
        if (!pres || !ids.includes(a.id)) return a
        const status = presenceToStatus(pres.userPresenceType)
        window.electron.store.updateAccount(a.id, { status, presenceType: pres.userPresenceType, lastLocation: pres.lastLocation, refreshedAt: now }).catch(() => {})
        return { ...a, status, presenceType: pres.userPresenceType, lastLocation: pres.lastLocation, refreshedAt: now }
      })
      onAccountsChange(updated)
    } finally {
      setRefreshingIds(new Set())
      setRefreshing(false)
    }
  }

  const handleRefresh = useCallback(() => {
    doRefresh(selected.size > 0 ? [...selected] : accounts.map(a => a.id))
  }, [selected, accounts]) // eslint-disable-line react-hooks/exhaustive-deps

  // Backfill Roblox account-creation date for accounts added before the age gate
  // existed (so the New/Ready filter + join block work for them). Throttled.
  useEffect(() => {
    const missing = accounts.filter(a => a.cookie && !a.created).slice(0, 10)
    if (!missing.length) return
    let cancelled = false
    ;(async () => {
      const found: Record<string, string> = {}
      for (const a of missing) {
        if (cancelled) break
        try {
          const u = await window.electron.roblox.getUserById(a.userId)
          if (u?.created) { found[a.id] = u.created; window.electron.store.updateAccount(a.id, { created: u.created }).catch(() => {}) }
        } catch {}
        await new Promise(r => setTimeout(r, 350))
      }
      if (!cancelled && Object.keys(found).length) {
        onAccountsChange(accounts.map(a => found[a.id] ? { ...a, created: found[a.id] } : a))
      }
    })()
    return () => { cancelled = true }
  }, [accounts]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = useCallback((newAccounts: RobloxAccount[]) => {
    const updated = [...accounts, ...newAccounts]
    onAccountsChange(updated)
    newAccounts.forEach(a => window.electron.store.addAccount(a).catch(() => {}))
    setAddOpen(false)
    if (newAccounts.length) showToast(`Successfully added ${newAccounts.length} account${newAccounts.length === 1 ? '' : 's'}`)
  }, [accounts, onAccountsChange, showToast])

  const toggleFavorite = useCallback((account: RobloxAccount) => {
    const fav = !account.favorite
    onAccountsChange(accounts.map(a => a.id === account.id ? { ...a, favorite: fav } : a))
    window.electron.store.updateAccount(account.id, { favorite: fav }).catch(() => {})
  }, [accounts, onAccountsChange])

  const removeOne = useCallback(async (account: RobloxAccount) => {
    await window.electron.store.removeAccounts([account.id]).catch(() => {})
    onAccountsChange(accounts.filter(a => a.id !== account.id))
    if (selected.has(account.id)) { const n = new Set(selected); n.delete(account.id); updateSelected(n) }
  }, [accounts, selected, onAccountsChange, updateSelected])

  const setTag = useCallback((account: RobloxAccount, tag: string | null) => {
    onAccountsChange(accounts.map(a => a.id === account.id ? { ...a, tag: tag ?? undefined } : a))
    window.electron.store.updateAccount(account.id, { tag: tag ?? undefined }).catch(() => {})
  }, [accounts, onAccountsChange])

  const createCustomTag = useCallback((account: RobloxAccount, name: string) => {
    const tag = name.trim()
    if (!tag) return
    if (settings && !settings.customTags.includes(tag)) {
      const next = { ...settings, customTags: [...settings.customTags, tag] }
      setSettings(next)
      window.electron.store.saveSettings(next).catch(() => {})
    }
    setTag(account, tag)
  }, [settings, setTag])

  const copyCookie = useCallback((account: RobloxAccount) => {
    if (account.cookie) copyText(account.cookie)
  }, [])

  const handleRemoveSelected = useCallback(async () => {
    const ids = [...selected]
    await window.electron.store.removeAccounts(ids).catch(() => {})
    onAccountsChange(accounts.filter(a => !selected.has(a.id)))
    updateSelected(new Set())
  }, [selected, accounts, onAccountsChange, updateSelected])

  const handleDisconnectSelected = useCallback(async () => {
    const targets = selected.size > 0
      ? [...selected].filter(id => runningIds.has(id))
      : [...runningIds]
    await Promise.all(targets.map(id => window.electron.roblox.disconnect(id).catch(() => {})))
    setRunningIds(prev => { const next = new Set(prev); targets.forEach(id => next.delete(id)); return next })
  }, [selected, runningIds])

  const selectAll = useCallback(() => {
    updateSelected(new Set(filtered.map(a => a.id)))
  }, [filtered, updateSelected])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack shortcuts while a modal is open
      if (addOpen || erlcOpen) return
      const t = e.target as HTMLElement | null
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      const k = e.key.toLowerCase()

      if (e.ctrlKey && k === 'f') { e.preventDefault(); searchInputRef.current?.focus(); searchInputRef.current?.select(); return }
      if (e.ctrlKey && k === 'a') { if (typing) return; e.preventDefault(); selectAll(); return }
      if (e.ctrlKey && k === 'n') { e.preventDefault(); setAddOpen(true); return }
      if (e.ctrlKey && k === 'j') { e.preventDefault(); setErlcOpen(true); return }
      if (e.ctrlKey && k === 'l') { e.preventDefault(); setErlcOpen(true); return }   // launch selected → Join Server
      if (e.key === 'Delete')     { if (typing) return; if (selected.size > 0) { e.preventDefault(); setConfirmDelete(true) } return }
      if (e.key === 'Escape')     { if (confirmDelete) { setConfirmDelete(false); return } if (selected.size > 0) { updateSelected(new Set()) } return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addOpen, erlcOpen, selected, selectAll, confirmDelete, updateSelected])

  // Whether any selected accounts are currently running (or any are running if nothing selected)
  const hasRunningSelected = selected.size > 0
    ? [...selected].some(id => runningIds.has(id))
    : runningIds.size > 0

  const counts = {
    all: accounts.length,
    online: accounts.filter(isOnline).length,
    offline: accounts.filter(a => !isOnline(a)).length,
    new: accounts.filter(a => isAccountTooNew(a.created)).length,
    ready: accounts.filter(a => !isAccountTooNew(a.created)).length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', gap: 8 }}>
      <TopBar
        search={search}
        onSearchChange={setSearch}
        searchRef={searchInputRef}
        sort={sort}
        onSortChange={setSort}
        onAddAccount={() => setAddOpen(true)}
        onRefresh={handleRefresh}
        onRemoveSelected={() => setConfirmDelete(true)}
        onDisconnect={handleDisconnectSelected}
        onJoinErlc={() => setErlcOpen(true)}
        onBring={() => setBringOpen(true)}
        hasSelection={selected.size > 0}
        hasRunningSelected={hasRunningSelected}
        refreshing={refreshing}
        hasCookieAccounts={accounts.some(a => !!a.cookie)}
      />
      {/* FilterTabs sits inside the table glass card as a header strip */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <FilterTabs filter={filter} onFilterChange={setFilter} counts={counts} />
        <AccountTable
          accounts={filtered}
          selected={selected}
          onSelectionChange={updateSelected}
          refreshingIds={refreshingIds}
          runningIds={runningIds}
          onContextMenu={(account, x, y) => setCtxMenu({ account, x, y })}
        />
      </div>

      {addOpen && (
        <AddAccountModal
          onAdd={handleAdd}
          onClose={() => setAddOpen(false)}
          existingIds={accounts.map(a => a.userId)}
        />
      )}

      {erlcOpen && (
        <ErlcJoinModal
          accounts={accounts}
          selected={selected}
          onClose={() => setErlcOpen(false)}
        />
      )}

      {bringOpen && <BringModal accounts={accounts} onClose={() => setBringOpen(false)} />}

      {ctxMenu && (
        <AccountContextMenu
          account={ctxMenu.account}
          x={ctxMenu.x}
          y={ctxMenu.y}
          customTags={settings?.customTags ?? []}
          onFavorite={() => { toggleFavorite(ctxMenu.account); setCtxMenu(null) }}
          onCopyCookie={() => copyCookie(ctxMenu.account)}
          onSetTag={(tag) => setTag(ctxMenu.account, tag)}
          onCreateTag={(name) => createCustomTag(ctxMenu.account, name)}
          onRefresh={() => { doRefresh([ctxMenu.account.id]); setCtxMenu(null) }}
          onRemove={() => { removeOne(ctxMenu.account); setCtxMenu(null) }}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* Delete confirmation — destructive, requires a deliberate second click.
          Portaled to <body> so overflow-hidden ancestors can't clip it. */}
      {confirmDelete && createPortal(
        <div
          onClick={() => setConfirmDelete(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9990, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(4,3,10,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
        >
          <div onClick={e => e.stopPropagation()} className="glass animate-scale-in"
            style={{ width: 360, padding: 22, textAlign: 'center', border: '1px solid rgba(248,113,113,0.3)' }}>
            <div style={{ width: 46, height: 46, margin: '0 auto 14px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171' }}>
              <svg style={{ width: 22, height: 22 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: 0 }}>
              Delete {selected.size} account{selected.size === 1 ? '' : 's'}?
            </h2>
            <p style={{ fontSize: 12, color: 'oklch(0.85 0.03 284)', margin: '8px 0 18px', lineHeight: 1.5 }}>
              This permanently removes {selected.size === 1 ? 'it' : 'them'} from the dashboard. This can't be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn-ghost" style={{ minWidth: 96 }} onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button
                style={{ minWidth: 96, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '7px 14px', borderRadius: 12, border: '1px solid rgba(248,113,113,0.55)',
                  background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 18px -4px rgba(239,68,68,0.55), inset 0 1px 0 rgba(255,255,255,0.18)' }}
                onClick={async () => { await handleRemoveSelected(); setConfirmDelete(false) }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Success toast — portaled to <body> + clears the status bar so it can't be clipped */}
      {toast && createPortal(
        <div className="animate-slide-up"
          style={{ position: 'fixed', bottom: 52, left: '50%', transform: 'translateX(-50%)', zIndex: 9990,
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(34,197,94,0.22), rgba(22,163,74,0.22))',
            border: '1px solid rgba(74,222,128,0.45)', color: '#bbf7d0', fontSize: 12.5, fontWeight: 600,
            backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
            boxShadow: '0 10px 30px -10px rgba(34,197,94,0.5), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
          <svg style={{ width: 15, height: 15, color: '#4ade80' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          {toast}
        </div>,
        document.body
      )}
    </div>
  )
}
