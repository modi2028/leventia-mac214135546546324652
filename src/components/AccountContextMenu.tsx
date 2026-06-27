import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RobloxAccount } from '../types'

interface Props {
  account: RobloxAccount
  x: number
  y: number
  customTags: string[]
  onFavorite: () => void
  onCopyCookie: () => void
  onSetTag: (tag: string | null) => void
  onCreateTag: (name: string) => void
  onRefresh: () => void
  onRemove: () => void
  onClose: () => void
}

const MENU_W = 196
const PRESET_TAGS = ['Moderator perms', 'Admin perms']

export function tagColors(tag: string) {
  if (tag === 'Admin perms')     return { bg: 'rgba(248,113,113,0.16)', fg: '#fca5a5', bd: 'rgba(248,113,113,0.4)' }
  if (tag === 'Moderator perms') return { bg: 'rgba(59,130,246,0.16)',  fg: '#93c5fd', bd: 'rgba(59,130,246,0.4)' }
  return { bg: 'rgba(167,139,250,0.16)', fg: '#c4b5fd', bd: 'rgba(167,139,250,0.4)' }
}

function Item({ icon, label, onClick, danger, color, right, subtitle }: {
  icon: React.ReactNode; label: string; onClick: () => void
  danger?: boolean; color?: string; right?: React.ReactNode; subtitle?: string
}) {
  const base = danger ? '#f87171' : color ?? 'oklch(0.92 0.02 285)'
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
        padding: '8px 11px', border: 'none', background: 'transparent', cursor: 'pointer',
        fontSize: 12, fontWeight: 500, color: base, borderRadius: 8, transition: 'background 0.12s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = danger ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.06)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <span style={{ flexShrink: 0, display: 'flex', width: 15, height: 15 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        {label}
        {subtitle && <span style={{ display: 'block', fontSize: 9.5, fontWeight: 500, color: 'oklch(0.74 0.035 282)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</span>}
      </span>
      {right && <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{right}</span>}
    </button>
  )
}

const star = <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 15, height: 15 }}><path d="M11.48 3.5a.56.56 0 011.04 0l2.12 5.11a.56.56 0 00.48.35l5.52.44c.5.04.7.66.32.99l-4.2 3.6a.56.56 0 00-.18.56l1.28 5.38a.56.56 0 01-.84.61l-4.72-2.88a.56.56 0 00-.59 0l-4.72 2.88a.56.56 0 01-.84-.61l1.28-5.38a.56.56 0 00-.18-.56l-4.2-3.6a.56.56 0 01.32-.99l5.52-.44a.56.56 0 00.48-.35L11.48 3.5z" /></svg>
const check = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} style={{ width: 12, height: 12, color: '#4ade80' }}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
const chevron = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 12, height: 12, opacity: 0.5 }}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>

