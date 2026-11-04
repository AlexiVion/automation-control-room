import { describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { encodeHistoryCursor, decodeHistoryCursor } from "../src/history-cursor.js";
const key = randomBytes(32);
const workspaceId = randomUUID();
const row = { version: 1 as const, workspaceId, status: null,
  at: "2026-11-04T16:00:00.000Z", id: randomUUID() };
describe("signed history pagination cursor", () => {
  it("round trips an authenticated, scoped cursor", () => {
    const token = encodeHistoryCursor(row, key);
    expect(decodeHistoryCursor(token, workspaceId, null, key)).toEqual(row);
  });
  it("rejects changed workspace and changed status filter", () => {
    const token = encodeHistoryCursor(row, key);
    expect(() => decodeHistoryCursor(token, randomUUID(), null, key)).toThrow("INVALID_RUN_CURSOR");
    expect(() => decodeHistoryCursor(token, workspaceId, "completed", key)).toThrow("INVALID_RUN_CURSOR");
  });
  it("rejects tampered, truncated, oversized and forged signatures", () => {
    const token = encodeHistoryCursor(row, key);
    expect(() => decodeHistoryCursor(token.replace(/^./, "z"), workspaceId, null, key)).toThrow();
    expect(() => decodeHistoryCursor(token.slice(0, -3), workspaceId, null, key)).toThrow();
    expect(() => decodeHistoryCursor("x".repeat(513), workspaceId, null, key)).toThrow();
    expect(() => decodeHistoryCursor(token, workspaceId, null, randomBytes(32))).toThrow();
  });
  it("rejects malformed UUID and timestamp before signing", () => {
    expect(() => encodeHistoryCursor({...row, id: "bad"}, key)).toThrow();
    expect(() => encodeHistoryCursor({...row, at: "yesterday"}, key)).toThrow();
  });
});
