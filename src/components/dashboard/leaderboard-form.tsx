'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, ChevronDown } from 'lucide-react'
import type { LeaderboardState } from '@/lib/leaderboards/actions'
import type { Leaderboard, Reward } from '@/lib/db/types'
import { Button } from '@/components/ui/button'
import { Field, TextareaField } from '@/components/ui/field'
import { publicEnv } from '@/lib/config/env'
import { slugify } from '@/lib/slug'
import { cn } from '@/lib/utils'

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO (UTC) → valor para <input type="datetime-local"> na hora local. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** datetime-local (hora local do browser) → ISO em UTC. */
function toIso(local: string): string {
  if (!local) return ''
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'A guardar…' : label}
    </Button>
  )
}

type Props = {
  mode: 'create' | 'edit'
  action: (state: LeaderboardState, formData: FormData) => Promise<LeaderboardState>
  creatorName: string
  defaultSlug: string
  leaderboard?: Leaderboard
  rewards?: Reward[]
}

export function LeaderboardForm({
  mode,
  action,
  creatorName,
  defaultSlug,
  leaderboard,
  rewards = [],
}: Props) {
  const [state, formAction] = useActionState<LeaderboardState, FormData>(action, {})

  const [name, setName] = useState(leaderboard?.name ?? '')
  const [slug, setSlug] = useState(leaderboard?.slug ?? defaultSlug)
  const [startsAt, setStartsAt] = useState(
    toLocalInput(leaderboard?.starts_at) || toLocalInput(new Date().toISOString()),
  )
  const [endsAt, setEndsAt] = useState(toLocalInput(leaderboard?.ends_at))
  const [eventAt, setEventAt] = useState(toLocalInput(leaderboard?.event_at))
  const [open, setOpen] = useState(mode === 'edit')

  const host = publicEnv.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, '')
  const timezone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'Europe/Lisbon'

  const rewardFor = (position: number) => rewards.find((r) => r.position === position)

  return (
    <form action={formAction} className="space-y-6">
      {leaderboard ? <input type="hidden" name="id" value={leaderboard.id} /> : null}
      <input type="hidden" name="timezone" value={leaderboard?.timezone ?? timezone} />
      <input type="hidden" name="startsAt" value={toIso(startsAt)} />
      <input type="hidden" name="endsAt" value={toIso(endsAt)} />
      <input type="hidden" name="eventAt" value={toIso(eventAt)} />

      {/* ─── O essencial ─────────────────────────────────────────────── */}
      <div className="space-y-5 rounded-lg border border-line bg-surface/70 p-5">
        <Field
          label="Nome da competição"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Batalha de Clippers — ${creatorName}`}
          maxLength={80}
          required
          autoFocus={mode === 'create'}
        />

        <Field
          label="Endereço público"
          name="slug"
          value={slug}
          onChange={(e) => setSlug(slugify(e.target.value))}
          placeholder={defaultSlug}
          maxLength={40}
          required
          hint={
            <>
              <span className="text-fg-muted">
                {host}/{slug || defaultSlug}
              </span>{' '}
              · convite em{' '}
              <span className="text-fg-muted">
                {host}/join/{slug || defaultSlug}
              </span>
            </>
          }
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Início"
            name="startsAtLocal"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
          <Field
            label="Fim (opcional)"
            name="endsAtLocal"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            hint="Deixa vazio para uma competição contínua."
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg">Como conta o ranking</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <Radio
              name="periodMode"
              value="monthly"
              defaultChecked={(leaderboard?.period_mode ?? 'monthly') === 'monthly'}
              title="Corrida mensal"
              description="Reinicia todos os meses, com histórico geral à parte."
            />
            <Radio
              name="periodMode"
              value="fixed"
              defaultChecked={leaderboard?.period_mode === 'fixed'}
              title="Período único"
              description="Conta tudo entre o início e o fim."
            />
          </div>
        </fieldset>
      </div>

      {/* ─── Opcional ────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-line bg-surface/40">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-sm font-medium text-fg">
            Regras, prémios e aviso{' '}
            <span className="font-normal text-fg-subtle">— opcional, dá para mudar depois</span>
          </span>
          <ChevronDown
            className={cn('h-4 w-4 text-fg-subtle transition-transform', open && 'rotate-180')}
            strokeWidth={2}
          />
        </button>

        {open && (
          <div className="space-y-5 border-t border-line/60 p-5">
            <TextareaField
              label="Aviso no topo da página"
              name="announcement"
              defaultValue={leaderboard?.announcement ?? ''}
              placeholder="POSTEM VÍDEOS TODOS OS DIAS! O @joao está em 1.º com 28,8K de média."
              maxLength={280}
              hint="Aparece numa faixa no topo do leaderboard público."
            />

            <TextareaField
              label="As regras nas tuas palavras"
              name="quote"
              defaultValue={leaderboard?.quote ?? ''}
              placeholder="Na última live de cada mês vou analisar as vossas contas. Quem tiver mais views recebe o prémio em direto."
              maxLength={600}
              hint="Mostrado como citação, em destaque."
            />

            <Field
              label="Assinatura da citação"
              name="quoteAuthor"
              defaultValue={leaderboard?.quote_author ?? creatorName}
              placeholder={creatorName}
              maxLength={60}
            />

            <Field
              label="Data da live de análise (opcional)"
              name="eventAtLocal"
              type="datetime-local"
              value={eventAt}
              onChange={(e) => setEventAt(e.target.value)}
              hint="Cria uma contagem decrescente no topo da página pública."
            />

            <TextareaField
              label="Regras detalhadas"
              name="rules"
              defaultValue={leaderboard?.rules ?? ''}
              placeholder="Só contam clips do stream. Sem conteúdo roubado de outros clippers."
              maxLength={4000}
            />

            <div>
              <p className="mb-1.5 text-sm font-medium text-fg">Prémios</p>
              <p className="mb-3 text-xs text-fg-subtle">
                Valor em euros, etiqueta, ou os dois. O que deixares vazio não aparece.
              </p>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((position) => (
                  <div key={position} className="flex items-center gap-3">
                    <span className="nums w-8 shrink-0 text-center text-sm text-fg-subtle">
                      {position}.º
                    </span>
                    <input
                      name={`reward-${position}-amount`}
                      defaultValue={
                        rewardFor(position)?.amount_cents != null
                          ? String((rewardFor(position)!.amount_cents as number) / 100)
                          : ''
                      }
                      inputMode="decimal"
                      placeholder="500"
                      className="w-28 rounded-sm border border-line bg-surface-2 px-3 py-2 text-sm placeholder:text-fg-subtle focus:border-brand focus:ring-2 focus:ring-brand/25 focus:outline-none"
                    />
                    <input
                      name={`reward-${position}-label`}
                      defaultValue={rewardFor(position)?.label ?? ''}
                      placeholder="Etiqueta — ex.: Candidato a contratação"
                      maxLength={120}
                      className="min-w-0 flex-1 rounded-sm border border-line bg-surface-2 px-3 py-2 text-sm placeholder:text-fg-subtle focus:border-brand focus:ring-2 focus:ring-brand/25 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {state.error && (
        <p className="flex items-start gap-2 rounded-sm border border-danger/25 bg-danger/8 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          {state.error}
        </p>
      )}

      <Submit label={mode === 'create' ? 'Criar leaderboard' : 'Guardar alterações'} />
    </form>
  )
}

function Radio({
  name,
  value,
  title,
  description,
  defaultChecked,
}: {
  name: string
  value: string
  title: string
  description: string
  defaultChecked?: boolean
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-sm border border-line bg-surface-2 p-3 transition-colors hover:border-line-strong has-[:checked]:border-brand/50 has-[:checked]:bg-brand/8">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-0.5 accent-[var(--color-brand)]"
      />
      <span>
        <span className="block text-sm font-medium text-fg">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-fg-subtle">{description}</span>
      </span>
    </label>
  )
}
