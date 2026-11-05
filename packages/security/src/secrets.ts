import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type SecretEnvelope = {
  version: 1;
  keyId: string;
  nonce: string;
  ciphertext: string;
  tag: string;
};
function aad(workspaceId: string, credentialId: string): Buffer {
  if (!workspaceId || !credentialId) throw new Error("INVALID_SECRET_SCOPE");
  return Buffer.from("acr.secret.v1\n" + workspaceId + "\n" + credentialId, "utf8");
}
export function encryptSecret(
  plaintext: string, workspaceId: string, credentialId: string,
  keyId: string, encryptionKey: Uint8Array
): SecretEnvelope {
  if (encryptionKey.byteLength !== 32 || !keyId || plaintext.length > 8192) throw new Error("INVALID_SECRET_KEY");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, nonce);
  cipher.setAAD(aad(workspaceId, credentialId));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { version: 1, keyId, nonce: nonce.toString("base64"),
    ciphertext: ciphertext.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}
export function decryptSecret(
  envelope: SecretEnvelope, workspaceId: string, credentialId: string,
  getKey: (keyId: string) => Uint8Array | undefined
): string {
  if (envelope.version !== 1) throw new Error("UNSUPPORTED_SECRET_VERSION");
  const key = getKey(envelope.keyId);
  if (!key || key.byteLength !== 32) throw new Error("SECRET_KEY_UNAVAILABLE");
  const nonce = Buffer.from(envelope.nonce, "base64");
  const tag = Buffer.from(envelope.tag, "base64");
  const ciphertext = Buffer.from(envelope.ciphertext, "base64");
  if (nonce.byteLength !== 12 || tag.byteLength !== 16 || ciphertext.byteLength > 8192)
    throw new Error("INVALID_SECRET_ENVELOPE");
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(aad(workspaceId, credentialId));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
export function rewrapSecret(
  envelope: SecretEnvelope, workspaceId: string, credentialId: string,
  getKey: (keyId: string) => Uint8Array | undefined,
  nextKeyId: string, nextKey: Uint8Array
): SecretEnvelope {
  const plaintext = decryptSecret(envelope, workspaceId, credentialId, getKey);
  return encryptSecret(plaintext, workspaceId, credentialId, nextKeyId, nextKey);
}
/** Prefer allowlisted audit fields. This is an additional last-resort structured scrub. */
export function scrubLogData(input: unknown, depth = 0): unknown {
  if (depth > 5) return "[TRUNCATED]";
  if (typeof input === "string") {
    if (input.length > 512) return "[TRUNCATED]";
    return input.replace(/Bearer\s+[^\s"'<>]+/gi, "Bearer [REDACTED]")
      .replace(/(sk-|api_key=)[A-Za-z0-9_.-]{8,}/gi, "[REDACTED]");
  }
  if (Array.isArray(input)) return input.slice(0, 25).map(value => scrubLogData(value, depth + 1));
  if (input && typeof input === "object") {
    const sanitized: Record<string, unknown> = Object.create(null);
    for (const [key, value] of Object.entries(input).slice(0, 40)) {
      sanitized[key] = /secret|token|password|authorization|cookie|credential|private.?key|api.?key|session/i.test(key)
        ? "[REDACTED]" : scrubLogData(value, depth + 1);
    }
    return sanitized;
  }
  return input;
}
