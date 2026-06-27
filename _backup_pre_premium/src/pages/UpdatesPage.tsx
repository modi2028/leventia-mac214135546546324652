import React, { useState, useEffect, useCallback } from 'react'
import type { UpdatePost, UpdateCategory } from '../types'

interface Props {
  isStaff: boolean
}

// ── Category styling ──────────────────────────────────────────────────────────

const CATEGORY_META: Record<UpdateCategory, { label: string; color: string; bg: string; bdr: string; solid: string; icon: React.ReactNode }> = {
  feature:      { label: 'Feature',      color: '#c4b5fd', bg: 'rgba(124,58,237,0.15)', bdr: 'rgba(167,139,250,0.35)', solid: '#a78bfa',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 11, height: 11 }}><path d="M9.5 3l1.6 4.4L15.5 9l-4.4 1.6L9.5 15l-1.6-4.4L3.5 9l4.4-1.6L9.5 3zm8 9l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9.9-2.5z" /></svg> },
  fix:          { label: 'Fix',          color: '#86efac', bg: 'rgba(34,197,94,0.13)',  bdr: 'rgba(34,197,94,0.3)',   solid: '#4ade80',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} style={{ width: 11, height: 11 }}><path strokeLinecap="round" strokeLinejoin="round" d="M11.5 6.5l3.5-3.5a4 4 0 015 5l-3.5 3.5M6.5 11.5L3 15a4 4 0 005 5l3.5-3.5M9 9l6 6" /></svg> },
  announcement: { label: 'Announcement', color: '#67e8f9', bg: 'rgba(6,182,212,0.13)',  bdr: 'rgba(6,182,212,0.3)',   solid: '#38bdf8',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 11, height: 11 }}><path strokeLinecap="round" strokeLinejoin="round" d="M3 11l16-7v16L3 13v-2zm0 0v5m4-3.5V18a2 2 0 002 2h1" /></svg> },
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ── Composer (staff only) ─────────────────────────────────────────────────────

