-- Immutable monthly results. Only the service role can generate or attach a video.
create table public.monthly_recaps (
  id uuid primary key default gen_random_uuid(),
  leaderboard_id uuid not null references public.leaderboards(id) on delete cascade,
  period_key text not null check (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  winner_video_path text,
  unique (leaderboard_id, period_key)
);
alter table public.monthly_recaps enable row level security;
create policy recap_read on public.monthly_recaps for select using (
  exists (select 1 from public.leaderboards l where l.id = leaderboard_id and l.is_public and l.status <> 'draft')
);
grant select on public.monthly_recaps to anon, authenticated;
grant all on public.monthly_recaps to service_role;

-- Runs hourly; unique key makes retries safe. Months are closed in the board's timezone.
-- Counts are the latest synced metrics at generation, frozen from then on.
create or replace function public.generate_monthly_recaps()
returns integer language plpgsql security definer set search_path = public as $$
declare lb record; m timestamp; month_end timestamptz; result_count integer := 0; inserted integer;
begin
  for lb in select * from public.leaderboards where period_mode = 'monthly' and status <> 'draft' loop
    for m in select generate_series(
      date_trunc('month', lb.starts_at at time zone lb.timezone),
      date_trunc('month', least(now(), coalesce(lb.ends_at, now())) at time zone lb.timezone), interval '1 month') loop
      month_end := (m + interval '1 month') at time zone lb.timezone;
      if month_end > now() then continue; end if;
      if exists(select 1 from public.monthly_recaps where leaderboard_id = lb.id and period_key = to_char(m, 'YYYY-MM')) then continue; end if;
      insert into public.monthly_recaps(leaderboard_id, period_key, snapshot)
      select lb.id, to_char(m, 'YYYY-MM'), jsonb_build_object('videos', coalesce(jsonb_agg(jsonb_build_object(
        'id', v.id, 'participantId', p.id, 'name', cp.display_name, 'avatar', cp.avatar_url,
        'thumbnail', v.thumbnail_url, 'caption', v.caption, 'url', v.url,
        'views', v.latest_views, 'likes', v.latest_likes, 'shares', v.latest_shares, 'comments', v.latest_comments
      ) order by v.id), '[]'::jsonb))
      from public.leaderboard_participants p
      join public.clipper_profiles cp on cp.id = p.clipper_profile_id
      join public.social_accounts sa on sa.clipper_profile_id = cp.id
      join public.videos v on v.social_account_id = sa.id
      where p.leaderboard_id = lb.id and p.status = 'active' and sa.provider = any(lb.platforms)
        and not v.is_deleted
        and v.published_at >= greatest(lb.starts_at, m at time zone lb.timezone)
        and v.published_at < least(month_end, coalesce(lb.ends_at, month_end))
        and not exists(select 1 from public.video_exclusions x where x.leaderboard_id = lb.id and x.video_id = v.id)
      on conflict (leaderboard_id, period_key) do nothing;
      get diagnostics inserted = row_count;
      result_count := result_count + inserted;
    end loop;
  end loop;
  return result_count;
end;
$$;
revoke all on function public.generate_monthly_recaps() from public, anon, authenticated;
grant execute on function public.generate_monthly_recaps() to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('recap-videos', 'recap-videos', false, 4194304, array['video/mp4'])
on conflict (id) do nothing;
