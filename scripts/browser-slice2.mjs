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
  // Contrast assertions on meaningful small text, against white surface.
  // Full WCAG audit and screen-reader tests remain a separate review.
  const contrast=await page.evaluate(()=>{
    const luminance=rgb=>{
      const rgbValues=(rgb.match(/\d+(?:\.\d+)?/g)||[]).slice(0,3).map(Number);
      const components=rgbValues.map(v=>{
        const x=v/255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4;
      });
      return components[0]*0.2126+components[1]*0.7152+components[2]*0.0722;
    };
    const selectors=[
      ".slice2Heading p",".slice2Metrics .metricItem span",
      ".workflowTitle p",".graphNode small",".graphNodeFooter",
      ".workflowFoot",".slice2Content footer"
    ];
    return selectors.map(selector=>{
      const target=document.querySelector(selector);
      if(!target)return {selector,ratio:0};
      const text=luminance(getComputedStyle(target).color);
      const white=1;
      return {selector,ratio:(Math.max(text,white)+0.05)/(Math.min(text,white)+0.05)};
    });
  });
  for(const item of contrast){
    assert.ok(item.ratio>=4.5,
      "Small readable text contrast must reach 4.5:1 on white: "+item.selector+" "+item.ratio.toFixed(2));
  }
  console.log("PASS meaningful small-text contrast >=4.5:1 on white surfaces");
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
  const decision=await page.locator(".slice2Approval").boundingBox();
  const canvas=await page.locator(".workflowPanel").boundingBox();
  assert.ok(decision&&canvas&&decision.y+decision.height<canvas.y,
    "Approval must be before the large canvas so the primary task is discoverable");
  assert.equal(await page.getByRole("button",{name:"Aprobar escritura"}).isVisible(),true);
  console.log("PASS pending human decision precedes canvas with visible primary action");
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
  // The owner's screenshots came from a ~1180px desktop. Focus mode must
  // meaningfully increase graph width there as well, not shrink it for a sidebar.
  await page.setViewportSize({width:1180,height:820});
  await page.waitForFunction(()=>{
    const output=document.querySelector(".workflowToolbar output")?.textContent;
    return output && Number.parseInt(output,10)<100;
  },null,{timeout});
  const compactFit=parseInt(await page.locator(".workflowToolbar output").innerText(),10);
  assert.ok(compactFit>=75,"1180px studio should remain legible, got "+compactFit+"%");
  await page.getByRole("button",{name:"Ampliar diagrama"}).click();
  const compactDialog=page.getByRole("dialog",{name:"Vista ampliada del workflow"});
  await compactDialog.waitFor({timeout});
  const compactBounds=await compactDialog.locator(".workflowViewport").boundingBox();
  assert.ok(compactBounds&&compactBounds.width>=1000,
    "At 1180px focus must use full-width graph with the audit beneath it");
  await page.screenshot({path:path.join(evidence,"02c-focus-at-1180px.png"),fullPage:false});
  await page.keyboard.press("Escape");
  await compactDialog.waitFor({state:"hidden",timeout});
  await page.setViewportSize({width:1440,height:900});
  console.log("PASS 1180px canvas readable and focus graph expanded beyond 1000px");
  console.log("PASS browser approved happy path: one CRM attempt, zero retries");

  await page.getByRole("button",{name:/Historial/}).click();
  await page.getByRole("heading",{name:"Ejecuciones guardadas"}).waitFor({timeout});
  assert.equal(new URL(page.url()).searchParams.get("view"),"activity");
  assert.equal(await page.getByRole("button",{name:/Historial/}).getAttribute("aria-current"),"page");
  await page.getByText(/búsqueda de texto no consulta otras páginas del servidor/i).waitFor({timeout});
  await page.getByLabel("Filtrar filas cargadas por lead o ID").fill("no_match_demo");
  await page.getByText(/No hay coincidencias en las páginas cargadas/).waitFor({timeout});
  await page.getByRole("button",{name:"Limpiar búsqueda"}).click();
  await page.locator(".historyRow").first().waitFor({timeout});
  console.log("PASS history search scope is honest and clearable, active view is semantic");
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
  assert.equal(new URL(page.url()).searchParams.get("view"),"crm");
  await page.goBack();
  await page.getByRole("heading",{name:"Historial de ejecuciones"}).waitFor({timeout});
  assert.equal(new URL(page.url()).searchParams.get("view"),"activity");
  await page.goForward();
  await page.getByRole("heading",{name:"CRM de demostración"}).waitFor({timeout});
  assert.equal(new URL(page.url()).searchParams.get("view"),"crm");
  console.log("PASS browser Back/Forward restores navigation and run context");
  const crmRows=page.locator(".slice2CRM tbody tr");
  assert.equal(await crmRows.count(),1);
  // Portfolio proof: capture the confirmed synthetic CRM record BEFORE leaving CRM.
  await page.screenshot({path:path.join(evidence,"04-confirmed-crm-desktop.png"),fullPage:true});
  await page.getByRole("button",{name:"Ver ejecución ↗"}).first().click();
  await page.getByRole("heading",{name:"Detalle de ejecución"}).waitFor({timeout});
  await page.screenshot({path:path.join(evidence,"04b-return-to-audit-desktop.png"),fullPage:true});
  console.log("PASS browser CRM row links to correct persisted execution");

  // Separate browser profile; must not see runs or CRM data from the first one.
  const isolated=await browser.newContext({viewport:{width:390,height:844}});
  const mobile=await isolated.newPage();
  mobile.on("pageerror",error=>errors.push(String(error)));
  await mobile.goto(base,{waitUntil:"domcontentloaded",timeout});
  await mobile.getByRole("heading",{name:"Tu automatización, paso a paso"}).waitFor({timeout});
  const mobileNavFont=await mobile.getByRole("button",{name:/Historial/})
    .evaluate(element=>Number.parseFloat(getComputedStyle(element).fontSize));
  assert.ok(mobileNavFont>=11,"Mobile navigation labels should not be hidden");
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
  console.log("PASS browser mobile labelled navigation, viewport and guest isolation");
  // Expiration and stale links must recover explicitly rather than trapping visitors.
  await context.clearCookies();
  await page.getByRole("button",{name:/Demo interactiva/}).click();
  await page.getByRole("button",{name:"Actualizar ejecución"}).click();
  await page.getByRole("button",{name:"Iniciar nueva sesión demo"}).waitFor({timeout});
  await page.screenshot({path:path.join(evidence,"06-expired-session-recovery.png"),fullPage:false});
  await page.getByRole("button",{name:"Iniciar nueva sesión demo"}).click();
  await page.getByText(/Nueva sesión de demostración activa/).waitFor({timeout});
  const restoredWorkspace=await page.locator(".sideBottom strong").innerText();
  assert.notEqual(restoredWorkspace,originalWorkspace);
  assert.equal(new URL(page.url()).searchParams.has("run"),false);
  await page.goto(base+"?view=activity&run="+currentID,{waitUntil:"domcontentloaded",timeout});
  await page.getByText(/ejecución del enlace pertenece a otra sesión demo o ya venció/).waitFor({timeout});
  assert.equal(new URL(page.url()).searchParams.has("run"),false,
    "Unowned deep link must not remain selected");
  console.log("PASS explicit expired-guest recovery and safe stale-run deep-link handling");
  // A transient GET /me server failure must not create a new workspace
  // automatically or leave visitors watching a permanent loading spinner.
  const broken=await browser.newContext({viewport:{width:1024,height:800}});
  const bootPage=await broken.newPage();
  let creates=0;
  bootPage.on("pageerror",error=>errors.push(String(error)));
  bootPage.on("request",request=>{
    if(request.method()==="POST"&&new URL(request.url()).pathname==="/v1/demo/sessions")creates++;
  });
  await bootPage.route("**/v1/demo/me",route=>route.fulfill({
    status:503,contentType:"application/json",
    body:JSON.stringify({error:{code:"TEMPORARY_UNAVAILABLE"}})
  }));
  await bootPage.goto(base,{waitUntil:"domcontentloaded",timeout});
  await bootPage.getByRole("button",{name:"Reintentar conexión"}).waitFor({timeout});
  assert.equal(creates,0,"Transient 503 must not silently create a new guest workspace");
  await bootPage.unroute("**/v1/demo/me");
  await bootPage.getByRole("button",{name:"Reintentar conexión"}).click();
  await bootPage.locator(".sideBottom strong").waitFor({timeout});
  await bootPage.locator(".graphNode").first().waitFor({timeout});
  assert.equal(creates,1,"Explicit retry should create exactly one isolated demo guest");
  console.log("PASS boot transient 503 shows retry and recovers without silent workspace churn");
  await broken.close();
  assert.deepEqual(errors,[],"Browser application must not produce uncaught runtime exceptions");
  await isolated.close();await context.close();
  console.log("PRODUCT_SLICE2_BROWSER_E2E_PASS");
}finally{
  await browser.close();
}

// The same CI job also verifies actual workflow authoring, v1/v2 editing and live execution.
await import("./browser-lab.mjs");
