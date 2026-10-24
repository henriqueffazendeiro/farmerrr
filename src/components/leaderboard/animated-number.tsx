'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { compactNumber, fullNumber } from '@/lib/format'

export function AnimatedNumber({ value, compact = false }: { value: number; compact?: boolean }) {
  const target = Number.isFinite(value) ? value : 0
  const previous = useRef(target)
  const reducedMotion = useReducedMotion()
  const direction = target >= previous.current ? -1 : 1
  const formatted = (compact ? compactNumber : fullNumber)(target)

  useEffect(() => { previous.current = target }, [target])

  return <span aria-label={formatted} style={{ display: 'inline-grid', overflow: 'hidden', verticalAlign: 'bottom', fontVariantNumeric: 'tabular-nums' }}>
    <AnimatePresence initial={false} custom={direction}>
      <motion.span
        key={formatted}
        aria-hidden="true"
        custom={direction}
        variants={{
          enter: (sign: number) => ({ opacity: 0, y: reducedMotion ? 0 : -sign * 6 }),
          visible: { opacity: 1, y: 0 },
          leave: (sign: number) => ({ opacity: 0, y: reducedMotion ? 0 : sign * 6 }),
        }}
        initial="enter"
        animate="visible"
        exit="leave"
        transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.4, 0, 0.2, 1] }}
        style={{ gridArea: '1 / 1', whiteSpace: 'nowrap' }}
      >{formatted}</motion.span>
    </AnimatePresence>
  </span>
}
