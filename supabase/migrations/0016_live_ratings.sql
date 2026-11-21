-- Notas (1 a 10 estrelas) dadas pelos visitantes às lives dos streamers.
-- Um voto por browser e por live: voter_hash é o hash de um identificador
-- anónimo guardado num cookie. Só o servidor (service role) lê e escreve votos;
-- o público vê apenas a média e o número de votos, pela view live_rating_stats.

create table if not exists public.live_ratings (
  live_id     uuid not null references public.creator_lives (id) on delete cascade,
  voter_hash  text not null check (length(voter_hash) = 64),
  score       smallint not null check (score between 1 and 10),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (live_id, voter_hash)
);

alter table public.live_ratings enable row level security;
revoke all on public.live_ratings from anon, authenticated;
grant all on public.live_ratings to service_role;

create or replace view public.live_rating_stats
with (security_invoker = false) as
  select live_id, round(avg(score)::numeric, 2)::float8 as average, count(*)::int as count
  from public.live_ratings
  group by live_id;

revoke all on public.live_rating_stats from public;
grant select on public.live_rating_stats to anon, authenticated, service_role;
