"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Fixture={id:string;name:string;text:string;priority:"high"|"medium"|"low";category:string};
type Session={workspaceId:string;csrf:string;expiresAt:string;budgets:{runsRemaining:number;activeRuns:number};fixtures:Fixture[]};
type Event={sequence:number;eventType:string;nodeId:string|null;message:string;createdAt:string};
type Run={id:string;status:string;leadId:string;priority:string|null;category:string|null;attempts:number;lastEventSeq:number;createdAt:string};
type Approval={id:string;status:string;payloadDigest:string;expiresAt:string};
type Snapshot={execution:Run;events:Event[];approval:Approval|null;budgets:Session["budgets"]};
type Crm={id:string;externalKey:string;priority:string;category:string;updatedAt:string;executionId:string};
type Screen="demo"|"activity"|"crm";
const steps=[
  {id:"source",title:"Entrada",subtitle:"Webhook sintético",num:"01"},
  {id:"classify",title:"Clasificar",subtitle:"Fixture IA",num:"02"},
  {id:"branch",title:"Condición",subtitle:"Prioridad alta",num:"03"},
  {id:"approval",title:"Aprobación",subtitle:"Revisión humana",num:"04"},
  {id:"crm",title:"CRM Demo",subtitle:"Upsert confirmado",num:"05"},
  {id:"done_high",title:"Finalizar",subtitle:"Registro persistido",num:"06"}
];
const statusLabels:Record<string,string>={
  queued:"En cola",running:"Ejecutando",waiting_approval:"Esperando aprobación",
  retrying:"Reintentando",completed:"Completada",cancelled:"Cancelada",
  failed:"Falló",needs_review:"Necesita revisión"
};
const eventLabels:Record<string,string>={
  "execution.queued":"En cola","step.started":"Paso iniciado",
  "fixture.classified":"Clasificado","condition.evaluated":"Condición evaluada",
  "approval.requested":"Aprobación solicitada","approval.approved":"Aprobado",
  "approval.rejected":"Rechazado","approval.expired":"Aprobación vencida",
  "step.retry_scheduled":"Reintento programado","crm.confirmed":"CRM actualizado",
  "step.skipped":"Rama omitida","execution.completed":"Completado",
  "execution.cancelled":"Cancelado"
};
const displayTime=(time:string)=>new Date(time).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
async function requestJSON<T>(path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(path,{credentials:"include",cache:"no-store",...init});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error?.code??"HTTP_"+response.status);
  return body as T;
}
let firstSession:Promise<Session>|null=null;
function startSession():Promise<Session>{
  if(!firstSession){
    firstSession=requestJSON<Session>("/v1/demo/me").catch(()=>requestJSON<Session>("/v1/demo/sessions",{method:"POST"}))
      .catch(error=>{firstSession=null;throw error});
  }
  return firstSession;
}
export default function Dashboard(){
  const [session,setSession]=useState<Session|null>(null);
  const [fixtures,setFixtures]=useState<Fixture[]>([]);
  const [fixtureId,setFixtureId]=useState("lead_demo_001");
  const [failOnce,setFailOnce]=useState(false);
  const [runId,setRunId]=useState<string|null>(null);
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [crm,setCrm]=useState<Crm[]>([]);
  const [screen,setScreen]=useState<Screen>("demo");
  const [selectedNode,setSelectedNode]=useState("source");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [live,setLive]=useState(false);
  const refreshBusy=useRef(false);
  const selected=fixtures.find(x=>x.id===fixtureId);
  const refresh=useCallback(async()=>{
    if(refreshBusy.current)return;
    refreshBusy.current=true;
    try{
      const [details,records]=await Promise.all([
        runId?requestJSON<Snapshot>("/v1/demo/runs/"+runId):Promise.resolve(null),
        requestJSON<{items:Crm[]}>("/v1/demo/crm")
      ]);
      if(details){setSnapshot(details);setSession(s=>s?{...s,budgets:details.budgets}:s);}
      setCrm(records.items);
      setError("");
    }catch(e){setError(e instanceof Error?e.message:"ERROR_DE_CONEXION");}
    finally{refreshBusy.current=false;}
  },[runId]);

  useEffect(()=>{
    let mounted=true;
    void startSession().then(s=>{
      if(!mounted)return;
      setSession(s);setFixtures(s.fixtures);
      void requestJSON<{items:Crm[]}>("/v1/demo/crm").then(r=>{
        if(mounted)setCrm(r.items);
      }).catch(()=>{});
    }).catch(e=>{if(mounted)setError(e instanceof Error?e.message:"SESSION_ERROR");});
    return()=>{mounted=false};
  },[]);
  useEffect(()=>{
    if(!runId)return;
    void refresh();
    const interval=setInterval(()=>{void refresh()},2200);
    const source=new EventSource("/v1/executions/"+runId+"/events");
    source.addEventListener("execution-event",()=>{setLive(true);void refresh()});
    source.onopen=()=>setLive(true);
    source.onerror=()=>setLive(false);
    return()=>{clearInterval(interval);source.close();setLive(false)};
  },[runId,refresh]);
  async function start(){
    if(!session||busy)return;
    setBusy(true);setError("");setSnapshot(null);setRunId(null);
    try{
      const key=crypto.randomUUID();
      const data=await requestJSON<{executionId:string}>("/v1/demo/events",{
        method:"POST",headers:{"Content-Type":"application/json",
          "X-ACR-CSRF":session.csrf,"Idempotency-Key":key},
        body:JSON.stringify({fixtureId,simulateTransientFailureOnce:failOnce})
      });
      setScreen("demo");setSelectedNode("source");setRunId(data.executionId);
    }catch(e){setError(e instanceof Error?e.message:"START_FAILED");}
    finally{setBusy(false);}
  }
  async function decide(decision:"approved"|"rejected"){
    if(!session||!snapshot?.approval||busy)return;
    setBusy(true);setError("");
    try{
      await requestJSON("/v1/approvals/"+snapshot.approval.id+"/decision",{
        method:"POST",headers:{"Content-Type":"application/json","X-ACR-CSRF":session.csrf},
        body:JSON.stringify({decision,expectedPayloadDigest:snapshot.approval.payloadDigest})
      });
      await refresh();
    }catch(e){setError(e instanceof Error?e.message:"APPROVAL_FAILED");await refresh();}
    finally{setBusy(false);}
  }
  const executedNodeIds=new Set(snapshot?.events.map(x=>x.nodeId).filter(Boolean)??[]);
  const status=snapshot?.execution.status??"idle";
  const isHigh=snapshot?.execution.priority==="high";
  const cards=steps.map(step=>{
    const skipped=!!snapshot&&(!isHigh&&["approval","crm","done_high"].includes(step.id) &&
      snapshot.execution.status==="completed");
    const awaiting=step.id==="approval"&&status==="waiting_approval";
    const approved=!!snapshot?.events.some(e=>e.eventType==="approval.approved");
    const rejected=step.id==="approval"&&!!snapshot?.events.some(e=>e.eventType==="approval.rejected");
    const done=executedNodeIds.has(step.id) && (step.id!=="approval"||approved);
    return {...step,done,skipped,awaiting,rejected};
  });
  const currentNode=steps.find(s=>s.id===selectedNode);
  const nodeEvents=snapshot?.events.filter(event=>event.nodeId===selectedNode)??[];
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brandmark">◈</span><div><strong>Automation</strong><span>Control Room</span></div></div>
      <div className="navCaption">WORKSPACE</div>
      <nav className="sideNav" aria-label="Principal">
        <button className={screen==="demo"?"navItem current":"navItem"} onClick={()=>setScreen("demo")}><span>◫</span> Demo interactiva</button>
        <button className={screen==="activity"?"navItem current":"navItem"} onClick={()=>setScreen("activity")}><span>◷</span> Actividad</button>
        <button className={screen==="crm"?"navItem current":"navItem"} onClick={()=>setScreen("crm")}><span>▤</span> CRM ficticio <small>{crm.length}</small></button>
      </nav>
      <div className="sideBottom"><span className="sidebarDot"/> Sesión local aislada
        <p>Sin proveedores externos ni IA de pago.</p></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="breadcrumb">Automation Control Room <span>/</span> <strong>{screen==="demo"?"Demo":screen==="activity"?"Actividad":"CRM ficticio"}</strong></div>
        <div className="topRight"><span className="environment">LOCAL · FASE 5</span><a href="https://github.com/AlexiVion/automation-control-room" target="_blank" rel="noreferrer">GitHub ↗</a></div>
      </header>
      <div className="content">
        <div className="heading"><div><h1>{screen==="demo"?"Automatizaciones verificables":screen==="activity"?"Historial de ejecución":"CRM de demostración"}</h1>
          <p>{screen==="demo"?"Simulá un lead, tomá una decisión y seguí cada paso hasta PostgreSQL.":screen==="activity"?"Eventos persistidos en orden, no animaciones de resultado.":"Registros ficticios confirmados por el worker."}</p></div>
          <span className="modeTag"><span/> Clasificación determinista · sin LLM</span>
        </div>
        {error&&<div className="error" role="alert"><strong>Error:</strong> {error}<button onClick={()=>setError("")} aria-label="Cerrar error">×</button></div>}
        {!session&&<div className="empty"><span className="spinner"/> Creando workspace de demostración…</div>}
        {session&&screen==="demo"&&<>
          <section className="controls">
            <div className="choose"><label htmlFor="lead">Lead de demostración</label>
              <select id="lead" value={fixtureId} onChange={e=>setFixtureId(e.target.value)}>
                {fixtures.map(f=><option key={f.id} value={f.id}>{f.name} · {f.priority}</option>)}
              </select>
              <p>{selected?.text}</p>
            </div>
            <label className="toggle"><input type="checkbox" checked={failOnce} onChange={e=>setFailOnce(e.target.checked)}/><span>Simular fallo transitorio al escribir CRM</span></label>
            <button className="primary" disabled={busy||session.budgets.runsRemaining<=0} onClick={()=>void start()}>{busy?"Procesando…":"▶ Simular entrada"}</button>
          </section>
          <div className="metricBar">
            <div><span>ESTADO DE EJECUCIÓN</span><strong className={"state "+status}>{snapshot?statusLabels[status]??status:"Lista para empezar"}</strong></div>
            <div><span>EJECUCIONES DISPONIBLES</span><strong>{session.budgets.runsRemaining} <em>/ 5</em></strong></div>
            <div><span>REGISTROS EN CRM</span><strong>{crm.length}</strong></div>
            <div><span>EVENTOS PERSISTIDOS</span><strong>{snapshot?.events.length??0}</strong></div>
          </div>
          <div className="workspaceGrid">
            <section className="canvasPanel">
              <div className="panelHead"><div><h2>Flujo publicado</h2><p>Lead → Clasificación → Condición → Aprobación → CRM</p></div><div className="readOnly">● Solo lectura</div></div>
              <div className="flowCanvas">
                {!snapshot&&<div className="canvasHint">Elegí un lead y pulsá «Simular entrada» para comenzar una ejecución real.</div>}
                <div className="flowTrack">
                  {cards.map((step,i)=><div key={step.id} className="trackItem">
                    <button onClick={()=>setSelectedNode(step.id)} className={"flowNode "+(selectedNode===step.id?"selected ":"")+(step.done?"done ":"")+(step.skipped?"skipped ":"")+(step.awaiting?"awaiting ":"")+(step.rejected?"rejected ":"")} aria-label={step.title+": "+(step.skipped?"omitido":step.awaiting?"esperando aprobación":step.rejected?"rechazado":step.done?"completado":"pendiente")} aria-pressed={selectedNode===step.id}>
                      <span className="nodeNumber">{step.num}</span><span className="nodeBody"><strong>{step.title}</strong><small>{step.subtitle}</small></span>
                      <span className="nodeState">{step.skipped?"—":step.awaiting?"…":step.rejected?"×":step.done?"✓":"·"}</span>
                    </button>
                    {i<cards.length-1&&<div className="connector"><div/></div>}
                  </div>)}
                </div>
                <div className="falseBranch"><span>Rama false</span><strong>Prioridad media/baja → Finalizar sin CRM</strong></div>
              </div>
            </section>
            <section className="inspector">
              <div className="panelHead"><div><h2>Inspector</h2><p>{currentNode?.title??"Seleccioná un nodo"}</p></div><button className="plainButton" onClick={()=>void refresh()}>↻ Actualizar</button></div>
              {snapshot?<div className="inspectBody">
                <div className="field"><label>Execution ID</label><code title={snapshot.execution.id}>{snapshot.execution.id.slice(0,12)}…</code></div>
                <div className="field"><label>Estado verificado</label><strong>{statusLabels[status]??status}</strong></div>
                <div className="field"><label>Clasificación</label><span>{snapshot.execution.priority??"Pendiente"} / {snapshot.execution.category??"Pendiente"}</span></div>
                <div className="field"><label>Intentos</label><span>{snapshot.execution.attempts}</span></div>
                <div className="dividerLine"/>
                <h3>Eventos del nodo</h3>
                {nodeEvents.length?nodeEvents.map(e=><div className="miniEvent" key={e.sequence}><span className="miniSeq">#{e.sequence}</span><div><strong>{eventLabels[e.eventType]??e.eventType}</strong><p>{e.message}</p></div></div>):<p className="muted">Este nodo aún no tiene eventos persistidos.</p>}
              </div>:<div className="inspectEmpty">Los detalles aparecerán cuando comience una ejecución.</div>}
            </section>
          </div>
          {snapshot?.approval?.status==="pending"&&status==="waiting_approval"&&<section className="approvalCard">
            <div><span className="approvalIcon">!</span></div><div className="approvalInfo"><h2>Aprobación humana requerida</h2><p>Se creará o actualizará el lead <strong>{snapshot.execution.leadId}</strong> en el CRM ficticio. Esta decisión quedará registrada en PostgreSQL.</p><small>Caduca: {displayTime(snapshot.approval.expiresAt)} · No se publica en ningún servicio externo.</small></div>
            <div className="approvalActions"><button className="secondary" disabled={busy} onClick={()=>void decide("rejected")}>Rechazar</button><button className="primary" disabled={busy} onClick={()=>void decide("approved")}>Aprobar acción</button></div>
          </section>}
          <section className="timelinePanel"><div className="panelHead"><div><h2>Historial de eventos</h2><p>Orden durable de PostgreSQL</p></div><span className="streamStatus"><span className={live?"liveDot":"offlineDot"}/> {live?"Stream conectado":"Sincronización periódica"}</span></div>
            {snapshot?.events.length?<ol className="timeline">{snapshot.events.map(event=><li key={event.sequence}><span className="timelinePoint"/><span className="seq">#{String(event.sequence).padStart(2,"0")}</span><div><strong>{eventLabels[event.eventType]??event.eventType}</strong><p>{event.message}</p></div><time>{displayTime(event.createdAt)}</time></li>)}</ol>:<div className="timelineEmpty">Todavía no hay eventos. El historial aparecerá aquí.</div>}
          </section>
        </>}
        {session&&screen==="activity"&&<section className="timelinePanel"><div className="panelHead"><div><h2>Actividad actual</h2><p>Recuperada desde el servidor</p></div><button className="plainButton" onClick={()=>void refresh()}>Actualizar</button></div>
          {snapshot?.events.length?<ol className="timeline">{snapshot.events.map(e=><li key={e.sequence}><span className="timelinePoint"/><span className="seq">#{e.sequence}</span><div><strong>{eventLabels[e.eventType]??e.eventType}</strong><p>{e.message}</p></div><time>{displayTime(e.createdAt)}</time></li>)}</ol>:<div className="timelineEmpty">No hay ejecución seleccionada. Iniciá una desde la demo.</div>}
        </section>}
        {session&&screen==="crm"&&<section className="timelinePanel"><div className="panelHead"><div><h2>Registros confirmados</h2><p>Solo datos ficticios del workspace actual</p></div><button className="plainButton" onClick={()=>void refresh()}>Actualizar</button></div>
          {crm.length?<div className="tableScroll"><table><thead><tr><th>Lead</th><th>Categoría</th><th>Prioridad</th><th>Actualizado</th></tr></thead><tbody>{crm.map(row=><tr key={row.id}><td><strong>{row.externalKey}</strong></td><td>{row.category}</td><td>{row.priority}</td><td>{displayTime(row.updatedAt)}</td></tr>)}</tbody></table></div>:<div className="timelineEmpty">Todavía no hay registros confirmados. Aprobá un lead de prioridad alta para crear el primero.</div>}
        </section>}
        <footer>ACR · Fase 5 / Slice 1 · Demo local y determinista · Código abierto · Sin proveedores externos</footer>
      </div>
    </main>
  </div>
}
