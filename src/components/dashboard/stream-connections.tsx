import { ChannelPicker } from './channel-picker'
import { createAdminClient } from '@/lib/supabase/admin'
import { streamPlatforms } from '@/lib/streams/model'
import { isPublicMarker, publicStreamsConfigured } from '@/lib/streams/public-provider'

const messages: Record<string, string> = {
  connected: 'Canal ligado. As próximas lives serão registadas no Absolute Cinema e as anteriores continuam guardadas.',
  disconnected: 'Canal desligado. As lives anteriores continuam guardadas.',
  checked: 'Verificação concluída.', recent: 'O canal foi verificado há menos de um minuto.',
  cancelled: 'A ligação foi cancelada.', invalid: 'A ligação expirou. Tenta novamente.',
  unavailable: 'Esta plataforma ainda não está disponível.', error: 'Não foi possível concluir. Tenta novamente.',
  sync_pending: 'Canal ligado. A primeira verificação não terminou; vamos tentar novamente.',
  claimed: 'Este canal já está ligado a outro perfil no farmerrr.',
  busy: 'Não foi possível alterar a ligação durante uma verificação. Tenta novamente dentro de alguns minutos.',
  offline_access: 'Autoriza o acesso contínuo ao canal para podermos detetar lives quando não estás no site.',
}
export async function StreamConnections({ creatorId, notice }: { creatorId: string; notice?: string }) {
  const { data, error } = await createAdminClient().from('stream_connections')
    .select('id,platform,channel_name,channel_url,status,access_token_enc,last_checked_at,last_error').eq('creator_id', creatorId)
  const connections = data?.map(({ access_token_enc, ...row }) => ({ ...row,
    mode: isPublicMarker(access_token_enc) ? 'public' as const : 'oauth' as const,
  })) ?? []
  return <section id="canais" aria-labelledby="canais-title" className="mt-6 scroll-mt-8 pt-6">
    <h3 id="canais-title" className="mb-1.5 text-xs text-fg-muted">Canais ligados</h3>
    <div className="text-sm">
      {error ? <p role="status" className="text-fg-muted">A ligação de canais está a ser preparada. Tenta novamente mais tarde.</p> : <ChannelPicker key={JSON.stringify([notice, connections])} initialNotice={notice ? messages[notice] : undefined} options={streamPlatforms.map(platform => ({
        platform,
        configured: publicStreamsConfigured(platform),
        connection: connections.find(row => row.platform === platform) ?? null,
      }))} />}

    </div>
  </section>
}
