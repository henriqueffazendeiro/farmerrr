-- As lives passam a ser lidas só pelas APIs oficiais (Twitch, Kick, YouTube).
-- O programa farmerrr no PC do streamer foi removido: estas tabelas deixam de ser usadas.
-- As ligações antigas guardadas para o programa são convertidas para leitura pela API.
begin;

drop table if exists public.agent_pairings;
drop table if exists public.agent_devices;

update public.stream_connections
   set access_token_enc = 'api:public', last_error = null
 where access_token_enc in ('agent:public', 'apify:public');

commit;
