# TikTok oficial: Login Kit e Display API

O convite /join/<slug> abre **Entrar com TikTok**. O clipper autoriza a leitura
do perfil e dos vídeos públicos no TikTok e regressa à competição. Não há
inscrição por username, confirmação na bio, scraping ou serviço Python TikTok.
O provider por omissão é tiktok; mock é apenas para desenvolvimento explícito.

## Ativar

1. Aplicar as migrações pendentes, incluindo 0013_tiktok_official_only.sql.
2. No TikTok Developers adicionar Login Kit Web e Display API. Pedir os scopes
   user.info.basic, user.info.profile, user.info.stats e video.list. O utilizador
   tem de conceder video.list. Os campos opcionais só são pedidos se autorizados.
3. Registar exatamente https://DOMINIO/api/auth/tiktok/callback como redirect.
   O login exige HTTPS, mesmo em sandbox.
4. No alojamento configurar SOCIAL_PROVIDER=tiktok, NEXT_PUBLIC_APP_URL,
   TIKTOK_REDIRECT_URI, TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET,
   TOKEN_ENCRYPTION_KEY, CLIPPER_SESSION_SECRET e CRON_SECRET.
   Manter a chave de cifra existente. Nunca publicar segredos em NEXT_PUBLIC_*.
   Remover TIKTOK_SCRAPER_* e os valores antigos SOCIAL_PROVIDER=scraper/apify.
5. Testar com uma conta no sandbox e obter aprovação para produção dos produtos
   e scopes, com site, termos, privacidade e demonstração exigidos pelo TikTok.
6. Publicar e ativar um agendador **na cloud** para /api/cron/schedule e
   /api/cron/sync?limit=1, com Authorization: Bearer CRON_SECRET.
   Ver [agendamento externo](external-scheduler.md). Nenhum computador pessoal
   precisa de ficar ligado. npm run clippers:watch é só uma alternativa local.

Publicar o código não ativa sozinho o agendamento nem aprova a aplicação no
TikTok. Não duplicar agendadores cloud com workers locais. O lote inicial de um
job/minuto é conservador: medir a fila e dimensionar frequência, concorrência e
recursos antes de suportar centenas de contas. Um agendador com timeout de 30 s
pode precisar do modo background descrito no documento de agendamento.

## Recolha e limites

- Tokens cifrados no servidor, renovados pela validade devolvida pela API,
  guardando o novo refresh token e verificando a identidade. Revogação ou
  expiração exigem login; nunca há fallback para scraping.
- Cada descoberta lê até três páginas de vinte vídeos e guarda o cursor depois
  de persistir os dados e recalcular rankings. O agendador retoma as páginas
  seguintes até completar o histórico público disponibilizado pela API.
  O ciclo seguinte começa pelos vídeos recentes, após pelo menos 30 minutos.
- Métricas elegíveis a cada 1 h / 6 h / 24 h conforme a idade. Os vídeos há mais
  tempo sem atualização têm prioridade. Filas e quotas podem adiar a recolha.
- Respostas incompletas não viram contagens zero. Erros 429 têm espera crescente;
  erros de autorização pedem login. Após cinco falhas, a conta aguarda seis horas
  antes de receber novos trabalhos.
- Só há recolha para participantes ativos em competições ativas. As regras do
  ranking aplicam datas, plataforma e exclusões, mas não identificam se o vídeo
  é sobre o streamer nem a live de origem.

## Contas antigas

A migração marca public:* e apify:* como needs_reauth e termina os seus jobs
pendentes, preservando o histórico. O código também bloqueia a recolha destas
contas antes da migração. O open_id oficial não é o antigo ID público.
Um novo login cria uma identidade OAuth separada: não fundimos perfis pelo
username, que pode mudar de dono. Participações históricas precisam de
reconciliação verificada antes de anunciar continuidade ou limpar duplicados.

## Verificação

Executar npm run typecheck, npm run test:clippers e npm run test:streams.
São testes com respostas simuladas. Ainda é necessário validar OAuth real,
renovação, importação e agendamento com a aplicação aprovada ou em sandbox.

Referências oficiais:
- [Display API](https://developers.tiktok.com/docs/en/display-api-get-started)
- [Paginação](https://developers.tiktok.com/docs/en/tiktok-api-v2-video-list)
- [Tokens](https://developers.tiktok.com/docs/en/oauth-user-access-token-management)
- [Limites](https://developers.tiktok.com/docs/en/tiktok-api-v2-rate-limit)
