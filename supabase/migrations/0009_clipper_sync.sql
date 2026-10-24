begin;
alter table public.social_accounts
  add column last_discovered_at timestamptz,
  add column sync_locked_until timestamptz not null default '-infinity';
commit;
