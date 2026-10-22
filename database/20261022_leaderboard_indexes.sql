-- Leaderboard query indexes, applied to Supabase project owqerwkisyjiiskmecoc on 2026-10-22.
-- These match the ORDER BY clauses used by lobby.js.

create index if not exists game_scores_score_rank_idx
  on public.game_scores (score desc, created_at asc, name asc);

create index if not exists game_scores_time_rank_idx
  on public.game_scores (elapsed_ms asc, created_at asc, name asc)
  where elapsed_ms is not null;
