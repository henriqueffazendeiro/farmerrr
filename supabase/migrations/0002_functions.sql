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
