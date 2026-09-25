-- ============================================================
-- Migration 0007: performance index for the reconciler pass
-- ============================================================
create index if not exists idx_attempts_reconcile on public.attempts(submitted_at)
  where status in ('submitted', 'grading');
