'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { ButtonLink } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import styles from './community-cta.module.css'

function Hyperspace() {
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
    const stars = Array.from({ length: 420 }, () => ({
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
          star.z -= delta * 0.64
          if (star.z < 12) star.z = depth
        }
        const scale = focalLength / Math.max(star.z, 12)
        const x = Math.cos(star.angle) * star.radius
        const y = Math.sin(star.angle) * star.radius
        const screenX = width / 2 + x * scale
        const screenY = height / 2 + y * scale
        if (screenX < -100 || screenX > width + 100 || screenY < -100 || screenY > height + 100) continue
        const tailScale = focalLength / (star.z + (moving ? 130 : 0))
        const alpha = Math.min(0.85, (1 - star.z / depth) * 0.95)
        const color = star.blue ? '170, 202, 255' : '228, 237, 255'
        context.lineWidth = star.size * Math.min(1.6, scale)
        if (moving) {
          const tailX = width / 2 + x * tailScale
          const tailY = height / 2 + y * tailScale
          const gradient = context.createLinearGradient(tailX, tailY, screenX, screenY)
          gradient.addColorStop(0, `rgba(${color}, 0)`)
          gradient.addColorStop(1, `rgba(${color}, ${alpha})`)
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
  }, [])

  return <canvas ref={canvasRef} className={styles.space} aria-hidden="true" />
}

export function CommunityCta() {
  return (
    <section id="comunidade" className={`${styles.section} scroll-mt-20`} aria-labelledby="community-cta-title">
      <Hyperspace />
      <Container>
        <div className={styles.copy}>
          <h2 id="community-cta-title" className="text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">Pronto para começar?</h2>
          <p>Leva a tua comunidade para além do chat.</p>
          <div className={styles.actions}>
            <ButtonLink href="/registar" size="lg">Começar grátis</ButtonLink>
            <Link href="/#precos" className="rounded-sm px-4 py-2 text-sm text-fg-muted transition-colors hover:text-fg">Ver preços</Link>
          </div>
        </div>
      </Container>
    </section>
  )
}
