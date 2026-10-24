'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Both the expanding circle and the ribbons cover the stage at 450 ms.
export const RECAP_TRANSITION_MS = 1000
const COVERED_AT_MS = 450

export function useRecapNavigation(count: number, reduced: boolean) {
  const [scene, setScene] = useState(0)
  const [run, setRun] = useState(0)
  const [direction, setDirection] = useState(1)
  const [transitioning, setTransitioning] = useState(false)
  const [travel, setTravel] = useState({ from: 0, to: 0 })
  const current = useRef(0)
  const busy = useRef(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const navigate = useCallback((destination: number, replay = false) => {
    const target = Math.max(0, Math.min(count - 1, destination))
    if (busy.current || (!replay && target === current.current)) return
    setDirection(target >= current.current ? 1 : -1)
    setTravel({ from: current.current, to: target })
    const commit = () => {
      current.current = target
      setScene(target)
      if (replay) setRun(value => value + 1)
    }
    if (reduced) { commit(); return }
    busy.current = true
    setTransitioning(true)
    timers.current = [
      setTimeout(commit, COVERED_AT_MS),
      setTimeout(() => {
        busy.current = false
        setTransitioning(false)
        timers.current = []
      }, RECAP_TRANSITION_MS),
    ]
  }, [count, reduced])

  const go = useCallback((delta: number) => navigate(current.current + delta), [navigate])

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('input,select,textarea,video,audio,[contenteditable]:not([contenteditable="false"]),[role="slider"],[role="dialog"]')) return
      // Space keeps its native action when a control has keyboard focus.
      if (event.code === 'Space' && target?.closest('button,a,[role="button"]')) return
      if (event.key === 'ArrowRight' || event.code === 'Space') { event.preventDefault(); go(1) }
      if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1) }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [go])

  return { scene, run, direction, transitioning, travel, go, navigate, replay: () => navigate(0, true) }
}
