'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { CalendarDays, CalendarRange, Plus, Trash2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { finishOnboarding } from '@/lib/onboarding/actions'
import { streamLabels, streamPlatforms, type StreamPlatform } from '@/lib/streams/model'
import { normalizeStreamChannel } from '@/lib/streams/public-input'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { MAX_REWARD_POSITIONS } from '@/lib/leaderboards/reward-positions'
import styles from './setup-wizard.module.css'

type Step = 'period' | 'dates' | 'rewards' | 'platform' | 'account'
const DRAFT_KEY = 'onboarding-draft'
type Props = { initialPlatform?: StreamPlatform; initialChannel?: string; previewSlug?: string }

export function SetupWizard({ initialPlatform, initialChannel = '', previewSlug }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('period')
  const [period, setPeriod] = useState<'monthly' | 'fixed'>('monthly')
  const [platform, setPlatform] = useState<StreamPlatform | null>(initialPlatform ?? null)
  const [account, setAccount] = useState(initialChannel)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [rewardAmounts, setRewardAmounts] = useState(['', '', ''])
  const [skipRewards, setSkipRewards] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [direction, setDirection] = useState(1)
  const heading = useRef<HTMLHeadingElement>(null)
  const reduced = useReducedMotion()
  const steps: Step[] = period === 'monthly' ? ['period', 'rewards', 'platform', 'account'] : ['period', 'dates', 'rewards', 'platform', 'account']
  const index = steps.indexOf(step)
  const progress = ((index + 1) / steps.length) * 100
  // Voltou do pagamento sem pagar (ou o pagamento passou mas a página não foi criada): repõe as respostas
  // e abre no último passo, para só ter de carregar outra vez em "Continuar".
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('pagamento')
    if (!status) return
    try {
      const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null')
      if (draft) {
        setPeriod(draft.period); setPlatform(draft.platform); setAccount(draft.account); setStart(draft.start); setEnd(draft.end)
        setRewardAmounts(draft.rewardAmounts); setSkipRewards(draft.skipRewards); setStep('account')
      }
    } catch { /* Storage may be disabled. */ }
    setError(status === 'pago' ? 'O pagamento ficou concluído, mas não foi possível criar a página. Carrega em continuar para tentar outra vez.'
      : 'O pagamento foi cancelado. A tua página só é criada depois de concluíres o pagamento.')
  }, [])
  function go(next: Step) {
    setDirection(steps.indexOf(next) > index ? 1 : -1)
    setError(''); setStep(next)
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }))
  }
  async function next(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setError('')
    if (step === 'period') return go(period === 'fixed' ? 'dates' : 'rewards')
    if (step === 'dates') {
      if (!start || !end || !Number.isFinite(Date.parse(start)) || Date.parse(end) <= Date.parse(start)) {
        setError('Escolhe uma data de fim posterior ao início.'); return
      }
      return go('rewards')
    }
    if (step === 'rewards') { setSkipRewards(false); return go('platform') }
    if (step === 'platform') { if (platform) go('account'); return }
    if (step !== 'account' || !platform) return
    try { normalizeStreamChannel(platform, account) } catch (e) { setError(e instanceof Error ? e.message : 'Confirma a conta.'); return }
    if (previewSlug) { router.push('/preview/onboarding/pronta'); return }
    setPending(true)
    try {
      const now = new Date()
      const result = await finishOnboarding({ period, platform, channel: account,
        rewards: skipRewards ? [] : rewardAmounts.flatMap((amount, index) => amount.trim() && Number(amount) > 0
          ? [{ position: index + 1, amountCents: Math.round(Number(amount) * 100) }] : []),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        startsAt: period === 'monthly' ? new Date(now.getFullYear(), now.getMonth(), 1).toISOString() : new Date(start).toISOString(),
        endsAt: period === 'monthly' ? null : new Date(end).toISOString(),
      })
      // Pagamento primeiro (página externa do Stripe): a página só é criada depois de pagar.
      // As respostas ficam guardadas neste browser para não se perderem se a pessoa voltar atrás.
      if (result.next) {
        try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ period, platform, account, start, end, rewardAmounts, skipRewards })) } catch { /* Storage may be disabled. */ }
        window.location.assign(result.next); return
      }
      if (!result.slug) { setError(result.error ?? 'Não foi possível criar a página.'); return }
      try {
        sessionStorage.removeItem(DRAFT_KEY)
        if (result.notice) sessionStorage.setItem('onboarding-notice', result.notice)
        else sessionStorage.removeItem('onboarding-notice')
      } catch { /* Storage may be disabled. */ }
      router.push(`/${result.slug}?criada=1`)
    } catch { setError('Não foi possível concluir. Tenta novamente.') }
    finally { setPending(false) }
  }
  const titles: Record<Step, string> = { period: 'Vamos criar a tua página', dates: 'Escolhe as datas', rewards: 'Quais são os prémios?', platform: 'Onde fazes as tuas lives?', account: 'Qual é a tua conta?' }
  const descriptions: Record<Step, string> = { period: 'Primeiro, como queres organizar a competição?', dates: 'Define o início e o fim da tua competição.',
    rewards: 'Define o valor para cada lugar. Podes deixar em branco e decidir mais tarde.',
    platform: 'Escolhe a plataforma que usas.', account: `Indica o teu canal ${platform ? streamLabels[platform] : ''}.` }
  return <section className={styles.wizard} aria-label="Criar a tua página">
    <div className={styles.progress} role="progressbar" aria-label="Progresso da configuração" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-valuetext={`Passo ${index + 1} de ${steps.length}`}>
      {steps.map((item, segmentIndex) => <div key={item} className={styles.track}>
        <motion.div className={styles.fill} initial={false} animate={{ scaleX: segmentIndex <= index ? 1 : 0 }} transition={{ duration: reduced ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }} />
      </div>)}
    </div>
    <div className={styles.body}>
      <motion.div key={`question-${step}`} initial={reduced ? false : { opacity: 0, x: direction * 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduced ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}>
        <h1 ref={heading} tabIndex={-1} className={styles.title}>{titles[step]}</h1>
        <p className={styles.description}>{descriptions[step]}</p>
      </motion.div>
      <form onSubmit={next} className={styles.form}>
        <div className={styles.fields}>
        <motion.div key={`options-${step}`} initial={reduced ? false : { opacity: 0, x: direction * 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduced ? 0 : 0.45, delay: reduced ? 0 : 0.06, ease: [0.22, 1, 0.36, 1] }}>
        {step === 'period' && <div className={styles.options} role="group" aria-label="Período da competição">
          {([{ value: 'monthly', title: 'Por meses', text: 'Começa neste mês. Uma nova classificação todos os meses.', icon: CalendarDays },
            { value: 'fixed', title: 'Datas personalizadas', text: 'Tu escolhes quando começa e quando termina.', icon: CalendarRange }] as const).map(item => <button key={item.value} type="button" aria-pressed={period === item.value}
              className={styles.option} onClick={() => setPeriod(item.value)}>
            <item.icon size={23} strokeWidth={1.5} /><span><strong>{item.title}</strong><small>{item.text}</small></span>
          </button>)}
        </div>}
        {step === 'dates' && <div className={styles.dates}>
          <Field label="Data de início" name="startsAt" type="datetime-local" value={start} onChange={event => setStart(event.target.value)} required />
          <Field label="Data de fim" name="endsAt" type="datetime-local" value={end} min={start || undefined} onChange={event => setEnd(event.target.value)} required />
        </div>}
        {step === 'rewards' && <div className={styles.rewardPanel}>
          <div className={styles.rewards} role="group" aria-label="Prémios da competição">
          {rewardAmounts.map((amount, index) => <div key={index} className={`${styles.reward} grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-3`}>
            <span className="nums flex h-10 w-10 items-center justify-center rounded-xs bg-surface-2 text-sm text-fg-muted">{index + 1}.º</span>
              <input id={`reward-${index + 1}`} name={`reward-${index + 1}`} type="number" inputMode="decimal"
                aria-label={`Valor do prémio do ${index + 1}.º lugar em euros`}
                min="0" max="1000000" step="0.01" placeholder="0" value={amount}
                className="h-10 w-full min-w-0 rounded-sm border-0 bg-surface-2 px-3 py-2.5 text-sm placeholder:text-fg-subtle transition-colors hover:bg-surface-3 focus:bg-surface-3 focus:outline-none"
                onChange={event => setRewardAmounts(values => values.map((value, position) => position === index ? event.target.value : value))} />
            <Button type="button" variant="secondary" size="sm"
              className="h-10 w-10 shrink-0 border-0 p-0 text-fg-subtle hover:bg-surface-3 hover:text-danger"
              aria-label={`Remover prémio do ${index + 1}.º lugar`} title="Remover lugar"
              onClick={() => setRewardAmounts(values => values.filter((_, position) => position !== index))}>
              <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </Button>
          </div>)}
          </div>
          {rewardAmounts.length < MAX_REWARD_POSITIONS && <Button type="button" variant="secondary" size="sm"
            className="mt-3 h-10 w-full border-0 p-0 text-fg-muted hover:bg-surface-3 hover:text-fg" title="Adicionar lugar"
            aria-label="Adicionar lugar nos prémios" onClick={() => {
              const nextPosition = rewardAmounts.length + 1
              setRewardAmounts(values => values.length < MAX_REWARD_POSITIONS ? [...values, ''] : values)
              requestAnimationFrame(() => document.getElementById(`reward-${nextPosition}`)?.focus({ preventScroll: true }))
              requestAnimationFrame(() => document.getElementById(`reward-${nextPosition}`)?.scrollIntoView({ block: 'nearest', behavior: 'instant' }))
            }}><Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /></Button>}
        </div>}
        {step === 'platform' && <div className={styles.options} role="group" aria-label="Plataforma das lives">
          {streamPlatforms.map(value => <button key={value} type="button" aria-pressed={platform === value} className={styles.option}
            onClick={() => { if (platform !== value) setAccount(''); setPlatform(value) }}>
            <Image src={`/platforms/${value}.svg`} width={24} height={24} alt="" className="invert" /><span><strong>{streamLabels[value]}</strong></span>
          </button>)}
        </div>}
        {step === 'account' && <Field className={styles.accountField} label={platform === 'youtube' ? '@canal ou ID do canal' : 'Username ou URL da conta'} name="channel" value={account}
          onChange={event => setAccount(event.target.value)} placeholder={platform === 'youtube' ? '@canal ou ID do canal' : 'Username ou URL da conta'}
          autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={200} disabled={pending} />}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        </motion.div>
        </div>
        <div className={styles.footer}>
          {index > 0 ? <button type="button" className={styles.back} disabled={pending} onClick={() => go(steps[index - 1])}>Voltar</button> : <span />}
          <div className={styles.actions}>
          {step === 'rewards' && <button type="button" className={styles.back} onClick={() => { setSkipRewards(true); go('platform') }}>Saltar</button>}
          <Button type="submit" disabled={pending || (step === 'platform' && !platform) || (step === 'account' && !account.trim())}>
            {pending ? 'A preparar…' : step === 'account' ? 'Concluir' : 'Continuar'}
          </Button>
          </div>
        </div>
      </form>
    </div>
  </section>
}
