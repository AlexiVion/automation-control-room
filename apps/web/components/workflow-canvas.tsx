"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GraphNode = { id: string; type: string; config?: unknown };
export type GraphEdge = { id: string; source: string; target: string; branch?: string };
export type PublishedGraph = { nodes: GraphNode[]; edges: GraphEdge[]; trigger: {nodeId:string} };
import { stateOfNode, type CanvasEvent, type GraphRun, type NodeState } from "../lib/workflow-state";
export type { CanvasEvent, GraphRun } from "../lib/workflow-state";

type Props = {
  graph:PublishedGraph | null;
  digest?:string;
  events:CanvasEvent[];
  execution:GraphRun | null;
  selectedNode:string;
  onSelect:(id:string)=>void;
};
type Point={x:number;y:number};
const WIDTH=1040,HEIGHT=550,CARD_W=200,CARD_H=114;
const placement:Record<string,Point>={
  source:{x:38,y:92},
  classify:{x:293,y:92},
  branch:{x:548,y:92},
  approval:{x:801,y:92},
  crm:{x:801,y:348},
  done_high:{x:548,y:348},
  done_low:{x:293,y:348}
};
const titles:Record<string,[string,string,string]>={
  source:["Entrada","Evento sintético","↧"],
  classify:["Clasificación","IA determinista","✧"],
  branch:["Condición","Prioridad alta","◇"],
  approval:["Aprobación","Revisión humana","✓"],
  crm:["CRM Demo","Escritura durable","▤"],
  done_high:["Finalizado","Ruta aprobada","◉"],
  done_low:["Finalizado","Ruta sin CRM","◉"]
};
const idFor=(id:string)=>titles[id]??[id,id,"◈"];
const statusWords:Record<NodeState,string>={
  idle:"Pendiente",complete:"Completado",waiting:"En espera",
  retrying:"Reintento",cancelled:"Rechazado",skipped:"Omitido",running:"En proceso"
};
function edgePath(edge:GraphEdge):string{
  const a=placement[edge.source],b=placement[edge.target];
  if(!a||!b)return "";
  if(edge.source==="approval"&&edge.target==="crm"){
    const x=a.x+CARD_W/2;
    return `M${x},${a.y+CARD_H} C${x},${a.y+175} ${x},${b.y-50} ${x},${b.y}`;
  }
  if(edge.source==="branch"&&edge.branch==="false"){
    const x1=a.x+CARD_W/2,x2=b.x+CARD_W/2;
    return `M${x1},${a.y+CARD_H} C${x1},${a.y+240} ${x2},${b.y-100} ${x2},${b.y}`;
  }
  if(edge.source==="crm"){
    const y=a.y+CARD_H/2;
    return `M${a.x},${y} C${a.x-52},${y} ${b.x+CARD_W+52},${y} ${b.x+CARD_W},${y}`;
  }
  const x1=a.x+CARD_W,y1=a.y+CARD_H/2,x2=b.x,y2=b.y+CARD_H/2;
  return `M${x1},${y1} C${x1+60},${y1} ${x2-60},${y2} ${x2},${y2}`;
}

