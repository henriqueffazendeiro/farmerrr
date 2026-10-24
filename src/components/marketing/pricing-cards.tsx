import { BarChart3, CircleCheck, CreditCard, LoaderCircle, PiggyBank, Sparkles } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MONTHLY_FEATURES = [
  {
    label: 'Sistema de ranking em direto',
    icon: BarChart3,
    iconClassName: 'text-violet-400',
  },
  {
    label: 'Pagamentos automáticos',
    icon: CreditCard,
    iconClassName: 'text-sky-600',
  },
  {
    label: 'Ratings das tuas lives',
    icon: 'ratings',
    iconClassName: '',
  },
] as const

const ANNUAL_FEATURES = [
  {
    label: 'Tudo do plano mensal',
    icon: CircleCheck,
    iconClassName: 'text-violet-400',
  },
] as const

const PLANS = [
  {
    name: 'Plano mensal',
    description: 'Perfeito para começar',
    price: '25 €',
    cadence: '/mês',
    buttonVariant: 'primary',
    featured: false,
    features: MONTHLY_FEATURES,
    extra: {
      label: 'farmerrr recap',
      icon: Sparkles,
      iconClassName: 'text-amber-300',
      badge: 'A caminho',
    },
  },
  {
    name: 'Plano anual',
    description: 'Para fazeres disto parte da tua stream',
    price: '200 €',
    cadence: '/ano',
    buttonVariant: 'secondary',
    featured: true,
    features: ANNUAL_FEATURES,
    extra: {
      label: 'Poupa 100 € por ano',
      icon: PiggyBank,
      iconClassName: 'text-amber-300',
    },
  },
] as const

export function PricingCards() {
  return (
    <div className="mx-auto mt-14 grid max-w-4xl items-stretch gap-6 lg:grid-cols-2">
      {PLANS.map((plan) => (
        <article
          key={plan.name}
          className={cn(
            'flex h-full flex-col rounded-xs border bg-surface/80 p-6 sm:p-7',
            plan.featured ? 'border-accent/35' : 'border-line bg-surface/50',
          )}
        >
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-fg">{plan.name}</h3>
            <p className="mt-2 min-h-10 text-sm leading-5 text-fg-muted">{plan.description}</p>
          </div>

          <div className="mt-6 flex items-baseline gap-2">
            <span className="nums text-5xl font-semibold tracking-[-0.03em]">{plan.price}</span>
            <span className="text-sm text-fg-subtle">{plan.cadence}</span>
          </div>

          <div className="mt-7 border-t border-line" />

          <ul className="min-h-[148px] py-5">
            {plan.features.map(({ label, icon: Icon, iconClassName }) => (
              <li key={label} className="flex items-center gap-3 py-2 text-sm">
                {Icon === 'ratings' ? (
                  <span aria-hidden="true" className="inline-flex h-3 w-4 shrink-0 items-center justify-center rounded-sm bg-accent text-[8px] leading-none font-semibold tracking-[-0.04em] text-black">
                    rrr.
                  </span>
                ) : (
                  <Icon className={cn('h-4 w-4 shrink-0', iconClassName)} strokeWidth={2.25} />
                )}
                <span className="text-fg-muted">{label}</span>
              </li>
            ))}
          </ul>

          <div className="border-t border-line" />

          <div className="flex items-center gap-3 py-5 text-sm">
            <plan.extra.icon
              className={cn('h-4 w-4 shrink-0', plan.extra.iconClassName)}
              strokeWidth={2.25}
            />
            <span className="font-medium text-fg">{plan.extra.label}</span>
            {'badge' in plan.extra ? (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xs border border-[#a6cc94] bg-[#dcf7cd] px-2 py-0.5 text-[11px] font-[300] text-[#6f995d]">
                {plan.extra.badge}
                <LoaderCircle aria-hidden="true" className="h-3 w-3 motion-safe:animate-spin [animation-duration:1.5s]" />
              </span>
            ) : null}
          </div>

          <div className="border-t border-line" />

          <ButtonLink
            href="/registar"
            size="lg"
            variant={plan.buttonVariant}
            className="mt-6 w-full"
          >
            Começar
          </ButtonLink>
        </article>
      ))}
    </div>
  )
}
