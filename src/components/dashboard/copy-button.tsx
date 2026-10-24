'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CopyButton({
  value,
  label,
  variant = 'secondary',
}: {
  value: string
  label: string
  variant?: 'primary' | 'secondary'
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // Browsers sem permissão de clipboard: seleciona para o utilizador copiar.
      window.prompt('Copia o link:', value)
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Button type="button" variant={variant} onClick={copy} aria-live="polite">
      {copied ? (
        <Check className="h-4 w-4 text-live" strokeWidth={2.5} />
      ) : (
        <Copy className="h-4 w-4" strokeWidth={2} />
      )}
      {copied ? 'Copiado' : label}
    </Button>
  )
}
