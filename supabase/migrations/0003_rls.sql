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