export default function WorkflowCanvas({graph,digest,events,execution,selectedNode,onSelect}:Props){
  const viewport=useRef<HTMLDivElement|null>(null);
  const drag=useRef<{x:number;y:number;ox:number;oy:number}|null>(null);
  const [scale,setScale]=useState(.76);
  const [offset,setOffset]=useState<Point>({x:0,y:0});
  const [grid,setGrid]=useState(true);
  const [dragging,setDragging]=useState(false);
  const [focused,setFocused]=useState(false);
  const panel=useRef<HTMLElement|null>(null);
  const focusTrigger=useRef<HTMLButtonElement|null>(null);
  // Fullscreen inspection is an accessible modal view of the same graph,
  // not a separate copy or a simulated state.
  useEffect(()=>{
    if(!focused)return;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const keyHandler=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){
        event.preventDefault();setFocused(false);return;
      }
      if(event.key!=="Tab"||!panel.current)return;
      const tabbables=Array.from(panel.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )).filter(e=>e.getClientRects().length>0);
      if(!tabbables.length)return;
      const first=tabbables[0],last=tabbables[tabbables.length-1];
      if(event.shiftKey&&document.activeElement===first){
        event.preventDefault();last.focus();
      }else if(!event.shiftKey&&document.activeElement===last){
        event.preventDefault();first.focus();
      }
    };
    document.addEventListener("keydown",keyHandler);
    // Opening from the toolbar already places focus on its close control.
    return()=>{
      document.body.style.overflow=previousOverflow;
      document.removeEventListener("keydown",keyHandler);
      focusTrigger.current?.focus();
    };
  },[focused]);
  const fit=useCallback(()=>{
    const element=viewport.current;
    if(!element)return;
    const width=element.clientWidth,height=element.clientHeight;
    const next=Math.max(.42,Math.min(1.05,Math.min((width-36)/WIDTH,(height-26)/HEIGHT)));
    setScale(next);
    setOffset({x:(width-WIDTH*next)/2,y:(height-HEIGHT*next)/2});
  },[]);
  useEffect(()=>{
    const element=viewport.current;
    if(!element)return;
    const observer=new ResizeObserver(()=>fit());
    observer.observe(element);fit();
    return()=>observer.disconnect();
  },[fit]);
  const zoom=(by:number)=>{
    const el=viewport.current;
    if(!el)return;
    setScale(old=>{
      const next=Math.min(1.55,Math.max(.42,+(old+by).toFixed(2)));
      setOffset(prev=>({
        x:prev.x+(el.clientWidth/2-prev.x)*(1-next/old),
        y:prev.y+(el.clientHeight/2-prev.y)*(1-next/old)
      }));
      return next;
    });
  };
  function down(event:React.PointerEvent<HTMLDivElement>){
    if((event.target as HTMLElement).closest("button"))return;
    drag.current={x:event.clientX,y:event.clientY,ox:offset.x,oy:offset.y};
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function move(event:React.PointerEvent<HTMLDivElement>){
    if(!drag.current)return;
    setOffset({x:drag.current.ox+event.clientX-drag.current.x,
      y:drag.current.oy+event.clientY-drag.current.y});
  }
  function up(){drag.current=null;setDragging(false);}
  const nodes=graph?.nodes??[];
  const edges=graph?.edges??[];
  const states=new Map(nodes.map(n=>[n.id,stateOfNode(n.id,execution,events)]));
  const selected=nodes.find(n=>n.id===selectedNode);
  const selectedState=states.get(selectedNode)??"idle";
  const selectedEvents=events.filter(e=>e.nodeId===selectedNode).slice(-4).reverse();
  return <section ref={panel} className={"workflowPanel "+(focused?"focusMode":"")}
    role={focused?"dialog":undefined} aria-modal={focused?true:undefined}
    aria-label={focused?"Vista ampliada del workflow":"Diagrama publicado de la automatización"}>
    <div className="workflowHeader">
      <div className="workflowTitle"><span className="graphHeaderIcon">◇</span><div>
        <h2>Workflow publicado <span className="graphVersion">v1.0</span></h2>
        <p>Vista de ejecución · Grafo de PostgreSQL · Sin edición</p></div></div>
      <div className="workflowToolbar" aria-label="Controles del diagrama">
        <button type="button" title="Alejar" aria-label="Alejar diagrama" onClick={()=>zoom(-.15)}>−</button>
        <output aria-live="off" aria-label="Nivel de zoom">{Math.round(scale*100)}%</output>
        <button type="button" title="Acercar" aria-label="Acercar diagrama" onClick={()=>zoom(.15)}>+</button>
        <button type="button" className="fitButton" onClick={fit} title="Ajustar a pantalla">Ajustar</button>
        <button type="button" aria-pressed={grid} onClick={()=>setGrid(v=>!v)} title="Mostrar u ocultar cuadrícula" aria-label="Cuadrícula">⊞</button>
        <button ref={focusTrigger} type="button" className="focusButton"
          aria-label={focused?"Salir de vista ampliada":"Ampliar diagrama"}
          title={focused?"Cerrar vista ampliada (Esc)":"Vista ampliada"}
          aria-expanded={focused} onClick={()=>setFocused(f=>!f)}>
          {focused?"Salir de enfoque":"⛶ Enfocar"}
        </button>
      </div>
    </div>
    <div className={"workflowViewport "+(grid?"withGrid ":"")+(dragging?"isPanning":"")}
      ref={viewport} onPointerDown={down} onPointerMove={move}
      onPointerUp={up} onPointerCancel={up}>
      <div className="workflowStage" style={{
        width:WIDTH,height:HEIGHT,
        transform:`translate(${offset.x}px,${offset.y}px) scale(${scale})`
      }}>
        <svg className="workflowWires" width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          aria-hidden="true">
          <defs>
            <marker id="arrowNormal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 1 1 L 9 5 L 1 9 z" fill="#9caec9"/>
            </marker>
            <marker id="arrowTrue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 1 1 L 9 5 L 1 9 z" fill="#57a9ac"/>
            </marker>
            <marker id="arrowFalse" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 1 1 L 9 5 L 1 9 z" fill="#c4a56b"/>
            </marker>
          </defs>
          {edges.map(edge=><path key={edge.id} d={edgePath(edge)}
            className={"graphWire "+(edge.branch==="true"?"branchTrue":edge.branch==="false"?"branchFalse":"")}
            markerEnd={`url(#${edge.branch==="true"?"arrowTrue":edge.branch==="false"?"arrowFalse":"arrowNormal"})`}/>)}
          <g className="branchLabels"><rect x="760" y="125" width="34" height="22" rx="8"/><text x="777" y="140" textAnchor="middle">Sí</text>
            <rect x="424" y="294" width="34" height="22" rx="8"/><text x="441" y="309" textAnchor="middle">No</text></g>
        </svg>
        {nodes.map((node,i)=>{
          const p=placement[node.id]??{x:38+(i%4)*245,y:92+Math.floor(i/4)*250};
          const state=states.get(node.id)??"idle";
          const [title,subtitle,symbol]=idFor(node.id);
          const nodeType=node.type.replaceAll("."," / ");
          return <button key={node.id} type="button" className={`graphNode status-${state} ${selectedNode===node.id?"isSelected":""}`}
            style={{left:p.x,top:p.y,width:CARD_W,height:CARD_H}} onClick={()=>onSelect(node.id)}
            aria-pressed={selectedNode===node.id}
            aria-label={`${title}, ${statusWords[state]}, inspeccionar nodo`}>
            <span className="graphNodeTop"><span className="nodeSymbol">{symbol}</span>
              <span className="graphStateDot"/><span className="nodeStateLabel">{statusWords[state]}</span>
            </span>
            <strong>{title}</strong><small>{subtitle}</small>
            <span className="graphNodeFooter">{nodeType}</span>
          </button>;
        })}
      </div>
      {!graph&&<div className="workflowLoading">Cargando grafo publicado desde el servidor…</div>}
      <div className="canvasMinimap" aria-label="Minimapa del workflow">
        <span>MAPA</span>
        <svg viewBox="0 0 170 86" width="170" height="86" aria-hidden="true">
          {edges.map(e=><path key={e.id} d={edgePath(e)} transform="scale(.1634,.155)"
            fill="none" stroke={e.branch==="false"?"#c9a36b":"#96aecb"} strokeWidth="14"/>)}
          {nodes.map(n=>{const p=placement[n.id]??{x:38,y:92};
            return <rect key={n.id} x={p.x*.1634} y={p.y*.155} width={CARD_W*.1634} height={CARD_H*.155}
              rx="3" fill={selectedNode===n.id?"#5364ef":states.get(n.id)==="complete"?"#b1ded1":"#dbe3f1"}
              stroke={selectedNode===n.id?"#3248cb":"#93a4bf"} strokeWidth=".6"/>;
          })}
        </svg>
      </div>
      <div className="canvasHintKey">Arrastrá para moverte · Seleccioná un nodo para inspeccionarlo</div>
    </div>
    {focused&&<aside className="workflowFocusInspector" aria-label="Inspector de la vista ampliada">
      <div className="focusInspectorEyebrow">INSPECCIÓN DEL NODO</div>
      <h3>{selected? idFor(selected.id)[0]:"Seleccioná un nodo"}</h3>
      <p className="focusInspectorDescription">{selected? idFor(selected.id)[1]:""}</p>
      <div className={"focusInspectorStatus status-"+selectedState}>
        <span className="graphStateDot"/>{statusWords[selectedState]}
      </div>
      <dl className="focusInspectorFacts">
        <div><dt>Identificador</dt><dd>{selectedNode}</dd></div>
        <div><dt>Tipo</dt><dd>{selected?.type??"—"}</dd></div>
        <div><dt>Eventos de este nodo</dt><dd>{events.filter(e=>e.nodeId===selectedNode).length}</dd></div>
        <div><dt>Estado ejecución</dt><dd>{execution?.status??"Sin iniciar"}</dd></div>
      </dl>
      <div className="focusInspectorEyebrow">ÚLTIMOS EVENTOS</div>
      {selectedEvents.length?<ol className="focusEventList">
        {selectedEvents.map(e=><li key={e.sequence}>
          <strong>#{e.sequence} · {e.eventType}</strong>
          <span>{e.message}</span>
        </li>)}
      </ol>:<p className="focusInspectorEmpty">Este nodo todavía no tiene eventos persistidos.</p>}
      <div className="focusInspectorFooter">Solo lectura · datos persistidos en PostgreSQL</div>
    </aside>}
    <div className="mobileWorkflowNodes" aria-label="Lista de pasos del workflow">
      {nodes.map(node=>{
        const state=states.get(node.id)??"idle";
        const [title,subtitle]=idFor(node.id);
        return <button key={node.id} className={`mobileWorkflowNode status-${state}`}
          onClick={()=>onSelect(node.id)} aria-pressed={node.id===selectedNode}>
          <span className="mobileNodeDot"/><span><strong>{title}</strong><small>{subtitle}</small></span>
          <em>{statusWords[state]}</em>
        </button>;
      })}
    </div>
    <div className="workflowFoot">
      <span><i className="legendDot complete"/> Completado</span>
      <span><i className="legendDot waiting"/> Esperando</span>
      <span><i className="legendDot retrying"/> Reintentando</span>
      <span><i className="legendDot idle"/> Pendiente / omitido</span>
      {digest&&<code title={digest}>SHA-256 {digest.slice(0,10)}…</code>}
    </div>
  </section>;
}
