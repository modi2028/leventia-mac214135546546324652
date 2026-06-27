// Account-age gate: Roblox heavily restricts/captchas brand-new accounts, so the
// app blocks joining with anything under MIN_ACCOUNT_AGE_DAYS and lets you filter
// them out. Age is derived from the Roblox account creation date.

export const MIN_ACCOUNT_AGE_DAYS = 3

export function accountAgeDays(created?: string): number | null {
  if (!created) return null
  const ms = Date.now() - new Date(created).getTime()
  if (isNaN(ms)) return null
  return ms / 86_400_000
}

// True only when we KNOW the account is under the threshold (unknown age = not blocked).
export function isAccountTooNew(created?: string): boolean {
  const d = accountAgeDays(created)
  return d !== null && d < MIN_ACCOUNT_AGE_DAYS
}

// Short human label, e.g. "2d", "17h", or '' if unknown.
export function ageLabel(created?: string): string {
  const d = accountAgeDays(created)
  if (d === null) return ''
  if (d < 1) return `${Math.max(0, Math.floor(d * 24))}h old`
  return `${Math.floor(d)}d old`
}
