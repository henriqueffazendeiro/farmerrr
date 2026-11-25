-- Banir clippers a partir da página pública: motivo e data de fim do ban.
-- O ban usa o estado 'disqualified' que já existia (fora do ranking e dos prémios, sem poder voltar a entrar).
-- banned_until vazio com o estado 'disqualified' = ban por tempo indeterminado.

alter table public.leaderboard_participants
  add column if not exists ban_reason text check (ban_reason is null or char_length(ban_reason) <= 500),
  add column if not exists banned_until timestamptz;
