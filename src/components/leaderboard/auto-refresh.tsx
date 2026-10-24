'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Mantém a página viva durante uma live sem recarregar o browser:
 * pede ao Next para revalidar os dados e o React reconcilia — o que faz as
 * linhas do ranking deslizarem quando alguém troca de posição.
 */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter()

  useEffect(() => {
    if (typeof document === 'undefined') return

    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }

    const id = setInterval(tick, seconds * 1000)
    return () => clearInterval(id)
  }, [router, seconds])

  return null
}
