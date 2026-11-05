import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const api=process.env.ACR_API_BASE??"http://localhost:3100";
const origin=process.env.ACR_ORIGIN??"http://localhost:3000";
async function request(path,{method="GET",cookie,csrf,body,key,expected=200}={}){
  const headers={Origin:origin};
  if(cookie)headers.Cookie=cookie;
  if(csrf)headers["X-ACR-CSRF"]=csrf;
  if(key)headers["Idempotency-Key"]=key;
  if(body)headers["Content-Type"]="application/json";
  const reply=await fetch(api+path,{method,headers,body:body?JSON.stringify(body):undefined});
  const value=await reply.json().catch(()=>({}));
  assert.equal(reply.status,expected,
    method+" "+path+": expected "+expected+" got "+reply.status+" "+JSON.stringify(value));
  return {value,reply};
}
const literal=value=>({kind:"literal",value});
const path=value=>({kind:"path",path:value});
const workflowA={
  schemaVersion:1,trigger:{nodeId:"in"},
  nodes:[
    {id:"in",type:"webhook.trigger",config:{sourceKey:"lab.local"}},
    {id:"priority",type:"condition",config:{left:path("$.trigger.priority"),operator:"eq",right:"high"}},
    {id:"confirm",type:"approval",config:{reason:"Approve lead insertion",expiresMinutes:10}},
    {id:"create",type:"demo_crm.upsert",config:{fields:{
      leadId:path("$.trigger.id"),category:literal("automation"),priority:path("$.trigger.priority")}}},
    {id:"done",type:"finish",config:{}},
    {id:"skip",type:"finish",config:{}}
  ],
  edges:[
    {id:"one",source:"in",target:"priority"},
    {id:"yes",source:"priority",target:"confirm",branch:"true"},
    {id:"no",source:"priority",target:"skip",branch:"false"},
    {id:"three",source:"confirm",target:"create"},
    {id:"four",source:"create",target:"done"}
  ]
};
const workflowB={
  schemaVersion:1,trigger:{nodeId:"request"},
  nodes:[
    {id:"request",type:"webhook.trigger",config:{sourceKey:"lab.support"}},
    {id:"tag",type:"compose.template",config:{value:"hold"}},
    {id:"decide",type:"condition",config:{left:path("$.steps.tag.value"),operator:"eq",right:"go"}},
    {id:"authorize",type:"approval",config:{reason:"Escalate this ticket",expiresMinutes:5}},
    {id:"ticket",type:"demo_crm.upsert",config:{fields:{
      leadId:literal("support-ticket-001"),category:literal("support"),priority:literal("medium")}}},
    {id:"escalated",type:"finish",config:{}},
    {id:"ordinary",type:"finish",config:{}}
  ],
  edges:[
    {id:"a",source:"request",target:"tag"},
    {id:"b",source:"tag",target:"decide"},
    {id:"yes",source:"decide",target:"authorize",branch:"true"},
    {id:"no",source:"decide",target:"ordinary",branch:"false"},
    {id:"c",source:"authorize",target:"ticket"},
    {id:"d",source:"ticket",target:"escalated"}
  ]
};
async function waitRun(id,cookie,status){
  const until=Date.now()+20_000;
  while(Date.now()<until){
    const {value}=await request("/v1/lab/runs/"+id,{cookie});
    if(value.status===status)return value;
    if(["completed","cancelled","failed"].includes(value.status)&&value.status!==status)
      throw new Error("Lab run terminal mismatch "+status+" != "+value.status);
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw new Error("Timeout waiting for "+status+" in "+id);
}
const start=await request("/v1/demo/sessions",{method:"POST",expected:201});
const cookie=start.reply.headers.get("set-cookie")?.split(";")[0];
const csrf=start.value.csrf;
assert.ok(cookie&&csrf);
const input={id:"lead-001",priority:"high",category:"support"};
const empty=await request("/v1/lab/workflows",{cookie});
assert.equal(empty.value.items.length,0);
for(const item of [{name:"My lead workflow",draft:workflowA},
                   {name:"My support workflow",draft:workflowB}]){
  const draft=await request("/v1/lab/workflows",{method:"POST",cookie,csrf,body:item,expected:201});
  assert.equal(draft.value.draftRevision,0);
  if(item.name.startsWith("My lead"))globalThis.__labA=draft.value.workflowId;
  else globalThis.__labB=draft.value.workflowId;
}
const a=globalThis.__labA,b=globalThis.__labB;
assert.ok(a&&b&&a!==b);
const publishA=await request("/v1/lab/workflows/"+a+"/publish",{
  method:"POST",cookie,csrf,body:{expectedRevision:0},expected:201
});
const publishB=await request("/v1/lab/workflows/"+b+"/publish",{
  method:"POST",cookie,csrf,body:{expectedRevision:0},expected:201
});
assert.equal(publishA.value.versionNo,1);
assert.equal(publishB.value.versionNo,1);
await request("/v1/lab/workflows/"+b+"/publish",{
  method:"POST",cookie,csrf,body:{expectedRevision:0},expected:409
});
console.log("PASS two scoped author-authored graphs independently published as immutable versions");

const key=randomUUID();
const aRun=await request("/v1/lab/workflows/"+a+"/runs",{method:"POST",cookie,csrf,
  key,body:{input},expected:202});
assert.equal(aRun.value.duplicate,false);
const duplicate=await request("/v1/lab/workflows/"+a+"/runs",{method:"POST",cookie,csrf,
  key,body:{input},expected:202});
assert.equal(duplicate.value.duplicate,true);
assert.equal(duplicate.value.executionId,aRun.value.executionId);
const awaiting=await waitRun(aRun.value.executionId,cookie,"waiting_approval");
assert.equal(awaiting.approvalNodeId,"confirm");
assert.equal((await request("/v1/lab/records",{cookie})).value.items.length,0);
await request("/v1/lab/runs/"+aRun.value.executionId+"/decision",{
  method:"POST",cookie,csrf,body:{decision:"approved"}
});
const approved=await waitRun(aRun.value.executionId,cookie,"completed");
assert.equal(approved.version.versionNo,1);
assert.deepEqual(approved.trace.map(t=>t.nodeId),
  ["in","priority","confirm","create","done"]);
assert.ok(approved.trace.some(t=>t.nodeId==="create"&&t.status==="executed"));
assert.equal((await request("/v1/lab/records",{cookie})).value.items.length,1);
console.log("PASS user-built graph paused at real worker approval then committed local record once");

const bRun=await request("/v1/lab/workflows/"+b+"/runs",{method:"POST",cookie,csrf,
  body:{input},expected:202});
const old=await waitRun(bRun.value.executionId,cookie,"completed");
assert.equal(old.version.versionNo,1);
assert.deepEqual(old.trace.map(t=>t.nodeId),["request","tag","decide","ordinary"]);
assert.equal((await request("/v1/lab/records",{cookie})).value.items.length,1);

const changed=structuredClone(workflowB);
changed.nodes.find(n=>n.id==="tag").config.value="go";
const saved=await request("/v1/lab/workflows/"+b+"/draft",{
  method:"PUT",cookie,csrf,body:{expectedRevision:0,draft:changed}
});
assert.equal(saved.value.draftRevision,1);
await request("/v1/lab/workflows/"+b+"/draft",{
  method:"PUT",cookie,csrf,body:{expectedRevision:0,draft:changed},expected:409
});
const v2=await request("/v1/lab/workflows/"+b+"/publish",{
  method:"POST",cookie,csrf,body:{expectedRevision:1},expected:201
});
assert.equal(v2.value.versionNo,2);
assert.notEqual(v2.value.graphDigest,publishB.value.graphDigest);
const bReject=await request("/v1/lab/workflows/"+b+"/runs",{
  method:"POST",cookie,csrf,body:{input},expected:202
});
await waitRun(bReject.value.executionId,cookie,"waiting_approval");
await request("/v1/lab/runs/"+bReject.value.executionId+"/decision",{
  method:"POST",cookie,csrf,body:{decision:"rejected"}
});
const rejected=await waitRun(bReject.value.executionId,cookie,"cancelled");
assert.equal(rejected.version.versionNo,2);
assert.equal((await request("/v1/lab/records",{cookie})).value.items.length,1);
console.log("PASS v1 and v2 produce different actual branch behavior; rejection writes nothing");

const bApproved=await request("/v1/lab/workflows/"+b+"/runs",{
  method:"POST",cookie,csrf,body:{input},expected:202
});
await waitRun(bApproved.value.executionId,cookie,"waiting_approval");
await request("/v1/lab/runs/"+bApproved.value.executionId+"/decision",{
  method:"POST",cookie,csrf,body:{decision:"approved"}
});
const confirmed=await waitRun(bApproved.value.executionId,cookie,"completed");
assert.equal(confirmed.version.versionNo,2);
assert.ok(confirmed.trace.some(t=>t.nodeId==="ticket"&&t.status==="executed"));
assert.equal((await request("/v1/lab/records",{cookie})).value.items.length,2);
const older=await request("/v1/lab/workflows/"+b+"/runs",{
  method:"POST",cookie,csrf,
  body:{input,versionId:publishB.value.versionId},expected:202
});
const oldAgain=await waitRun(older.value.executionId,cookie,"completed");
assert.equal(oldAgain.version.versionNo,1);
assert.deepEqual(oldAgain.trace.map(t=>t.nodeId),["request","tag","decide","ordinary"]);
await request("/v1/lab/workflows/"+b+"/runs",{
  method:"POST",cookie,csrf,body:{input},expected:429
});
console.log("PASS both immutable workflow versions remain executable after publishing v2");

const other=await request("/v1/demo/sessions",{method:"POST",expected:201});
const otherCookie=other.reply.headers.get("set-cookie")?.split(";")[0];
assert.ok(otherCookie);
assert.equal((await request("/v1/lab/workflows",{cookie:otherCookie})).value.items.length,0);
await request("/v1/lab/workflows/"+a,{cookie:otherCookie,expected:404});
await request("/v1/lab/runs/"+aRun.value.executionId,{cookie:otherCookie,expected:404});
assert.equal((await request("/v1/lab/records",{cookie:otherCookie})).value.items.length,0);
await request("/v1/lab/workflows/"+a+"/draft",{
  method:"PUT",cookie:otherCookie,csrf:"a".repeat(64),
  body:{expectedRevision:0,draft:workflowA},expected:403
});
console.log("PASS other guest cannot read or modify custom workflows, executions or records");
console.log("TWO_CUSTOM_WORKFLOWS_EXECUTED_PASS");
