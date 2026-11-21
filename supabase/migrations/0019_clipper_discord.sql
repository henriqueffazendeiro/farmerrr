-- Discord do clipper, preenchido nas definições dele. O streamer vê-o na lista de vencedores
-- (para combinar o pagamento manual dos prémios).
alter table public.clipper_profiles
  add column if not exists discord text check (discord is null or length(discord) between 2 and 40);
