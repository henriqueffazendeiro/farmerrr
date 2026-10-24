# Lives do streamer → Absolute Cinema

O streamer autoriza o canal em Dashboard → Conta → Plataformas de live.
O servidor consulta as APIs oficiais e guarda cada transmissão por ID da
plataforma (Kick: ID do canal + início). Uma repetição não cria outra live.
O calendário usa o fuso da competição, mostra várias transmissões no mesmo
dia e atualiza através do AutoRefresh existente. Não são importados clips
nem inventadas avaliações. A votação real é uma funcionalidade separada.

## Ativação

1. Executar `supabase/migrations/0008_streamer_lives.sql` no SQL Editor,
   depois das migrações anteriores, incluindo 0007.
2. Criar uma app OAuth para cada plataforma pretendida. Só os botões das
   plataformas com Client ID e Client Secret ficam ativos.
3. Preencher as variáveis abaixo em `.env.local` e reiniciar o servidor.
4. Autorizar o próprio canal no farmerrr e testar durante uma live pública.

| Plataforma | Variáveis | Callback local |
| --- | --- | --- |
| Twitch | TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET | http://localhost:3000/api/streams/twitch/callback |
| YouTube | YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET | http://localhost:3000/api/streams/youtube/callback |
| Kick | KICK_CLIENT_ID, KICK_CLIENT_SECRET | http://localhost:3000/api/streams/kick/callback |

Em produção, trocar o domínio em NEXT_PUBLIC_APP_URL e registar os callbacks
HTTPS correspondentes nas apps. A disponibilidade de callbacks locais depende
das regras de cada plataforma; quando necessário, usar um domínio de teste HTTPS.

YouTube: ativar YouTube Data API v3 no Google Cloud, configurar o consentimento
OAuth e um cliente Web. Scope: youtube.readonly. Durante testes adicionar a conta
como test user. O modo de teste pode exigir reautorizações periódicas; seguir a
verificação Google antes de abrir a utilizadores externos.

Twitch: app em dev.twitch.tv/console/apps, tipo confidencial. Não precisamos de
scopes de escrita. Kick: app no portal de developers, scope channel:read, com PKCE.

## Agendamento

Local: manter `npm run dev` e `npm run streams:watch` em execução. O botão
Verificar agora permite validar uma ligação sem esperar pelo agendador.

Produção: `/api/cron/streams`, com Authorization: Bearer CRON_SECRET, precisa de
um agendador externo configurado para cada minuto. Ver `external-scheduler.md`.
vercel.json não ativa tarefas internas. Uma visita ao site não inicia a sincronização.
O worker consulta até dez canais por execução, por ordem de última verificação;
com mais canais, aumentar a capacidade antes de prometer deteção em um minuto.
Erros e limites da plataforma podem atrasar a deteção. Transmissões que começam
e terminam entre consultas podem não ser vistas. Não há importação retroativa.

O fim é a hora de deteção offline, não uma hora exata fornecida pela plataforma.
Twitch e Kick mantêm o registo após terminar; não há link VOD sem resolver o
arquivo real. YouTube mantém o link do vídeo. Só lives públicas do YouTube são
publicadas. Falhas de API nunca são interpretadas como fim de live.

Tokens cifrados com AES-GCM, tabelas de credenciais sem acesso do browser,
OAuth associado ao utilizador e creator, cookie de 10 minutos e lease por canal
para evitar verificações simultâneas. Desligar remove os tokens locais e para
a sincronização; a autorização na plataforma pode ser revogada no respetivo painel.

## Validação

`npm run test:streams`, `npm run typecheck`, `npm run lint`.
Os testes com respostas simuladas não substituem o teste OAuth com apps reais.

Fontes: https://dev.twitch.tv/docs/api/reference#get-streams,
https://developers.google.com/youtube/data/live/reference/rest/v3/liveBroadcasts/list,
https://docs.kick.com/apis/channels,
https://docs.kick.com/getting-started/generating-tokens-oauth2-flow.
