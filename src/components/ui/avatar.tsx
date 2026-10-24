import { cn } from '@/lib/utils'

const sizes = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
} as const

type Size = keyof typeof sizes

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function Avatar({
  src,
  name,
  size = 'md',
  className,
}: {
  src?: string | null
  name: string
  size?: Size
  className?: string
}) {
  const cls = cn(
    'shrink-0 overflow-hidden rounded-full border border-line bg-surface-2',
    'grid place-items-center font-semibold text-fg-muted select-none',
    sizes[size],
    className,
  )

  if (src) {
    // <img> em vez de next/image: os avatares vêm de domínios variáveis e
    // não vale a pena o custo de otimização para imagens tão pequenas.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} className={cls} loading="lazy" />
  }

  return (
    <span className={cls} aria-label={name}>
      {initials(name)}
    </span>
  )
}
