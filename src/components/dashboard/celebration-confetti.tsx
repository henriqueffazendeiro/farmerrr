'use client'

import { useEffect, useRef } from 'react'
import styles from './page-ready.module.css'

export function CelebrationConfetti() {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const surface = canvas.current
    const context = surface?.getContext('2d')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!surface || !context || reduced.matches) return
    let width = window.innerWidth
    let height = window.innerHeight
    function resize() {
      if (!surface || !context) return
      width = window.innerWidth
      height = window.innerHeight
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      surface.width = width * ratio
      surface.height = height * ratio
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    resize()
    const colors = ['#ff7547', '#ffd54a', '#51d6a5', '#53b9ff', '#a78bfa', '#f472b6', '#ffffff']
    const particles = Array.from({ length: width < 600 ? 120 : 200 }, (_, index) => {
      const launchDepth = 180 + Math.random() * 60
      const speed = Math.sqrt((height + launchDepth) * 2 * 1050) * (.9 + Math.random() * .28)
      const spread = (Math.random() - .5) * 1.5
      return {
        x: width * (.32 + Math.random() * .36), y: height + launchDepth,
        vx: Math.sin(spread) * Math.min(width, 1100) * 1.05, vy: -speed * Math.cos(spread),
        rotation: Math.random() * Math.PI * 2, spin: (Math.random() - .5) * 16,
        phase: Math.random() * Math.PI * 2, flutter: 5 + Math.random() * 8,
        size: 5 + Math.random() * 5, color: colors[index % colors.length],
        aspect: .8 + Math.random() * .9,
        drag: 1.8 + Math.random() * .8,
        sway: 16 + Math.random() * 20,
        lifetime: 6 + Math.random(), age: 0,
      }
    })
    let frame = 0
    let previous = performance.now()
    let elapsed = 0
    function draw(now: number) {
      if (!context) return
      const dt = Math.min((now - previous) / 1000, .04)
      previous = now
      elapsed += dt
      context.clearRect(0, 0, width, height)
      for (const piece of particles) {
        piece.age += dt
        piece.vx *= Math.exp(-1.05 * dt)
        piece.vy += (1050 - Math.max(0, piece.vy) * piece.drag) * dt
        const falling = Math.min(1, Math.max(0, piece.vy) / 200)
        piece.x += (piece.vx + Math.sin(piece.age * piece.flutter + piece.phase) * piece.sway * falling) * dt
        piece.y += piece.vy * dt
        piece.spin *= Math.exp(-.18 * dt)
        piece.rotation += piece.spin * dt
        if (piece.y > height + 24 || piece.y < -24 || piece.x < -24 || piece.x > width + 24) continue
        context.save()
        context.translate(piece.x, piece.y)
        context.rotate(piece.rotation)
        // Turning paper exposes its thin edge, then its face again.
        const turn = Math.cos(piece.age * piece.flutter + piece.phase)
        context.scale(1, Math.max(.12, Math.abs(turn)))
        context.globalAlpha = Math.min(1, Math.max(0, (piece.lifetime - piece.age) / .8)) * (.78 + Math.abs(turn) * .22)
        context.fillStyle = piece.color
        context.fillRect(-piece.size / 2, -piece.size * piece.aspect / 2, piece.size, piece.size * piece.aspect)
        context.restore()
      }
      if (elapsed < 7) frame = requestAnimationFrame(draw)
      else context.clearRect(0, 0, width, height)
    }
    function stop() {
      cancelAnimationFrame(frame)
      context?.clearRect(0, 0, width, height)
    }
    frame = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    reduced.addEventListener('change', stop)
    return () => {
      stop()
      window.removeEventListener('resize', resize)
      reduced.removeEventListener('change', stop)
    }
  }, [])

  return <canvas ref={canvas} className={styles.confetti} aria-hidden="true" />
}
