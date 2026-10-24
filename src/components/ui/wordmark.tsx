import { cn } from '@/lib/utils'

/**
 * Marca: `farmerrr.` em minúsculas, com `rrr.` num bloco da cor principal.
 * Os três erres são a assinatura — nunca escrever "farmer" nem "farmr".
 */
export function Wordmark({
  className,
  size = 'md',
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'inherit'
}) {
  const sizes = {
    sm: 'text-[15px]',
    md: 'text-[18px]',
    lg: 'text-[24px]',
    inherit: 'text-[length:inherit]',
  } as const

  return (
    <span
      className={cn(
        'inline-flex items-center gap-[0.18em] whitespace-nowrap font-semibold tracking-[-0.04em] text-fg select-none',
        sizes[size],
        className,
      )}
    >
      <span>farme</span><span className={cn(
        'inline-flex w-[1.8em] min-w-8 shrink-0 items-center justify-center rounded-ui bg-accent text-canvas',
        size === 'inherit' ? 'h-[1.7778em]' : 'h-8',
      )}><span className="relative -top-[0.1em] leading-none">rrr.</span></span>
    </span>
  )
}
