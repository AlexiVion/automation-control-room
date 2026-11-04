import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signWebhook, verifyWebhook } from "../src/webhook.js";

const secret = randomBytes(32), wrongSecret = randomBytes(32);
const body = Buffer.from('{"lead":{"id":"demo_01","text":"hello"}}');
const now = 1793797200; // arbitrary fixed UNIX seconds, independent of CI clock
const timestamp = String(now);
const eventId = "evt_abc_0001";
const correct = () => signWebhook(secret, timestamp, eventId, body);

describe("HMAC webhook verification", () => {
  it("accepts valid signed raw-body payload", () => {
    expect(verifyWebhook(secret, { timestamp, eventId, signature: correct() }, body, now))
      .toEqual({ok: true, eventId, timestampSeconds: now});
  });
  it("rejects tampered raw body bytes even when parsed JSON could be equivalent", () => {
    const changed = Buffer.from('{ "lead": {"id":"demo_01","text":"hello"} }');
    expect(verifyWebhook(secret, {timestamp,eventId,signature:correct()},changed,now))
      .toMatchObject({ok:false,reason:"signature_invalid"});
  });
  it("binds signature to eventId and timestamp", () => {
    expect(verifyWebhook(secret, {timestamp,eventId:"evt_wrong",signature:correct()},body,now).ok).toBe(false);
    const future=String(now+10);
    expect(verifyWebhook(secret, {timestamp:future,eventId,signature:correct()},body,now).ok).toBe(false);
  });
  it("rejects wrong key, malformed digests, missing signature and short secrets", () => {
    expect(verifyWebhook(wrongSecret,{timestamp,eventId,signature:correct()},body,now).ok).toBe(false);
    expect(verifyWebhook(secret,{timestamp,eventId,signature:"sha256=BAD"},body,now))
      .toMatchObject({ok:false,reason:"malformed"});
    expect(verifyWebhook(secret,{timestamp,eventId,signature:""},body,now).ok).toBe(false);
    expect(verifyWebhook(Buffer.from("short"),{timestamp,eventId,signature:correct()},body,now).ok).toBe(false);
  });
  it("rejects stale and excessively future-dated signatures; accepts boundaries", () => {
    const old=String(now-301), future=String(now+301);
    expect(verifyWebhook(secret,{timestamp:old,eventId,signature:signWebhook(secret,old,eventId,body)},body,now))
      .toMatchObject({ok:false,reason:"expired"});
    expect(verifyWebhook(secret,{timestamp:future,eventId,signature:signWebhook(secret,future,eventId,body)},body,now))
      .toMatchObject({ok:false,reason:"expired"});
    const edge=String(now-300);
    expect(verifyWebhook(secret,{timestamp:edge,eventId,signature:signWebhook(secret,edge,eventId,body)},body,now).ok).toBe(true);
  });
  it("rejects oversized bodies, invalid IDs and unsafe timestamps", () => {
    const tooLarge=Buffer.alloc(65537);
    expect(verifyWebhook(secret,{timestamp,eventId,signature:correct()},tooLarge,now).ok).toBe(false);
    expect(verifyWebhook(secret,{timestamp,eventId:"evt\nX",signature:correct()},body,now).ok).toBe(false);
    expect(verifyWebhook(secret,{timestamp:"123",eventId,signature:correct()},body,now).ok).toBe(false);
  });
});
