import React from 'react'

type SortType = 'name-asc' | 'name-desc' | 'added-desc' | 'added-asc' | 'status'

interface Props {
  search: string
  onSearchChange: (v: string) => void
  searchRef?: React.RefObject<HTMLInputElement>
  sort: SortType
  onSortChange: (v: SortType) => void
  onAddAccount: () => void
  onRefresh: () => void
  onRemoveSelected: () => void
  onDisconnect: () => void
  onJoinErlc: () => void
  onBring: () => void
  hasSelection: boolean
  hasRunningSelected: boolean
  refreshing: boolean
  hasCookieAccounts: boolean
}

// Reusable glass pill wrapper for inputs / small controls
const glassPill: React.CSSProperties = {
  background: 'rgba(20,14,40,0.6)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 10,
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  color: 'oklch(0.86 0.03 285)',
  fontSize: 12,
  transition: 'all 0.2s ease',
}

export function TopBar({ search, onSearchChange, searchRef, sort, onSortChange, onAddAccount, onRefresh, onRemoveSelected, onDisconnect, onJoinErlc, onBring, hasSelection, hasRunningSelected, refreshing, hasCookieAccounts }: Props) {
  return (
    <div className="glass" style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 14px',
      flexShrink: 0,
    }}>
      <div className="glass-aurora" />

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 240, width: '100%' }}>
        <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'oklch(0.68 0.035 280)', pointerEvents: 'none' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          ref={searchRef}
          className="input-base w-full"
          style={{ paddingLeft: 30 }}
          placeholder="Search accounts… (Ctrl+F)"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
        />
        {search && (
          <button style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.68 0.035 280)', cursor: 'pointer', background: 'none', border: 'none', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'oklch(0.96 0.01 260)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'oklch(0.68 0.035 280)'}
            onClick={() => onSearchChange('')}>
            <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* :bring command generator — beside the search */}
      <button
        onClick={onBring}
        title="Generate a :bring command with all your accounts"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, flexShrink: 0,
          background: 'rgba(124,58,237,0.14)', border: '1px solid rgba(167,139,250,0.35)', color: '#c4b5fd',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: '"JetBrains Mono", monospace', transition: 'all 0.2s ease' }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(124,58,237,0.24)'; el.style.borderColor = 'rgba(167,139,250,0.55)'; el.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(124,58,237,0.14)'; el.style.borderColor = 'rgba(167,139,250,0.35)'; el.style.transform = '' }}
      >
        <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
        :bring
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
        {/* Sort dropdown */}
        <div style={{ position: 'relative' }}>
          <select
            style={{ ...glassPill, padding: '7px 26px 7px 12px', appearance: 'none', cursor: 'pointer', outline: 'none' }}
            value={sort}
            onChange={e => onSortChange(e.target.value as SortType)}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.25)'; (e.currentTarget as HTMLElement).style.color = 'oklch(0.96 0.01 260)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; (e.currentTarget as HTMLElement).style.color = 'oklch(0.86 0.03 285)' }}
          >
            <option value="added-desc">Newest first</option>
            <option value="added-asc">Oldest first</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="status">By status</option>
          </select>
          <svg style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 11, height: 11, color: 'oklch(0.68 0.035 280)', pointerEvents: 'none' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </div>

        {/* Refresh */}
        <button className="btn-ghost" onClick={onRefresh} disabled={refreshing} title={hasSelection ? 'Refresh selected' : 'Refresh all'}>
          <svg style={{ width: 13, height: 13, animation: refreshing ? 'spinSlow 0.7s linear infinite' : 'none' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh
        </button>

        {/* Delete selected — deliberately alarming so it isn't pressed by accident */}
        {hasSelection && (
          <button
            onClick={onRemoveSelected}
            title="Delete selected accounts"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '7px 13px', borderRadius: 10,
              background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
              border: '1px solid rgba(248,113,113,0.55)',
              color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 18px -4px rgba(239,68,68,0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.filter = 'brightness(1.12)'; el.style.transform = 'translateY(-1px)'; el.style.boxShadow = '0 8px 24px -4px rgba(239,68,68,0.7), inset 0 1px 0 rgba(255,255,255,0.18)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.filter = ''; el.style.transform = ''; el.style.boxShadow = '0 4px 18px -4px rgba(239,68,68,0.55), inset 0 1px 0 rgba(255,255,255,0.18)' }}
          >
            <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            Delete
          </button>
        )}

        {/* Disconnect — shown when running alts exist */}
        {hasRunningSelected && (
          <button
            onClick={onDisconnect}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '7px 13px', borderRadius: 10,
              background: 'rgba(248,113,113,0.12)',
              border: '1px solid rgba(248,113,113,0.3)',
              color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(248,113,113,0.2)'; el.style.borderColor = 'rgba(248,113,113,0.5)'; el.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(248,113,113,0.12)'; el.style.borderColor = 'rgba(248,113,113,0.3)'; el.style.transform = '' }}
            title={hasSelection ? 'Disconnect selected running alts' : 'Disconnect all running alts'}
          >
            {/* Unplug icon */}
            <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M8.25 8.25A6 6 0 0012 18a6 6 0 005.657-4M3.75 9.75h.75m15 0h.75M9 3.75v.75m6-1.5v1.5M4.5 15.75l3-3m12-6l-3 3" />
            </svg>
            Disconnect
          </button>
        )}

        {/* Join ERLC — green gradient */}
        <button
          onClick={onJoinErlc}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '7px 13px', borderRadius: 10,
            background: 'linear-gradient(135deg, oklch(0.74 0.18 150), oklch(0.65 0.20 150))',
            border: 'none',
            color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 18px -4px rgba(34,197,94,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px -4px rgba(34,197,94,0.6), inset 0 1px 0 rgba(255,255,255,0.15)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = ''; (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 18px -4px rgba(34,197,94,0.5), inset 0 1px 0 rgba(255,255,255,0.15)' }}
        >
          <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>
          Join ERLC
        </button>

        {/* Add Account — violet gradient */}
        <button
          className="btn-accent"
          onClick={onAddAccount}
          style={{ background: 'linear-gradient(135deg, oklch(0.62 0.22 280), oklch(0.55 0.24 295))' }}
        >
          <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Add Account
        </button>
      </div>
    </div>
  )
}
