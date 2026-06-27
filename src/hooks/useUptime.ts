import { useState, useEffect, useRef } from 'react'

export function useUptime(): string {
  const startRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 1000)
    return () => clearInterval(id)
  }, [])

  const h = Math.floor(elapsed / 3_600_000).toString().padStart(2, '0')
  const m = Math.floor((elapsed % 3_600_000) / 60_000).toString().padStart(2, '0')
  const s = Math.floor((elapsed % 60_000) / 1_000).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}
