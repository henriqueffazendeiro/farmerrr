# Lives do streamer → Absolute Cinema

Tudo é lido pelas **APIs oficiais**, no servidor, com as credenciais da app farmerrr.
O streamer só cola o nome do canal: não autoriza nada e não corre nada no PC.
Não há scrapers (yt-dlp, Apify) nem programa no PC.

| | Twitch | Kick | YouTube |
| --- | --- | --- | --- |
| API | Helix | Public API v1 | Data API v3 |
| Autenticação | client credentials | client credentials | chave da API |
| Variáveis | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET` | `YOUTUBE_API_KEY` |
| Live em direto (título, thumbnail, início) | sim | sim | sim |
| Lives passadas (ao ligar e 1× por dia) | últimas 50 VODs (`type=archive`) | não (a API não tem histórico) | últimos 50 uploads |

Na Kick cada live só fica registada se for vista em direto por uma verificação.

## Ativação

1. Aplicar as migrações de `supabase/migrations` (incluindo `0017_drop_pc_agent.sql`).
2. Twitch: app em dev.twitch.tv/console/apps (confidencial). Kick: app no portal de
   developers da Kick. Basta o Client ID e o Client Secret: o servidor pede um token de
   app (`grant_type=client_credentials`) e guarda-o em memória até expirar.
3. YouTube: ativar a YouTube Data API v3 no Google Cloud e criar uma chave restrita a essa API.
4. Pôr as variáveis em `.env.local` e no Vercel (Production).
5. Definições → Canais ligados → escolher a plataforma e colar o canal.

## Avisos em tempo real (webhooks)

As plataformas avisam o farmerrr quando uma live começa/acaba; não é preciso perguntar constantemente.

| | Como | Endereço | Verificação |
| --- | --- | --- | --- |
| Twitch | EventSub `stream.online` / `stream.offline` (token da app) | `/api/webhooks/twitch` | HMAC-SHA256 |
| Kick | `livestream.status.updated` | `/api/webhooks/kick` (configurado na app da Kick: "Enable webhooks") | RSA, chave pública da Kick |
| YouTube | WebSub (pubsubhubbub.appspot.com), dura 10 dias | `/api/webhooks/youtube` | HMAC-SHA1 |

As subscrições são criadas/renovadas na primeira verificação de cada canal em cada dia e
apagadas quando o canal é desligado. Os segredos derivam de `CRON_SECRET`; só funcionam
num endereço HTTPS público (`NEXT_PUBLIC_APP_URL`), não em localhost.
O YouTube só avisa "o canal publicou/alterou um vídeo"; a leitura barata confirma se é live.

## Verificação periódica (rede de segurança)

`/api/cron/streams` (Authorization: Bearer CRON_SECRET, chamado a cada minuto pelo cron-job.org)
verifica cada canal de 10 em 10 minutos (5 sem webhooks), **em grupo**:
Twitch 100 canais por pedido, Kick 50, YouTube ~1 unidade de quota por canal
(`playlistItems` + `videos.list` em grupos de 50 — sem `search.list`, que custa 100).
A primeira verificação do dia de cada canal é individual (importa lives passadas e renova webhooks).
Com a quota grátis do YouTube (10 000/dia) chegam ~60 canais YouTube; Twitch e Kick, milhares.

## Regras

- Cada transmissão é guardada pelo ID da plataforma (Kick: ID do canal + início).
- Uma live passada só é acrescentada se ainda não existir (mesmo ID, ou início a menos
  de 15 minutos, porque na Twitch a live e a VOD podem ter IDs diferentes).
- Falhas de API nunca terminam uma live; só uma resposta completa "offline" o faz.
- O fim é a hora em que a live deixou de ser vista em direto.
- Ligações antigas (do programa no PC) passam a ser lidas pela API e recebem o ID
  real do canal na primeira verificação.

## Validação

`npm run test:streams`, `npm run typecheck`.

Fontes: https://dev.twitch.tv/docs/api/reference#get-streams,
https://dev.twitch.tv/docs/api/reference#get-videos,
https://docs.kick.com/apis/channels,
https://docs.kick.com/getting-started/generating-tokens-oauth2-flow,
https://developers.google.com/youtube/v3/docs/search/list.
