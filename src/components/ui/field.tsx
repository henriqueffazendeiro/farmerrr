import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const inputStyles =
  'w-full rounded-sm border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-fg ' +
  'placeholder:text-fg-subtle transition-colors ' +
  'hover:border-line-strong focus:border-brand focus:outline-none ' +
  'focus:ring-2 focus:ring-brand/25 disabled:opacity-50'

export function Field({
  label,
  name,
  hint,
  className,
  ...props
}: ComponentProps<'input'> & { label: string; name: string; hint?: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
      </label>
      <input id={name} name={name} className={inputStyles} {...props} />
      {hint ? <p className="mt-1.5 text-xs text-fg-subtle">{hint}</p> : null}
    </div>
  )
}

export function TextareaField({
  label,
  name,
  hint,
  className,
  ...props
}: ComponentProps<'textarea'> & { label: string; name: string; hint?: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
      </label>
      <textarea id={name} name={name} className={cn(inputStyles, 'min-h-24 resize-y')} {...props} />
      {hint ? <p className="mt-1.5 text-xs text-fg-subtle">{hint}</p> : null}
    </div>
  )
}
