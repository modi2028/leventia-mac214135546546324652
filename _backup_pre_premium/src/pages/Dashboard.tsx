import React, { useState, useEffect, useCallback } from 'react'
import { Background } from '../components/Background'
import { Sidebar } from '../components/Sidebar'
import { StatusBar } from '../components/StatusBar'
import { HomePage } from './HomePage'
import { AccountsPage } from './AccountsPage'
import { SettingsPage } from './SettingsPage'
import { LeaderboardPage } from './LeaderboardPage'
import { AboutPage } from './AboutPage'
import { StaffPage } from './StaffPage'
import { UpdatesPage } from './UpdatesPage'
import { PremiumPage } from './PremiumPage'
import { DynamicIsland } from '../components/DynamicIsland'
import { useSystemStats } from '../hooks/useSystemStats'
import { useUptime } from '../hooks/useUptime'
import { useUpdateNotifications } from '../hooks/useUpdateNotifications'
import type { LicenseData, RobloxAccount, Page } from '../types'

interface Props { license: LicenseData; onLogout: () => void }

export function Dashboard({ license, onLogout }: Props) {
  const [page, setPage]               = useState<Page>('home')
  const [accounts, setAccounts]       = useState<RobloxAccount[]>([])
  const [selectedCount, setSelectedCount] = useState(0)
  const stats  = useSystemStats()
  const uptime = useUptime()
  const { notification, dismiss } = useUpdateNotifications()

  // TEMP: Premium is open to ALL users right now. Set PREMIUM_OPEN = false to
  // re-gate it — staff then grant access per-user via Management → Access tier.
  const PREMIUM_OPEN = true
  const hasPremium = PREMIUM_OPEN || license.type === 'staff' || (license.role ?? 'standard') !== 'standard'

  useEffect(() => { window.electron.store.getAccounts().then(setAccounts).catch(() => {}) }, [])

  // Re-sync accounts from the store when entering the Accounts page, so changes
  // made elsewhere (e.g. a Health Check from the Premium tab) show up.
  useEffect(() => {
    if (page === 'accounts') window.electron.store.getAccounts().then(setAccounts).catch(() => {})
  }, [page])

  const handleAccountsChange = useCallback((updated: RobloxAccount[]) => setAccounts(updated), [])

  return (
    <>
      <Background />

      {/* Root layout — 12 px padding all round so panels float above the animated bg */}
      <div style={{
        display: 'flex',
        height: '100%',
        gap: 10,
        padding: 12,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}>
        {/* Sidebar floats in the left column */}
        <Sidebar
          activePage={page}
          onNavigate={setPage}
          accountCount={accounts.length}
          uptime={uptime}
          licenseKey={license.key}
          expiresAt={license.expiresAt}
          licenseType={license.type}
          discordUsername={license.discordUsername}
          hasPremium={hasPremium}
        />

        {/* Main column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden', minWidth: 0 }}>
          <main style={{ flex: 1, overflow: 'hidden' }}>
            <div key={page} className="page-enter" style={{ height: '100%' }}>
            {page === 'home' && <HomePage license={license} onNavigate={setPage} />}
            {page === 'accounts' && (
              <AccountsPage
                accounts={accounts}
                onAccountsChange={handleAccountsChange}
                onSelectionChange={setSelectedCount}
              />
            )}
            {page === 'settings'     && <SettingsPage onAccountsCleared={() => { setAccounts([]); setSelectedCount(0) }} onLogout={onLogout} />}
            {page === 'leaderboard'  && <LeaderboardPage />}
            {page === 'about'        && <AboutPage />}
            {page === 'premium'      && hasPremium && <PremiumPage />}
            {page === 'updates'      && <UpdatesPage isStaff={license.type === 'staff'} />}
            {page === 'staff'        && <StaffPage />}
            </div>
          </main>

          <StatusBar
            selectedCount={selectedCount}
            totalCount={accounts.length}
            cpuUsage={stats.cpuUsage}
            usedRam={stats.usedRam}
            totalRam={stats.totalRam}
          />
        </div>
      </div>

      {/* Dynamic Island — staff-update notifications for everyone */}
      {notification && (
        <DynamicIsland update={notification} onClick={() => setPage('updates')} onDismiss={dismiss} />
      )}
    </>
  )
}
