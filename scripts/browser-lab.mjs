import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const origin=process.env.ACR_BROWSER_BASE??"http://localhost:33000";
const evidence=process.env.ACR_BROWSER_EVIDENCE??"/tmp/acr-slice2-evidence";
const timeout=30_000;
await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:930}});
const errors=[];
try{
  page.on("pageerror",error=>errors.push(String(error)));
  await page.goto(origin+"/lab",{waitUntil:"domcontentloaded",timeout});
  await page.getByRole("heading",{name:/Construí\. Ejecutá\. Cambiá el resultado/}).waitFor({timeout});
  await page.locator(".labFlowCard").first().waitFor({timeout});
  assert.equal(await page.locator(".labFlowCard").count(),6);
  assert.equal(await page.locator(".react-flow__edge").count(),5);
  await page.screenshot({path:path.join(evidence,"10-real-workflow-lab-editor.png"),fullPage:true});
  console.log("PASS user-authored React Flow editor renders real DAG with 6 nodes and 5 edges");

  await page.getByRole("button",{name:/Publicar versión/}).click();
  await page.getByText(/Versión 1 publicada/).waitFor({timeout});
  await page.getByRole("button",{name:/Ejecutar en worker real/}).click();
  await page.getByRole("heading",{name:"Tu decisión es necesaria"}).waitFor({timeout});
  await page.screenshot({path:path.join(evidence,"11-lab-live-approval.png"),fullPage:true});
  await page.getByRole("button",{name:"Aprobar escritura"}).click();
  await page.getByRole("heading",{name:"Ejecución completada"}).waitFor({timeout});
  await page.getByText(/Local record committed in PostgreSQL/).waitFor({timeout});
  console.log("PASS browser created, published and executed first authored workflow via worker and committed record");

  // Edit a condition node on the actual canvas. The previously published
  // version must not mutate, while v2 must choose another branch with same input.
  await page.locator(".labFlowCard").filter({hasText:"filter"}).first().click();
  await page.getByLabel("Valor esperado").fill("medium");
  await page.getByRole("button",{name:/Publicar versión/}).click();
  await page.getByText(/Versión 2 publicada/).waitFor({timeout});
  await page.getByRole("button",{name:/Ejecutar en worker real/}).click();
  await page.getByRole("heading",{name:"Ejecución completada"}).waitFor({timeout});
  await page.getByText("other",{exact:true}).last().waitFor({timeout});
  await page.screenshot({path:path.join(evidence,"12-lab-changed-condition-v2.png"),fullPage:true});
  console.log("PASS editable condition changes actual branch/output in published v2");

  await page.getByRole("button",{name:"Comparar"}).click();
  await page.getByText(/V1 · completed/).waitFor({timeout});
  await page.getByText(/V2 · completed/).waitFor({timeout});
  console.log("PASS real multi-version comparison is accessible from the UI");

  const mobile=await browser.newPage({viewport:{width:390,height:844}});
  mobile.on("pageerror",error=>errors.push(String(error)));
  await mobile.goto(origin+"/lab",{waitUntil:"domcontentloaded",timeout});
  await mobile.getByRole("heading",{name:/Construí\. Ejecutá\. Cambiá el resultado/}).waitFor({timeout});
  await mobile.locator(".labFlowCard").first().waitFor({timeout});
  assert.equal(await mobile.evaluate(()=>
    document.documentElement.scrollWidth>window.innerWidth+2),false,
    "Workflow Lab mobile viewport must not overflow horizontally");
  await mobile.screenshot({path:path.join(evidence,"13-lab-mobile-editor.png"),fullPage:true});
  await mobile.close();
  assert.deepEqual(errors,[],"Workflow Lab browser should not throw runtime errors");
  console.log("WORKFLOW_LAB_BROWSER_E2E_PASS");
}finally{
  await browser.close();
}
