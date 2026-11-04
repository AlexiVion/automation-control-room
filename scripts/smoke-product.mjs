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
assert.equal((await json("/v1/demo/crm",{cookie})).value.items.length,1);
log("Human approval → pg-boss worker → real PostgreSQL CRM upsert");

const retry=await json("/v1/demo/events",{method:"POST",cookie,csrf,key:randomUUID(),
  body:{fixtureId:"lead_demo_001",simulateTransientFailureOnce:true},expected:202});
const retryWaiting=await waitStatus(cookie,retry.value.executionId,"waiting_approval");
await json("/v1/approvals/"+retryWaiting.approval.id+"/decision",{method:"POST",cookie,csrf,
  body:{decision:"approved",expectedPayloadDigest:retryWaiting.approval.payloadDigest}});
const retried=await waitStatus(cookie,retry.value.executionId,"completed");
assert.ok(retried.events.some(e=>e.eventType==="step.retry_scheduled"));
assert.equal((await json("/v1/demo/crm",{cookie})).value.items.length,1);
log("Simulated transient retry without duplicate CRM lead");

const medium=await json("/v1/demo/events",{method:"POST",cookie,csrf,key:randomUUID(),
  body:{fixtureId:"lead_demo_002"},expected:202});
const mediumDone=await waitStatus(cookie,medium.value.executionId,"completed");
assert.equal(mediumDone.approval,null);
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

const other=await json("/v1/demo/sessions",{method:"POST",expected:201});
const otherCookie=other.response.headers.get("set-cookie")?.split(";")[0];
assert.ok(otherCookie);
await json("/v1/demo/runs/"+firstRun,{cookie:otherCookie,expected:404});
assert.equal((await json("/v1/demo/crm",{cookie:otherCookie})).value.items.length,0);
await json("/v1/demo/events",{method:"POST",cookie:otherCookie,csrf:"a".repeat(64),
  body:{fixtureId:"lead_demo_001"},expected:403});
log("Cross-workspace isolation + CSRF rejection");
console.log("PRODUCT_SLICE1_E2E_PASS");
