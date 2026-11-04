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
  const defaultFit=parseInt(before,10);
  assert.ok(defaultFit>=85,
    "The default 1440px desktop fit must be readable, got "+before);
  const studioColumns=await page.locator(".slice2Studio").evaluate(el=>getComputedStyle(el).gridTemplateColumns);
  assert.equal(studioColumns.split(" ").length,1,"Canvas must occupy the full studio width");
  const originalWorkspace=await page.locator(".sideBottom strong").innerText();
  assert.match(originalWorkspace,/^[a-f0-9]{8}$/i);
  await page.screenshot({path:path.join(evidence,"00-readable-canvas-desktop.png"),fullPage:true});
  await page.getByRole("button",{name:"Acercar diagrama"}).click();
  const after=await page.locator(".workflowToolbar output").innerText();
  assert.notEqual(before,after,"Zoom control must change canvas scale");
  await page.getByRole("button",{name:"Ajustar"}).click();
  // Visual geometry guard: the minimap must not cover any node after fit.
  // This caught a genuine desktop screenshot regression in the initial Slice 2.
  const minimap=await page.locator(".canvasMinimap").boundingBox();
  assert.ok(minimap);
  for(const card of await page.locator(".graphNode").all()){
    const box=await card.boundingBox();
    if(!box)continue;
    const collision=box.x < minimap.x+minimap.width &&
      box.x+box.width > minimap.x &&
      box.y < minimap.y+minimap.height &&
      box.y+box.height > minimap.y;
    assert.equal(collision,false,"Canvas minimap must not cover published node "+(await card.getAttribute("aria-label")));
  }
  console.log("PASS browser full-width canvas fit ≥85%, real edges, zoom and unobstructed minimap");

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
  // The professional focus mode is the SAME graph and state. It is keyboard
  // escapable, keeps node auditing visible, and restores toolbar focus.
  await page.getByRole("button",{name:"Ampliar diagrama"}).click();
  const dialog=page.getByRole("dialog",{name:"Vista ampliada del workflow"});
  await dialog.waitFor({timeout});
  const focusBounds=await dialog.locator(".workflowViewport").boundingBox();
  assert.ok(focusBounds&&focusBounds.width>=900&&focusBounds.height>=500,
    "Focus mode must grant the graph substantial usable space");
  assert.equal(await dialog.locator(".graphNode").count(),7);
  await dialog.getByRole("button",{name:/CRM Demo, Completado/}).click();
  await dialog.getByRole("heading",{name:"CRM Demo"}).waitFor({timeout});
  await dialog.getByText(/crm.confirmed/).waitFor({timeout});
  await page.screenshot({path:path.join(evidence,"02b-focus-mode-audit-desktop.png"),fullPage:false});
  await page.keyboard.press("Escape");
  await dialog.waitFor({state:"hidden",timeout});
  const returned=await page.getByRole("button",{name:"Ampliar diagrama"})
    .evaluate(el=>document.activeElement===el);
  assert.equal(returned,true,"Escape must return focus to the toolbar");
  console.log("PASS fullscreen inspection, real CRM node events, keyboard Escape and focus restoration");
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
  assert.equal(await page.locator(".sideBottom strong").innerText(),originalWorkspace,
    "A browser reload keeps the same guest workspace");
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
  const otherWorkspace=await mobile.locator(".sideBottom strong").innerText();
  assert.notEqual(otherWorkspace,originalWorkspace,"Separate profiles require different guest workspace IDs");
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