function Composer({ onPosted }: { onPosted: (u: UpdatePost) => void }) {
  const [title, setTitle]       = useState('')
  const [body, setBody]         = useState('')
  const [version, setVersion]   = useState('')
  const [category, setCategory] = useState<UpdateCategory>('feature')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [open, setOpen]         = useState(false)

  const submit = async () => {
    if (!title.trim() || !body.trim()) { setError('Title and body are required.'); return }
    setLoading(true); setError('')
    try {
      const post = await window.electron.store.postUpdate({ title: title.trim(), body: body.trim(), version: version.trim() || undefined, category })
      onPosted(post)
      setTitle(''); setBody(''); setVersion(''); setCategory('feature'); setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post update.')
    } finally { setLoading(false) }
  }

  if (!open) {
    return (
      <button className="btn-accent" style={{ gap: 6 }} onClick={() => setOpen(true)}>
        <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        Post Update
      </button>
    )
  }

  return (
    <div className="glass animate-slide-up" style={{ padding: 18, marginBottom: 16, width: '100%' }}>
      <div className="glass-aurora" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>New Update</h3>
        <button onClick={() => setOpen(false)} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: 'none', color: 'oklch(0.74 0.035 282)', cursor: 'pointer' }}>
          <svg style={{ width: 12, height: 12 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Category + version row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(Object.keys(CATEGORY_META) as UpdateCategory[]).map(c => {
            const m = CATEGORY_META[c]
            const active = category === c
            return (
              <button key={c} onClick={() => setCategory(c)}
                style={{ fontSize: 11, fontWeight: 600, padding: '6px 11px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                  background: active ? m.bg : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? m.bdr : 'rgba(255,255,255,0.08)'}`,
                  color: active ? m.color : 'oklch(0.78 0.035 283)' }}>
                {m.label}
              </button>
            )
          })}
        </div>
        <input className="input-base" style={{ width: 110, marginLeft: 'auto' }} placeholder="v1.0.0 (opt.)" value={version} onChange={e => setVersion(e.target.value)} />
      </div>

      <input className="input-base w-full" style={{ marginBottom: 8 }} placeholder="Update title…" value={title} onChange={e => setTitle(e.target.value)} />
      <textarea className="input-base w-full" style={{ minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }} placeholder="What's new? Describe the changes…" value={body} onChange={e => setBody(e.target.value)} />

      {error && <p style={{ fontSize: 11, color: '#f87171', marginTop: 8 }}>{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn-accent" style={{ gap: 6 }} onClick={submit} disabled={loading}>
          {loading
            ? <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spinSlow 0.7s linear infinite', display: 'inline-block' }} />
            : <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>
          }
          Publish
        </button>
      </div>
    </div>
  )
}

// ── Update card ───────────────────────────────────────────────────────────────

function UpdateCard({ post, isStaff, onDelete }: { post: UpdatePost; isStaff: boolean; onDelete: (id: string) => void }) {
  const m = CATEGORY_META[post.category] ?? CATEGORY_META.announcement
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try { await window.electron.store.deleteUpdate(post.id); onDelete(post.id) }
    catch { setDeleting(false) }
  }

  return (
    <div className="glass" style={{ padding: '16px 18px 16px 20px', marginBottom: 12, position: 'relative', overflow: 'hidden' }}>
      <div className="glass-aurora" />
      {/* category accent stripe + corner tint */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 3, background: `linear-gradient(180deg, ${m.solid}, ${m.solid}55)` }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(360px 130px at 0% 0%, ${m.bg}, transparent 72%)` }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: m.bg, color: m.color, border: `1px solid ${m.bdr}`, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
          {m.icon}{m.label}
        </span>
        {post.version && (
          <span style={{ fontSize: 11, fontWeight: 600, fontFamily: '"JetBrains Mono", monospace', color: 'oklch(0.86 0.03 285)', padding: '3px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            {post.version}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'oklch(0.7 0.035 281)', fontFamily: '"JetBrains Mono", monospace', whiteSpace: 'nowrap' }}>
          {fmtDateTime(post.postedAt)}
        </span>
        {isStaff && (
          <button onClick={handleDelete} disabled={deleting} title="Delete update"
            style={{ flexShrink: 0, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.22)', color: '#f87171', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.2)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.1)'}>
            <svg style={{ width: 12, height: 12 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
          </button>
        )}
      </div>

      <h3 style={{ position: 'relative', fontSize: 15.5, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>{post.title}</h3>
      <p style={{ position: 'relative', fontSize: 13, color: 'oklch(0.89 0.025 285)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{post.body}</p>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: m.solid, boxShadow: `0 0 6px ${m.solid}` }} />
        <span style={{ fontSize: 10, color: 'oklch(0.74 0.035 282)', fontWeight: 500 }}>{post.author}</span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function UpdatesPage({ isStaff }: Props) {
  const [updates, setUpdates] = useState<UpdatePost[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setUpdates(await window.electron.store.getUpdates()) } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 640 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>📢</span> Updates
            </h1>
            <p style={{ fontSize: 11, color: 'oklch(0.82 0.035 284)', marginTop: 4 }}>Latest changes, fixes and announcements</p>
          </div>
          {isStaff && <Composer onPosted={u => setUpdates(prev => [u, ...prev])} />}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 20, height: 20, border: '2px solid rgba(124,58,237,0.4)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spinSlow 0.7s linear infinite' }} />
          </div>
        ) : updates.length === 0 ? (
          <div className="glass" style={{ padding: 48, textAlign: 'center' }}>
            <div className="glass-aurora" />
            <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg style={{ width: 24, height: 24, color: 'rgba(167,139,250,0.4)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.3}><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" /></svg>
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'oklch(0.86 0.03 285)', margin: 0 }}>No updates yet</p>
            <p style={{ fontSize: 11, color: 'oklch(0.68 0.035 280)', marginTop: 4 }}>
              {isStaff ? 'Post the first update using the button above.' : 'Check back soon for news and changes.'}
            </p>
          </div>
        ) : (
          updates.map(u => <UpdateCard key={u.id} post={u} isStaff={isStaff} onDelete={id => setUpdates(prev => prev.filter(x => x.id !== id))} />)
        )}

      </div>
    </div>
  )
}
