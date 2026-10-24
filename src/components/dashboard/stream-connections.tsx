import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createAdminClient } from '@/lib/supabase/admin'
import { streamPlatforms, streamLabels } from '@/lib/streams/model'
import { streamConfigured } from '@/lib/streams/providers'
import { checkStreamNow, disconnectStream } from '@/lib/streams/actions'

const messages: Record<string, string> = {
  connected: 'Canal ligado. As próximas lives serão registadas no Absolute Cinema.',
  disconnected: 'Canal desligado. As lives anteriores continuam guardadas.',
  checked: 'Verificação concluída.', recent: 'O canal foi verificado há menos de um minuto.',
  cancelled: 'A ligação foi cancelada.', invalid: 'A ligação expirou. Tenta novamente.',
  unavailable: 'Esta plataforma ainda não está disponível.', error: 'Não foi possível concluir. Tenta novamente.',
  sync_pending: 'Canal ligado. A primeira verificação não terminou; vamos tentar novamente.',
  claimed: 'Este canal já está ligado a outro perfil no farmerrr.',
  busy: 'Está a decorrer uma verificação. Tenta novamente dentro de um minuto.',
  offline_access: 'Autoriza o acesso contínuo ao canal para podermos detetar lives quando não estás no site.',
}
export async function StreamConnections({ creatorId, notice }: { creatorId: string; notice?: string }) {
  const { data, error } = await createAdminClient().from('stream_connections')
    .select('id,platform,channel_name,channel_url,status,last_checked_at,last_error').eq('creator_id', creatorId)
  return <Card className="mt-4">
    <CardHeader><CardTitle>Plataformas de live</CardTitle></CardHeader>
    <CardBody className="space-y-5 text-sm">
      <p className="text-fg-muted">Liga o canal onde fazes as tuas lives. Quando entrares em direto, a transmissão aparece automaticamente no Absolute Cinema.</p>
      {notice && messages[notice] && <p role="status" className="text-fg">{messages[notice]}</p>}
      {error ? <p role="status" className="text-fg-muted">A ligação de canais está a ser preparada. Tenta novamente mais tarde.</p> : streamPlatforms.map(platform => {
        const connection = data?.find(row => row.platform === platform)
        const configured = streamConfigured(platform)
        return <div key={platform} className="space-y-3 border-t border-line pt-4">
          <div className="flex items-center justify-between gap-3"><strong>{streamLabels[platform]}</strong>
            <span className="text-xs text-fg-muted">{connection ? connection.status === 'connected' ? 'Ligado' : 'Voltar a ligar' : 'Não ligado'}</span></div>
          {connection && <>
            <a href={connection.channel_url} target="_blank" rel="noopener noreferrer" className="underline">{connection.channel_name}</a>
            {connection.last_checked_at && <p className="text-xs text-fg-muted">Última verificação: {new Date(connection.last_checked_at).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })}</p>}
            {connection.last_error && <p className="text-fg-muted">{connection.last_error}</p>}
          </>}
          <div className="flex flex-wrap gap-2">
            {configured ? <a className="rounded border border-line px-3 py-2 hover:bg-surface-2" href={`/api/streams/${platform}/start`}>
              {connection ? 'Voltar a ligar' : `Ligar ${streamLabels[platform]}`}</a> : <span className="text-fg-muted">Disponível em breve</span>}
            {connection && <>
              {connection.status === 'connected' && <form action={checkStreamNow}><input type="hidden" name="connectionId" value={connection.id} /><Button type="submit" variant="secondary">Verificar agora</Button></form>}
              <form action={disconnectStream}><input type="hidden" name="connectionId" value={connection.id} /><Button type="submit" variant="secondary">Desligar</Button></form>
            </>}
          </div>
        </div>
      })}
    </CardBody>
  </Card>
}
