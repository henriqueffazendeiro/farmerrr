-- Enforce one leaderboard per creator, including concurrent creation requests.
-- Existing duplicates must be reviewed before applying; no data is deleted.
create unique index leaderboards_one_per_creator
  on public.leaderboards (creator_id);
