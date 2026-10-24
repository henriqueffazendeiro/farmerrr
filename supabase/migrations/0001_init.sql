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
