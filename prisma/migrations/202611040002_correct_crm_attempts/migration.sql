-- Phase 5 Slice 2. "attempts" used to count both initial classification and
-- CRM attempt(s). It now exclusively counts attempted CRM writes.
-- Every previously processed run has exactly one classification increment.
-- Preserve 0 for queued runs and avoid invalid negative values.
UPDATE "DemoExecution"
SET "attempts" = GREATEST("attempts" - 1, 0)
WHERE "attempts" > 0;
