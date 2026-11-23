import { Button } from '@/components/ui/button'
import { money } from '@/lib/format'
import { Laurel } from '@/components/leaderboard/laurel'
import ranking from '@/components/leaderboard/ranking.module.css'
import { withdrawPrizesAction } from '@/lib/prizes/actions'
import type { ClipperPrize } from '@/lib/prizes/payouts'
import type { ClipperPayoutAccount } from '@/lib/db/types'

export const prizeNotices: Record<string, string> = {
  enviado: 'Enviado. O dinheiro chega ao IBAN em poucos dias úteis.',
  ligada: 'Conta de pagamentos ligada.',
  pendente: 'O Stripe está a verificar os dados. Quando terminar, basta carregar outra vez em "Levantar".',
  incompleto: 'Faltam alguns dados no formulário do Stripe. Carrega em "Levantar" para continuar.',
  nada: 'Não há prémios por levantar.',
  erro: 'Não foi possível concluir o levantamento. Tenta novamente daqui a pouco.',
  indisponivel: 'Os levantamentos ainda não estão disponíveis.',
}

const statusLabel: Record<string, string> = { available: 'Por levantar', transferring: 'A enviar…', paid: 'Levantado' }

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-baseline justify-between gap-4">
    <dt className={strong ? 'text-fg' : 'text-fg-muted'}>{label}</dt>
    <dd className={`nums ${strong ? 'font-semibold' : 'font-medium'}`}>{value}</dd>
  </div>
}

/**
 * "Ganhos" no painel Conta do clipper (sem ir à base de dados), no estilo do "Entregar prémios": uma linha por prémio
 * desta competição (lugar, mês e valor), depois o total, o levantado, o por levantar e o botão "Levantar".
 * `preview`: os botões não fazem nada (páginas de pré-visualização).
 */
export function ClipperPrizesView({ prizes, account, slug, preview = false }: {
  prizes: ClipperPrize[]; account: Pick<ClipperPayoutAccount, 'transfers_enabled' | 'details_submitted'> | null
  slug: string; preview?: boolean
}) {
  const sum = (list: ClipperPrize[]) => list.reduce((total, p) => total + p.amount_cents, 0)
  const available = sum(prizes.filter(p => p.status === 'available'))
  // Já recebido: levantado para o IBAN (ou a caminho) e o que o streamer pagou diretamente.
  const withdrawn = sum(prizes.filter(p => p.status !== 'available'))
  if (!prizes.length) return <p className="text-sm text-fg-subtle">Ainda sem prémios.</p>
  return (
    <div>
      {/* Mostra 3 prémios de cada vez; os restantes com scroll. */}
      <ul className="max-h-[170px] divide-y divide-line/50 overflow-y-auto text-sm [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
        {prizes.map(prize => <li key={prize.id} className="flex items-center gap-3 py-2.5">
          {/* O lugar com a coroa de louros, como na tabela do ranking. */}
          <span className={`${ranking.position} ${prize.position <= 3 ? ranking[`rank${prize.position}`] : ''} !h-[30px] !w-[30px] shrink-0 [&>span]:!text-[11px] [&>svg]:!h-[26px] [&>svg]:!w-[30px]`} aria-label={`${prize.position}.º lugar`}>
            {prize.position <= 3 && <Laurel className={ranking.positionWreath} />}<span className={ranking.positionNumber}>{prize.position}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{prize.title.replace('Prémios de ', '')}</span>
            <span className="block truncate text-xs text-fg-subtle">
              {prize.manual ? 'Pago pelo streamer' : <>{prize.fee_cents > 0 && `${money(prize.amount_cents + prize.fee_cents, prize.currency)} − 5% · `}{statusLabel[prize.status]}</>}
            </span>
          </span>
          <span className="nums shrink-0 font-medium">{money(prize.amount_cents, prize.currency)}</span>
        </li>)}
      </ul>

      <dl className="space-y-2 border-t border-line/60 pt-3 text-sm">
        <Row label="Total" value={money(available + withdrawn)} strong />
      </dl>

      {available > 0 && (
        <form action={preview ? undefined : withdrawPrizesAction} className="mt-3">
          <input type="hidden" name="slug" value={slug} />
          <Button type={preview ? 'button' : 'submit'} variant="secondary" className="w-full border-0">Levantar {money(available)}</Button>
          {!account?.transfers_enabled && (
            <p className="mt-2 text-xs text-fg-subtle">No primeiro levantamento, o Stripe pede os dados pessoais e o IBAN (cerca de 3 minutos).</p>
          )}
        </form>
      )}
    </div>
  )
}
