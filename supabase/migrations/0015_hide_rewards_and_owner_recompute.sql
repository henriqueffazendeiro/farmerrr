-- ─── 1. Quantias ocultas não saem da base de dados ──────────────────────────
-- Com blur_rewards, a página mostrava "..." mas a leitura pública de `rewards`
-- devolvia amount_cents a qualquer pessoa (incluindo pela chave anon).
-- O público passa a ler a view rewards_public, que esconde o valor; a tabela
-- fica só para o dono (política "prémios: dono gere", já existente).

drop policy if exists "prémios: leitura pública" on public.rewards;

create or replace view public.rewards_public
with (security_invoker = false) as
  select
    r.id,
    r.leaderboard_id,
    r.position,
    r.label,
    case when lb.blur_rewards then null else r.amount_cents end as amount_cents,
    r.currency,
    r.created_at,
    (lb.blur_rewards and r.amount_cents is not null) as amount_hidden
  from public.rewards r
  join public.leaderboards lb on lb.id = r.leaderboard_id
  where lb.is_public and lb.status <> 'draft';

revoke all on public.rewards_public from public;
grant select on public.rewards_public to anon, authenticated, service_role;

-- ─── 2. Só o servidor recalcula rankings ─────────────────────────────────────
-- recompute_leaderboard é security definer e estava aberta a qualquer conta
-- autenticada, para qualquer competição. A aplicação confirma o dono e chama-a
-- com a service role; os triggers internos não dependem deste grant.

revoke execute on function public.recompute_leaderboard(uuid) from authenticated;
grant execute on function public.recompute_leaderboard(uuid) to service_role;
