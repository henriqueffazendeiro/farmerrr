'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'

/** Barra fixa em baixo com o estado e o botão "Guardar alterações" (definições do streamer e do clipper). */
export function SaveFooter({ label, dirty, saved }: { label: string; dirty: boolean; saved: boolean }) {
  const { pending } = useFormStatus()
  return (
    <footer className="fixed inset-x-0 bottom-0 z-30 bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <Container className="flex min-h-20 items-center justify-between gap-4 py-4">
        <p role="status" className="text-xs text-fg-muted">
          {pending ? 'A guardar…' : dirty ? 'Alterações por guardar' : saved ? 'Alterações guardadas' : 'Sem alterações'}
        </p>
        <Button type="submit" variant={dirty ? 'primary' : 'secondary'} disabled={!dirty || pending} className="border-0">
          {pending ? 'A guardar…' : label}
        </Button>
      </Container>
    </footer>
  )
}
