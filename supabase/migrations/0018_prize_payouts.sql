-- Pagamento de prémios aos clippers (Stripe Connect Express, "separate charges and transfers").
--
--   1. O streamer paga exatamente o valor dos prémios de um período fechado no Stripe Checkout
--      → prize_payments (um pago por leaderboard e período). fee_cents = os 5% que ficam para a plataforma.
--   2. Nesse momento fica guardada a parte de cada clipper, pela posição final no ranking → prize_payouts:
--      amount_cents = o que o clipper recebe (prémio − 5%), fee_cents = a taxa tirada a esse prémio.
--   3. O clipper carrega em "Sacar": na primeira vez liga uma conta Stripe Express (clipper_payout_accounts);
--      depois o dinheiro é transferido para essa conta e o Stripe envia-o para o IBAN dele.
--
-- Só o servidor (service role) lê e escreve estas tabelas.

begin;

create table if not exists public.clipper_payout_accounts (
  clipper_profile_id uuid primary key references public.clipper_profiles (id) on delete cascade,
  stripe_account_id  text not null unique,
  transfers_enabled  boolean not null default false,  -- capability "transfers" ativa: já pode receber
  details_submitted  boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.prize_payments (
  id                         uuid primary key default gen_random_uuid(),
  -- set null: um registo de dinheiro não desaparece se a página for apagada.
  leaderboard_id             uuid references public.leaderboards (id) on delete set null,
  period_key                 text not null,
  prizes_cents               bigint not null check (prizes_cents > 0),
  fee_cents                  bigint not null check (fee_cents >= 0),
  currency                   char(3) not null default 'EUR',
  status                     text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'expired')),
  -- stripe: pago no site, os clippers sacam; manual: o streamer pagou diretamente a cada clipper (sem taxa).
  method                     text not null default 'stripe' check (method in ('stripe', 'manual')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id   text unique,
  stripe_charge_id           text,
  paid_at                    timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

-- Os prémios de um período só podem ser pagos uma vez.
create unique index if not exists prize_payments_one_paid
  on public.prize_payments (leaderboard_id, period_key) where status = 'paid';
create index if not exists prize_payments_lb_idx on public.prize_payments (leaderboard_id, period_key);

create table if not exists public.prize_payouts (
  id                 uuid primary key default gen_random_uuid(),
  payment_id         uuid not null references public.prize_payments (id) on delete cascade,
  clipper_profile_id uuid references public.clipper_profiles (id) on delete set null,
  participant_id     uuid references public.leaderboard_participants (id) on delete set null,
  position           integer not null check (position >= 1),
  amount_cents       bigint not null check (amount_cents > 0),  -- líquido: o que é transferido
  fee_cents          bigint not null default 0 check (fee_cents >= 0),
  currency           char(3) not null default 'EUR',
  -- awaiting_payment → (streamer pagou) available → transferring → paid
  -- canceled: o pagamento do streamer foi reembolsado antes do saque.
  status             text not null default 'awaiting_payment'
                     check (status in ('awaiting_payment', 'available', 'transferring', 'paid', 'canceled')),
  stripe_transfer_id text unique,
  last_error         text,
  transferred_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (payment_id, position)
);

-- Para quem já tinha corrido a versão anterior desta migração.
alter table public.prize_payments add column if not exists method text not null default 'stripe' check (method in ('stripe', 'manual'));
alter table public.prize_payouts add column if not exists fee_cents bigint not null default 0 check (fee_cents >= 0);

create index if not exists prize_payouts_clipper_idx on public.prize_payouts (clipper_profile_id, status);

create trigger clipper_payout_accounts_touch before update on public.clipper_payout_accounts
  for each row execute function public.touch_updated_at();
create trigger prize_payments_touch before update on public.prize_payments
  for each row execute function public.touch_updated_at();
create trigger prize_payouts_touch before update on public.prize_payouts
  for each row execute function public.touch_updated_at();

alter table public.clipper_payout_accounts enable row level security;
alter table public.prize_payments          enable row level security;
alter table public.prize_payouts           enable row level security;
revoke all on public.clipper_payout_accounts, public.prize_payments, public.prize_payouts from anon, authenticated;
grant all on public.clipper_payout_accounts, public.prize_payments, public.prize_payouts to service_role;

commit;
