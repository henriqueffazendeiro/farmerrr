begin;

-- OAuth credentials are server-only, including encrypted tokens.
create table public.stream_connections (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  platform text not null check (platform in ('twitch', 'youtube', 'kick')),
  channel_id text not null,
  channel_name text not null,
  channel_url text not null,
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at timestamptz not null,
  status text not null default 'connected' check (status in ('connected', 'needs_reauth')),
  last_checked_at timestamptz,
  last_error text,
  sync_locked_until timestamptz not null default '-infinity',
  created_at timestamptz not null default now(),
  unique (creator_id, platform),
  unique (platform, channel_id)
);
alter table public.stream_connections enable row level security;
revoke all on public.stream_connections from anon, authenticated;
grant all on public.stream_connections to service_role;

create table public.creator_lives (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  platform text not null check (platform in ('twitch', 'youtube', 'kick')),
  channel_id text not null,
  external_id text not null,
  title text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  last_seen_at timestamptz not null default now(),
  is_live boolean not null default true,
  thumbnail_url text,
  watch_url text not null,
  created_at timestamptz not null default now(),
  unique (creator_id, platform, channel_id, external_id)
);
create index creator_lives_calendar on public.creator_lives (creator_id, started_at desc);
alter table public.creator_lives enable row level security;
create policy "lives: visible creator" on public.creator_lives for select to anon, authenticated
  using (public.owns_creator(creator_id) or exists (
    select 1 from public.leaderboards l
    where l.creator_id = creator_lives.creator_id and l.is_public and l.status <> 'draft'
  ));
grant select on public.creator_lives to anon, authenticated;
grant all on public.creator_lives to service_role;
commit;
