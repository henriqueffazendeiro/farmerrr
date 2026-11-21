-- Server-only rate budget for paid public-profile lookups. No client access.
create table public.public_tracking_limits (
  key text primary key,
  attempts integer not null default 1,
  expires_at timestamptz not null default (now() + interval '1 hour')
);
alter table public.public_tracking_limits enable row level security;
revoke all on public.public_tracking_limits from anon, authenticated;

create or replace function public.consume_public_tracking_attempt(p_key text)
returns boolean language plpgsql security definer set search_path = public as $$
declare allowed boolean;
begin
  insert into public_tracking_limits as budget (key) values (p_key)
  on conflict (key) do update set
    attempts = case when budget.expires_at <= now() then 1 else budget.attempts + 1 end,
    expires_at = case when budget.expires_at <= now() then now() + interval '1 hour' else budget.expires_at end
  where budget.expires_at <= now() or budget.attempts < 10
  returning true into allowed;
  return coalesce(allowed, false);
end;
$$;
revoke all on function public.consume_public_tracking_attempt(text) from public, anon, authenticated;
grant execute on function public.consume_public_tracking_attempt(text) to service_role;
