export type LabKind =
  | "webhook.trigger" | "condition" | "compose.template"
  | "approval" | "demo_crm.upsert" | "finish";
export type LabNode = {id:string;type:LabKind;config:Record<string,unknown>};
export type LabEdge = {id:string;source:string;target:string;branch?:"true"|"false"};
export type LabDraft = {
  schemaVersion:1;trigger:{nodeId:string};nodes:LabNode[];edges:LabEdge[];
};
export const labKinds: {kind:LabKind;title:string;description:string}[] = [
  {kind:"webhook.trigger",title:"Entrada",description:"Datos enviados desde el laboratorio"},
  {kind:"condition",title:"Condición",description:"Divide el flujo según una regla"},
  {kind:"compose.template",title:"Transformar",description:"Produce un valor configurable"},
  {kind:"approval",title:"Aprobación",description:"Detiene la ejecución hasta tu decisión"},
  {kind:"demo_crm.upsert",title:"Guardar registro",description:"Escritura local autorizada"},
  {kind:"finish",title:"Finalizar",description:"Entrega el resultado"}
];
export function initialConfig(kind:LabKind):Record<string,unknown> {
  switch(kind){
    case "webhook.trigger":return {sourceKey:"lab.manual"};
    case "condition":return {left:{kind:"path",path:"$.trigger.priority"},
      operator:"eq",right:"high"};
    case "compose.template":return {value:"go"};
    case "approval":return {reason:"Autorizar el registro local",expiresMinutes:10};
    case "demo_crm.upsert":return {fields:{
      leadId:{kind:"path",path:"$.trigger.id"},
      category:{kind:"literal",value:"automation"},
      priority:{kind:"path",path:"$.trigger.priority"}}};
    case "finish":return {};
  }
}
const lead:LabDraft = {
  schemaVersion:1,trigger:{nodeId:"source"},
  nodes:[
    {id:"source",type:"webhook.trigger",config:{sourceKey:"lab.manual"}},
    {id:"filter",type:"condition",config:{
      left:{kind:"path",path:"$.trigger.priority"},operator:"eq",right:"high"}},
    {id:"approve",type:"approval",config:{
      reason:"¿Guardar esta oportunidad?",expiresMinutes:10}},
    {id:"store",type:"demo_crm.upsert",config:initialConfig("demo_crm.upsert")},
    {id:"done",type:"finish",config:{}},
    {id:"other",type:"finish",config:{}}
  ],
  edges:[
    {id:"edge_source",source:"source",target:"filter"},
    {id:"edge_yes",source:"filter",target:"approve",branch:"true"},
    {id:"edge_no",source:"filter",target:"other",branch:"false"},
    {id:"edge_approve",source:"approve",target:"store"},
    {id:"edge_store",source:"store",target:"done"}
  ]
};
const support:LabDraft = {
  schemaVersion:1,trigger:{nodeId:"request"},
  nodes:[
    {id:"request",type:"webhook.trigger",config:{sourceKey:"lab.support"}},
    {id:"rule",type:"compose.template",config:{value:"hold"}},
    {id:"gate",type:"condition",config:{
      left:{kind:"path",path:"$.steps.rule.value"},operator:"eq",right:"go"}},
    {id:"supervisor",type:"approval",config:{
      reason:"Escalar solicitud de soporte",expiresMinutes:10}},
    {id:"ticket",type:"demo_crm.upsert",config:{fields:{
      leadId:{kind:"path",path:"$.trigger.id"},
      category:{kind:"literal",value:"support"},
      priority:{kind:"literal",value:"medium"}}}},
    {id:"escalated",type:"finish",config:{}},
    {id:"ordinary",type:"finish",config:{}}
  ],
  edges:[
    {id:"edge_1",source:"request",target:"rule"},
    {id:"edge_2",source:"rule",target:"gate"},
    {id:"edge_3",source:"gate",target:"supervisor",branch:"true"},
    {id:"edge_4",source:"gate",target:"ordinary",branch:"false"},
    {id:"edge_5",source:"supervisor",target:"ticket"},
    {id:"edge_6",source:"ticket",target:"escalated"}
  ]
};
const blank:LabDraft={schemaVersion:1,trigger:{nodeId:"trigger"},
  nodes:[
    {id:"trigger",type:"webhook.trigger",config:initialConfig("webhook.trigger")},
    {id:"done",type:"finish",config:{}}
  ],
  edges:[{id:"edge_start",source:"trigger",target:"done"}]
};
export const labTemplates=[
  {id:"lead",label:"Oportunidades",subtitle:"Entrada → condición → aprobación → registro",draft:lead},
  {id:"support",label:"Soporte",subtitle:"Transformar → decisión → resultado",draft:support},
  {id:"blank",label:"Desde cero",subtitle:"Entrada y salida, para construir tu flujo",draft:blank}
];
