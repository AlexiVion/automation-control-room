import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const MAX_IDLE_MS = 30 * 60_000;
const MAX_ABSOLUTE_MS = 24 * 60 * 60_000;
const TOKEN_BYTES = 32;
const SESSION_PATTERN = /^[a-f0-9]{64}$/;
const CSRF_PATTERN = /^[a-f0-9]{64}$/;

export type GuestSessionRecord = {
  workspaceId: string;
  sessionId: string;
  tokenHash: string;
  createdAtMs: number;
  lastSeenAtMs: number;
  absoluteExpiresAtMs: number;
};

export function createGuestSession(nowMs: number, workspaceId: string, sessionId: string) {
  if (!Number.isSafeInteger(nowMs) || !workspaceId || !sessionId) throw new Error("INVALID_SESSION");
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = hashToken(token);
  return {
    token,
    record: {
      workspaceId, sessionId, tokenHash, createdAtMs: nowMs,
      lastSeenAtMs: nowMs, absoluteExpiresAtMs: nowMs + MAX_ABSOLUTE_MS
    } satisfies GuestSessionRecord
  };
}
export function hashToken(token: string): string {
  if (!SESSION_PATTERN.test(token)) throw new Error("INVALID_SESSION_TOKEN");
  return createHash("sha256").update(token, "utf8").digest("hex");
}
function constantEqualHex(expectedHex: string, providedHex: string): boolean {
  if (!CSRF_PATTERN.test(expectedHex) || !CSRF_PATTERN.test(providedHex)) return false;
  const left = Buffer.from(expectedHex, "hex");
  const right = Buffer.from(providedHex, "hex");
  return timingSafeEqual(left, right);
}
export function validateGuestSession(token: string, stored: GuestSessionRecord, nowMs: number): boolean {
  if (!Number.isSafeInteger(nowMs) || !Number.isSafeInteger(stored.absoluteExpiresAtMs) ||
      nowMs < stored.createdAtMs || nowMs >= stored.absoluteExpiresAtMs ||
      nowMs - stored.lastSeenAtMs >= MAX_IDLE_MS || nowMs < stored.lastSeenAtMs) return false;
  if (!SESSION_PATTERN.test(token)) return false;
  return constantEqualHex(hashToken(token), stored.tokenHash);
}
/** API must update lastSeenAtMs using DB CAS and enforce TTL on every read, not only cleanup. */
export function csrfToken(secret: Uint8Array, record: GuestSessionRecord): string {
  if (secret.byteLength < 32) throw new Error("INVALID_CSRF_KEY");
  return createHmac("sha256", secret)
    .update("acr.csrf.v1\n" + record.sessionId + "\n" + record.tokenHash)
    .digest("hex");
}
export function verifyCsrfToken(
  secret: Uint8Array, record: GuestSessionRecord, presented: string
): boolean {
  if (!CSRF_PATTERN.test(presented)) return false;
  return constantEqualHex(csrfToken(secret, record), presented);
}
export function verifyMutationOrigin(origin: string | undefined, allowedOrigins: readonly string[]): boolean {
  if (!origin || origin === "null") return false;
  try {
    const parsed = new URL(origin);
    if (parsed.username || parsed.password || parsed.pathname !== "/" ||
        parsed.search || parsed.hash || !["http:", "https:"].includes(parsed.protocol)) return false;
    if (parsed.protocol === "http:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) return false;
    return allowedOrigins.some(candidate => {
      try { return new URL(candidate).origin === parsed.origin && candidate === new URL(candidate).origin; }
      catch { return false; }
    });
  } catch { return false; }
}
export function guestCookie(token: string, secure = true): string {
  if (!SESSION_PATTERN.test(token)) throw new Error("INVALID_SESSION_TOKEN");
  return "acr_demo_session=" + token + "; Path=/; HttpOnly; SameSite=Lax" +
    (secure ? "; Secure" : "") + "; Max-Age=86400";
}
