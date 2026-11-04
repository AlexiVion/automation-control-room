import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base=process.env.ACR_BROWSER_BASE??"http://127.0.0.1:33000";
const evidence=process.env.ACR_BROWSER_EVIDENCE??"/tmp/acr-slice2-evidence";
await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[];
const timeout=30_000;
try {
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  page.on("pageerror",error=>errors.push(String(error)));
  await page.goto(base,{waitUntil:"domcontentloaded",timeout});
  assert.match(await page.title(),/Automation Control Room/);
  await page.getByRole("heading",{name:"Tu automatización, paso a paso"}).waitFor({timeout});
  await page.getByRole("button",{name:/Iniciar automatización/}).waitFor({state:"visible",timeout});
  await page.locator(".workflowPanel .graphNode").first().waitFor({timeout});
  assert.equal(await page.locator(".workflowPanel .graphNode").count(),7);
  assert.equal(await page.locator(".workflowWires .graphWire").count(),6);
  const before=await page.locator(".workflowToolbar output").innerText();
  await page.getByRole("button",{name:"Acercar diagrama"}).click();
  const after=await page.locator(".workflowToolbar output").innerText();
  assert.notEqual(before,after,"Zoom control must change canvas scale");
  await page.getByRole("button",{name:"Ajustar"}).click();
  console.log("PASS browser desktop workflow canvas renders real nodes/edges and zoom");

  await page.getByRole("button",{name:/Iniciar automatización/}).click();
  await page.getByRole("heading",{name:"Esta acción necesita tu aprobación"}).waitFor({timeout});
  await page.getByRole("button",{name:/Aprobación, En espera/}).waitFor({timeout});
  await page.screenshot({path:path.join(evidence,"01-awaiting-approval-desktop.png"),fullPage:true});
  console.log("PASS browser waiting approval state is not marked completed");

  await page.getByRole("button",{name:"Aprobar escritura"}).click();
  await page.locator(".metricStatus").getByText("Completada").waitFor({timeout});
  await page.locator(".slice2Inspector .inspectorData").getByText("Intentos CRM").waitFor();
  const attempts=await page.locator(".slice2Inspector .inspectorData").innerText();
  assert.match(attempts,/Intentos CRM\s+1/);
  assert.match(attempts,/Reintentos\s+0/);
  await page.getByRole("button",{name:/CRM Demo, Completado/}).waitFor({timeout});
  await page.screenshot({path:path.join(evidence,"02-completed-canvas-desktop.png"),fullPage:true});
  console.log("PASS browser approved happy path: one CRM attempt, zero retries");

  await page.getByRole("button",{name:/Historial/}).click();
  await page.getByRole("heading",{name:"Ejecuciones guardadas"}).waitFor({timeout});
  await page.locator(".historyRow").first().waitFor({timeout});
  const currentID=(new URL(page.url())).searchParams.get("run");
  assert.ok(currentID&&currentID.length===36,"The selected run must be in URL");
  await page.reload({waitUntil:"domcontentloaded"});
  await page.getByRole("heading",{name:"Ejecuciones guardadas"}).waitFor({timeout});
  await page.locator(".historyRow.selected").waitFor({timeout});
  assert.equal((new URL(page.url())).searchParams.get("run"),currentID);
  await page.getByRole("heading",{name:"Detalle de ejecución"}).waitFor({timeout});
  await page.screenshot({path:path.join(evidence,"03-reloadable-history-desktop.png"),fullPage:true});
  console.log("PASS browser durable history remains scoped and selected after page reload");

  await page.getByRole("button",{name:/CRM ficticio/}).click();
  await page.getByText("lead_demo_001",{exact:true}).first().waitFor({timeout});
  const crmRows=page.locator(".slice2CRM tbody tr");
  assert.equal(await crmRows.count(),1);
  await page.getByRole("button",{name:"Ver ejecución ↗"}).first().click();
  await page.getByRole("heading",{name:"Detalle de ejecución"}).waitFor({timeout});
  await page.screenshot({path:path.join(evidence,"04-crm-to-audit-desktop.png"),fullPage:true});
  console.log("PASS browser CRM row links to correct persisted execution");

  // Separate browser profile; must not see runs or CRM data from the first one.
  const isolated=await browser.newContext({viewport:{width:390,height:844}});
  const mobile=await isolated.newPage();
  mobile.on("pageerror",error=>errors.push(String(error)));
  await mobile.goto(base,{waitUntil:"domcontentloaded",timeout});
  await mobile.getByRole("heading",{name:"Tu automatización, paso a paso"}).waitFor({timeout});
  await mobile.locator(".mobileWorkflowNodes .mobileWorkflowNode").first().waitFor({timeout});
  assert.equal(await mobile.locator(".mobileWorkflowNodes .mobileWorkflowNode").count(),7);
  assert.equal(await mobile.locator(".workflowViewport").isVisible(),false);
  const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
  assert.equal(overflow,false,"Mobile viewport must not scroll horizontally");
  await mobile.getByRole("button",{name:/CRM ficticio/}).click();
  await mobile.getByText("Aún no hay escrituras confirmadas.").waitFor({timeout});
  await mobile.screenshot({path:path.join(evidence,"05-mobile-isolated-crm.png"),fullPage:true});
  await mobile.getByRole("button",{name:/Historial/}).click();
  await mobile.getByText("No hay ejecuciones para este filtro.").waitFor({timeout});
  console.log("PASS browser mobile viewport and independent guest isolation");
  assert.deepEqual(errors,[],"Browser application must not produce uncaught runtime exceptions");
  await isolated.close();await context.close();
  console.log("PRODUCT_SLICE2_BROWSER_E2E_PASS");
}finally{
  await browser.close();
}
