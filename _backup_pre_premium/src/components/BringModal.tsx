import React, { useState } from 'react'
import type { RobloxAccount } from '../types'

const PREFIX_KEY = 'lvnt:bringPrefix'

function copyText(text: string) {
  try { if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(text); return } } catch {}
  const ta = document.createElement('textarea')
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
  document.body.appendChild(ta); ta.select()
  try { document.execCommand('copy') } catch {}
  document.body.removeChild(ta)
}

// Builds e.g. ":bring averryFord99,StrongzGlen,OlivexFrost" from every account
// the user has added (even ones whose cookie/license has expired).
export function BringModal({ accounts, onClose }: { accounts: RobloxAccount[]; onClose: () => void }) {
  const [prefix, setPrefix] = useState(() => localStorage.getItem(PREFIX_KEY) ?? ':bring')
  const [copied, setCopied] = useState(false)

  const usernames = [...new Set(accounts.map(a => a.username.trim()).filter(Boolean))]
  const command = [prefix.trim(), usernames.join(',')].filter(Boolean).join(' ')

  const onPrefixChange = (v: string) => { setPrefix(v); localStorage.setItem(PREFIX_KEY, v) }
  const copy = () => { if (!usernames.length) return; copyText(command); setCopied(true); setTimeout(() => setCopied(false), 1800) }

  const label = { fontSize: 10, fontWeight: 600 as const, color: 'oklch(0.74 0.035 282)', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 8 }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={e => e.key === 'Escape' && onClose()}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass animate-slide-up relative w-full" style={{ maxWidth: 460, borderRadius: 20 }}>
        <div className="glass-aurora" />
        <div style={{ padding: '22px 22px 20px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                Bring Command
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(167,139,250,0.3)', color: '#c4b5fd', letterSpacing: '0.08em' }}>{usernames.length} ALTS</span>
              </h2>
              <p style={{ fontSize: 11, color: 'oklch(0.78 0.035 283)', marginTop: 4 }}>Every account you've added — paste this into the server chat.</p>
            </div>
            <button onClick={onClose} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: 'none', color: 'oklch(0.74 0.035 282)', cursor: 'pointer', flexShrink: 0 }}>
              <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Prefix */}
          <p style={label}>Command prefix</p>
          <input className="input-base w-full" value={prefix} onChange={e => onPrefixChange(e.target.value)} placeholder=":bring"
            style={{ marginBottom: 14, fontFamily: '"JetBrains Mono", monospace' }} />

          {/* Generated command */}
          <p style={label}>Command</p>
          {usernames.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'oklch(0.74 0.035 282)', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              No accounts added yet.
            </div>
          ) : (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', maxHeight: 150, overflowY: 'auto', wordBreak: 'break-all', userSelect: 'text' }}>
              <p style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: '#d6c9ff', fontWeight: 500, margin: 0, lineHeight: 1.7 }}>
                {prefix.trim() && <span style={{ color: '#a78bfa', fontWeight: 700 }}>{prefix.trim()} </span>}
                {usernames.join(',')}
              </p>
            </div>
          )}

          {/* Copy */}
          <button className="btn-accent w-full" style={{ marginTop: 16, padding: '10px 0', justifyContent: 'center', gap: 6 }} onClick={copy} disabled={usernames.length === 0}>
            {copied
              ? <><svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> Copied!</>
              : <><svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg> Copy Command</>}
          </button>
        </div>
      </div>
    </div>
  )
}
