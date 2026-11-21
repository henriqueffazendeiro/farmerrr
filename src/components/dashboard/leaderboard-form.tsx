'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { useProfileImageDraft } from './profile-image-draft'
import { AlertCircle, Plus, Trash2 } from 'lucide-react'
import type { LeaderboardState } from '@/lib/leaderboards/actions'
import type { Leaderboard, Reward } from '@/lib/db/types'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Container } from '@/components/ui/container'
import { slugify } from '@/lib/slug'
import { MAX_REWARD_POSITIONS, REWARD_POSITIONS } from '@/lib/leaderboards/reward-positions'

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

function SaveFooter({ label, dirty, saved }: { label: string; dirty: boolean; saved: boolean }) {
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
  leaderboard,
  rewards = [],
}: Props) {
  const imageDraft = useProfileImageDraft()
  const router = useRouter()
  const pathname = usePathname()
  const [name, setName] = useState(leaderboard?.name ?? '')
  const slug = slugify(name)
  const [blurRewards, setBlurRewards] = useState(leaderboard?.blur_rewards ?? false)
  const [startsAt, setStartsAt] = useState(
    toLocalInput(leaderboard?.starts_at) || toLocalInput(new Date().toISOString()),
  )
  const [endsAt, setEndsAt] = useState(toLocalInput(leaderboard?.ends_at))
  // Mensal: automático (dia 1 às 00:00 até ao fim do último dia, sem data de fim guardada) ou datas escolhidas pelo streamer.
  const monthly = leaderboard?.period_mode === 'monthly'
  const [automatic, setAutomatic] = useState(monthly && !leaderboard?.ends_at)
  const [visibleRewardCount, setVisibleRewardCount] = useState(() => Math.min(MAX_REWARD_POSITIONS, Math.max(3, ...rewards.map(reward => reward.position))))
  const [rewardValues, setRewardValues] = useState(() => REWARD_POSITIONS.map((position) => {
    const reward = rewards.find((item) => item.position === position)
    return { amount: reward?.amount_cents != null ? String(reward.amount_cents / 100) : '', label: reward?.label ?? '' }
  }))
  const snapshot = JSON.stringify([name, slug, automatic ? '' : startsAt, automatic ? '' : endsAt, String(blurRewards), ...rewardValues.flatMap((reward) => [reward.amount, reward.label])])
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot)
  const dirty = snapshot !== savedSnapshot || Boolean(imageDraft?.file)
  const [state, formAction] = useActionState<LeaderboardState, FormData>(async (previous, data) => {
    const submitted = JSON.stringify([
      ...['name', 'slug', 'startsAtLocal', 'endsAtLocal', 'blurRewards'].map((key) => String(data.get(key) ?? '')),
      ...REWARD_POSITIONS.flatMap((position) => ['amount', 'label'].map((key) => String(data.get(`reward-${position}-${key}`) ?? ''))),
    ])
    imageDraft?.setSaving(true)
    try {
      const result = await action(previous, data)
      if (!result.success) return result
      setSavedSnapshot(submitted)
      if (imageDraft?.file) {
        const upload = new FormData()
        upload.set('avatar', imageDraft.file)
        const response = await fetch('/api/profile/avatar', { method: 'POST', body: upload })
        const image = await response.json()
        if (!response.ok) return { error: image.error || 'Não foi possível guardar a imagem. Tenta novamente.' }
        imageDraft.setSavedUrl(image.url)
        imageDraft.setFile(null)
      }
      if (result.slug && leaderboard && pathname === `/${leaderboard.slug}` && result.slug !== leaderboard.slug) {
        router.replace(`/${result.slug}`)
      }
      return result
    } catch {
      return { error: 'Não foi possível guardar todas as alterações. Tenta novamente.' }
    } finally {
      imageDraft?.setSaving(false)
    }
  }, {})

  const timezone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'Europe/Lisbon'

  return (
    <form action={formAction} className="space-y-6 [&_label]:text-xs [&_label]:font-normal [&_label]:text-fg-muted">
      {leaderboard ? <input type="hidden" name="id" value={leaderboard.id} /> : null}
      <input type="hidden" name="timezone" value={leaderboard?.timezone ?? timezone} />
      {/* Automático: o início fica como estava (conta para o histórico geral) e não há data de fim. */}
      <input type="hidden" name="startsAt" value={automatic ? leaderboard?.starts_at ?? '' : toIso(startsAt)} />
      <input type="hidden" name="endsAt" value={automatic ? '' : toIso(endsAt)} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="blurRewards" value={String(blurRewards)} />

      {/* ─── O essencial ─────────────────────────────────────────────── */}
      <section aria-label="Página pública" className="space-y-6">
        <div className="grid gap-6">
        <Field
          label="Nome da página"
          className="[&_input]:border-0 [&_input:hover]:bg-surface-3 [&_input:focus]:bg-surface-3"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Batalha de Clippers — ${creatorName}`}
          maxLength={80}
          required
        />


        </div>
      </section>
      <section aria-label="Datas da competição" className="space-y-6">
        <div>


        {monthly && <>
          <h2 className="mb-1.5 text-xs text-fg-muted">Datas</h2>
          <fieldset className="mb-3 flex gap-1 rounded-sm border-0 bg-surface-2 p-1">
            <legend className="sr-only">Datas da competição</legend>
            {[{ label: 'Automático', value: true }, { label: 'Personalizado', value: false }].map(option => (
              <label key={option.label} className={`relative flex h-9 flex-1 cursor-pointer items-center justify-center rounded-xs ${automatic === option.value ? 'bg-surface-3 text-fg!' : 'hover:text-fg!'}`}>
                <input type="radio" name="dateMode" value={option.value ? 'auto' : 'custom'} checked={automatic === option.value} onChange={() => setAutomatic(option.value)} className="peer sr-only" />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
        </>}
        {automatic ? <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Início" className="[&_input]:border-0 [&_input]:text-fg-muted" name="startsAuto" value="Dia 1, 00:00" readOnly tabIndex={-1} />
          <Field label="Fim" className="[&_input]:border-0 [&_input]:text-fg-muted" name="endsAuto" value="Último dia, 24:00" readOnly tabIndex={-1} />
        </div> : <div className="grid gap-6 sm:grid-cols-2">
          <Field
            label="Início"
            className="[&_input]:border-0 [&_input:hover]:bg-surface-3 [&_input:focus]:bg-surface-3"
            name="startsAtLocal"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
          <Field
            label="Fim"
            className="[&_input]:border-0 [&_input:hover]:bg-surface-3 [&_input:focus]:bg-surface-3"
            name="endsAtLocal"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            required={monthly}
          />
        </div>}
        {!monthly && <p className="mt-1.5 text-left text-[11px] leading-relaxed text-fg-subtle">Define quando começa e termina a competição.</p>}
        </div>
      </section>

      {/* ─── Opcional ────────────────────────────────────────────────── */}
      <section className="grid gap-1.5">
        <h2 className="text-xs text-fg-muted">Prémios</h2>
        <fieldset className="mb-3 flex gap-1 rounded-sm border-0 bg-surface-2 p-1">
          <legend className="sr-only">Visibilidade das quantias dos prémios</legend>
          {[{ label: 'Mostrar quantia', value: false }, { label: '...', value: true }].map(option => (
            <label key={option.label} className={`relative flex h-9 flex-1 cursor-pointer items-center justify-center rounded-xs ${blurRewards === option.value ? 'bg-surface-3 text-fg!' : 'hover:text-fg!'}`}>
              <input type="radio" name="rewardVisibility" value={String(option.value)} checked={blurRewards === option.value} onChange={() => setBlurRewards(option.value)} className="peer sr-only" />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
            <div>
              <div className="grid gap-3">
                {REWARD_POSITIONS.map((position) => (
                  <div key={position} className={position > visibleRewardCount ? 'hidden' : 'grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-3'}>
                    <span className="nums flex h-10 w-10 items-center justify-center rounded-xs bg-surface-2 text-sm text-fg-muted">
                      {position}.º
                    </span>
                    <input
                      name={`reward-${position}-amount`}
                      aria-label={`Valor do prémio do ${position}.º lugar em euros`}
                      value={rewardValues[position - 1].amount}
                      onChange={(event) => setRewardValues((values) => values.map((reward, index) => index === position - 1 ? { ...reward, amount: event.target.value } : reward))}
                      inputMode="decimal"
                      placeholder="0"
                      className="h-10 w-full min-w-0 rounded-sm border-0 bg-surface-2 px-3 py-2.5 text-sm placeholder:text-fg-subtle transition-colors hover:bg-surface-3 focus:bg-surface-3 focus:outline-none"
                    />
                    <input
                      type="hidden"
                      name={`reward-${position}-label`}
                      value={rewardValues[position - 1].label}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-10 w-10 shrink-0 border-0 p-0 text-fg-subtle hover:bg-surface-3 hover:text-danger"
                      aria-label={`Remover prémio do ${position}.º lugar`}
                      title="Remover lugar"
                      onClick={() => {
                        setRewardValues((values) => [...values.filter((_, index) => index !== position - 1), { amount: '', label: '' }])
                        setVisibleRewardCount((count) => Math.max(0, count - 1))
                      }}
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
              {visibleRewardCount < MAX_REWARD_POSITIONS && (
                <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-10 w-full border-0 p-0 text-fg-muted hover:bg-surface-3 hover:text-fg"
                  aria-label="Adicionar lugar nos prémios"
                  title="Adicionar lugar"
                  onClick={() => setVisibleRewardCount((count) => Math.min(count + 1, MAX_REWARD_POSITIONS))}
                >
                  <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                </Button>
                </div>
              )}
            </div>
      </section>

      {state.error && (
        <p className="flex items-start gap-2 rounded-sm border border-danger/25 bg-danger/8 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          {state.error}
        </p>
      )}

      <SaveFooter label={mode === 'create' ? 'Criar página' : 'Guardar alterações'} dirty={dirty} saved={Boolean(state.success)} />
    </form>
  )
}
