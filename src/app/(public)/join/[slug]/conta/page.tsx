import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getClipperMembership } from '@/lib/clippers/session'
import { requestClipperSync } from '@/lib/clippers/actions'
import { Button, ButtonLink } from '@/components/ui/button'
import { AutoRefresh } from '@/components/leaderboard/auto-refresh'
import { isMockMode } from '@/lib/providers/registry'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'A minha participação', robots: { index: false } }
const notices: Record<string, string> = {
  fila: 'Atualização pedida. Os vídeos serão importados assim que o pedido for processado.',
  recente: 'A conta foi atualizada há menos de cinco minutos. Tenta novamente mais tarde.',
  indisponivel: 'A atualização não está disponível para esta participação.', erro: 'Não foi possível pedir a atualização. Tenta novamente.',
}
export default async function ClipperAccount({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ estado?: string }>
}) {
  const { slug } = await params
  const { estado } = await searchParams
  const member = await getClipperMembership(slug)
  if (!member) redirect(`/join/${encodeURIComponent(slug)}`)
  const { board, participant, account } = member
  const active = participant.status === 'active' && board.status === 'active' && (!board.ends_at || new Date(board.ends_at).getTime() > Date.now())
  return <main className="mx-auto max-w-lg px-5 py-16">
    <AutoRefresh seconds={30} />
    <h1 className="text-2xl font-semibold">A minha participação</h1>
    <p className="mt-2 text-fg-muted">{board.name}</p>
    {isMockMode() && <p className="mt-4 text-sm text-gold">Demonstração: esta conta e os vídeos são simulados.</p>}
    <div className="mt-6 space-y-4 rounded-xl border border-line bg-surface p-6">
      <h2 className="font-semibold">{account?.username ? `@${account.username}` : account?.display_name || 'TikTok'}</h2>
      <p>Participação: {participant.status === 'active' ? 'ativa' : participant.status === 'disqualified' ? 'desqualificada' : 'terminada'}</p>
      <p>Ligação: {account?.status === 'connected' ? 'ligada' : 'precisa de autorização'}</p>
      <p className="text-sm text-fg-muted">{account?.last_synced_at ? `Última atualização: ${new Date(account.last_synced_at).toLocaleString('pt-PT', { timeZone: board.timezone })}` : 'A aguardar a primeira importação dos vídeos.'}</p>
      {estado && notices[estado] && <p role="status" className="text-sm">{notices[estado]}</p>}
      {active && <div className="flex flex-wrap gap-3">
        {account?.status === 'connected' && <form action={requestClipperSync}><input type="hidden" name="slug" value={slug} /><Button type="submit" variant="secondary">Pedir atualização</Button></form>}
        <a href={`/api/auth/tiktok/start?lb=${encodeURIComponent(slug)}`} className="rounded border border-line px-4 py-2">Voltar a ligar TikTok</a>
      </div>}
    </div>
    <p className="mt-5 text-sm text-fg-muted">São contabilizados os vídeos públicos elegíveis para esta competição. As visualizações são atualizadas periodicamente.</p>
    <p className="mt-3 text-sm text-fg-muted">Podes revogar o acesso do farmerrr nas definições de aplicações ligadas do TikTok.</p>
    <div className="mt-6 flex flex-col gap-4"><ButtonLink href={`/${slug}`}>Ver ranking</ButtonLink><Link href={`/${slug}/c/${participant.id}`}>Ver a minha página pública</Link></div>
  </main>
}
