import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const CursorSchema = z.object({
  version: z.literal(1),
  workspaceId: z.uuid(),
  status: z.string().nullable(),
  at: z.iso.datetime(),
  id: z.uuid()
}).strict();
export type HistoryCursor = z.infer<typeof CursorSchema>;
const sign = (payload: string, key: Buffer) =>
  createHmac("sha256", key).update("acr:history:v1:" + payload).digest();

/** Signed, immutable keyset cursor. A cursor cannot be replayed across sessions
 * or silently switch the server-side status filter. */
export function encodeHistoryCursor(data: HistoryCursor, key: Buffer): string {
  const input = CursorSchema.parse(data);
  const payload = Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
  return payload + "." + sign(payload, key).toString("base64url");
}
export function decodeHistoryCursor(
  value: string, workspaceId: string, status: string | null, key: Buffer
): HistoryCursor {
  if (!value || value.length > 512 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value))
    throw new Error("INVALID_RUN_CURSOR");
  const [payload, encodedMac] = value.split(".");
  const actual = Buffer.from(encodedMac!, "base64url");
  const expected = sign(payload!, key);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("INVALID_RUN_CURSOR");
  let data: unknown;
  try { data = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8")); }
  catch { throw new Error("INVALID_RUN_CURSOR"); }
  const parsed = CursorSchema.safeParse(data);
  if (!parsed.success || parsed.data.workspaceId !== workspaceId || parsed.data.status !== status)
    throw new Error("INVALID_RUN_CURSOR");
  return parsed.data;
}
