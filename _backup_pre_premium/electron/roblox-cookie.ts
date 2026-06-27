// ─────────────────────────────────────────────────────────────────────────────
// Roblox .ROBLOSECURITY cookie ROTATION
//
// Roblox periodically rotates the auth cookie: an authenticated request (most
// notably the game auth-ticket endpoint we hit on EVERY launch) responds with a
// Set-Cookie carrying a brand-new .ROBLOSECURITY token, and the previous token
// is invalidated shortly after. If we keep using the stored (now-stale) cookie,
// the next request — typically the health-check sweep — gets 401/403 and the
// account is flagged "expired". That's why an alt appears to die after being
// used a single time.
//
// extractRotatedCookie pulls the fresh token out of a response's Set-Cookie
// header(s) so callers can persist it back onto the account.
// ─────────────────────────────────────────────────────────────────────────────

export function extractRotatedCookie(res: Response): string | null {
  // undici (Electron's main-process fetch) exposes multiple Set-Cookie values
  // via getSetCookie(); fall back to the (comma-joined) single header otherwise.
  let lines: string[] = []
  const h = res.headers as Headers & { getSetCookie?: () => string[] }
  if (typeof h.getSetCookie === 'function') lines = h.getSetCookie()
  else { const one = res.headers.get('set-cookie'); if (one) lines = [one] }

  for (const line of lines) {
    const m = /\.ROBLOSECURITY=([^;]+)/i.exec(line)
    if (!m) continue
    const val = m[1].trim()
    // Skip logout/clear cookies. A genuine token is long and warning-prefixed
    // (_|WARNING:-DO-NOT-SHARE-THIS…|_<token>); "DELETED"/empty means sign-out.
    if (!val || val.toUpperCase() === 'DELETED' || val.length < 100) continue
    return val
  }
  return null
}
