import { useState, useEffect, useCallback } from 'react'
import type { UpdatePost } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// Watches the shared (Supabase) updates feed and fires a one-off notification
// whenever staff post something newer than what this client has already seen.
//
// "Last seen" is tracked in localStorage by timestamp, so:
//   • the very first run never spams (it silently marks the latest as seen),
//   • a genuinely newer post (while the app is open OR posted while it was
//     closed) triggers exactly one notification on the next poll/launch.
// ─────────────────────────────────────────────────────────────────────────────

const LAST_SEEN_KEY = 'lvnt:lastSeenUpdateTime'
const POLL_MS = 30_000

export function useUpdateNotifications() {
  const [notification, setNotification] = useState<UpdatePost | null>(null)

  const dismiss = useCallback(() => setNotification(null), [])

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const updates = await window.electron.store.getUpdates()
        if (cancelled || !updates || updates.length === 0) return

        // rpc_get_updates returns newest-first
        const newest = updates[0]
        const lastSeen = localStorage.getItem(LAST_SEEN_KEY)

        // First time we've ever seen the feed → mark current as seen, no popup.
        if (lastSeen === null) {
          localStorage.setItem(LAST_SEEN_KEY, newest.postedAt)
          return
        }

        if (new Date(newest.postedAt).getTime() > new Date(lastSeen).getTime()) {
          localStorage.setItem(LAST_SEEN_KEY, newest.postedAt)
          setNotification(newest)
        }
      } catch { /* offline / not configured — ignore */ }
    }

    check()
    const timer = setInterval(check, POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  return { notification, dismiss }
}
