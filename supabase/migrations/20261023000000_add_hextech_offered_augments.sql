-- Track which Hextech augment choices were presented in each run.
-- Existing runs keep NULL because their offered choices cannot be reconstructed.
ALTER TABLE public.merge_hextech_scores
  ADD COLUMN IF NOT EXISTS offered_augments jsonb;

ALTER TABLE public.merge_hextech_scores
  DROP CONSTRAINT IF EXISTS merge_hextech_scores_offered_augments_array_check;

ALTER TABLE public.merge_hextech_scores
  ADD CONSTRAINT merge_hextech_scores_offered_augments_array_check
  CHECK (
    offered_augments IS NULL
    OR jsonb_typeof(offered_augments) = 'array'
  );
