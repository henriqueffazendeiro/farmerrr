-- Programa farmerrr no PC do streamer: faz a recolha pública (lives) e envia os
-- resultados ao site. Só o servidor (service_role) acede a estas tabelas.
begin;

create table public.agent_devices (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  token_hash text not null unique,
  name text not null default 'PC' check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
create index agent_devices_creator_idx on public.agent_devices (creator_id);
alter table public.agent_devices enable row level security;
revoke all on public.agent_devices from anon, authenticated;
grant all on public.agent_devices to service_role;

-- Emparelhamento tipo "código na TV": o programa pede um código, o streamer
-- autoriza no browser (com sessão iniciada) e o programa recebe o token.
create table public.agent_pairings (
  code text primary key check (code ~ '^[A-Z2-9]{4}-[A-Z2-9]{4}$'),
  poll_secret_hash text not null,
  creator_id uuid references public.creators(id) on delete cascade,
  device_name text not null default 'PC' check (char_length(device_name) between 1 and 60),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.agent_pairings enable row level security;
revoke all on public.agent_pairings from anon, authenticated;
grant all on public.agent_pairings to service_role;

commit;
