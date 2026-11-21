-- Competições mensais com datas definidas pelo streamer (ex.: do dia 1 ao dia 21).
--
-- O ranking do mês conta só o que foi publicado entre starts_at e ends_at. Quando acaba, a competição fica em pausa
-- até ser entregue o prémio E chegar o dia de início seguinte; aí as duas datas avançam um mês (os mesmos dias), a
-- não ser que o streamer as mude. A chave do período é o mês em que a competição acaba.
-- history_starts_at guarda o primeiro início, para o histórico geral não encolher quando as datas avançam.
-- Mensais sem data de fim continuam por meses do calendário.

alter table public.leaderboards add column if not exists history_starts_at timestamptz;

-- A chave do período corrente (tem de dar o mesmo que currentPeriodKey em src/lib/period.ts).
create or replace function public.current_period_key(lb public.leaderboards)
returns text
language sql
stable
as $$
  select case
    when lb.period_mode <> 'monthly' then 'all'
    when lb.ends_at is not null then to_char((lb.ends_at - interval '1 millisecond') at time zone lb.timezone, 'YYYY-MM')
    else public.period_key_for(lb.period_mode, lb.timezone, now())
  end;
$$;

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
    v_keys := v_keys || public.current_period_key(lb);
  end if;

  foreach v_key in array v_keys loop
    if v_key = 'all' then
      -- Histórico geral: desde o primeiro início (as datas mensais vão avançando).
      v_from := coalesce(lb.history_starts_at, lb.starts_at);
      v_to   := case when lb.period_mode = 'monthly' and lb.ends_at is not null then now() else coalesce(lb.ends_at, now()) end;
    elsif lb.ends_at is not null then
      -- Mensal com datas: só o que foi publicado entre o início e o fim definidos pelo streamer.
      v_from := lb.starts_at;
      v_to   := lb.ends_at;
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


revoke all on function public.current_period_key(public.leaderboards) from public, anon, authenticated;
grant execute on function public.current_period_key(public.leaderboards) to service_role;
revoke all on function public.recompute_leaderboard(uuid) from public, anon, authenticated;
grant execute on function public.recompute_leaderboard(uuid) to service_role;

notify pgrst, 'reload schema';
