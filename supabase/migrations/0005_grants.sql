-- ═══════════════════════════════════════════════════════════════════════════
-- Farmerrr — permissões de execução das funções
--
-- Por omissão o Postgres deixa qualquer papel executar uma função nova. As
-- funções SECURITY DEFINER ignoram a RLS, por isso têm de ser fechadas
-- explicitamente — senão um visitante anónimo podia chamá-las por RPC.
-- ═══════════════════════════════════════════════════════════════════════════

-- Recalcular o ranking: só o dono (autenticado) e o servidor.
revoke all on function public.recompute_leaderboard(uuid) from public, anon;
grant execute on function public.recompute_leaderboard(uuid) to authenticated, service_role;

-- Estas duas só fazem sentido a partir do servidor.
revoke all on function public.recompute_for_account(uuid) from public, anon, authenticated;
grant execute on function public.recompute_for_account(uuid) to service_role;

revoke all on function public.enqueue_sync_job(uuid, sync_job_kind, integer, interval)
  from public, anon, authenticated;
grant execute on function public.enqueue_sync_job(uuid, sync_job_kind, integer, interval)
  to service_role;

-- Leitura de totais: pública, mas continua sujeita à RLS (não é definer).
grant execute on function public.leaderboard_totals(uuid, text) to anon, authenticated, service_role;
grant execute on function public.period_key_for(period_mode, text, timestamptz)
  to anon, authenticated, service_role;

-- Nota: `recompute_leaderboard` fica acessível a qualquer utilizador
-- autenticado. Não devolve dados nem permite corromper nada — só volta a
-- calcular valores corretos — mas se um dia isso passar a incomodar, o guarda
-- natural é verificar `public.owns_leaderboard()` no início da função.
