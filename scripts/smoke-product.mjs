import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const api=process.env.ACR_API_BASE??"http://localhost:3100";
const web=process.env.ACR_WEB_BASE??"http://localhost:3000";
const origin=process.env.ACR_ORIGIN??"http://localhost:3000";
async function json(path,{method="GET",cookie,csrf,body,key,expected=200}={}){
  const headers={"Origin":origin};
  if(cookie)headers.Cookie=cookie;
  if(csrf)headers["X-ACR-CSRF"]=csrf;
  if(key)headers["Idempotency-Key"]=key;
  if(body)headers["Content-Type"]="application/json";
  const response=await fetch(api+path,{method,headers,body:body?JSON.stringify(body):undefined});
  const value=await response.json().catch(()=>({}));
  assert.equal(response.status,expected,`HTTP ${path}: ${response.status} ${JSON.stringify(value)}`);
  return {value,response};
}
async function waitStatus(cookie,runId,status,timeout=20_000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    const {value}=await json("/v1/demo/runs/"+runId,{cookie});
    if(value.execution.status===status)return value;
    if(["failed","cancelled","needs_review"].includes(value.execution.status)&&value.execution.status!==status)
      throw new Error("Unexpected run terminal state "+value.execution.status);
    await new Promise(r=>setTimeout(r,200));
  }
  throw new Error("TIMEOUT awaiting "+status+" for "+runId);
}
function log(name){console.log("PASS "+name);}
const health=await json("/health/ready");
assert.equal(health.value.database,"ok");
log("API + PostgreSQL ready");
const html=await fetch(web+"/").then(r=>r.text());
assert.match(html,/Automation Control Room|Automatizaciones verificables/);
log("Next.js web route rendered");
const proxiedResponse=await fetch(web+"/v1/demo/sessions",{
  method:"POST",headers:{"Origin":origin}
});
assert.equal(proxiedResponse.status,201,"Next.js same-origin API proxy must preserve Origin and status");
const proxiedBody=await proxiedResponse.json();
const proxiedCookie=proxiedResponse.headers.get("set-cookie")?.split(";")[0];
assert.ok(proxiedCookie?.startsWith("acr_demo_session="));
const proxiedMe=await fetch(web+"/v1/demo/me",{headers:{Cookie:proxiedCookie}});
assert.equal(proxiedMe.status,200,"Browser cookie must pass through Next.js reverse proxy");
assert.equal((await proxiedMe.json()).workspaceId,proxiedBody.workspaceId);
log("Next.js same-origin API proxy forwards session cookie");
// Browser renders inspector, CRM and SSE concurrently; all authenticated reads
// must remain valid even when many requests touch the same session at once.
for (let round = 0; round < 3; round++) {
  const responses = await Promise.all(Array.from({length:32}, (_,i) =>
    fetch(web + (i%2===0?"/v1/demo/me":"/v1/demo/crm"),
      {headers:{Cookie:proxiedCookie}})
  ));
  assert.deepEqual(responses.map(r=>r.status),Array(32).fill(200),
    "concurrent browser reads must not sporadically return SESSION_REQUIRED");
  await Promise.all(responses.map(r=>r.arrayBuffer()));
}
log("96 parallel browser-session reads without spurious 401");
const created=await json("/v1/demo/sessions",{method:"POST",expected:201});
const cookie=created.response.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie?.startsWith("acr_demo_session="));
const csrf=created.value.csrf;
assert.equal(csrf.length,64);
log("Local anonymous cookie session + CSRF");

const eventId=randomUUID();
const first=await json("/v1/demo/events",{method:"POST",cookie,csrf,
  key:eventId,body:{fixtureId:"lead_demo_001"},expected:202});
const firstRun=first.value.executionId;
const duplicate=await json("/v1/demo/events",{method:"POST",cookie,csrf,
  key:eventId,body:{fixtureId:"lead_demo_001"},expected:202});
assert.equal(duplicate.value.executionId,firstRun);
assert.equal(duplicate.value.duplicate,true);
const waiting=await waitStatus(cookie,firstRun,"waiting_approval");
assert.equal(waiting.approval.status,"pending");
assert.equal((await json("/v1/demo/crm",{cookie})).value.items.length,0);
log("Transactional intake + deduplicated receipt + durable approval");