export function AccountContextMenu({ account, x, y, customTags, onFavorite, onCopyCookie, onSetTag, onCreateTag, onRefresh, onRemove, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })
  const [view, setView] = useState<'main' | 'labels'>('main')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [copied, setCopied] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth || MENU_W
    const h = el.offsetHeight
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - w - 8)),
      top:  Math.max(8, Math.min(y, window.innerHeight - h - 8)),
    })
  }, [x, y, view, creating, customTags.length])

  useEffect(() => {
    const close = () => onClose()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const t = setTimeout(() => {
      window.addEventListener('mousedown', close)
      window.addEventListener('contextmenu', close)
      window.addEventListener('scroll', close, true)
      window.addEventListener('resize', close)
    }, 0)
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('mousedown', close)
      window.removeEventListener('contextmenu', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const copyCookie = () => { onCopyCookie(); setCopied(true); setTimeout(onClose, 850) }
  const pickTag = (tag: string | null) => { onSetTag(tag); onClose() }
  const submitNew = () => { const n = newName.trim(); if (n) { onCreateTag(n); onClose() } }
  const allTags = [...PRESET_TAGS, ...customTags.filter(t => !PRESET_TAGS.includes(t))]

  return (
    <div
      ref={ref}
      onMouseDown={e => e.stopPropagation()}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation() }}
      className="animate-scale-in"
      style={{
        position: 'fixed', left: pos.left, top: pos.top, width: MENU_W, zIndex: 10000,
        padding: 5, borderRadius: 12, transformOrigin: 'top left',
        background: 'rgba(12,10,22,0.96)', border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(24px) saturate(150%)', WebkitBackdropFilter: 'blur(24px) saturate(150%)',
        boxShadow: '0 18px 50px -12px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* header — which account this targets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px 8px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 4 }}>
        {account.avatarUrl
          ? <img src={account.avatarUrl} alt="" style={{ width: 20, height: 20, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
          : <span style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(124,58,237,0.18)', flexShrink: 0 }} />}
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account.username}</span>
      </div>

      {view === 'main' ? (
        <>
          <Item icon={account.favorite
            ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 15, height: 15 }}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5a.56.56 0 011.04 0l2.12 5.11a.56.56 0 00.48.35l5.52.44c.5.04.7.66.32.99l-4.2 3.6a.56.56 0 00-.18.56l1.28 5.38a.56.56 0 01-.84.61l-4.72-2.88a.56.56 0 00-.59 0l-4.72 2.88a.56.56 0 01-.84-.61l1.28-5.38a.56.56 0 00-.18-.56l-4.2-3.6a.56.56 0 01.32-.99l5.52-.44a.56.56 0 00.48-.35L11.48 3.5z" /></svg>
            : star}
            color="#fbbf24" label={account.favorite ? 'Unfavorite' : 'Favorite'} onClick={onFavorite} />

          {account.cookie && (
            <Item
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 15, height: 15 }}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>}
              color={copied ? '#4ade80' : undefined}
              label={copied ? 'Copied!' : 'Copy Cookie'}
              right={copied ? check : undefined}
              onClick={copyCookie}
            />
          )}

          <Item
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 15, height: 15 }}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>}
            label="Set Label"
            subtitle={account.tag ?? 'None'}
            right={chevron}
            onClick={() => setView('labels')}
          />

          <Item
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 15, height: 15 }}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M3.985 14.652H-.008v4.992M4.638 9.348a8.25 8.25 0 0113.803-3.047l3.572 3.011M19.362 14.652a8.25 8.25 0 01-13.803 3.047l-3.572-3.011" /></svg>}
            label="Refresh" onClick={onRefresh} />

          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 6px' }} />

          <Item
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 15, height: 15 }}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>}
            label="Remove" danger onClick={onRemove} />
        </>
      ) : (
        <>
          {/* labels view header */}
          <button onClick={() => { setView('main'); setCreating(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 9px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 8, color: 'oklch(0.78 0.035 283)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} style={{ width: 12, height: 12 }}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            Label
          </button>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '2px 6px 4px' }} />

          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            <Item icon={<span style={{ width: 10, height: 10, borderRadius: 3, border: '1.5px solid rgba(255,255,255,0.25)' }} />}
              label="None" right={!account.tag ? check : undefined} onClick={() => pickTag(null)} />
            {allTags.map(tag => {
              const c = tagColors(tag)
              return (
                <Item key={tag}
                  icon={<span style={{ width: 10, height: 10, borderRadius: 3, background: c.bg, border: `1.5px solid ${c.bd}` }} />}
                  color={c.fg} label={tag} right={account.tag === tag ? check : undefined} onClick={() => pickTag(tag)} />
              )
            })}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 6px' }} />

          {creating ? (
            <div style={{ display: 'flex', gap: 5, padding: '4px 6px' }}>
              <input
                autoFocus value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitNew() } else if (e.key === 'Escape') { e.stopPropagation(); setCreating(false); setNewName('') } }}
                placeholder="Group name…" maxLength={24}
                style={{ flex: 1, minWidth: 0, fontSize: 11, padding: '6px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(167,139,250,0.4)', color: '#fff', outline: 'none' }}
              />
              <button onClick={submitNew}
                style={{ flexShrink: 0, padding: '0 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, oklch(0.62 0.22 280), oklch(0.55 0.24 295))', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                Add
              </button>
            </div>
          ) : (
            <Item
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 15, height: 15 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>}
              color="#c4b5fd" label="New group…" onClick={() => setCreating(true)} />
          )}
        </>
      )}
    </div>
  )
}
