import { z } from "zod";

export const ConnectorManifestSchema = z.strictObject({
  key: z.string().regex(/^[a-z][a-z0-9._-]{0,63}$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  effect: z.enum(["none", "read", "write"]),
  requiredGrants: z.array(z.string().min(1).max(100)).max(12),
  timeoutMs: z.number().int().min(100).max(10000),
  idempotency: z.enum(["transactional", "provider_key", "none"]),
  network: z.enum(["none", "restricted_egress"]),
  inputSchemaId: z.string().min(1).max(100),
  outputSchemaId: z.string().min(1).max(100)
});
export type ConnectorManifest = z.infer<typeof ConnectorManifestSchema>;
export type ConnectorError =
  | { kind: "definitive"; code: string; message: string; retryable: boolean }
  | { kind: "uncertain"; code: "PROVIDER_UNCERTAIN"; message: string; retryable: false };
export type ConnectorResult<T> =
  | { ok: true; value: T; providerReference?: string }
  | { ok: false; error: ConnectorError };
export interface ScopedHttpClient {
  /** Must enforce DNS, IP and redirects + network egress allowlist, not raw fetch. */
  request(input: {
    destinationKey: string;
    method: "GET" | "POST";
    body?: unknown;
    idempotencyKey?: string;
    signal: AbortSignal;
  }): Promise<{ status: number; body: unknown; providerReference?: string }>;
}
export interface ConnectorContext {
  workspaceId: string;
  executionId: string;
  stepExecutionId: string;
  operationKey: string;
  /** Secrets are loaded in the worker after authorization, never returned to browser/AI. */
  resolveSecret(credentialRef: string): Promise<string>;
  http: ScopedHttpClient;
  signal: AbortSignal;
  recordTrace(fields: { event: string; sanitizedDetail?: string }): void;
}
export interface ConnectorPort<Input, Output> {
  manifest: ConnectorManifest;
  validateInput(input: unknown): Input;
  validateOutput(output: unknown): Output;
  execute(context: ConnectorContext, input: Input): Promise<ConnectorResult<Output>>;
}
