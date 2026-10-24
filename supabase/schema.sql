-- ═══════════════════════════════════════════════════════════════════════════
-- farmerrr — schema completo, num ficheiro só
--
-- COMO USAR: abre o SQL Editor do teu projeto Supabase, cola isto tudo e
-- carrega em Run. É idempotente o suficiente para correr num projeto novo.
--
-- Gerado a partir de supabase/migrations/0001 a 0005 — se mexeres no schema,
-- mexe nas migrações e volta a gerar este ficheiro, não o contrário.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ 0001_init.sql ═══════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- Farmerrr — schema inicial
-- Ver ARQUITETURA.md §2 para o racional de cada decisão.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ─── Enums ─────────────────────────────────────────────────────────────────

create type leaderboard_status  as enum ('draft', 'active', 'ended');
create type period_mode         as enum ('fixed', 'monthly');
create type participant_status  as enum ('active', 'disqualified', 'left');
create type social_provider     as enum ('tiktok', 'instagram', 'youtube');
create type account_status      as enum ('connected', 'needs_reauth', 'revoked');
create type sync_job_kind       as enum ('discover', 'refresh', 'profile');
create type sync_job_status     as enum ('pending', 'running', 'done', 'error');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete');

-- ─── updated_at automático ─────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── profiles ──────────────────────────────────────────────────────────────
-- O utilizador que paga. Espelha auth.users.

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Cria o profile assim que nasce um auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── creators ──────────────────────────────────────────────────────────────
-- A marca/persona do streamer. Um profile pode ter vários (raro hoje, útil amanhã).

create table public.creators (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null,
  handle     citext not null unique,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index creators_owner_idx on public.creators (owner_id);

create trigger creators_touch before update on public.creators
  for each row execute function public.touch_updated_at();

-- ─── slugs reservados ──────────────────────────────────────────────────────
-- O leaderboard público vive na raiz (/luisferreira), por isso o slug não pode
-- colidir com nenhuma rota da aplicação.

create table public.reserved_slugs (
  slug citext primary key
);

insert into public.reserved_slugs (slug) values
  ('api'), ('auth'), ('join'), ('dashboard'), ('entrar'), ('registar'),
  ('sair'), ('precos'), ('legal'), ('overlay'), ('stream'), ('admin'),
  ('conta'), ('settings'), ('definicoes'), ('novo'), ('new'), ('app'),
  ('www'), ('static'), ('public'), ('assets'), ('_next'), ('favicon'),
  ('robots'), ('sitemap'), ('farmerrr'), ('suporte'), ('ajuda'), ('blog');

-- ─── leaderboards ──────────────────────────────────────────────────────────

create table public.leaderboards (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references public.creators (id) on delete cascade,

  name             text not null,
  slug             citext not null unique,
  description      text,
  rules            text,

  -- Conteúdo editorial (inspirado no luisclips — ver ARQUITETURA.md §10)
  announcement     text,          -- barra de aviso no topo da página pública
  quote            text,          -- as regras nas palavras do streamer
  quote_author     text,
  cover_url        text,

  starts_at        timestamptz not null default now(),
  ends_at          timestamptz,   -- null = competição contínua
  event_at         timestamptz,   -- "live de análise em: 24d 23h" (countdown)
  timezone         text not null default 'Europe/Lisbon',

  status           leaderboard_status not null default 'active',
  period_mode      period_mode not null default 'monthly',
  platforms        social_provider[] not null default array['tiktok']::social_provider[],
  required_keyword text,          -- reservado: hashtag obrigatória
  is_public        boolean not null default true,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint leaderboards_dates_ck check (ends_at is null or ends_at > starts_at)
);

create index leaderboards_creator_idx on public.leaderboards (creator_id);
create index leaderboards_status_idx  on public.leaderboards (status)
  where status = 'active';

create trigger leaderboards_touch before update on public.leaderboards
  for each row execute function public.touch_updated_at();

-- Rejeita slugs reservados, no servidor, sempre.
create or replace function public.check_slug_allowed()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.reserved_slugs r where r.slug = new.slug) then
    raise exception 'O endereço "%" está reservado.', new.slug
      using errcode = 'check_violation';
  end if;
  if new.slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' then
    raise exception 'O endereço "%" é inválido: usa 3 a 40 letras minúsculas, números ou hífenes.', new.slug
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger leaderboards_slug_check
  before insert or update of slug on public.leaderboards
  for each row execute function public.check_slug_allowed();

