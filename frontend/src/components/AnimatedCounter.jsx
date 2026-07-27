import { useEffect, useRef, useState } from 'react'
import { formatUsdt } from '../utils/format'

/**
 * Smoothly tweens between the previous and new numeric value whenever `value`
 * changes, instead of snapping — used for the balance hero and other premium
 * counters. Falls back to an instant update if the browser prefers reduced
 * motion.
 */
export default function AnimatedCounter({ value, formatter = formatUsdt, duration = 500, className = '' }) {
  const [display, setDisplay] = useState(Number(value) || 0)
  const fromRef = useRef(Number(value) || 0)
  const rafRef = useRef(null)

  useEffect(() => {
    const to = Number(value) || 0
    const from = fromRef.current
    if (to === from) return

    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setDisplay(to)
      fromRef.current = to
      return
    }

    const start = performance.now()
    cancelAnimationFrame(rafRef.current)

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = from + (to - from) * eased
      setDisplay(current)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return <span className={className}>{formatter(display)}</span>
}
