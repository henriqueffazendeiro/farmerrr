'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle } from 'lucide-react'
import { createCreatorAction, type CreatorState } from '@/lib/creators/actions'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { slugify } from '@/lib/slug'
import { publicEnv } from '@/lib/config/env'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? 'A criar…' : 'Continuar'}
    </Button>
  )
}

export function CreatorOnboarding({ suggestedName }: { suggestedName: string }) {
  const [state, formAction] = useActionState<CreatorState, FormData>(createCreatorAction, {})
  const [name, setName] = useState(suggestedName)
  const [handle, setHandle] = useState(slugify(suggestedName))
  const [handleTouched, setHandleTouched] = useState(false)

  const host = publicEnv.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, '')

  return (
    <form action={formAction} className="space-y-5">
      <Field
        label="Como te chamas na stream?"
        name="name"
        value={name}
        onChange={(e) => {
          const value = e.target.value
          setName(value)
          if (!handleTouched) setHandle(slugify(value))
        }}
        placeholder="Luís Ferreira"
        maxLength={60}
        required
        autoFocus
      />

      <Field
        label="Endereço público"
        name="handle"
        value={handle}
        onChange={(e) => {
          setHandleTouched(true)
          setHandle(slugify(e.target.value))
        }}
        placeholder="luisferreira"
        maxLength={40}
        required
        hint={
          <>
            O teu leaderboard vai viver em{' '}
            <span className="text-fg-muted">
              {host}/{handle || 'o-teu-nome'}
            </span>
          </>
        }
      />

      {state.error && (
        <p className="flex items-start gap-2 rounded-sm border border-danger/25 bg-danger/8 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          {state.error}
        </p>
      )}

      <Submit />
    </form>
  )
}
