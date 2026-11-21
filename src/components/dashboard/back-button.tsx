import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export function BackButton({ fallback }: { fallback: string }) {
  return (
    <Link
      href={fallback}
      className="inline-flex items-center gap-2 rounded-sm py-1 text-xs text-fg-muted transition-colors hover:text-fg"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
      Voltar
    </Link>
  )
}
