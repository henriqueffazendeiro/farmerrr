import { Button } from '@/components/ui/button'
import { createAdminClient } from '@/lib/supabase/admin'
import { money, shortDate } from '@/lib/format'
import type { Leaderboard } from '@/lib/db/types'
import { payPrizesAction } from '@/lib/prizes/actions'
import { paidPayment, payablePeriods, payoutsOf, prizeSplit, prizeTitle, prizesConfigured } from '@/lib/prizes/payments'

const notices: Record<string, string> = {
  entregue: 'Prémios marcados como entregues.',
  pago: 'Pagamento recebido. Cada clipper já pode levantar o seu prémio.',
  processando: 'Pagamento em processamento (Multibanco pode demorar). Os clippers podem levantar assim que for confirmado.',
  duplicado: 'Estes prémios já tinham sido pagos — o pagamento repetido foi devolvido.',
  erro: 'Não foi possível abrir o pagamento. Tenta novamente.',
  indisponivel: 'Os pagamentos ainda não estão configurados.',
}

const payoutLabel: Record<string, string> = {
  available: 'Por levantar', transferring: 'A enviar', paid: 'Levantado', canceled: 'Cancelado', awaiting_payment: 'A aguardar',
}

/** Secção "Prémios" das definições: pagar os prémios de cada período fechado e ver quem já sacou. */
export async function StreamerPrizes({ board, notice }: { board: Leaderboard; notice?: string }) {
  if (!prizesConfigured()) return null
  const periods = (await payablePeriods(board)).slice(0, 3)
  const rows = await Promise.all(periods.map(async periodKey => {
    const payment = await paidPayment(board.id, periodKey)
    if (payment) return { periodKey, payment, shares: (await payoutsOf(payment.id)).map(p => ({ position: p.position, amountCents: p.amount_cents + p.fee_cents, clipperProfileId: p.clipper_profile_id, status: p.status })) }
    return { periodKey, payment: null, shares: (await prizeSplit(board.id, periodKey)).map(s => ({ ...s, status: null as string | null })) }
  }))
  const visible = rows.filter(row => row.shares.length)
  if (!visible.length && !notice) return null

  const ids = [...new Set(visible.flatMap(row => row.shares.map(s => s.clipperProfileId)).filter((id): id is string => !!id))]
  const { data: profiles } = ids.length ? await createAdminClient().from('clipper_profiles').select('id,display_name').in('id', ids) : { data: [] }
  const nameOf = new Map((profiles ?? []).map(p => [p.id, p.display_name]))

  return (
    <section aria-labelledby="premios-title" className="mt-6 pt-6">
      <h3 id="premios-title" className="mb-1.5 text-xs text-fg-muted">Prémios</h3>
      {notice && notices[notice] && <p role="status" className="mb-3 text-sm">{notices[notice]}</p>}
      <div className="space-y-3">
        {visible.map(({ periodKey, payment, shares }) => {
          const prizes = shares.reduce((sum, s) => sum + s.amountCents, 0)
          return (
            <div key={periodKey} className="rounded-sm border border-line bg-surface p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium">{prizeTitle(periodKey)}</p>
                <p className="nums text-sm text-fg-muted">{money(prizes)}</p>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {shares.map(share => (
                  <li key={share.position} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate"><span className="nums text-fg-subtle">{share.position}.º</span> {(share.clipperProfileId && nameOf.get(share.clipperProfileId)) || 'Clipper'}</span>
                    <span className="nums shrink-0 text-fg-muted">
                      {money(share.amountCents)}{share.status && payment?.method !== 'manual' && <span className="ml-2 text-xs text-fg-subtle">· {payoutLabel[share.status]}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {payment ? (
                <p className="mt-3 text-xs text-fg-subtle">{payment.method === 'manual' ? 'Entregue manualmente' : 'Pago'}{payment.paid_at ? ` a ${shortDate(payment.paid_at)}` : ''} · {money(payment.prizes_cents)}</p>
              ) : (
                <form action={payPrizesAction} className="mt-4">
                  <input type="hidden" name="leaderboardId" value={board.id} />
                  <input type="hidden" name="periodKey" value={periodKey} />
                  <Button type="submit" className="w-full">Pagar prémios · {money(prizes)}</Button>
                  <p className="mt-2 text-center text-xs text-fg-subtle">Cada clipper recebe o seu prémio menos 5% de taxa de serviço.</p>
                </form>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
