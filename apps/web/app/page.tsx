"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import WorkflowCanvas, {type PublishedGraph, type CanvasEvent} from "../components/workflow-canvas";

type Fixture={id:string;name:string;text:string;priority:"high"|"medium"|"low";category:string};
type Session={workspaceId:string;csrf:string;expiresAt:string;budgets:{runsRemaining:number;activeRuns:number};fixtures:Fixture[]};
type Event=CanvasEvent;
type Run={id:string;status:string;leadId:string;priority:string|null;category:string|null;
  attempts:number;crmAttempts:number;retryCount:number;durationMs:number|null;lastEventSeq:number;
  createdAt:string;updatedAt:string};
type Approval={id:string;status:string;payloadDigest:string;expiresAt:string};
type Snapshot={execution:Run;events:Event[];approval:Approval|null;budgets:Session["budgets"]};
type HistoryRun={id:string;leadId:string;priority:string|null;category:string|null;status:string;
  createdAt:string;updatedAt:string;durationMs:number|null;crmAttempts:number;retryCount:number;
  eventCount:number;approvalStatus:string|null;workflowVersionId:string};
type HistoryPage={items:HistoryRun[];total:number;nextCursor:string|null};
type Crm={id:string;externalKey:string;priority:string;category:string;updatedAt:string;executionId:string};
type Workflow={id:string;name:string;graphDigest:string;graph:PublishedGraph};
type Screen="demo"|"activity"|"crm";
const statuses:Record<string,string>={
  queued:"En cola",running:"Ejecutando",waiting_approval:"Esperando aprobación",
  retrying:"Reintentando",completed:"Completada",cancelled:"Cancelada",
  failed:"Falló",needs_review:"Revisión necesaria"
};
const eventLabels:Record<string,string>={
  "execution.queued":"En cola","step.started":"Entrada recibida",
  "fixture.classified":"Clasificado","condition.evaluated":"Condición evaluada",
  "approval.requested":"Aprobación solicitada","approval.approved":"Aprobación confirmada",
  "approval.rejected":"Acción rechazada","approval.expired":"Aprobación vencida",
  "step.retry_scheduled":"Reintento programado","crm.confirmed":"CRM actualizado",
  "step.skipped":"Rama omitida","execution.completed":"Completado",
  "execution.cancelled":"Cancelado"
};
const statusOptions=[
  ["","Todas"],["completed","Completadas"],["waiting_approval","Pendientes"],
  ["cancelled","Canceladas"],["retrying","Reintentos"]
] as const;
const terminal=new Set(["completed","cancelled","failed","needs_review"]);
const humanError:Record<string,string>={
  SESSION_REQUIRED:"La sesión venció. Recargá la página para crear otra sesión demo.",
  DEMO_QUOTA_REACHED:"Se alcanzó el límite de 5 ejecuciones. La sesión tiene un presupuesto diario.",
  APPROVAL_ALREADY_DECIDED_OR_EXPIRED:"Esta aprobación ya fue decidida o caducó. El estado se volvió a consultar.",
  CSRF_REQUIRED:"No se pudo validar la sesión. Recargá la página.",
  INVALID_RUN_CURSOR:"El historial cambió o la página ya no es válida. Actualizá el listado.",
  INVALID_RUN_FILTER:"El filtro del historial no es válido."
};
const time=(date:string)=>new Date(date).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
const dateTime=(date:string)=>new Date(date).toLocaleString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
const duration=(ms:number|null)=>ms==null?"—":ms<1000?"< 1 s":ms<60_000?(ms/1000).toFixed(1)+" s":(ms/60_000).toFixed(1)+" min";
async function getJSON<T>(path:string,options?:RequestInit):Promise<T>{
  const response=await fetch(path,{credentials:"include",cache:"no-store",...options});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error?.code??"HTTP_"+response.status);
  return payload as T;
}
let initialSession:Promise<Session>|null=null;
function boot():Promise<Session>{
  if(!initialSession){
    initialSession=getJSON<Session>("/v1/demo/me")
      .catch(()=>getJSON<Session>("/v1/demo/sessions",{method:"POST"}))
      .catch(e=>{initialSession=null;throw e});
  }
  return initialSession;
}
function StatePill({status}:{status:string}){
  return <span className={`statePill statePill-${status}`}><i/>{statuses[status]??status}</span>;
}
function Timeline({events}:{events:Event[]}){
  if(!events.length)return <div className="slice2Empty">Esta ejecución todavía no tiene eventos persistidos.</div>;
  return <ol className="timeline elegantTimeline" aria-label="Eventos persistidos de la ejecución">
    {events.map(event=><li key={event.sequence}>
      <span className="timelinePoint"/><span className="seq">#{String(event.sequence).padStart(2,"0")}</span>
      <div><strong>{eventLabels[event.eventType]??event.eventType}</strong><p>{event.message}</p></div>
      <time dateTime={event.createdAt}>{time(event.createdAt)}</time>
    </li>)}
  </ol>;
}
function Summary({run,crmCount,remaining}:{run:Run|null;crmCount:number;remaining:number}){
  const rows=[
    ["EJECUCIÓN",run?statuses[run.status]??run.status:"Sin iniciar","status"],
    ["CRÉDITOS DE DEMO",remaining+" / 5","quota"],
    ["REGISTROS CRM",String(crmCount),"crm"],
    ["REINTENTOS",String(run?.retryCount??0),"retries"]
  ];
  return <div className="metricBar slice2Metrics">{rows.map(([label,value,kind])=>
    <div key={label} className="metricItem"><span>{label}</span>
      <strong className={kind==="status"?"metricStatus":""}>{value}</strong>
    </div>)}</div>;
}
const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[a-f0-9]{12}$/i;

