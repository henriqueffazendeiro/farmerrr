'use client'

import { useActionState, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useProfileImageDraft } from './profile-image-draft'
import { AlertCircle, Plus, Trash2 } from 'lucide-react'
import type { LeaderboardState } from '@/lib/leaderboards/actions'
import type { Leaderboard, Reward } from '@/lib/db/types'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Container } from '@/components/ui/container'
import { slugify } from '@/lib/slug'
import { SaveFooter } from '@/components/ui/save-footer'
import { MAX_REWARD_POSITIONS, REWARD_POSITIONS } from '@/lib/leaderboards/reward-positions'



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
  const [visibleRewardCount, setVisibleRewardCount] = useState(() => Math.min(MAX_REWARD_POSITIONS, Math.max(3, ...rewards.map(reward => reward.position))))
  const [rewardValues, setRewardValues] = useState(() => REWARD_POSITIONS.map((position) => {
    const reward = rewards.find((item) => item.position === position)
    return { amount: reward?.amount_cents != null ? String(reward.amount_cents / 100) : '', label: reward?.label ?? '' }
  }))
  const snapshot = JSON.stringify([name, slug, String(blurRewards), ...rewardValues.flatMap((reward) => [reward.amount, reward.label])])
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot)
  const dirty = snapshot !== savedSnapshot || Boolean(imageDraft?.file)
  const [state, formAction] = useActionState<LeaderboardState, FormData>(async (previous, data) => {
    const submitted = JSON.stringify([
      ...['name', 'slug', 'blurRewards'].map((key) => String(data.get(key) ?? '')),
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
      {/* As competições são sempre mensais e automáticas (do dia 1 ao último dia de cada mês): não há datas a escolher. */}
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
