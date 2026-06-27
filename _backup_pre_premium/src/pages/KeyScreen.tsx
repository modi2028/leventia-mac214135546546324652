import React, { useState, useRef, useEffect } from 'react'
import type { LicenseData } from '../types'
import logoUrl from '../assets/logo.svg'

interface Props {
  onValidated: (license: LicenseData) => void
}

export function KeyScreen({ onValidated }: Props) {
  const [key, setKey]     = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = async () => {
    const trimmed = key.trim()
    if (!trimmed || loading) return
    setLoading(true); setError('')
    try {
      const license = await window.electron.store.saveLicense(trimmed)
      onValidated(license)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid key. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden"
      style={{ background: 'radial-gradient(ellipse 120% 80% at 50% 120%, rgba(124,58,237,0.12) 0%, rgba(59,130,246,0.06) 40%, transparent 70%), #07070e' }}>

      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full pointer-events-none animate-float"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      <div className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)', filter: 'blur(40px)' }} />

      {/* Card */}
      <div className="relative w-full max-w-[400px] mx-4 animate-scale-in"
        style={{
          background: 'linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(124,58,237,0.04) 50%, rgba(255,255,255,0.02) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '24px',
          backdropFilter: 'blur(40px)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.02) inset, 0 1px 0 rgba(255,255,255,0.1) inset',
        }}>

        {/* Shimmer line */}
        <div className="absolute top-0 left-8 right-8 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.6), rgba(59,130,246,0.4), transparent)' }} />

        <div style={{ padding: '40px 36px 36px' }}>
          {/* Logo + Branding */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px', gap: '14px' }}>
            <div className="animate-float" style={{ position: 'relative' }}>
              <div className="animate-glow-pulse" style={{ position: 'absolute', inset: -12, background: 'radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)', filter: 'blur(12px)', borderRadius: '50%' }} />
              <img src={logoUrl} width={68} height={68} alt="Leventia"
                style={{ position: 'relative', filter: 'drop-shadow(0 0 20px rgba(124,58,237,0.5))' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.04em', background: 'linear-gradient(135deg, #c4b5fd, #93c5fd, #67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', margin: 0 }}>
                Leventia Alting
              </h1>
              <p style={{ fontSize: '11px', color: 'oklch(0.8 0.035 283)', marginTop: '4px', letterSpacing: '0.1em' }}>
                Account Manager
              </p>
            </div>
          </div>

          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)', marginBottom: '28px' }} />

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: 'oklch(0.82 0.035 284)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '8px' }}>
                License Key
              </label>
              <input
                ref={inputRef}
                className="input-base w-full font-mono text-center"
                style={{ fontSize: '12px', letterSpacing: '0.07em' }}
                placeholder="LVNT-STAFF-… or LVNT-BASIC-…"
                value={key}
                onChange={e => { setKey(e.target.value.toUpperCase()); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                disabled={loading}
                spellCheck={false}
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '10px' }}>
                <svg style={{ width: 14, height: 14, color: '#a78bfa', flexShrink: 0, marginTop: 1 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p style={{ fontSize: '11px', color: '#c4b5fd' }}>{error}</p>
              </div>
            )}

            <button
              className="btn-pill w-full"
              style={{ paddingTop: '11px', paddingBottom: '11px', fontSize: '13px' }}
              onClick={handleSubmit}
              disabled={loading || !key.trim()}
            >
              {loading
                ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spinSlow 0.7s linear infinite', display: 'inline-block' }} />
                : <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
              }
              {loading ? 'Validating…' : 'Activate License'}
            </button>
          </div>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 10, color: 'oklch(0.72 0.03 282)', letterSpacing: '0.05em' }}>
            Keys are issued by Leventia staff. Contact us on Discord to obtain one.
          </p>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center' }}>
        <p style={{ fontSize: '9px', color: 'oklch(0.7 0.03 282)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Leventia Alting V2.2</p>
      </div>
    </div>
  )
}
