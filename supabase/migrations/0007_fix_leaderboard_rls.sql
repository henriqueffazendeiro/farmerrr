-- Break the creators -> leaderboards -> creators policy recursion.
-- Ownership is still checked against the authenticated user's ID.
begin;

create or replace function public.owns_creator(p_creator_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.creators c
    where c.id = p_creator_id and c.owner_id = auth.uid()
  );
$$;

revoke all on function public.owns_creator(uuid) from public;
grant execute on function public.owns_creator(uuid) to anon, authenticated, service_role;

alter policy "leaderboards: gerir os próprios"
  on public.leaderboards
  using (public.owns_creator(creator_id))
  with check (public.owns_creator(creator_id));

commit;
