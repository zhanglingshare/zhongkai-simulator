/* V3.9 public model-subject atlas.
   Model nodes are NOT an official registry of all regional enterprises.
   hist/affinity/contact edges are simulation evidence layers, not verified contracts. */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.ZKAtlasCore=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const label={hist:"历史/预设连接",affinity:"模型亲和推断",contact:"模型同域联系",unknown:"其他模型连接"};
function build(graph){
 if(!graph||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges))throw Error("缺少原模型网络");
 const byName=new Map();
 const items=graph.nodes.map((node,index)=>{
  if(!node||typeof node.name!=="string"||!node.name||byName.has(node.name))throw Error("模型主体名称异常或重复");
  const out={name:node.name,type:node.type||"other",typeName:node.typeName||node.type||"未分类模型主体",
   weight:Number.isFinite(node.w)?node.w:1,alive:!!node.alive,
   energy:Number.isFinite(node.energy)?node.energy:null,sentiment:Number.isFinite(node.sentiment)?node.sentiment:null,
   relations:[],counts:{hist:0,affinity:0,contact:0,unknown:0},index};
  byName.set(out.name,out);return out;
 });
 graph.edges.forEach(edge=>{
  if(!edge||!byName.has(edge.a)||!byName.has(edge.b)||edge.a===edge.b)return;
  const layer=Object.prototype.hasOwnProperty.call(label,edge.layer)?edge.layer:"unknown";
  for(const [a,b] of [[edge.a,edge.b],[edge.b,edge.a]]){
    const item=byName.get(a);item.counts[layer]++;
    item.relations.push({name:b,layer,layerLabel:label[layer],note:typeof edge.rel==="string"?edge.rel:""});
  }
 });
 items.forEach(n=>n.relations.sort((a,b)=>a.name.localeCompare(b.name,"zh-CN")));
 return {items,total:items.length,active:items.filter(n=>n.alive).length,
  types:[...new Set(items.map(n=>n.typeName))].sort((a,b)=>a.localeCompare(b,"zh-CN"))};
}
function find(atlas,{query="",status="all",type="all"}={}){
 if(!atlas||!Array.isArray(atlas.items))return [];
 const needle=String(query).trim().toLocaleLowerCase();
 return atlas.items.filter(n=>{
  const matchText=!needle||(n.name+" "+n.typeName+" "+n.type).toLocaleLowerCase().includes(needle);
  const matchType=type==="all"||n.typeName===type;
  const matchStatus=status==="all"||
   status==="core"&&n.weight>=3||status==="active"&&n.alive||
   status==="inactive"&&!n.alive||status==="stressed"&&n.alive&&n.energy!==null&&n.energy<.32;
  return matchText&&matchType&&matchStatus;
 }).sort((a,b)=>b.weight-a.weight||a.name.localeCompare(b.name,"zh-CN"));
}
function summary(n){
 const x=n.counts;
 return {total:n.relations.length,historical:x.hist,inferred:x.affinity+x.contact+x.unknown,
  categories:[["hist",x.hist],["affinity",x.affinity],["contact",x.contact],["unknown",x.unknown]]
  .filter(([,count])=>count>0).map(([key,count])=>({key,label:label[key],count}))};
}
return {build,find,summary,label};
});
