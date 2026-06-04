import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 68  // px of pull needed to trigger
const MAX_PULL  = 96  // max visual travel (dampened)

export function usePullToRefresh(
  scrollRef: React.RefObject<HTMLElement | null>,
  onRefresh: () => Promise<void> | void,
) {
  const [pullY, setPullY]         = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startYRef = useRef<number | null>(null)
  const pullYRef  = useRef(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop === 0) {
        startYRef.current = e.touches[0].clientY
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null) return
      if (el.scrollTop > 0) { startYRef.current = null; return }

      const delta = e.touches[0].clientY - startYRef.current
      if (delta > 0) {
        const clamped = Math.min(delta * 0.45, MAX_PULL)
        pullYRef.current = clamped
        setPullY(clamped)
      } else {
        startYRef.current = null
        pullYRef.current = 0
        setPullY(0)
      }
    }

    const onTouchEnd = async () => {
      const triggered = pullYRef.current >= THRESHOLD
      startYRef.current = null
      pullYRef.current = 0
      setPullY(0)

      if (triggered) {
        setRefreshing(true)
        try { await onRefresh() } finally { setRefreshing(false) }
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove',  onTouchMove,  { passive: true })
    el.addEventListener('touchend',   onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
    }
  }, [scrollRef, onRefresh])

  return { pullY, refreshing, threshold: THRESHOLD }
}
