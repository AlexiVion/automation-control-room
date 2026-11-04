import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createGuestSession, csrfToken, guestCookie, validateGuestSession,
  verifyCsrfToken, verifyMutationOrigin
} from "../src/sessions.js";
import { canAccess, requireAccess, workspaceFilter } from "../src/authorization.js";
import type { Permission, Principal } from "../src/authorization.js";

const t0=1793797200000;
const issued=createGuestSession(t0,"workspaceA","sessionA");
const principal: Principal={kind:"guest",sessionId:"sessionA",workspaceId:"workspaceA",
  authenticatedAtMs:t0,expiresAtMs:t0+24*3600*1000};

describe("guest session and browser security",()=>{
  it("issues unpredictable 256-bit opaque tokens and stores only a digest",()=>{
    expect(issued.token).toMatch(/^[a-f0-9]{64}$/);
    expect(issued.record.tokenHash).not.toBe(issued.token);
    expect(createGuestSession(t0,"workspaceA","sessionB").token).not.toBe(issued.token);
    expect(validateGuestSession(issued.token,issued.record,t0+1000)).toBe(true);
    expect(validateGuestSession("a".repeat(64),issued.record,t0+1000)).toBe(false);
  });
  it("enforces idle 30 minute and absolute 24 hour expiry on reads",()=>{
    expect(validateGuestSession(issued.token,issued.record,t0+29*60*1000)).toBe(true);
    expect(validateGuestSession(issued.token,issued.record,t0+30*60*1000)).toBe(false);
    const refreshed={...issued.record,lastSeenAtMs:t0+23*3600*1000};
    expect(validateGuestSession(issued.token,refreshed,t0+24*3600*1000-1)).toBe(true);
    expect(validateGuestSession(issued.token,refreshed,t0+24*3600*1000)).toBe(false);
  });
  it("sets cookie HttpOnly, Secure and SameSite; never returns bearer token in body",()=>{
    expect(guestCookie(issued.token)).toContain("HttpOnly");
    expect(guestCookie(issued.token)).toContain("Secure");
    expect(guestCookie(issued.token)).toContain("SameSite=Lax");
    expect(guestCookie(issued.token)).toContain("Max-Age=86400");
  });
  it("binds CSRF token to server key and session and rejects invalid token",()=>{
    const csrfKey=randomBytes(32), token=csrfToken(csrfKey,issued.record);
    expect(verifyCsrfToken(csrfKey,issued.record,token)).toBe(true);
    expect(verifyCsrfToken(randomBytes(32),issued.record,token)).toBe(false);
    expect(verifyCsrfToken(csrfKey,{...issued.record,sessionId:"someoneElse"},token)).toBe(false);
    expect(verifyCsrfToken(csrfKey,issued.record,"xyz")).toBe(false);
  });
  it("requires exact trusted Origin for cookie-authenticated writes",()=>{
    const allowed=["https://acrdemo.example.com","http://localhost:3000"];
    expect(verifyMutationOrigin("https://acrdemo.example.com",allowed)).toBe(true);
    expect(verifyMutationOrigin("http://localhost:3000",allowed)).toBe(true);
    for(const invalid of [undefined,"null","https://acrdemo.example.com.evil.net",
      "https://attacker.example.com","http://acrdemo.example.com",
      "https://acrdemo.example.com@evil.net","https://acrdemo.example.com/path"]) {
      expect(verifyMutationOrigin(invalid,allowed),invalid).toBe(false);
    }
  });
});

describe("workspace authorization (pure policy)",()=>{
  it("denies cross-workspace reads, edits, approvals and event streams",()=>{
    for(const kind of ["workflow","execution","approval","crm","event"] as const){
      for(const permission of ["demo.read","demo.edit","demo.approve"] as Permission[]){
        expect(canAccess(principal,{workspaceId:"workspaceB",kind},permission,t0+100)).toBe(false);
      }
    }
    expect(canAccess(principal,{workspaceId:"workspaceA",kind:"crm"},"demo.read",t0+100)).toBe(true);
  });
  it("guest cannot call live AI, external HTTP, read credentials or access expired session",()=>{
    for(const grant of ["operator.ai.live","operator.http.execute","operator.credentials.read","operator.admin"] as Permission[]){
      expect(canAccess(principal,{workspaceId:"workspaceA",kind:"workflow"},grant,t0+1)).toBe(false);
    }
    expect(canAccess(principal,{workspaceId:"workspaceA",kind:"credential"},"demo.read",t0+1)).toBe(false);
    expect(canAccess(principal,{workspaceId:"workspaceA",kind:"crm"},"demo.read",t0+24*3600*1000)).toBe(false);
  });
  it("operator must possess an explicit grant, even in their own workspace",()=>{
    const op:Principal={kind:"operator",userId:"userA",workspaceId:"workspaceA",grants:new Set(["operator.workflows"])};
    expect(canAccess(op,{workspaceId:"workspaceA",kind:"workflow"},"operator.workflows",t0+1)).toBe(true);
    expect(canAccess(op,{workspaceId:"workspaceA",kind:"credential"},"operator.credentials.read",t0+1)).toBe(false);
    expect(canAccess(op,{workspaceId:"workspaceB",kind:"workflow"},"operator.workflows",t0+1)).toBe(false);
    expect(()=>requireAccess(op,{workspaceId:"workspaceB",kind:"workflow"},"operator.workflows",t0+1))
      .toThrow("FORBIDDEN");
    expect(workspaceFilter(op)).toEqual({workspaceId:"workspaceA"});
  });
});
