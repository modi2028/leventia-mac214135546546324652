import { useState, useEffect } from 'react'
import type { SystemStats } from '../types/index.js'

const DEFAULT: SystemStats = { cpuUsage: 0, totalRam: 0, usedRam: 0 }

export function useSystemStats(intervalMs = 3000): SystemStats {
  const [stats, setStats] = useState<SystemStats>(DEFAULT)

  useEffect(() => {
    let mounted = true
    const fetch = async () => {
      try {
        const s = await window.electron.system.getStats()
        if (mounted) setStats(s)
      } catch {}
    }
    fetch()
    const id = setInterval(fetch, intervalMs)
    return () => { mounted = false; clearInterval(id) }
  }, [intervalMs])

  return stats
}
