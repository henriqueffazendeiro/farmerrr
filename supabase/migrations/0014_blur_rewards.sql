alter table public.leaderboards
  add column if not exists blur_rewards boolean not null default false;
