'use client'

import { useEffect, useRef } from 'react'

export function Hyperspace({ className, starCount = 420, smooth = false }: { className?: string; starCount?: number; smooth?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let width = 0
    let height = 0
    let frame = 0
    let previousTime = 0
    let visible = false
    const depth = 1500
    const stars = Array.from({ length: starCount }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 80 + Math.random() * 1100,
      z: Math.random() * depth,
      size: 0.5 + Math.random() * 1.1,
      blue: Math.random() > 0.75,
    }))

    function draw(delta: number, moving: boolean) {
      if (!context) return
      context.clearRect(0, 0, width, height)
      const focalLength = Math.max(width, height) * 0.55
      for (const star of stars) {
        if (moving) {
          star.z -= delta * (smooth ? 0.4 : 0.64)
          if (star.z < 12) star.z += depth - 12
        }
        const scale = focalLength / Math.max(star.z, 12)
        const x = Math.cos(star.angle) * star.radius
        const y = Math.sin(star.angle) * star.radius
        const screenX = width / 2 + x * scale
        const screenY = height / 2 + y * scale
        const tailScale = focalLength / (star.z + (moving ? (smooth ? 90 : 130) : 0))
        const edgeDistance = Math.max(Math.abs(screenX - width / 2) / Math.max(width / 2, 1), Math.abs(screenY - height / 2) / Math.max(height / 2, 1))
        const edgeProgress = Math.max(0, Math.min(1, (edgeDistance - 0.65) / 0.45))
        const edgeFade = smooth ? 1 - edgeProgress * edgeProgress * (3 - 2 * edgeProgress) : 1
        const alpha = Math.min(smooth ? 0.65 : 0.85, (1 - star.z / depth) * 0.95) * edgeFade
        if (alpha <= 0) continue
        const color = star.blue ? '170, 202, 255' : '228, 237, 255'
        context.lineWidth = star.size * Math.min(1.6, scale)
        context.lineCap = smooth ? 'round' : 'butt'
        if (moving) {
          const tailX = width / 2 + x * tailScale
          const tailY = height / 2 + y * tailScale
          const gradient = context.createLinearGradient(tailX, tailY, screenX, screenY)
          gradient.addColorStop(0, `rgba(${color}, 0)`)
          gradient.addColorStop(smooth ? 0.8 : 1, `rgba(${color}, ${alpha})`)
          if (smooth) gradient.addColorStop(1, `rgba(${color}, 0)`)
          context.strokeStyle = gradient
          context.beginPath()
          context.moveTo(tailX, tailY)
          context.lineTo(screenX, screenY)
          context.stroke()
        } else {
          context.fillStyle = `rgba(${color}, ${Math.max(0.2, alpha)})`
          context.beginPath()
          context.arc(screenX, screenY, star.size, 0, Math.PI * 2)
          context.fill()
        }
      }
    }

    function animate(time: number) {
      const delta = previousTime ? Math.min(time - previousTime, 40) : 16
      previousTime = time
      draw(delta, true)
      frame = requestAnimationFrame(animate)
    }

    function updateAnimation() {
      cancelAnimationFrame(frame)
      previousTime = 0
      draw(0, !preference.matches)
      if (visible && !document.hidden && !preference.matches) frame = requestAnimationFrame(animate)
    }

    const resize = new ResizeObserver(() => {
      const bounds = canvas.getBoundingClientRect()
      width = bounds.width
      height = bounds.height
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      updateAnimation()
    })
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      updateAnimation()
    })
    resize.observe(canvas)
    intersection.observe(canvas)
    preference.addEventListener('change', updateAnimation)
    document.addEventListener('visibilitychange', updateAnimation)
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      intersection.disconnect()
      preference.removeEventListener('change', updateAnimation)
      document.removeEventListener('visibilitychange', updateAnimation)
    }
  }, [starCount, smooth])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}

