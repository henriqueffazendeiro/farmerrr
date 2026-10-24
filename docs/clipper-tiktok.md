# Participação dos clippers

O convite `/join/<slug>` autoriza o TikTok e inscreve a conta nessa competição.
A primeira importação entra na fila: a pessoa vê o ranking inicialmente a zero
e pode acompanhar o estado em `/join/<slug>/conta`. A sessão assinada valida a
participação no servidor; um ID no URL não concede acesso à área privada.
Reautorizar a mesma conta mantém a participação. Participações desqualificadas
não são reativadas pelo OAuth. A revogação faz-se nas aplicações ligadas do TikTok.

## Ativar

1. Executar `supabase/migrations/0009_clipper_sync.sql` no Supabase.
2. Criar uma app em https://developers.tiktok.com/ e configurar Login Kit Web
   e Display API. Começar com sandbox e adicionar as contas de teste.
3. Configurar os scopes user.info.basic, user.info.profile, user.info.stats,
   video.list. O clipper precisa de conceder video.list.
4. Registar um callback HTTPS estático, por exemplo
   https://DOMINIO/api/auth/tiktok/callback. Login Kit Web não aceita localhost HTTP.
5. Preencher TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI,
   NEXT_PUBLIC_APP_URL e definir SOCIAL_PROVIDER=tiktok. Reiniciar o servidor.
6. Ativar os agendadores existentes /api/cron/schedule e /api/cron/sync.
   Localmente: `npm run clippers:watch`, mantendo `npm run dev` ativo.

SOCIAL_PROVIDER=mock é explicitamente apresentado como demonstração e não
funciona em produção. O modo real nunca cai silenciosamente para contas falsas.
As credenciais e os tokens ficam no servidor; a chave AES já existe em .env.local.

## Limites atuais

- Descoberta dos 60 vídeos públicos mais recentes, de 30 em 30 minutos.
  Não é uma importação completa do histórico de uma conta.
- Métricas atualizadas conforme a idade do vídeo (1 h / 6 h / 24 h), sujeitas
  à frequência e à capacidade do worker. Não são dados em tempo real.
- O ranking aplica datas, plataforma, participação e exclusões do streamer.
  Não identifica automaticamente se um vídeo é sobre o streamer. Atualmente
  todos os vídeos elegíveis da conta contam, salvo exclusão manual.
- A ligação automática entre um TikTok e uma live específica do Absolute Cinema
  ainda não existe. A data de publicação não prova a live de origem.
- A sessão da área privada representa a última competição autorizada.
- Testes locais com respostas simuladas não validam a aprovação OAuth real.

Fontes: https://developers.tiktok.com/docs/en/login-kit-web e
https://developers.tiktok.com/docs/en/display-api-overview.
