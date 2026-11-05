"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow, Controls, Background, MiniMap, Handle, Position,
  useNodesState, useEdgesState, MarkerType, BackgroundVariant,
  type Node, type Edge, type NodeProps, type Connection,
  type NodeChange, type EdgeChange
} from "@xyflow/react";
import {
  labKinds, labTemplates, initialConfig,
  type LabKind, type LabDraft
} from "../../lib/lab-templates";
import "./lab.css";

type NodeData = Record<string,unknown> & {
  kind:LabKind;label:string;config:Record<string,unknown>;
  runState?:string;
};
type StudioNode=Node<NodeData,"studio">;
type StudioEdge=Edge;
type Session={workspaceId:string;csrf:string};
type Version={id:string;versionNo:number;graphDigest:string;publishedAt:string};
type Workflow={
  id:string;name:string;draft:LabDraft;draftRevision:number;
  publishedRevision:number;versions:Version[];
};
type WorkflowRow={
  id:string;name:string;draftRevision:number;publishedRevision:number;
  versions:{id:string;versionNo:number}[];
};
type TraceStep={nodeId:string;type:string;status:string;branch?:string;message:string};
type Run={
  id:string;versionId:string;status:string;approvalNodeId:string|null;
  approvalReason:string|null;trace:TraceStep[];
  version:{versionNo:number;workflowId:string;graphDigest:string};
};
let sessionPromise:Promise<Session>|null=null;
async function fetchJSON<T>(path:string,method="GET",csrf?:string,body?:unknown):Promise<T>{
  const response=await fetch(path,{credentials:"include",cache:"no-store",method,
    headers:{"Content-Type":"application/json",...(csrf?{"X-ACR-CSRF":csrf}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const value=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(value.error?.code??"HTTP_"+response.status);
  return value as T;
}
async function sessionBoot():Promise<Session>{
  if(!sessionPromise){
    sessionPromise=fetchJSON<Session>("/v1/demo/me").catch(err=>{
      if(err instanceof Error&&err.message==="SESSION_REQUIRED")
        return fetchJSON<Session>("/v1/demo/sessions","POST");
      throw err;
    }).catch(error=>{sessionPromise=null;throw error;});
  }
  return sessionPromise;
}
const meta=(kind:LabKind)=>labKinds.find(x=>x.kind===kind)??labKinds[0];
const uid=(prefix:string)=>prefix+"_"+crypto.randomUUID().replace(/-/g,"").slice(0,17);

function FlowCard({data,selected}:NodeProps<StudioNode>){
  const detail=meta(data.kind);
  const condition=data.kind==="condition";
  const done=data.kind==="finish";
  const start=data.kind==="webhook.trigger";
  return <div className={"labFlowCard "+(selected?"selected ":"")+
    (data.runState?"is-"+data.runState:"")} aria-label={detail.title}>
    {!start&&<Handle type="target" position={Position.Left} id="in"/>}
    <span className="labFlowKind">{detail.title}</span>
    <strong>{data.label}</strong>
    <small>{detail.description}</small>
    {data.runState&&<span className="labFlowRunState">{data.runState}</span>}
    {!done&&(condition?<>
      <Handle type="source" id="true" position={Position.Right}
        style={{top:"34%",background:"#159b83"}}/>
      <Handle type="source" id="false" position={Position.Right}
        style={{top:"73%",background:"#d59b4e"}}/>
    </>:<Handle type="source" id="next" position={Position.Right}/>)}
    {condition&&<span className="labHandleLabels" aria-hidden="true">SÍ<br/>NO</span>}
  </div>;
}
const types={studio:FlowCard};
function intoFlow(graph:LabDraft):{nodes:StudioNode[];edges:StudioEdge[]}{
  const lookup=new Map(graph.nodes.map(node=>[node.id,node]));
  return {
    nodes:graph.nodes.map((node,i)=>({
      id:node.id,type:"studio" as const,position:{x:60+(i%4)*250,y:90+Math.floor(i/4)*180},
      data:{kind:node.type,label:node.id,config:structuredClone(node.config)}
    })),
    edges:graph.edges.map(edge=>({
      id:edge.id,source:edge.source,target:edge.target,
      sourceHandle:edge.branch??"next",type:"smoothstep",
      label:edge.branch==="true"?"SÍ":edge.branch==="false"?"NO":undefined,
      animated:false,markerEnd:{type:MarkerType.ArrowClosed},
      style:{stroke:edge.branch==="false"?"#bc9560":"#79979c",strokeWidth:2}
    }))
  };
}
function intoDraft(nodes:StudioNode[],edges:StudioEdge[]):LabDraft {
  const trigger=nodes.find(node=>node.data.kind==="webhook.trigger");
  return {schemaVersion:1,trigger:{nodeId:trigger?.id??"missing_trigger"},
    nodes:nodes.map(node=>({
      id:node.id,type:node.data.kind,config:structuredClone(node.data.config)
    })),
    edges:edges.map(edge=>{
      const source=nodes.find(node=>node.id===edge.source);
      const branch=source?.data.kind==="condition"?
        edge.sourceHandle==="false"?"false":"true":undefined;
      return {id:edge.id,source:edge.source,target:edge.target,...(branch?{branch}:{})};
    })
  };
}
const terminal=new Set(["completed","cancelled","failed"]);

export default function WorkflowLab(){
  const [session,setSession]=useState<Session|null>(null);
  const [items,setItems]=useState<WorkflowRow[]>([]);
  const [workflowId,setWorkflowId]=useState<string|null>(null);
  const [workflowName,setWorkflowName]=useState("Mi primera automatización");
  const [revision,setRevision]=useState(0);
  const [versions,setVersions]=useState<Version[]>([]);
  const [versionId,setVersionId]=useState<string>("");
  const [dirty,setDirty]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [selected,setSelected]=useState<string|null>(null);
  const [nodes,setNodes,onNodesChange]=useNodesState<StudioNode>(intoFlow(labTemplates[0].draft).nodes);
  const [edges,setEdges,onEdgesChange]=useEdgesState<StudioEdge>(intoFlow(labTemplates[0].draft).edges);
  const [input,setInput]=useState('{"id":"lead-001","priority":"high","category":"automation"}');
  const [runId,setRunId]=useState<string|null>(null);
  const [run,setRun]=useState<Run|null>(null);
  const [runHistory,setRunHistory]=useState<{id:string;versionId:string;status:string}[]>([]);
  const [historyRuns,setHistoryRuns]=useState<Run[]>([]);
  const [activeTab,setActiveTab]=useState<"trace"|"compare">("trace");
  const latestVersion=versions[0];

  const reloadList=useCallback(async()=>{
    const result=await fetchJSON<{items:WorkflowRow[]}>("/v1/lab/workflows");
    setItems(result.items);
  },[]);
  const reloadHistory=useCallback(async()=>{
    const result=await fetchJSON<{items:{id:string;versionId:string;status:string}[]}>("/v1/lab/runs");
    setRunHistory(result.items);
  },[]);
  useEffect(()=>{
    let live=true;
    void sessionBoot().then(async sess=>{
      if(!live)return;
      setSession(sess);
      await Promise.all([reloadList(),reloadHistory()]);
    }).catch(err=>{if(live)setError(String(err instanceof Error?err.message:err));});
    return()=>{live=false;};
  },[reloadHistory,reloadList]);

  function useGraph(graph:LabDraft){
    const view=intoFlow(graph);
    setNodes(view.nodes);
    setEdges(view.edges);
    setSelected(null);
    setRun(null);setRunId(null);
  }
  function selectTemplate(template:typeof labTemplates[number]){
    useGraph(structuredClone(template.draft));
    setWorkflowId(null);setRevision(0);setVersions([]);setVersionId("");
    setWorkflowName("Mi workflow de "+template.label.toLowerCase());
    setDirty(true);setNotice("Editá el grafo, guardá y publicá antes de ejecutarlo.");
    setError("");
  }
  async function openWorkflow(id:string){
    setBusy(true);setError("");
    try{
      const w=await fetchJSON<Workflow>("/v1/lab/workflows/"+id);
      useGraph(w.draft);
      setWorkflowId(w.id);setWorkflowName(w.name);setRevision(w.draftRevision);
      setVersions(w.versions);setVersionId(w.versions[0]?.id??"");
      setDirty(false);setNotice("Borrador cargado. Las versiones anteriores no se modifican.");
    }catch(e){setError(String(e instanceof Error?e.message:e))}
    finally{setBusy(false)}
  }
  const markedNodes=useMemo(()=>{
    const trace=run?.trace??[];
    const map=new Map(trace.map(step=>[step.nodeId,step.status]));
    return nodes.map(n=>({...n,data:{...n.data,
      runState:map.get(n.id)}}));
  },[nodes,run?.trace]);
  const selectedNode=nodes.find(n=>n.id===selected);
  function changeConfig(next:Record<string,unknown>){
    if(!selected)return;
    setNodes(current=>current.map(n=>n.id===selected?{
      ...n,data:{...n.data,config:next}
    }:n));
    setDirty(true);
  }
  function addNode(kind:LabKind){
    if(nodes.length>=12){setError("Límite: 12 nodos por workflow de demostración.");return;}
    if(kind==="webhook.trigger"&&nodes.some(n=>n.data.kind===kind)){
      setError("Solo puede haber una entrada por workflow.");return;
    }
    const id=uid("node");
    setNodes(current=>[...current,{
      id,type:"studio",position:{x:120+current.length*45,y:120+current.length*24},
      data:{kind,label:id,config:initialConfig(kind)}
    }]);
    setSelected(id);setDirty(true);setError("");
  }
  const nodesChanged=useCallback((changes:NodeChange<StudioNode>[])=>{
    onNodesChange(changes);
    if(changes.some(c=>c.type!=="select"))setDirty(true);
  },[onNodesChange]);
  const edgesChanged=useCallback((changes:EdgeChange<StudioEdge>[])=>{
    onEdgesChange(changes);
    if(changes.some(c=>c.type!=="select"))setDirty(true);
  },[onEdgesChange]);
  const connected=useCallback((c:Connection)=>{
    if(!c.source||!c.target||c.source===c.target)return;
    const source=nodes.find(n=>n.id===c.source);
    if(!source||source.data.kind==="finish")return;
    const handle=source.data.kind==="condition"?
      c.sourceHandle==="false"?"false":"true":"next";
    const branch=handle==="true"?"SÍ":handle==="false"?"NO":undefined;
    setEdges(current=>[...current.filter(e=>!(e.source===c.source&&
      e.sourceHandle===handle)),{
      id:uid("edge"),source:c.source!,target:c.target!,sourceHandle:handle,
      type:"smoothstep",markerEnd:{type:MarkerType.ArrowClosed},
      label:branch,style:{stroke:"#79979c",strokeWidth:2}
    }]);
    setDirty(true);
  },[nodes,setEdges]);

  async function saveDraft():Promise<{id:string;revision:number}>{
    if(!session)throw new Error("SESSION_REQUIRED");
    const draft=intoDraft(nodes,edges);
    if(!workflowId){
      const created=await fetchJSON<{
        workflowId:string;draftRevision:number
      }>("/v1/lab/workflows","POST",session.csrf,
        {name:workflowName,draft});
      setWorkflowId(created.workflowId);setRevision(created.draftRevision);
      setDirty(false);
      await reloadList();
      return {id:created.workflowId,revision:created.draftRevision};
    }
    if(!dirty)return {id:workflowId,revision};
    const saved=await fetchJSON<{draftRevision:number}>(
      "/v1/lab/workflows/"+workflowId+"/draft","PUT",session.csrf,
      {expectedRevision:revision,name:workflowName,draft});
    setRevision(saved.draftRevision);setDirty(false);
    await reloadList();
    return {id:workflowId,revision:saved.draftRevision};
  }
  async function save(){
    setBusy(true);setError("");
    try{await saveDraft();setNotice("Borrador guardado en PostgreSQL. Publicá para ejecutarlo.");}
    catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  async function publish(){
    setBusy(true);setError("");
    try{
      const saved=await saveDraft();
      const version=await fetchJSON<{versionId:string;versionNo:number}>(
        "/v1/lab/workflows/"+saved.id+"/publish","POST",session?.csrf,
        {expectedRevision:saved.revision});
      const fresh=await fetchJSON<Workflow>("/v1/lab/workflows/"+saved.id);
      setVersions(fresh.versions);setVersionId(version.versionId);
      setNotice("Versión "+version.versionNo+" publicada. Esta definición ya es inmutable.");
      await reloadList();
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  async function start(){
    if(!workflowId||!session||!versionId)return;
    setBusy(true);setError("");setNotice("");
    try{
      const submitted=JSON.parse(input);
      if(!submitted||typeof submitted!=="object"||Array.isArray(submitted))
        throw new Error("La entrada debe ser un objeto JSON.");
      const result=await fetchJSON<{executionId:string}>(
        "/v1/lab/workflows/"+workflowId+"/runs","POST",session.csrf,
        {input:submitted,versionId});
      setRunId(result.executionId);setRun(null);
      setNotice("Ejecutando en el worker real sobre la versión elegida.");
      await reloadHistory();
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  useEffect(()=>{
    if(!runId)return;
    let active=true;
    const refresh=async()=>{
      try{
        const next=await fetchJSON<Run>("/v1/lab/runs/"+runId);
        if(!active)return;
        setRun(next);
        if(terminal.has(next.status)){void reloadHistory();}
      }catch(e){if(active)setError(e instanceof Error?e.message:String(e))}
    };
    const interval=setInterval(()=>{void refresh()},800);
    void refresh();
    return()=>{active=false;clearInterval(interval)};
  },[runId,reloadHistory]);
  async function decide(decision:"approved"|"rejected"){
    if(!session||!runId||busy)return;
    setBusy(true);setError("");
    try{
      await fetchJSON("/v1/lab/runs/"+runId+"/decision","POST",session.csrf,{decision});
      setNotice(decision==="approved"?"Decisión enviada al worker.":"Rechazo registrado; no se ejecutará la escritura.");
      setRun(prev=>prev?{...prev,status:decision==="approved"?"queued":"cancelled"}:prev);
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  async function compare(){
    const allowed=new Set(versions.map(v=>v.id));
    const perVersion=new Map<string,typeof runHistory[number]>();
    for(const item of runHistory){if(allowed.has(item.versionId)&&!perVersion.has(item.versionId))perVersion.set(item.versionId,item);}
    const selectedRuns=[...perVersion.values()].slice(0,2);
    try{
      const details=await Promise.all(selectedRuns.map(item=>
        fetchJSON<Run>("/v1/lab/runs/"+item.id)));
      setHistoryRuns(details);setActiveTab("compare");
    }catch(e){setError(e instanceof Error?e.message:String(e))}
  }
  function removeSelected(){
    if(!selected)return;
    setNodes(current=>current.filter(n=>n.id!==selected));
    setEdges(current=>current.filter(e=>e.source!==selected&&e.target!==selected));
    setSelected(null);setDirty(true);
  }

  return <div className="labApp">
    <aside className="labSidebar">
      <a className="labBrand" href="/"><span className="labLogo">◈</span>
        <span><strong>CONTROL ROOM</strong><small>WORKFLOW LAB / LOCAL</small></span></a>
      <div className="labSideGroup">
        <span className="labSideLabel">EMPEZAR</span>
        {labTemplates.map(template=><button key={template.id}
          className="labTemplate" onClick={()=>selectTemplate(template)}>
          <span>✳</span><span><strong>{template.label}</strong>
          <small>{template.subtitle}</small></span><span>+</span></button>)}
      </div>
      <div className="labSideGroup">
        <span className="labSideLabel">TUS WORKFLOWS</span>
        {items.length===0?<p className="labSidebarEmpty">Todavía no guardaste ninguno.</p>:
          items.map(w=><button className={"labSaved "+(workflowId===w.id?"active":"")}
            onClick={()=>void openWorkflow(w.id)} key={w.id}>
            <span>◇</span><span>{w.name}</span><small>
              {w.versions[0]?"v"+w.versions[0].versionNo:"Borrador"}</small></button>)}
      </div>
      <div className="labSidebarFoot"><strong>Sandbox protegido</strong>
        <p>Todos los registros y workflows pertenecen a esta sesión. Sin IA externa, sin conexiones reales.</p>
        <a href="/">← Vista técnica anterior</a></div>
    </aside>
    <main className="labMain">
      <header className="labTopbar">
        <div><span className="labOverline">ESTUDIO DE AUTOMATIZACIONES</span>
          <h1>Construí. Ejecutá. Cambiá el resultado.</h1>
          <p>Los nodos que conectás determinan lo que hace el backend. No es una animación.</p></div>
        <span className="labLocalTag">● LOCAL · DATOS DE PRUEBA</span>
      </header>
      {error&&<div className="labAlert" role="alert">{error}
        <button aria-label="Cerrar error" onClick={()=>setError("")}>×</button></div>}
      {notice&&<div className="labNotice" role="status">{notice}</div>}
      {!session&&<div className="labNotice" role="status">Conectando con tu espacio de laboratorio…</div>}
      <section className="labToolbar">
        <label className="labWorkflowName">WORKFLOW
          <input value={workflowName} onChange={e=>{setWorkflowName(e.target.value);setDirty(true)}}
            aria-label="Nombre del workflow" maxLength={90}/></label>
        <div className="labToolbarActions">
          <span className={"labDirty "+(dirty?"unsaved":"")}>{dirty?"Cambios sin guardar":"Borrador guardado"}</span>
          <button className="labBtnNeutral" disabled={!session||busy} onClick={()=>void save()}>Guardar</button>
          <button className="labBtnPrimary" disabled={!session||busy} onClick={()=>void publish()}>Publicar versión ↗</button>
        </div>
      </section>
      <div className="labWorkspace">
        <aside className="labPalette">
          <span className="labPanelLabel">BLOQUES DISPONIBLES</span>
          <p>Agregá nodos y unilos desde sus conectores.</p>
          {labKinds.map(k=><button key={k.kind} onClick={()=>addNode(k.kind)}
            className="labPaletteOption" title={k.description}>
            <span className="labPalettePlus">+</span><span><strong>{k.title}</strong><small>{k.description}</small></span></button>)}
          <div className="labPaletteHint">El editor admite hasta 12 nodos por workflow. Las conexiones determinan el recorrido.</div>
        </aside>
        <div className="labCanvasWrap">
          <div className="labCanvasTitle"><span><span className="labCanvasDot"/> EDITOR VISUAL · GRAFO REAL</span>
            <small>{nodes.length} nodos / {edges.length} conexiones</small></div>
          <div className="labCanvas" aria-label="Editor de workflow">
            <ReactFlow<StudioNode,StudioEdge>
              nodes={markedNodes} edges={edges}
              onNodesChange={nodesChanged} onEdgesChange={edgesChanged}
              onConnect={connected} onNodeClick={(_,node)=>setSelected(node.id)}
              onPaneClick={()=>setSelected(null)} nodeTypes={types}
              fitView minZoom={0.25} maxZoom={1.7}
              proOptions={{hideAttribution:false}}
              deleteKeyCode={["Backspace","Delete"]}
              defaultEdgeOptions={{type:"smoothstep"}}>
              <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#cad6d9"/>
              <MiniMap zoomable pannable maskColor="rgba(18,34,49,.06)" />
              <Controls position="bottom-left"/>
            </ReactFlow>
          </div>
          <div className="labCanvasFoot"><span><i/> Conexión verde: rama SÍ</span>
            <span><i/> Rama NO: segunda salida de Condición</span>
            <span>Arrastrá los nodos para organizar tu flujo</span></div>
        </div>
        <aside className="labInspector">
          <span className="labPanelLabel">CONFIGURACIÓN</span>
          {!selectedNode?<div className="labInspectorEmpty"><span>◎</span><strong>Seleccioná un nodo</strong>
            <p>Modificá las reglas y acciones. El backend ejecutará la definición publicada.</p></div>:
            <div className="labConfig">
              <div className="labConfigHeader"><strong>{meta(selectedNode.data.kind).title}</strong>
                <small>{selectedNode.id}</small></div>
              {selectedNode.data.kind==="webhook.trigger"&&
                <label>Origen local
                  <input value={String(selectedNode.data.config.sourceKey??"")}
                    onChange={e=>changeConfig({sourceKey:e.target.value})}/></label>}
              {selectedNode.data.kind==="compose.template"&&
                <label>Valor producido
                  <input value={String(selectedNode.data.config.value??"")}
                    onChange={e=>changeConfig({value:e.target.value})}/></label>}
              {selectedNode.data.kind==="condition"&&<>
                <label>Campo de entrada
                  <input value={String((selectedNode.data.config.left as {path?:string})?.path??"")}
                    onChange={e=>changeConfig({...selectedNode.data.config,
                      left:{kind:"path",path:e.target.value}})}/></label>
                <label>Operador
                  <select value={String(selectedNode.data.config.operator??"eq")}
                    onChange={e=>changeConfig({...selectedNode.data.config,operator:e.target.value})}>
                    <option value="eq">Es igual a</option><option value="neq">Es distinto de</option>
                  </select></label>
                <label>Valor esperado
                  <input value={String(selectedNode.data.config.right??"")}
                    onChange={e=>changeConfig({...selectedNode.data.config,right:e.target.value})}/></label>
                <small>Conectá ambas salidas: SÍ y NO.</small>
              </>}
              {selectedNode.data.kind==="approval"&&<>
                <label>Pregunta de aprobación
                  <textarea value={String(selectedNode.data.config.reason??"")}
                    onChange={e=>changeConfig({...selectedNode.data.config,reason:e.target.value})}/></label>
                <small>El worker se detiene aquí. Solo una aprobación por workflow en esta primera versión.</small>
              </>}
              {selectedNode.data.kind==="demo_crm.upsert"&&<>
                <label>Identificador del registro
                  <input value={String(((selectedNode.data.config.fields as Record<string,any>)?.leadId)?.path??"$.trigger.id")}
                    onChange={e=>changeConfig({...selectedNode.data.config,
                      fields:{...(selectedNode.data.config.fields as Record<string,unknown>),
                        leadId:{kind:"path",path:e.target.value}}})}/></label>
                <label>Categoría
                  <input value={String(((selectedNode.data.config.fields as Record<string,any>)?.category)?.value??"")}
                    onChange={e=>changeConfig({...selectedNode.data.config,
                      fields:{...(selectedNode.data.config.fields as Record<string,unknown>),
                        category:{kind:"literal",value:e.target.value}}})}/></label>
                <small>El backend exige una aprobación inmediatamente antes de escribir.</small>
              </>}
              {selectedNode.data.kind==="finish"&&
                <p>Este nodo termina la ejecución con una salida guardada.</p>}
              <button className="labDanger" onClick={removeSelected}>Eliminar nodo</button>
            </div>}
        </aside>
      </div>
      <section className="labExecution">
        <div className="labExecutionLeft">
          <span className="labOverline">LABORATORIO DE EJECUCIÓN</span>
          <h2>Probá tus propias reglas.</h2>
          <p>Elegí una versión publicada, cambiá el input y mirá qué nodos recorrió el worker.</p>
          <div className="labExecControls">
            <label>Versión inmutable
              <select value={versionId} onChange={e=>setVersionId(e.target.value)}>
                {!versions.length&&<option value="">Publicá una versión para empezar</option>}
                {versions.map(v=><option key={v.id} value={v.id}>Versión {v.versionNo}</option>)}
              </select></label>
            <label>Entrada JSON
              <textarea rows={4} spellCheck={false} value={input}
                onChange={e=>setInput(e.target.value)}/></label>
            <button className="labBtnPrimary" disabled={!session||busy||!workflowId||!versionId}
              onClick={()=>void start()}>Ejecutar en worker real →</button>
          </div>
          <div className="labRunLimit">Hasta 5 ejecuciones por sesión de prueba. PostgreSQL y cola reales, sin integraciones externas.</div>
        </div>
        <div className="labExecutionRight">
          <div className="labResultsHead">
            <div><span className="labPanelLabel">RESULTADO COMPROBABLE</span>
              <h3>{run?run.status==="waiting_approval"?"Tu decisión es necesaria":
                run.status==="completed"?"Ejecución completada":
                run.status==="cancelled"?"Ejecución rechazada":
                run.status==="failed"?"Ejecución fallida":"Worker procesando":
                "Todavía no hay ejecución"}</h3></div>
            <div className="labResultTabs">
              <button className={activeTab==="trace"?"active":""} onClick={()=>setActiveTab("trace")}>Eventos</button>
              <button className={activeTab==="compare"?"active":""} onClick={()=>void compare()}>Comparar</button>
            </div>
          </div>
          {run?.status==="waiting_approval"&&
            <div className="labApproval"><strong>{run.approvalReason}</strong>
              <p>El worker está detenido. Ningún registro se confirma hasta tu aprobación.</p>
              <div><button className="labBtnPrimary" onClick={()=>void decide("approved")} disabled={busy}>Aprobar escritura</button>
                <button className="labBtnNeutral" onClick={()=>void decide("rejected")} disabled={busy}>Rechazar</button></div>
            </div>}
          {activeTab==="trace"?<div className="labTrace" role="log" aria-label="Traza de ejecución">
            {!run?<p className="labTraceEmpty">Ejecutá un workflow para ver sus decisiones reales, escrituras y resultado.</p>:
              <>
                <span className="labTraceVersion">EJECUCIÓN {run.id.slice(0,8)} · VERSIÓN {run.version.versionNo}</span>
                {(Array.isArray(run.trace)?run.trace:[]).map((step,i)=>
                  <div key={i} className="labTraceStep"><span className="labTraceNumber">{String(i+1).padStart(2,"0")}</span>
                    <div><strong>{step.nodeId}</strong><span>{step.message}</span></div>
                    <small>{step.branch?"Rama "+step.branch:step.status}</small></div>)}
              </>}
          </div>:<div className="labTrace">
            {historyRuns.length===0?<p className="labTraceEmpty">Ejecutá y publicá dos versiones para comparar rutas. Este panel no inventa resultados.</p>:
              historyRuns.map(other=><div className="labCompareCard" key={other.id}>
                <strong>V{other.version.versionNo} · {other.status}</strong>
                <p>{other.trace?.map(t=>t.nodeId).join(" → ")||"Sin eventos"}</p>
              </div>)}
          </div>}
          {!!runHistory.length&&<div className="labHistoryLine"><span>Últimas ejecuciones</span>
            {runHistory.slice(0,4).map(item=><button title={item.status} key={item.id}
              onClick={()=>{setRunId(item.id);setActiveTab("trace")}}>{item.id.slice(0,6)}</button>)}</div>}
        </div>
      </section>
      <footer className="labFooter">WORKFLOW LAB / ALPHA · Motor limitado a nodos locales · Sin llamadas a IA o HTTP externos · Las acciones se almacenan solamente en la base de prueba.</footer>
    </main>
  </div>;
}