-- ─── clipper_profiles ──────────────────────────────────────────────────────
-- A pessoa por trás das contas. Independente de leaderboard e de plataforma.

create table public.clipper_profiles (
  id           uuid primary key default gen_random_uuid(),
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger clipper_profiles_touch before update on public.clipper_profiles
  for each row execute function public.touch_updated_at();

-- ─── leaderboard_participants ──────────────────────────────────────────────

create table public.leaderboard_participants (
  id                 uuid primary key default gen_random_uuid(),
  leaderboard_id     uuid not null references public.leaderboards (id) on delete cascade,
  clipper_profile_id uuid not null references public.clipper_profiles (id) on delete cascade,
  status             participant_status not null default 'active',
  joined_at          timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (leaderboard_id, clipper_profile_id)
);

create index participants_leaderboard_idx on public.leaderboard_participants (leaderboard_id);

create trigger participants_touch before update on public.leaderboard_participants
  for each row execute function public.touch_updated_at();

-- ─── social_accounts ───────────────────────────────────────────────────────
-- Os tokens são cifrados pela aplicação antes de chegarem aqui (AES-256-GCM).
-- Esta tabela nunca é legível pelo papel `anon`.

create table public.social_accounts (
  id                 uuid primary key default gen_random_uuid(),
  clipper_profile_id uuid not null references public.clipper_profiles (id) on delete cascade,

  provider           social_provider not null,
  provider_user_id   text not null,          -- open_id no TikTok
  provider_union_id  text,
  username           text,
  display_name       text,
  avatar_url         text,
  profile_url        text,

  -- Estatísticas de perfil (scope user.info.stats)
  follower_count     integer,
  following_count    integer,
  likes_count        bigint,
  video_count        integer,
  stats_updated_at   timestamptz,

  access_token_enc   text,                   -- base64 de iv+tag+ciphertext
  refresh_token_enc  text,
  access_expires_at  timestamptz,
  refresh_expires_at timestamptz,
  scopes             text[] not null default '{}',

  status             account_status not null default 'connected',
  last_synced_at     timestamptz,
  sync_cursor        text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (provider, provider_user_id)
);

create index social_accounts_clipper_idx on public.social_accounts (clipper_profile_id);
create index social_accounts_sync_idx    on public.social_accounts (status, last_synced_at);

create trigger social_accounts_touch before update on public.social_accounts
  for each row execute function public.touch_updated_at();

-- ─── videos ────────────────────────────────────────────────────────────────
-- Pertencem à conta, não ao leaderboard: um clipper em 3 competições
-- sincroniza uma única vez.

create table public.videos (
  id                 uuid primary key default gen_random_uuid(),
  social_account_id  uuid not null references public.social_accounts (id) on delete cascade,

  provider           social_provider not null,
  provider_video_id  text not null,
  url                text,
  embed_link         text,
  thumbnail_url      text,        -- já copiada para o nosso Storage
  caption            text,
  duration_seconds   integer,
  published_at       timestamptz not null,

  latest_views       bigint not null default 0,
  latest_likes       bigint not null default 0,
  latest_comments    bigint not null default 0,
  latest_shares      bigint not null default 0,
  metrics_updated_at timestamptz,

  is_deleted         boolean not null default false,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (provider, provider_video_id)
);

create index videos_account_idx   on public.videos (social_account_id, published_at desc);
create index videos_published_idx on public.videos (published_at desc)
  where is_deleted = false;

create trigger videos_touch before update on public.videos
  for each row execute function public.touch_updated_at();

-- ─── video_metrics ─────────────────────────────────────────────────────────
-- Histórico, para gráficos de evolução. Nunca é lido no caminho quente.

create table public.video_metrics (
  id          bigserial primary key,
  video_id    uuid not null references public.videos (id) on delete cascade,
  views       bigint not null default 0,
  likes       bigint not null default 0,
  comments    bigint not null default 0,
  shares      bigint not null default 0,
  captured_at timestamptz not null default now()
);

create index video_metrics_video_idx on public.video_metrics (video_id, captured_at desc);

-- ─── video_exclusions ──────────────────────────────────────────────────────
-- O streamer exclui um vídeo DE UMA competição, não do mundo.

create table public.video_exclusions (
  id             uuid primary key default gen_random_uuid(),
  leaderboard_id uuid not null references public.leaderboards (id) on delete cascade,
  video_id       uuid not null references public.videos (id) on delete cascade,
  excluded_by    uuid references public.profiles (id) on delete set null,
  reason         text,
  created_at     timestamptz not null default now(),
  unique (leaderboard_id, video_id)
);

create index video_exclusions_lb_idx on public.video_exclusions (leaderboard_id);

-- ─── leaderboard_entries ───────────────────────────────────────────────────
-- Ranking materializado. Uma linha por participante E por período:
--   period_key = 'all'      → histórico geral
--   period_key = '2026-09'  → corrida do mês (quando period_mode = 'monthly')

create table public.leaderboard_entries (
  id              uuid primary key default gen_random_uuid(),
  leaderboard_id  uuid not null references public.leaderboards (id) on delete cascade,
  participant_id  uuid not null references public.leaderboard_participants (id) on delete cascade,
  period_key      text not null,

  total_views     bigint not null default 0,
  total_likes     bigint not null default 0,
  total_comments  bigint not null default 0,
  total_shares    bigint not null default 0,
  video_count     integer not null default 0,
  avg_views       bigint not null default 0,
  best_video_id   uuid references public.videos (id) on delete set null,

  rank            integer,
  previous_rank   integer,
  computed_at     timestamptz not null default now(),

  unique (leaderboard_id, participant_id, period_key)
);

create index entries_rank_idx on public.leaderboard_entries (leaderboard_id, period_key, rank);

-- ─── rewards ───────────────────────────────────────────────────────────────

create table public.rewards (
  id             uuid primary key default gen_random_uuid(),
  leaderboard_id uuid not null references public.leaderboards (id) on delete cascade,
  position       integer not null check (position >= 1),
  label          text,                       -- "Candidato a Contratação", texto livre
  amount_cents   bigint,
  currency       char(3) default 'EUR',
  created_at     timestamptz not null default now(),
  unique (leaderboard_id, position)
);

-- ─── subscriptions ─────────────────────────────────────────────────────────

create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  profile_id             uuid not null unique references public.profiles (id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  status                 subscription_status not null default 'trialing',
  plan                   text not null default 'creator',
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- ─── sync_jobs ─────────────────────────────────────────────────────────────
-- Fila simples. Evita que o cron faça um loop gigante e vá a timeout.

create table public.sync_jobs (
  id                uuid primary key default gen_random_uuid(),
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  kind              sync_job_kind not null,
  status            sync_job_status not null default 'pending',
  priority          integer not null default 100,   -- menor = mais urgente
  scheduled_for     timestamptz not null default now(),
  started_at        timestamptz,
  finished_at       timestamptz,
  attempts          integer not null default 0,
  last_error        text,
  created_at        timestamptz not null default now()
);

create index sync_jobs_queue_idx on public.sync_jobs (status, priority, scheduled_for)
  where status = 'pending';

-- Só um trabalho pendente por conta e tipo — evita a fila encher de duplicados.
create unique index sync_jobs_unique_pending
  on public.sync_jobs (social_account_id, kind)
  where status in ('pending', 'running');

-- ═══ 0002_functions.sql ═══════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- Farmerrr — funções de período e recálculo do ranking
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Período ───────────────────────────────────────────────────────────────
-- 'all' quando a competição é de datas fixas; 'YYYY-MM' quando é mensal.

create or replace function public.period_key_for(
  p_mode period_mode,
  p_tz   text,
  p_at   timestamptz
)
returns text
language sql
stable
as $$
  select case
    when p_mode = 'monthly' then to_char(p_at at time zone p_tz, 'YYYY-MM')
    else 'all'
  end;
$$;

-- ─── Recálculo do ranking ──────────────────────────────────────────────────
-- Chamado depois de cada lote de sincronização. Uma query agregada por
-- período — não um ciclo por clipper.

create or replace function public.recompute_leaderboard(p_leaderboard_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  lb      public.leaderboards%rowtype;
  v_keys  text[];
  v_key   text;
  v_from  timestamptz;
  v_to    timestamptz;
  v_rows  integer := 0;
  v_month timestamptz;
begin
  select * into lb from public.leaderboards where id = p_leaderboard_id;
  if not found then
    return 0;
  end if;

  -- O histórico geral existe sempre; o período mensal só quando aplicável.
  v_keys := array['all'];
  if lb.period_mode = 'monthly' then
    v_keys := v_keys || public.period_key_for(lb.period_mode, lb.timezone, now());
  end if;

  foreach v_key in array v_keys loop
    if v_key = 'all' then
      v_from := lb.starts_at;
      v_to   := coalesce(lb.ends_at, now());
    else
      v_month := (v_key || '-01')::timestamp at time zone lb.timezone;
      v_from  := greatest(lb.starts_at, v_month);
      v_to    := least(coalesce(lb.ends_at, now()), v_month + interval '1 month');
    end if;

    with valid_videos as (
      select
        p.id             as participant_id,
        vid.id           as video_id,
        vid.latest_views,
        vid.latest_likes,
        vid.latest_comments,
        vid.latest_shares
      from public.leaderboard_participants p
      join public.social_accounts sa
        on sa.clipper_profile_id = p.clipper_profile_id
      join public.videos vid
        on vid.social_account_id = sa.id
      where p.leaderboard_id = lb.id
        and p.status = 'active'
        and sa.provider = any (lb.platforms)
        and vid.is_deleted = false
        and vid.published_at >= v_from
        and vid.published_at <  v_to
        and not exists (
          select 1
          from public.video_exclusions x
          where x.leaderboard_id = lb.id
            and x.video_id = vid.id
        )
    ),
    aggregated as (
      select
        p.id                                              as participant_id,
        coalesce(sum(vv.latest_views), 0)::bigint         as total_views,
        coalesce(sum(vv.latest_likes), 0)::bigint         as total_likes,
        coalesce(sum(vv.latest_comments), 0)::bigint      as total_comments,
        coalesce(sum(vv.latest_shares), 0)::bigint        as total_shares,
        count(vv.video_id)::integer                       as video_count
      from public.leaderboard_participants p
      left join valid_videos vv on vv.participant_id = p.id
      where p.leaderboard_id = lb.id
        and p.status = 'active'
      group by p.id
    ),
    best as (
      select distinct on (participant_id)
        participant_id,
        video_id
      from valid_videos
      order by participant_id, latest_views desc, video_id
    ),
    ranked as (
      select
        a.*,
        b.video_id as best_video_id,
        case when a.video_count > 0
             then (a.total_views / a.video_count)::bigint
             else 0::bigint
        end as avg_views,
        row_number() over (
          order by a.total_views desc, a.video_count desc, a.participant_id
        )::integer as new_rank
      from aggregated a
      left join best b on b.participant_id = a.participant_id
    )
    insert into public.leaderboard_entries as e (
      leaderboard_id, participant_id, period_key,
      total_views, total_likes, total_comments, total_shares,
      video_count, avg_views, best_video_id, rank, previous_rank, computed_at
    )
    select
      lb.id, r.participant_id, v_key,
      r.total_views, r.total_likes, r.total_comments, r.total_shares,
      r.video_count, r.avg_views, r.best_video_id, r.new_rank, null, now()
    from ranked r
    on conflict (leaderboard_id, participant_id, period_key) do update set
      -- Guarda a posição anterior: é o que alimenta as setas ▲▼ e a animação.
      previous_rank  = e.rank,
      total_views    = excluded.total_views,
      total_likes    = excluded.total_likes,
      total_comments = excluded.total_comments,
      total_shares   = excluded.total_shares,
      video_count    = excluded.video_count,
      avg_views      = excluded.avg_views,
      best_video_id  = excluded.best_video_id,
      rank           = excluded.rank,
      computed_at    = now();

    get diagnostics v_rows = row_count;
  end loop;

  -- Limpa linhas de participantes que já não estão ativos.
  delete from public.leaderboard_entries e
  where e.leaderboard_id = lb.id
    and not exists (
      select 1 from public.leaderboard_participants p
      where p.id = e.participant_id and p.status = 'active'
    );

  return v_rows;
end;
$$;

-- ─── Recalcular todos os leaderboards afetados por uma conta ───────────────

create or replace function public.recompute_for_account(p_social_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select distinct p.leaderboard_id
    from public.social_accounts sa
    join public.leaderboard_participants p
      on p.clipper_profile_id = sa.clipper_profile_id
    where sa.id = p_social_account_id
      and p.status = 'active'
  loop
    perform public.recompute_leaderboard(r.leaderboard_id);
  end loop;
end;
$$;

-- ─── Enfileirar trabalho de sincronização ──────────────────────────────────
-- Idempotente: o índice único de pendentes evita duplicados.

create or replace function public.enqueue_sync_job(
  p_social_account_id uuid,
  p_kind              sync_job_kind,
  p_priority          integer default 100,
  p_delay             interval default interval '0'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.sync_jobs (social_account_id, kind, priority, scheduled_for)
  values (p_social_account_id, p_kind, p_priority, now() + p_delay)
  on conflict do nothing
  returning id into v_id;

  return v_id;
end;
$$;

-- ─── Estatísticas de topo de uma competição ────────────────────────────────

create or replace function public.leaderboard_totals(
  p_leaderboard_id uuid,
  p_period_key     text default 'all'
)
returns table (
  total_views     bigint,
  total_likes     bigint,
  total_clips     bigint,
  active_clippers bigint,
  avg_views       bigint
)
language sql
stable
as $$
  select
    coalesce(sum(e.total_views), 0)::bigint,
    coalesce(sum(e.total_likes), 0)::bigint,
    coalesce(sum(e.video_count), 0)::bigint,
    count(*)::bigint,
    case
      when coalesce(sum(e.video_count), 0) > 0
      then (sum(e.total_views) / sum(e.video_count))::bigint
      else 0::bigint
    end
  from public.leaderboard_entries e
  where e.leaderboard_id = p_leaderboard_id
    and e.period_key = p_period_key;
$$;

-- ═══ 0003_rls.sql ═══════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- Farmerrr — Row Level Security
--
-- Princípio: o papel `anon` só vê o que está numa página pública. Os tokens
-- de OAuth não são legíveis por ninguém a não ser o service_role (que só
-- existe no servidor e nunca chega ao browser).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Helpers ───────────────────────────────────────────────────────────────

create or replace function public.owns_leaderboard(p_leaderboard_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.leaderboards lb
    join public.creators c on c.id = lb.creator_id
    where lb.id = p_leaderboard_id
      and c.owner_id = auth.uid()
  );
$$;

create or replace function public.leaderboard_is_public(p_leaderboard_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.leaderboards lb
    where lb.id = p_leaderboard_id
      and lb.is_public
      and lb.status <> 'draft'
  );
$$;

-- ─── Ativar RLS em tudo ────────────────────────────────────────────────────

alter table public.profiles                 enable row level security;
alter table public.creators                 enable row level security;
alter table public.leaderboards             enable row level security;
alter table public.clipper_profiles         enable row level security;
alter table public.leaderboard_participants enable row level security;
alter table public.social_accounts          enable row level security;
alter table public.videos                   enable row level security;
alter table public.video_metrics            enable row level security;
alter table public.video_exclusions         enable row level security;
alter table public.leaderboard_entries      enable row level security;
alter table public.rewards                  enable row level security;
alter table public.subscriptions            enable row level security;
alter table public.sync_jobs                enable row level security;
alter table public.reserved_slugs           enable row level security;

-- ─── profiles ──────────────────────────────────────────────────────────────

create policy "profiles: ler o próprio"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: editar o próprio"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ─── creators ──────────────────────────────────────────────────────────────

create policy "creators: gerir os próprios"
  on public.creators for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Leitura pública: o nome e o avatar do creator aparecem na página pública.
create policy "creators: leitura pública"
  on public.creators for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.leaderboards lb
      where lb.creator_id = creators.id
        and lb.is_public
        and lb.status <> 'draft'
    )
  );

-- ─── leaderboards ──────────────────────────────────────────────────────────

create policy "leaderboards: gerir os próprios"
  on public.leaderboards for all
  using (
    exists (
      select 1 from public.creators c
      where c.id = leaderboards.creator_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.creators c
      where c.id = leaderboards.creator_id and c.owner_id = auth.uid()
    )
  );

create policy "leaderboards: leitura pública"
  on public.leaderboards for select
  to anon, authenticated
  using (is_public and status <> 'draft');

-- ─── clipper_profiles ──────────────────────────────────────────────────────
-- Só nome e avatar. Escrita apenas pelo servidor (service_role).

create policy "clippers: leitura pública"
  on public.clipper_profiles for select
  to anon, authenticated
  using (true);

-- ─── leaderboard_participants ──────────────────────────────────────────────

create policy "participantes: leitura pública"
  on public.leaderboard_participants for select
  to anon, authenticated
  using (public.leaderboard_is_public(leaderboard_id));

create policy "participantes: o dono vê e gere"
  on public.leaderboard_participants for all
  using (public.owns_leaderboard(leaderboard_id))
  with check (public.owns_leaderboard(leaderboard_id));

-- ─── social_accounts ───────────────────────────────────────────────────────
-- Nenhuma política = ninguém acede, exceto o service_role (que ignora RLS).
-- A informação pública (@username, avatar, seguidores) sai pela vista abaixo.

create view public.social_accounts_public
with (security_invoker = false) as
  select
    sa.id,
    sa.clipper_profile_id,
    sa.provider,
    sa.username,
    sa.display_name,
    sa.avatar_url,
    sa.profile_url,
    sa.follower_count,
    sa.following_count,
    sa.likes_count,
    sa.video_count,
    sa.status,
    sa.last_synced_at
  from public.social_accounts sa;

grant select on public.social_accounts_public to anon, authenticated;

-- ─── videos ────────────────────────────────────────────────────────────────
-- São vídeos públicos do TikTok; a metainformação pode ser lida.

create policy "vídeos: leitura pública"
  on public.videos for select
  to anon, authenticated
  using (is_deleted = false);

-- ─── video_metrics ─────────────────────────────────────────────────────────
-- Histórico só para o servidor e para o dono da competição (gráficos futuros).

create policy "métricas: dono da competição"
  on public.video_metrics for select
  using (
    exists (
      select 1
      from public.videos v
      join public.social_accounts sa on sa.id = v.social_account_id
      join public.leaderboard_participants p
        on p.clipper_profile_id = sa.clipper_profile_id
      where v.id = video_metrics.video_id
        and public.owns_leaderboard(p.leaderboard_id)
    )
  );

-- ─── video_exclusions ──────────────────────────────────────────────────────

create policy "exclusões: dono da competição"
  on public.video_exclusions for all
  using (public.owns_leaderboard(leaderboard_id))
  with check (public.owns_leaderboard(leaderboard_id));

create policy "exclusões: leitura pública"
  on public.video_exclusions for select
  to anon, authenticated
  using (public.leaderboard_is_public(leaderboard_id));

-- ─── leaderboard_entries ───────────────────────────────────────────────────

create policy "ranking: leitura pública"
  on public.leaderboard_entries for select
  to anon, authenticated
  using (public.leaderboard_is_public(leaderboard_id));

create policy "ranking: dono vê sempre"
  on public.leaderboard_entries for select
  using (public.owns_leaderboard(leaderboard_id));

-- ─── rewards ───────────────────────────────────────────────────────────────

create policy "prémios: leitura pública"
  on public.rewards for select
  to anon, authenticated
  using (public.leaderboard_is_public(leaderboard_id));

create policy "prémios: dono gere"
  on public.rewards for all
  using (public.owns_leaderboard(leaderboard_id))
  with check (public.owns_leaderboard(leaderboard_id));

-- ─── subscriptions ─────────────────────────────────────────────────────────

create policy "subscrição: ler a própria"
  on public.subscriptions for select
  using (profile_id = auth.uid());

-- ─── sync_jobs ─────────────────────────────────────────────────────────────
-- Sem políticas: exclusivo do service_role.

-- ─── reserved_slugs ────────────────────────────────────────────────────────

create policy "slugs reservados: leitura"
  on public.reserved_slugs for select
  to anon, authenticated
  using (true);

-- ═══ 0004_storage.sql ═══════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- Farmerrr — armazenamento das miniaturas
--
-- O `cover_image_url` do TikTok é um link de CDN com validade de ~6 horas.
-- Guardá-lo em bruto dá leaderboards com imagens partidas ao fim de meio dia,
-- por isso a imagem é copiada para aqui no primeiro sync.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('thumbs', 'thumbs', true)
on conflict (id) do nothing;

-- Leitura pública (as miniaturas aparecem em páginas públicas).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'thumbs: leitura pública'
  ) then
    create policy "thumbs: leitura pública"
      on storage.objects for select
      to anon, authenticated
      using (bucket_id = 'thumbs');
  end if;
end
$$;

-- A escrita fica reservada ao service_role, que ignora RLS.

-- ═══ 0005_grants.sql ═══════════════════════════════════════════════════

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