await json("/v1/approvals/"+waiting.approval.id+"/decision",{method:"POST",cookie,csrf,
  body:{decision:"approved",expectedPayloadDigest:waiting.approval.payloadDigest}});
const complete=await waitStatus(cookie,firstRun,"completed");
assert.ok(complete.events.some(e=>e.eventType==="crm.confirmed"));
assert.equal(complete.execution.crmAttempts,1,"A normal CRM write requires one attempt");
assert.equal(complete.execution.retryCount,0,"A normal execution must show zero retries");
assert.equal(complete.execution.attempts,1,"Legacy attempts field has CRM-only semantics");
assert.equal((await json("/v1/demo/crm",{cookie})).value.items.length,1);
log("Human approval → pg-boss worker → real PostgreSQL CRM upsert");

const retry=await json("/v1/demo/events",{method:"POST",cookie,csrf,key:randomUUID(),
  body:{fixtureId:"lead_demo_001",simulateTransientFailureOnce:true},expected:202});
const retryWaiting=await waitStatus(cookie,retry.value.executionId,"waiting_approval");
await json("/v1/approvals/"+retryWaiting.approval.id+"/decision",{method:"POST",cookie,csrf,
  body:{decision:"approved",expectedPayloadDigest:retryWaiting.approval.payloadDigest}});
const retried=await waitStatus(cookie,retry.value.executionId,"completed");
assert.ok(retried.events.some(e=>e.eventType==="step.retry_scheduled"));
assert.equal(retried.execution.crmAttempts,2,"A transient error must result in two CRM attempts");
assert.equal(retried.execution.retryCount,1,"A transient error must show one retry");
assert.equal((await json("/v1/demo/crm",{cookie})).value.items.length,1);
log("Simulated transient retry without duplicate CRM lead");

const medium=await json("/v1/demo/events",{method:"POST",cookie,csrf,key:randomUUID(),
  body:{fixtureId:"lead_demo_002"},expected:202});
const mediumDone=await waitStatus(cookie,medium.value.executionId,"completed");
assert.equal(mediumDone.approval,null);
assert.equal(mediumDone.execution.crmAttempts,0);
assert.equal(mediumDone.execution.retryCount,0);
assert.ok(mediumDone.events.some(e=>e.eventType==="step.skipped"));
log("Medium priority goes to finish without approval or CRM write");

const reject=await json("/v1/demo/events",{method:"POST",cookie,csrf,key:randomUUID(),
  body:{fixtureId:"lead_demo_001"},expected:202});
const rejectWaiting=await waitStatus(cookie,reject.value.executionId,"waiting_approval");
await json("/v1/approvals/"+rejectWaiting.approval.id+"/decision",{method:"POST",cookie,csrf,
  body:{decision:"rejected",expectedPayloadDigest:rejectWaiting.approval.payloadDigest}});
await waitStatus(cookie,reject.value.executionId,"cancelled");
assert.equal((await json("/v1/demo/crm",{cookie})).value.items.length,1);
log("Rejection cancels execution with no new CRM write");

const fifth=await json("/v1/demo/events",{method:"POST",cookie,csrf,key:randomUUID(),
  body:{fixtureId:"lead_demo_003"},expected:202});
await waitStatus(cookie,fifth.value.executionId,"completed");
const quota=await json("/v1/demo/events",{method:"POST",cookie,csrf,key:randomUUID(),
  body:{fixtureId:"lead_demo_003"},expected:429});
