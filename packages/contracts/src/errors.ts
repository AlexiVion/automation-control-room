import { z } from "zod";

export const ContractErrorCodeSchema = z.enum([
  "SCHEMA_INVALID", "INVALID_GRAPH", "INVALID_TRIGGER", "DUPLICATE_ID",
  "EDGE_MISSING_NODE", "INVALID_DEGREE", "INVALID_BRANCH", "CYCLE",
  "UNREACHABLE", "DEPTH_EXCEEDED", "LIMIT_EXCEEDED", "MISSING_FINISH",
  "APPROVAL_REQUIRED", "FORBIDDEN_CONNECTOR", "UNSAFE_BINDING",
  "INVALID_BINDING_SOURCE", "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND",
  "CONFLICT", "IDEMPOTENCY_CONFLICT", "APPROVAL_EXPIRED", "RATE_LIMITED",
  "TIMEOUT", "PROVIDER_UNCERTAIN", "NEEDS_REVIEW", "INTERNAL_ERROR"
]);
export type ContractErrorCode = z.infer<typeof ContractErrorCodeSchema>;
export const ContractIssueSchema = z.strictObject({
  code: ContractErrorCodeSchema,
  path: z.string().max(300),
  message: z.string().min(1).max(800)
});
export type ContractIssue = z.infer<typeof ContractIssueSchema>;
export const ApiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: ContractErrorCodeSchema,
    message: z.string().min(1).max(800),
    traceId: z.string().min(1).max(128),
    retryable: z.boolean(),
    issues: z.array(ContractIssueSchema).max(100).optional()
  })
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
