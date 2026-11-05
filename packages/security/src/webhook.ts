import { createHmac, timingSafeEqual } from "node:crypto";

export const WEBHOOK_WINDOW_SECONDS = 300;
const EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TS = /^[0-9]{10,11}$/;
const SIGNATURE = /^sha256=([a-f0-9]{64})$/;

export type WebhookHeaders = {
  timestamp: string;
  eventId: string;
  signature: string;
};
export type WebhookValidation =
  | { ok: true; eventId: string; timestampSeconds: number }
  | { ok: false; reason: "malformed" | "expired" | "signature_invalid" };

function canonical(timestamp: string, eventId: string, rawBody: Uint8Array): Buffer {
  return Buffer.concat([
    Buffer.from("acr.webhook.v1\n" + timestamp + "\n" + eventId + "\n", "utf8"),
    Buffer.from(rawBody)
  ]);
}
export function signWebhook(
  secret: Uint8Array, timestamp: string, eventId: string, rawBody: Uint8Array
): string {
  if (secret.byteLength < 32 || !TS.test(timestamp) || !EVENT_ID.test(eventId) ||
      rawBody.byteLength > 64 * 1024) throw new Error("INVALID_WEBHOOK_INPUT");
  return "sha256=" + createHmac("sha256", secret)
    .update(canonical(timestamp, eventId, rawBody)).digest("hex");
}

/**
 * This only checks authenticity/freshness, NOT event-ID deduplication.
 * The API must persist (workspaceId, sourceId, eventId) with a database UNIQUE
 * constraint in the same transaction that enqueues the execution.
 */
export function verifyWebhook(
  secret: Uint8Array,
  headers: WebhookHeaders,
  rawBody: Uint8Array,
  nowSeconds: number
): WebhookValidation {
  if (secret.byteLength < 32 || !TS.test(headers.timestamp) ||
      !EVENT_ID.test(headers.eventId) || !SIGNATURE.test(headers.signature) ||
      rawBody.byteLength > 64 * 1024 || !Number.isSafeInteger(nowSeconds)) {
    return { ok: false, reason: "malformed" };
  }
  const seconds = Number(headers.timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(nowSeconds - seconds) > WEBHOOK_WINDOW_SECONDS) {
    return { ok: false, reason: "expired" };
  }
  const calculated = signWebhook(secret, headers.timestamp, headers.eventId, rawBody);
  const suppliedBytes = Buffer.from(headers.signature.slice(7), "hex");
  const expectedBytes = Buffer.from(calculated.slice(7), "hex");
  if (suppliedBytes.byteLength !== expectedBytes.byteLength ||
      !timingSafeEqual(suppliedBytes, expectedBytes)) {
    return { ok: false, reason: "signature_invalid" };
  }
  return { ok: true, eventId: headers.eventId, timestampSeconds: seconds };
}
