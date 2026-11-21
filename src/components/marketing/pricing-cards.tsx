import { BarChart3, CircleCheck, CreditCard, LoaderCircle, PiggyBank, Sparkles, Star } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/button'
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
    icon: Star,
    iconClassName: 'text-amber-400',
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
    id: 'monthly',
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
    id: 'yearly',
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

/**
 * Cartões de preços. Na página inicial o botão leva ao registo; na página de subscrição
 * (`checkout`) cada cartão é um formulário que abre o Checkout do Stripe com o plano escolhido.
 */
export function PricingCards({ checkout, className }: { checkout?: { action: (form: FormData) => Promise<void>; next: string; label: string }; className?: string } = {}) {
  return (
    <div className={cn('mx-auto mt-14 grid max-w-4xl items-stretch gap-6 lg:grid-cols-2', className)}>
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
                <Icon className={cn('h-4 w-4 shrink-0', iconClassName)} strokeWidth={2.25} />
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
              <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xs bg-[#dcf7cd] px-2 pt-[5px] pb-[3px] text-[11px] leading-none font-[300] text-[#6f995d]">
                {plan.extra.badge}
                <LoaderCircle aria-hidden="true" className="relative -top-px h-3 w-3 motion-safe:[animation:spin_2s_linear_infinite]" />
              </span>
            ) : null}
          </div>

          <div className="border-t border-line" />

          {checkout ? (
            <form action={checkout.action} className="mt-6">
              <input type="hidden" name="plan" value={plan.id} />
              <input type="hidden" name="next" value={checkout.next} />
              <Button type="submit" size="lg" variant={plan.buttonVariant} className="w-full">{checkout.label}</Button>
            </form>
          ) : (
            <ButtonLink
              href="/entrar?seguinte=/dashboard/novo"
              size="lg"
              variant={plan.buttonVariant}
              className="mt-6 w-full"
            >
              Começar
            </ButtonLink>
          )}
        </article>
      ))}
    </div>
  )
}
