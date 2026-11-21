import { Button } from '@/components/ui/button'
import { money } from '@/lib/format'
import { openPayoutDashboardAction, withdrawPrizesAction } from '@/lib/prizes/actions'
import type { ClipperPrize } from '@/lib/prizes/payouts'
import type { ClipperPayoutAccount } from '@/lib/db/types'

export const prizeNotices: Record<string, string> = {
  enviado: 'Enviado. O dinheiro chega ao IBAN em poucos dias úteis.',
  ligada: 'Conta de pagamentos ligada.',
  pendente: 'O Stripe está a verificar os dados. Quando terminar, basta carregar outra vez em "Levantar".',
  incompleto: 'Faltam alguns dados no formulário do Stripe. Carregue em "Levantar" para continuar.',
  nada: 'Não há prémios por levantar.',
  erro: 'Não foi possível concluir o levantamento. Tente novamente daqui a pouco.',
  indisponivel: 'Os levantamentos ainda não estão disponíveis.',
}

const statusLabel: Record<string, string> = { available: 'Por levantar', transferring: 'A enviar…', paid: 'Levantado' }

/**
 * "Prémios" nas definições do clipper (sem ir à base de dados): a parte de cada competição ganha e o botão "Levantar".
 * `preview`: os botões não fazem nada (páginas de pré-visualização).
 */
export function ClipperPrizesView({ prizes, account, slug, preview = false }: {
  prizes: ClipperPrize[]; account: Pick<ClipperPayoutAccount, 'transfers_enabled' | 'details_submitted'> | null
  slug: string; preview?: boolean
}) {
  const available = prizes.filter(p => p.status === 'available').reduce((sum, p) => sum + p.amount_cents, 0)
  // Prémios de mais do que uma competição: cada linha diz de qual é.
  const severalBoards = new Set(prizes.map(p => p.leaderboardId)).size > 1
  if (!prizes.length) return <p className="text-sm text-fg-subtle">Ainda sem prémios.</p>
  return (
    <div>
      <ul className="divide-y divide-line/50 text-sm">
        {prizes.map(prize => (
          <li key={prize.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="block truncate font-medium">{prize.title.replace('Prémios de ', '')} · {prize.position}.º lugar</span>
              <span className="block truncate text-xs text-fg-subtle">
                {severalBoards && prize.leaderboardName && `${prize.leaderboardName} · `}
                {prize.manual ? 'Pago pelo streamer' : <>{prize.fee_cents > 0 && `${money(prize.amount_cents + prize.fee_cents, prize.currency)} − 5% · `}{statusLabel[prize.status]}</>}
              </span>
            </span>
            <span className="nums shrink-0 font-medium">{money(prize.amount_cents, prize.currency)}</span>
          </li>
        ))}
      </ul>
      {available > 0 && (
        <form action={preview ? undefined : withdrawPrizesAction} className="mt-3">
          <input type="hidden" name="slug" value={slug} />
          <Button type={preview ? 'button' : 'submit'} variant="secondary" className="w-full border-0">Levantar {money(available)}</Button>
          {!account?.transfers_enabled && (
            <p className="mt-2 text-xs text-fg-subtle">No primeiro levantamento, o Stripe pede os dados pessoais e o IBAN (cerca de 3 minutos).</p>
          )}
        </form>
      )}
      {account?.details_submitted && (
        <form action={preview ? undefined : openPayoutDashboardAction} className="mt-3">
          <input type="hidden" name="slug" value={slug} />
          <button type={preview ? 'button' : 'submit'} className="text-xs text-fg-muted underline-offset-4 hover:text-fg hover:underline">Ver pagamentos e alterar o IBAN</button>
        </form>
      )}
    </div>
  )
}
