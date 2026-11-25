import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { StreamerLeaderboard } from '@/components/leaderboard/streamer-leaderboard'
import { demoClippers, demoCreator, demoLeaderboard, demoRewards } from '@/lib/leaderboards/demo'
import { availablePeriods } from '@/lib/period'
import { ClipperSettingsView } from '@/components/clipper/clipper-settings'
import type { ClipperPrize } from '@/lib/prizes/payouts'
import { PageReady } from '@/components/dashboard/page-ready'

const demoPrize = (id: string, over: Partial<ClipperPrize>): ClipperPrize => ({
  id, payment_id: `payment-${id}`, clipper_profile_id: 'profile-1', participant_id: 'clipper-1', position: 1,
  amount_cents: 47500, fee_cents: 2500, currency: 'EUR', status: 'available', stripe_transfer_id: null, last_error: null,
  transferred_at: null, created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z',
  title: 'Prémios de Outubro', leaderboardId: 'demo', leaderboardName: 'Batalha de Clippers', manual: false, ...over,
})

export const metadata: Metadata = { title: 'Pré-visualizar entregar prémios', robots: { index: false, follow: false } }

/**
 * Só em desenvolvimento: o que o dono vê no lugar do contador quando o mês acaba e os prémios estão por entregar.
 * ?como=clipper → vista por um clipper que já participa (definições do clipper no lugar do "Participar").
 * ?como=visitante → vista por quem ainda não participa (com "Participar").
 * ?como=clipper&popup=premio → o pop-up "Prémio disponível" (o botão só fecha).
 * ?popup=pago → o pop-up "Prémios pagos" que o dono vê ao voltar do pagamento.
 * ?processando=1 → o dono pagou por Multibanco e a referência ainda não foi paga.
 */
export default async function PrizeDuePreviewPage({ searchParams }: { searchParams: Promise<{ como?: string; popup?: string; processando?: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { como, popup, processando } = await searchParams
  const asOwner = como !== 'clipper' && como !== 'visitante'
  const leaderboard = demoLeaderboard()
  const periods = availablePeriods(leaderboard)
  // Clippers de teste, só para a tabela não aparecer vazia.
  const clippers = demoClippers(periods[0])
  const totals = { total_views: clippers.reduce((sum, c) => sum + c.totalViews, 0), total_likes: clippers.reduce((sum, c) => sum + c.totalLikes, 0),
    total_clips: clippers.reduce((sum, c) => sum + c.videoCount, 0), active_clippers: clippers.length, avg_views: 0 }
  const rewards = demoRewards()
  // Os vencedores do painel "Entregar prémios" são os mesmos do pódio, com os mesmos prémios.
  const winners = rewards.map(reward => {
    const clipper = clippers.find(c => c.rank === reward.position)!
    return { position: reward.position, name: clipper.displayName, username: clipper.username, avatarUrl: clipper.avatarUrl, amountCents: reward.amount_cents ?? 0 }
  })
  return <><StreamerLeaderboard leaderboard={leaderboard} creator={demoCreator()} clippers={clippers} rewards={rewards}
    totals={totals}
    clipperSettings={como === 'clipper' ? <ClipperSettingsView preview data={{
      slug: leaderboard.slug, username: 'clipsdoluis', displayName: 'Clips do Luís', avatarUrl: clippers[0]?.avatarUrl ?? null,
      discord: 'clipsdoluis', email: 'luis@exemplo.com', needsReauth: false, banned: null,
      prizes: [demoPrize('outubro', {}),
        demoPrize('setembro', { title: 'Prémios de Setembro', position: 2, amount_cents: 23750, fee_cents: 1250, status: 'paid' }),
        demoPrize('agosto', { title: 'Prémios de Agosto', position: 3, amount_cents: 10000, fee_cents: 0, status: 'paid', manual: true }),
        demoPrize('julho', { title: 'Prémios de Julho', position: 1, amount_cents: 47500, fee_cents: 2500, status: 'paid' }),
        demoPrize('junho', { title: 'Prémios de Junho', position: 2, amount_cents: 23750, fee_cents: 1250, status: 'paid' })],
      payoutAccount: { transfers_enabled: true, details_submitted: true },
    }} /> : undefined}
    periods={periods} periodKey={periods[0]} sort="views" demo isOwner={asOwner} clockTarget={asOwner ? undefined : new Date(Date.now() + 9 * 86400000 + 5 * 3600000).toISOString()}
    prizeDue={{ periodKey: '2026-10', periodName: 'Outubro', amountCents: winners.reduce((sum, w) => sum + w.amountCents, 0), winners, processing: processando === '1' }} />
    {popup === 'premio' && <PageReady param={[]} title="Prémio disponível" celebration="money"
      image="https://cdn.7tv.app/emote/01JV0DYKQZ8F4FJ7GPMM8RJP35/4x.gif"
      description="Parabéns! 475 € prontos a levantar para o IBAN." action="Levantar 475 €" />}
    {popup === 'pago' && <PageReady param={[]} title="Prémios pagos" celebration="money"
      image="https://cdn.7tv.app/emote/01HRBKB9T000072EX513ZQ4552/4x.png"
      description="Os vencedores já podem levantar os prémios para o IBAN." action="Fechar" />}
  </>
}