assert.equal(quota.value.error.code,"DEMO_QUOTA_REACHED");
log("Atomic five-run guest quota");
// Pagination is real DB keyset pagination, not a view over current in-memory run.
const seen=new Set();
let next=null,round=0;
do {
  const qs=new URLSearchParams({limit:"2"});
  if(next)qs.set("cursor",next);
  const {value:page}=await json("/v1/demo/runs?"+qs,{cookie});
  assert.equal(page.total,5);
  assert.ok(page.items.length>=1&&page.items.length<=2);
  for(const row of page.items){
    assert.ok(!seen.has(row.id),"A run appears on only one page");
    seen.add(row.id);
    assert.equal(typeof row.crmAttempts,"number");
    assert.equal(typeof row.retryCount,"number");
  }
  next=page.nextCursor;round++;
  assert.ok(round<=3,"Expected three pages of two rows");
} while(next);
assert.equal(seen.size,5);
assert.ok(seen.has(firstRun)&&seen.has(retry.value.executionId));
const {value:completedHistory}=await json("/v1/demo/runs?status=completed&limit=20",{cookie});
assert.equal(completedHistory.total,4);
assert.equal(completedHistory.items.length,4);
const {value:cancelledHistory}=await json("/v1/demo/runs?status=cancelled",{cookie});
assert.equal(cancelledHistory.total,1);
assert.equal(cancelledHistory.items[0].id,reject.value.executionId);
const {value:workflow}=await json("/v1/demo/workflow",{cookie});
assert.equal(workflow.graph.nodes.length,7);
assert.equal(workflow.graph.edges.length,6);
assert.equal(workflow.graphDigest.length,64);
const {value:cursorPage}=await json("/v1/demo/runs?limit=2",{cookie});
assert.ok(cursorPage.nextCursor);
await json("/v1/demo/runs?limit=2&status=completed&cursor="+encodeURIComponent(cursorPage.nextCursor),
  {cookie,expected:400});
const [signedBody,signedMac]=cursorPage.nextCursor.split(".");
const corrupted=signedBody+"."+(signedMac[0]==="a"?"b":"a")+signedMac.slice(1);
await json("/v1/demo/runs?limit=2&cursor="+encodeURIComponent(corrupted),{cookie,expected:400});
log("Durable scoped run listing + signed 3-page cursor + filters + published graph");

const other=await json("/v1/demo/sessions",{method:"POST",expected:201});
const otherCookie=other.response.headers.get("set-cookie")?.split(";")[0];
assert.ok(otherCookie);
// Docker Desktop/Windows can correct wall time backwards immediately after a
// session was created. The 256-bit opaque cookie is still valid if idle and
// absolute expirations hold; createdAt is audit metadata, not an auth gate.
// Simulate a DB clock rollback deterministically without changing host clocks.
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required for session-clock regression");
const { createHash } = await import("node:crypto");
const { default: pg } = await import("pg");
const tokenHash=createHash("sha256").update(otherCookie.split("=")[1]).digest("hex");
const clockDb=new pg.Client({connectionString:process.env.DATABASE_URL});
await clockDb.connect();
try {
  const moved=await clockDb.query(
    `UPDATE "DemoSession" SET "createdAt" = CURRENT_TIMESTAMP + INTERVAL '2 minutes' WHERE "tokenHash" = $1`,
    [tokenHash]
  );
  assert.equal(moved.rowCount,1,"Expected to simulate skew on this exact synthetic session");
} finally { await clockDb.end(); }
assert.equal((await json("/v1/demo/me",{cookie:otherCookie})).value.workspaceId,other.value.workspaceId);
log("Fresh guest cookie survives a simulated DB wall-clock rollback");
await json("/v1/demo/runs/"+firstRun,{cookie:otherCookie,expected:404});
const {value:isolatedHistory}=await json("/v1/demo/runs?limit=5",{cookie:otherCookie});
assert.equal(isolatedHistory.total,0);
await json("/v1/demo/runs?cursor="+encodeURIComponent(cursorPage.nextCursor),
  {cookie:otherCookie,expected:400});
assert.equal((await json("/v1/demo/crm",{cookie:otherCookie})).value.items.length,0);
await json("/v1/demo/events",{method:"POST",cookie:otherCookie,csrf:"a".repeat(64),
  body:{fixtureId:"lead_demo_001"},expected:403});
log("Cross-workspace isolation + CSRF rejection");

// Sessions must still expire after 30 min idle; fixing concurrent 401 may not
// turn invalid/expired sessions into authenticated ones.
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required for expiry test");
const client = new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
try {
  const token = otherCookie.split("=")[1];
  const hash = createHash("sha256").update(token).digest("hex");
  const result = await client.query(
    `UPDATE "DemoSession" SET "lastSeenAt" = NOW() - INTERVAL '31 minutes' WHERE "tokenHash" = $1`,
    [hash]
  );
  assert.equal(result.rowCount,1);
} finally { await client.end(); }
await json("/v1/demo/me",{cookie:otherCookie,expected:401});
log("Expired idle guest session is rejected");
console.log("PRODUCT_SLICE1_E2E_PASS");
