-- Applied to Supabase project owqerwkisyjiiskmecoc on 2026-10-22.
-- NOT VALID avoids failing the migration on any legacy rows, while enforcing
-- these checks for newly inserted or updated rows. Audit legacy rows separately
-- before validating constraints.

alter table public.game_scores
  add constraint game_scores_score_upper_check check (score <= 100000) not valid;
alter table public.game_scores
  add constraint game_scores_elapsed_upper_check check (elapsed_ms is null or elapsed_ms <= 3600000) not valid;
alter table public.whack_scores
  add constraint whack_scores_score_upper_check check (score <= 1000) not valid;
alter table public.whack_scores
  add constraint whack_scores_combo_upper_check check (best_combo <= 1000) not valid;
alter table public.whack_scores
  add constraint whack_scores_hits_upper_check check (hits <= 1000 and bomb_hits <= 1000) not valid;