export default function Dashboard(){
  const [session,setSession]=useState<Session|null>(null);
  const [workflow,setWorkflow]=useState<Workflow|null>(null);
  const [fixtures,setFixtures]=useState<Fixture[]>([]);
  const [fixtureId,setFixtureId]=useState("lead_demo_001");
  const [failOnce,setFailOnce]=useState(false);
  const [runId,setRunId]=useState<string|null>(null);
  const currentRun=useRef<string|null>(null);
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [crm,setCrm]=useState<Crm[]>([]);
  const [screen,setScreen]=useState<Screen>("demo");
  const [selectedNode,setSelectedNode]=useState("source");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const screenTitle=useRef<HTMLHeadingElement|null>(null);
  const previousScreen=useRef<Screen|null>(null);
  const sessionExpired=error==="SESSION_REQUIRED";
  const [streamConnected,setStreamConnected]=useState(false);
  const [hydrated,setHydrated]=useState(false);
  const [history,setHistory]=useState<HistoryRun[]>([]);
  const [historyTotal,setHistoryTotal]=useState(0);
  const [historyCursor,setHistoryCursor]=useState<string|null>(null);
  const [historyLoading,setHistoryLoading]=useState(false);
  const [filter,setFilter]=useState("");
  const [search,setSearch]=useState("");
  const historyRequest=useRef(0);
  const refreshLock=useRef(false);
  const lead=fixtures.find(f=>f.id===fixtureId);

  // Never persist tokens or workspace identifiers in a URL. An execution ID
  // remains scoped to the cookie on the API, and is safe to bookmark.
  // URL changes are navigable: Back/Forward restores selected run and screen.
  useEffect(()=>{
    const fromURL=()=>{
      const params=new URLSearchParams(window.location.search);
      const view=params.get("view");
      const selected=params.get("run");
      const id=selected&&uuidPattern.test(selected)?selected:null;
      if(currentRun.current!==id)setSnapshot(null);
      currentRun.current=id;
      setRunId(id);
      setScreen(view==="demo"||view==="activity"||view==="crm"?view:"demo");
    };
    fromURL();
    setHydrated(true);
    window.addEventListener("popstate",fromURL);
    return()=>window.removeEventListener("popstate",fromURL);
  },[]);
  useEffect(()=>{
    if(!hydrated)return;
    if(previousScreen.current!==null&&previousScreen.current!==screen){
      screenTitle.current?.focus();
    }
    previousScreen.current=screen;
  },[screen,hydrated]);
  const pushRoute=useCallback((view:Screen,id:string|null)=>{
    const url=new URL(window.location.href);
    url.searchParams.set("view",view);
    if(id)url.searchParams.set("run",id);
    else url.searchParams.delete("run");
    const target=url.pathname+url.search;
    if(target!==window.location.pathname+window.location.search){
      window.history.pushState(null,"",target);
    }
  },[]);
  useEffect(()=>{
    if(!hydrated)return;
    const url=new URL(window.location.href);
    url.searchParams.set("view",screen);
    if(runId)url.searchParams.set("run",runId);
    else url.searchParams.delete("run");
    window.history.replaceState(null,"",url.pathname+url.search);
  },[hydrated,screen,runId]);

  const reloadHistory=useCallback(async(reset=true,next?:string|null,filterValue=filter)=>{
    const sequence=++historyRequest.current;
    setHistoryLoading(true);
    try{
      const query=new URLSearchParams({limit:"5"});
      if(filterValue)query.set("status",filterValue);
      if(!reset&&next)query.set("cursor",next);
      const page=await getJSON<HistoryPage>("/v1/demo/runs?"+query.toString());
      if(sequence!==historyRequest.current)return;
      setHistory(previous=>reset?page.items:[...previous,...page.items.filter(x=>!previous.some(p=>p.id===x.id))]);
      setHistoryCursor(page.nextCursor);
      setHistoryTotal(page.total);
    }catch(e){
      if(sequence===historyRequest.current)setError(e instanceof Error?e.message:"HISTORY_FAILED");
    }finally{if(sequence===historyRequest.current)setHistoryLoading(false);}
  },[filter]);
  const refresh=useCallback(async()=>{
    if(refreshLock.current)return;
    refreshLock.current=true;
    const id=currentRun.current;
    try{
      const [details,records]=await Promise.all([
        id?getJSON<Snapshot>("/v1/demo/runs/"+id):Promise.resolve(null),
        getJSON<{items:Crm[]}>("/v1/demo/crm")
      ]);
      if(details&&id===currentRun.current){
        setSnapshot(details);
        setSession(s=>s?{...s,budgets:details.budgets}:s);
      }
      setCrm(records.items);
      setError("");
    }catch(e){
      const code=e instanceof Error?e.message:"REFRESH_FAILED";
      if(code==="EXECUTION_NOT_FOUND"&&id===currentRun.current){
        // Old links are not access grants: the active workspace is authoritative.
        currentRun.current=null;
        setRunId(null);
        setSnapshot(null);
        setSelectedNode("source");
        setNotice("La ejecución del enlace pertenece a otra sesión demo o ya venció.");
        setError("");
      }else setError(code);
    }
    finally{refreshLock.current=false;}
  },[]);
  const pickRun=useCallback((id:string,view:Screen="activity")=>{
    if(id!==currentRun.current){setSnapshot(null);setSelectedNode("source");}
    currentRun.current=id;
    setRunId(id);
    pushRoute(view,id);
    setScreen(view);
  },[pushRoute]);
  useEffect(()=>{
    let active=true;
    void boot().then(async s=>{
      if(!active)return;
      setSession(s);setFixtures(s.fixtures);
      try{
        const [graph,records]=await Promise.all([
          getJSON<Workflow>("/v1/demo/workflow"),
          getJSON<{items:Crm[]}>("/v1/demo/crm")
        ]);
        if(!active)return;
        setWorkflow(graph);setCrm(records.items);
        void reloadHistory(true);
      }catch(e){if(active)setError(e instanceof Error?e.message:"INITIAL_LOAD_FAILED");}
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:"SESSION_FAILED")});
    return()=>{active=false};
    // The initial boot is intentionally once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(()=>{
    if(!session||sessionExpired)return;
    void refresh();
    const timer=setInterval(()=>{void refresh()},2400);
    return()=>clearInterval(timer);
  },[runId,session?.workspaceId,refresh,sessionExpired]);
  useEffect(()=>{
    if(!session||!runId)return;
    const stream=new EventSource("/v1/executions/"+runId+"/events");
    stream.onopen=()=>setStreamConnected(true);
    stream.onerror=()=>setStreamConnected(false);
    stream.addEventListener("execution-event",()=>{void refresh()});
    return()=>{stream.close();setStreamConnected(false)};
  },[runId,session?.workspaceId,refresh]);
  useEffect(()=>{
    if(screen!=="activity"||!session||sessionExpired)return;
    void reloadHistory(true);
    // Explicit refresh preserves previously loaded cursor pages.
    // Run creation and approval also refresh the latest history.
  },[screen,session?.workspaceId,filter,reloadHistory,sessionExpired]);
  async function start(){
    if(!session||busy||session.budgets.runsRemaining<=0)return;
    setBusy(true);setError("");
    try{
      const accepted=await getJSON<{executionId:string}>("/v1/demo/events",{
        method:"POST",headers:{"Content-Type":"application/json",
          "X-ACR-CSRF":session.csrf,"Idempotency-Key":crypto.randomUUID()},
        body:JSON.stringify({fixtureId,simulateTransientFailureOnce:failOnce})
      });
      pickRun(accepted.executionId,"demo");
      await reloadHistory(true);
    }catch(e){setError(e instanceof Error?e.message:"START_FAILED");}
    finally{setBusy(false);}
  }
  async function decide(decision:"approved"|"rejected"){
    if(!session||!snapshot?.approval||busy)return;
    setBusy(true);setError("");
    try{
      await getJSON("/v1/approvals/"+snapshot.approval.id+"/decision",{
        method:"POST",headers:{"Content-Type":"application/json","X-ACR-CSRF":session.csrf},
        body:JSON.stringify({decision,expectedPayloadDigest:snapshot.approval.payloadDigest})
      });
      await refresh();await reloadHistory(true);
    }catch(e){setError(e instanceof Error?e.message:"APPROVAL_FAILED");await refresh();}
    finally{setBusy(false);}
  }
  const current=snapshot?.execution??null;
  const events=snapshot?.events??[];
  const node=workflow?.graph.nodes.find(n=>n.id===selectedNode);
  const nodeEvents=events.filter(e=>e.nodeId===selectedNode);
  const visibleHistory=history.filter(x=>{
    const needle=search.toLowerCase().trim();
    return !needle || (x.leadId+" "+x.id+" "+x.category).toLowerCase().includes(needle);
  });
  function navigation(view:Screen){
    if(view===screen)return;
    pushRoute(view,currentRun.current);
    setScreen(view);
  }
  async function renewDemo(){
    if(busy)return;
    setBusy(true);
    try{
      // The guest explicitly accepts starting a fresh isolated session.
      initialSession=null;
      const fresh=await boot();
      const [graph,records]=await Promise.all([
        getJSON<Workflow>("/v1/demo/workflow"),
        getJSON<{items:Crm[]}>("/v1/demo/crm")
      ]);
      currentRun.current=null;
      setRunId(null);
      setSnapshot(null);
      setSelectedNode("source");
      setHistory([]);
      setHistoryCursor(null);
      setHistoryTotal(0);
      setFixtures(fresh.fixtures);
      setWorkflow(graph);
      setCrm(records.items);
      setSession(fresh);
      setNotice("Nueva sesión de demostración activa. La sesión anterior no se comparte.");
      setScreen("demo");
      setError("");
      const url=new URL(window.location.href);
      url.searchParams.set("view","demo");
      url.searchParams.delete("run");
      window.history.replaceState(null,"",url.pathname+url.search);
      void reloadHistory(true);
    }catch(e){setError(e instanceof Error?e.message:"SESSION_RESTART_FAILED");}
    finally{setBusy(false);}
  }
  return <div className="shell slice2Shell">
    <a className="skipLink" href="#main-content">Saltar al contenido</a>
    <aside className="sidebar">
      <div className="brand"><span className="brandmark">◈</span><div><strong>Automation</strong><span>Control Room</span></div></div>
      <div className="navCaption">WORKSPACE</div>
      <nav className="sideNav" aria-label="Principal">
        <button className={screen==="demo"?"navItem current":"navItem"} aria-current={screen==="demo"?"page":undefined} title="Demo interactiva" onClick={()=>navigation("demo")}>
          <span>◫</span> Demo interactiva</button>
        <button className={screen==="activity"?"navItem current":"navItem"} aria-current={screen==="activity"?"page":undefined} title="Historial de ejecuciones" onClick={()=>navigation("activity")}>
          <span>◷</span> Historial <small>{historyTotal}</small></button>
        <button className={screen==="crm"?"navItem current":"navItem"} aria-current={screen==="crm"?"page":undefined} title="CRM ficticio" onClick={()=>navigation("crm")}>
          <span>▤</span> CRM ficticio <small>{crm.length}</small></button>
      </nav>
      <div className="sideBottom"><span className="sidebarDot"/> Sesión local aislada
        <p>Espacio demo: <strong title="Identificador abreviado del workspace">
          {session?session.workspaceId.slice(0,8):"Cargando…"}</strong></p>
        <p>Los datos del historial y CRM pertenecen únicamente a este espacio. Una sesión distinta comienza vacía.</p>
      </div>
    </aside>
    <main className="main" id="main-content" tabIndex={-1}>
      <header className="topbar">
        <div className="breadcrumb">Automation Control Room <span>/</span>
          <strong>{screen==="demo"?"Demo":screen==="activity"?"Historial de ejecuciones":"CRM ficticio"}</strong>
        </div>
        <div className="topRight"><span className="environment">LOCAL · SLICE 2</span>
          <a href="https://github.com/AlexiVion/automation-control-room/tree/feat/phase5-slice2-ux-history-20261104" target="_blank" rel="noreferrer">Código de demo ↗</a></div>
      </header>
      <div className="content slice2Content">
        <div className="heading slice2Heading">
          <div>
            <h1 ref={screenTitle} tabIndex={-1}>{screen==="demo"?"Tu automatización, paso a paso":screen==="activity"?"Historial de ejecuciones":"CRM de demostración"}</h1>
            <p>{screen==="demo"?"Cada decisión, evento y escritura se puede inspeccionar.":screen==="activity"?
              "Volvé a cualquier ejecución guardada en tu workspace.":"Registros sintéticos escritos y confirmados por PostgreSQL."}</p>
          </div>
          <span className="modeTag"><span/> Datos ficticios · clasificación determinista</span>
        </div>
        {error&&<div className="error" role="alert"><strong>Atención:</strong> {humanError[error]??error}
          {sessionExpired?<button type="button" className="sessionRecover" disabled={busy}
            onClick={()=>void renewDemo()}>{busy?"Iniciando…":"Iniciar nueva sesión demo"}</button>:
            <button onClick={()=>setError("")} aria-label="Cerrar error">×</button>}
        </div>}
        {notice&&<div className="sessionNotice" role="status">
          <span>{notice}</span><button type="button" onClick={()=>setNotice("")} aria-label="Cerrar aviso">×</button>
        </div>}
        {!session&&!sessionExpired&&<div className="empty"><span className="spinner"/> Iniciando workspace aislado…</div>}
        {session&&!sessionExpired&&screen==="demo"&&<>
          <section className="controls slice2Controls" aria-label="Iniciar una automatización sintética">
            <div className="choose"><label htmlFor="fixtureSelect">Lead de demostración</label>
              <select id="fixtureSelect" value={fixtureId} onChange={e=>setFixtureId(e.target.value)}>
                {fixtures.map(f=><option key={f.id} value={f.id}>{f.name} · {f.priority}</option>)}
              </select><p>{lead?.text}</p>
              <p className="demoWalkthrough">Elegí un caso, iniciá la ejecución y aprobá la escritura solo si se solicita.</p>
            </div>
            <label className="toggle"><input type="checkbox" checked={failOnce}
              onChange={e=>setFailOnce(e.target.checked)}/>
              <span>Probar un reintento seguro en el CRM</span></label>
            <button className="primary" disabled={busy||session.budgets.runsRemaining<=0}
              onClick={()=>void start()}>{busy?"Procesando…":"▶ Iniciar automatización"}</button>
          </section>
          <Summary run={current} crmCount={crm.length} remaining={session.budgets.runsRemaining}/>
          <p className="srOnly" role="status" aria-live="polite" aria-atomic="true">
            {current?("Ejecución "+(statuses[current.status]??current.status)+". "+current.lastEventSeq+" eventos persistidos."): "Ninguna ejecución seleccionada."}
          </p>
          {snapshot?.approval?.status==="pending"&&current?.status==="waiting_approval"&&
            <section className="approvalCard slice2Approval" aria-label="Aprobación pendiente">
              <div><span className="approvalIcon">!</span></div>
              <div className="approvalInfo"><h2>Esta acción necesita tu aprobación</h2>
                <p>Se creará o actualizará <strong>{current.leadId}</strong> en el CRM ficticio.
                  La decisión se guarda en PostgreSQL y puede revisarse en el historial.</p>
                <small>Caduca {dateTime(snapshot.approval.expiresAt)} · Sin integraciones externas.</small></div>
              <div className="approvalActions">
                <button className="secondary" disabled={busy} onClick={()=>void decide("rejected")}>Rechazar</button>
                <button className="primary" disabled={busy} onClick={()=>void decide("approved")}>Aprobar escritura</button></div>
            </section>}
          <div className="slice2Studio">
            <WorkflowCanvas graph={workflow?.graph??null} digest={workflow?.graphDigest}
              events={events} execution={current} selectedNode={selectedNode}
              onSelect={setSelectedNode}/>
            <aside className="slice2Inspector" aria-label="Inspector de nodo">
              <div className="slice2InspectorHead"><span>INSPECTOR</span>
                <button onClick={()=>void refresh()} aria-label="Actualizar ejecución">↻ Actualizar</button></div>
              <div className="slice2InspectorTitle"><span className="inspectorSymbol">◇</span>
                <div><h2>{node?.type.replaceAll("."," / ")??"Seleccioná un nodo"}</h2>
                  <p>{node?.id??"Sin ejecución"}</p></div></div>
              {current?<div className="inspectorData">
                <div><span>Estado del run</span><StatePill status={current.status}/></div>
                <div><span>Lead</span><strong>{current.leadId}</strong></div>
                <div><span>Intentos CRM</span><strong>{current.crmAttempts}</strong></div>
                <div><span>Reintentos</span><strong>{current.retryCount}</strong></div>
                <div><span>Duración</span><strong>{duration(current.durationMs)}</strong></div>
                <div><span>Último evento</span><strong>#{current.lastEventSeq}</strong></div>
              </div>:<div className="slice2InspectorEmpty">Iniciá una ejecución para ver métricas reales y eventos.</div>}
              <div className="inspectorNodeEvents"><h3>Auditoría del nodo</h3>
                {nodeEvents.length?nodeEvents.map(e=><div key={e.sequence} className="miniEvent">
                  <span className="miniSeq">#{e.sequence}</span><div>
                    <strong>{eventLabels[e.eventType]??e.eventType}</strong>
                    <p>{e.message}</p></div></div>):<p className="muted">Aún no hay eventos confirmados de este nodo.</p>}
              </div>
              {current&&<button className="inspectorRunLink" onClick={()=>pickRun(current.id,"activity")}>Abrir historial completo ↗</button>}
            </aside>
          </div>
          <section className="timelinePanel slice2Timeline">
            <div className="panelHead"><div><h2>Timeline de la ejecución</h2>
              <p>Eventos almacenados en PostgreSQL, en orden de secuencia.</p></div>
              <span className="streamStatus"><span className={streamConnected?"liveDot":"offlineDot"}/>
                {streamConnected?"Stream conectado":"Sincronizando"}</span></div>
            <Timeline events={events}/>
          </section>
        </>}
        {session&&!sessionExpired&&screen==="activity"&&<div className="historyLayout">
          <section className="historyPanel" aria-label="Listado de ejecuciones guardadas">
            <div className="historyPanelHead"><div><h2>Ejecuciones guardadas</h2>
              <p>{historyTotal} resultados en tu sesión</p></div>
              <button className="plainButton" onClick={()=>void reloadHistory(true)}
                disabled={historyLoading}>↻</button></div>
            <div className="historyFilters">
              <label htmlFor="runSearch">Filtrar filas cargadas por lead o ID</label>
              <input id="runSearch" type="search" value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Buscar ejecución…" />
              <label htmlFor="runStatus">Estado</label>
              <select id="runStatus" value={filter} onChange={e=>{setFilter(e.target.value);setHistory([]);setHistoryCursor(null)}}>
                {statusOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
              </select>
              <p className="historySearchHelp" id="historySearchHelp">
                {visibleHistory.length} coincidencias entre {history.length} ejecuciones cargadas.
                La búsqueda de texto no consulta otras páginas del servidor.
              </p>
              {search&&<button type="button" className="historyClear" onClick={()=>setSearch("")}>
                Limpiar búsqueda
              </button>}
            </div>
            <div className="historyItems">
              {visibleHistory.map(item=><button key={item.id} className={"historyRow "+(runId===item.id?"selected":"")}
                onClick={()=>pickRun(item.id,"activity")} aria-pressed={runId===item.id}>
                <span className="historyRowTop"><strong>{item.leadId}</strong><StatePill status={item.status}/></span>
                <span className="historyRowMeta">{dateTime(item.createdAt)} · {item.eventCount} eventos</span>
                <span className="historyRowFooter"><span>{item.id.slice(0,11)}…</span>
                  <span>{item.retryCount} reintentos</span></span>
              </button>)}
              {!visibleHistory.length&&!historyLoading&&<div className="historyEmpty">
                {search?"No hay coincidencias en las páginas cargadas. Podés cargar más páginas o limpiar la búsqueda.":"No hay ejecuciones para este filtro."}
              </div>}
              {historyLoading&&<div className="historyLoading">Consultando historial…</div>}
              {historyCursor&&<button className="historyMore" disabled={historyLoading}
                onClick={()=>void reloadHistory(false,historyCursor)}>Cargar anteriores ↓</button>}
            </div>
          </section>
          <section className="historyDetail">
            <div className="historyDetailHeader"><div><span className="sectionOverline">AUDITORÍA</span>
              <h2>{current?"Detalle de ejecución":"Seleccioná una ejecución"}</h2>
              <p>{current?current.id:"Elegí una fila a la izquierda para consultar los eventos reales."}</p></div>
              {current&&<StatePill status={current.status}/>}</div>
            {current&&<div className="historyDetailStats">
              <div><span>CREADA</span><strong>{dateTime(current.createdAt)}</strong></div>
              <div><span>DURACIÓN</span><strong>{duration(current.durationMs)}</strong></div>
              <div><span>INTENTOS CRM</span><strong>{current.crmAttempts}</strong></div>
              <div><span>REINTENTOS</span><strong>{current.retryCount}</strong></div>
            </div>}
            <div className="historyDetailTimeline"><Timeline events={events}/></div>
            {current&&<div className="historyDetailBottom"><button className="secondary"
              onClick={()=>pickRun(current.id,"demo")}>Ver en el diagrama ↗</button>
              <span>Workflow publicado · datos ficticios</span></div>}
          </section>
        </div>}
        {session&&!sessionExpired&&screen==="crm"&&<section className="timelinePanel slice2CRM">
          <div className="panelHead"><div><h2>Registros confirmados</h2>
            <p>Una fila por lead y workspace. Cada escritura puede rastrearse hasta su ejecución.</p></div>
            <button className="plainButton" onClick={()=>void refresh()}>↻ Actualizar</button></div>
          {crm.length?<div className="tableScroll"><table><thead>
            <tr><th>LEAD</th><th>CATEGORÍA</th><th>PRIORIDAD</th><th>ÚLTIMA ACTUALIZACIÓN</th><th>EVIDENCIA</th></tr>
          </thead><tbody>{crm.map(row=><tr key={row.id}>
            <td><strong>{row.externalKey}</strong></td><td>{row.category}</td>
            <td><span className="priorityPill">{row.priority}</span></td><td>{dateTime(row.updatedAt)}</td>
            <td><button className="plainButton" onClick={()=>pickRun(row.executionId,"activity")}>Ver ejecución ↗</button></td>
          </tr>)}</tbody></table></div>:<div className="slice2Empty">
            <strong>Aún no hay escrituras confirmadas.</strong>
            <p>Iniciá un lead de prioridad alta y aprobá la acción desde Demo interactiva.</p>
            <button className="primary" onClick={()=>navigation("demo")}>Ir a la demo</button>
          </div>}
        </section>}
        <footer>Automation Control Room · Fase 5 / Slice 2 · Demo local · Datos sintéticos · Código abierto</footer>
      </div>
    </main>
  </div>;
}
