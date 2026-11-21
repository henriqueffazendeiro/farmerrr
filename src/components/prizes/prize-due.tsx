'use client'

import { useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { Hyperspace } from '@/components/ui/hyperspace'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { SettingsDrawer } from '@/components/dashboard/settings-drawer'
import { money } from '@/lib/format'
import { markPrizesManualAction, payPrizesAction } from '@/lib/prizes/actions'
import type { DuePrize } from '@/lib/prizes/model'
import summary from '@/components/leaderboard/competition-summary.module.css'

function SubmitButton({ children, pendingLabel }: { children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus()
  return <Button type="submit" variant="secondary" disabled={pending} className="w-full border-0">{pending ? pendingLabel : children}</Button>
}

function Hidden({ prize, leaderboardId, returnTo }: { prize: DuePrize; leaderboardId: string; returnTo: string }) {
  return <>
    <input type="hidden" name="leaderboardId" value={leaderboardId} />
    <input type="hidden" name="periodKey" value={prize.periodKey} />
    <input type="hidden" name="returnTo" value={returnTo} />
  </>
}

/** Uma forma de pagar: título, uma frase, os detalhes concretos e o botão. */
function Option({ title, text, details, children }: { title: string; text: string; details: string; children: ReactNode }) {
  return <section className="rounded-sm bg-surface p-5">
    <h3 className="font-semibold">{title}</h3>
    <p className="mt-1 text-sm text-fg-muted">{text}</p>
    <p className="mt-1 text-xs text-fg-subtle">{details}</p>
    <div className="mt-4">{children}</div>
  </section>
}

/** As duas formas de entregar os prémios: pelo site (automático) ou diretamente aos clippers (manual). */
function DeliveryOptions({ prize, leaderboardId, returnTo }: { prize: DuePrize; leaderboardId: string; returnTo: string }) {
  const amount = money(prize.amountCents)
  return <div className="flex flex-col">
    <section aria-label="Vencedores">
      <ul className="divide-y divide-line/50 text-sm">
        {prize.winners.map(winner => <li key={winner.position} className="flex items-center gap-3 py-2.5">
          <Avatar src={winner.avatarUrl} name={winner.name} size="sm" className="h-[33px] w-[33px] rounded-[var(--radius-ui)] border-0 bg-[#242429]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{winner.name}</span>
            {(winner.username || winner.discord) && <span className="block truncate text-xs text-fg-subtle">
              {[winner.username && `@${winner.username}`, winner.discord && `Discord: ${winner.discord}`].filter(Boolean).join(' · ')}
            </span>}
          </span>
          <span className="nums shrink-0 font-medium">{money(winner.amountCents)}</span>
        </li>)}
      </ul>
    </section>

    <div className="mt-auto pt-10">
    <div className="flex items-baseline justify-between gap-4 border-t border-line/60 pt-4">
      <span className="text-sm text-fg-muted">Total</span>
      <span className="nums text-sm font-semibold">{amount}</span>
    </div>

    <div className="mt-6 space-y-3">
      <Option title="Automático" text="Pagamento único no site. Cada clipper levanta o prémio para o IBAN."
        details="Cartão, MB Way ou Multibanco · taxa de 5%">
        <form action={payPrizesAction}>
          <Hidden prize={prize} leaderboardId={leaderboardId} returnTo={returnTo} />
          <SubmitButton pendingLabel="A abrir pagamento…">Pagar {amount}</SubmitButton>
        </form>
      </Option>
      <Option title="Manual" text="Pagamento feito diretamente a cada clipper, registado depois como entregue."
        details="MB Way ou transferência · sem taxas">
        <form action={markPrizesManualAction}>
          <Hidden prize={prize} leaderboardId={leaderboardId} returnTo={returnTo} />
          <SubmitButton pendingLabel="A guardar…">Marcar como pago</SubmitButton>
        </form>
      </Option>
    </div>
    </div>
  </div>
}

/**
 * O mês acabou e os prémios ainda não foram entregues (só o dono vê). O retângulo inteiro é clicável e abre o painel
 * com as duas opções. Mesmo estilo do "Pronto para começar?" da página inicial (estrelas, sem caixa, texto ao centro).
 */
export function PrizeDueBanner({ prize, leaderboardId, returnTo }: { prize: DuePrize; leaderboardId: string; returnTo: string }) {
  const [open, setOpen] = useState(false)
  // Pago por Multibanco, à espera da referência: só informa (não deixa pagar outra vez).
  if (prize.processing) return <div className={`${summary.prizeDue} ${summary.prizeDueStatic}`} role="status">
    <Hyperspace className={summary.prizeDueSpace} starCount={260} />
    <span className={summary.prizeDueCopy}>
      <span className={summary.prizeDueEyebrow}>{prize.periodName} terminou</span>
      <span className={summary.prizeDueTitle}>Pagamento em processamento</span>
      <span className={summary.prizeDueText}>Os prémios ficam disponíveis assim que a referência Multibanco for paga.</span>
    </span>
  </div>
  return <>
    <button type="button" className={summary.prizeDue} onClick={() => setOpen(true)} aria-haspopup="dialog">
      <Hyperspace className={summary.prizeDueSpace} starCount={260} />
      <span className={summary.prizeDueCopy}>
        <span className={summary.prizeDueEyebrow}>{prize.periodName} terminou</span>
        <span className={summary.prizeDueTitle}>Hora de entregar os prémios</span>
        <span className={summary.prizeDueText}>{prize.winners.length} {prize.winners.length === 1 ? 'vencedor' : 'vencedores'} do mês.</span>
      </span>
    </button>
    {open && <SettingsDrawer title="Entregar prémios" closeLabel="Fechar" onClose={() => setOpen(false)} fill>
      <DeliveryOptions prize={prize} leaderboardId={leaderboardId} returnTo={returnTo} />
    </SettingsDrawer>}
  </>
}
