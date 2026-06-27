import React, { useCallback, useRef, useEffect } from 'react'
import type { RobloxAccount } from '../types'
import { AccountRow } from './AccountRow'

interface Props {
  accounts: RobloxAccount[]
  selected: Set<string>
  onSelectionChange: (next: Set<string>) => void
  refreshingIds: Set<string>
  runningIds: Set<string>
  onContextMenu: (account: RobloxAccount, x: number, y: number) => void
}

const COLS = ['Username', 'User ID', 'Group', 'Status', 'Added', 'Refreshed']

export function AccountTable({ accounts, selected, onSelectionChange, refreshingIds, runningIds, onContextMenu }: Props) {
  const allSelected  = accounts.length > 0 && accounts.every(a => selected.has(a.id))
  const someSelected = !allSelected && accounts.some(a => selected.has(a.id))
  const checkRef     = useRef<HTMLInputElement>(null)

  useEffect(() => { if (checkRef.current) checkRef.current.indeterminate = someSelected }, [someSelected])

  const toggleAll = useCallback(() => {
    const next = new Set(selected)
    allSelected ? accounts.forEach(a => next.delete(a.id)) : accounts.forEach(a => next.add(a.id))
    onSelectionChange(next)
  }, [allSelected, accounts, selected, onSelectionChange])

  const toggleOne = useCallback((id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    onSelectionChange(next)
  }, [selected, onSelectionChange])

  if (accounts.length === 0) {
    return (
      <div className="glass" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div className="glass-aurora" />
        <div style={{ width: 60, height: 60, borderRadius: 20, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg style={{ width: 26, height: 26, color: 'rgba(167,139,250,0.4)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'oklch(0.86 0.03 285)' }}>No accounts yet</p>
          <p style={{ fontSize: 11, color: 'oklch(0.68 0.035 280)', marginTop: 4 }}>Click "Add Account" to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div className="glass-aurora" />
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, zIndex: 10, background: 'rgba(8,6,20,0.7)', backdropFilter: 'blur(20px)' }}>
            <th style={{ paddingLeft: 16, paddingRight: 8, paddingTop: 10, paddingBottom: 10, textAlign: 'left', width: 40 }}>
              <div
                onClick={toggleAll}
                style={{
                  width: 14, height: 14, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s',
                  background: allSelected ? 'linear-gradient(135deg, oklch(0.62 0.22 280), oklch(0.55 0.24 295))' : 'transparent',
                  border: allSelected ? 'none' : someSelected ? '1px solid rgba(167,139,250,0.5)' : '1px solid rgba(255,255,255,0.18)',
                  boxShadow: allSelected ? '0 2px 8px rgba(124,58,237,0.5)' : 'none',
                }}
              >
                {allSelected && <svg style={{ width: 10, height: 10, color: 'white' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                {someSelected && !allSelected && <span style={{ width: 6, height: 2, borderRadius: 99, background: '#a78bfa', display: 'block' }} />}
                <input ref={checkRef} type="checkbox" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} onChange={toggleAll} />
              </div>
            </th>
            <th style={{ padding: '10px 8px', textAlign: 'left', width: 44, fontSize: 10, fontWeight: 700, color: 'oklch(0.84 0.03 284)', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>Avatar</th>
            {COLS.map(col => (
              <th key={col} style={{ padding: '10px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'oklch(0.84 0.03 284)', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts.map((account, i) => (
            <AccountRow
              key={account.id}
              account={account}
              selected={selected.has(account.id)}
              onToggle={() => toggleOne(account.id)}
              onContextMenu={(x, y) => onContextMenu(account, x, y)}
              isRefreshing={refreshingIds.has(account.id)}
              isRunning={runningIds.has(account.id)}
              isEven={i % 2 === 0}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
