import { z } from "zod";

export const RunStatusSchema = z.enum([
  "queued", "running", "waiting_approval", "retrying",
  "needs_review", "completed", "failed", "cancelled"
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const StepStatusSchema = z.enum([
  "pending", "ready", "running", "waiting_approval", "retrying",
  "succeeded", "failed", "skipped", "cancelled", "needs_review"
]);
export type StepStatus = z.infer<typeof StepStatusSchema>;
