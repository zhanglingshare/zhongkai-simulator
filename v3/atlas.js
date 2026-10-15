/* V3.9 full subject atlas, downstream only. Does not modify WebGL/canvas renderer. */
(function(){
"use strict";
const Core=window.ZKAtlasCore,el=id=>document.getElementById(id);
if(!Core||!el("atlas-section"))return;
let atlas=null,status="all",query="",type="all",expanded=false,selected=null;
const make=(tag,cls,txt)=>{
 const x=document.createElement(tag);if(cls)x.className=cls;
 if(txt!==undefined)x.textContent=String(txt);
 return x;
};
const num=n=>String(n).padStart(2,"0");
function state(n){return n.alive?"模型内存续":"模型内退出";}
function safeEnergy(n){return n.energy===null?"未提供":Math.round(n.energy*100)+"%";}
function current(){
 const api=window.ZKAtlasBridge;
 return api&&api.getGraph()?Core.build(api.getGraph()):null;
}
function choose(name,{focus=true,scroll=false}={}){
 if(!atlas||!atlas.items.some(n=>n.name===name))return;
 selected=name;
 showSelected();
 render();
 if(focus&&window.ZKAtlasBridge)window.ZKAtlasBridge.focus(name,{scroll});
}
function showSelected(){
 const host=el("atlas-details");host.replaceChildren();
 const n=atlas&&atlas.items.find(x=>x.name===selected);
 el("atlas-focus").disabled=!n;
 if(!n){
  el("atlas-inspector-title").textContent="点击任一主体";
  el("atlas-selected-intro").textContent="选择模型主体，查看关系来源及当前模型状态。";
  host.append(make("div","atlas-empty-symbol","◎"),make("p","","选择任一主体后，这里显示其全部模型关系和状态。"));
  return;
 }
 el("atlas-inspector-title").textContent=n.name;
 el("atlas-selected-intro").textContent=n.typeName+" · "+state(n)+" · 模型权重 "+n.weight+
  "。名称不意味着已核实的工商登记主体，权重也不是现实规模排名。";
 const grid=make("div","atlas-detail-grid");
 for(const [label,value] of [["模型能量",safeEnergy(n)],["关系总数",n.relations.length],["模型权重",n.weight],["模型预期",n.sentiment===null?"未提供":n.sentiment.toFixed(3)]]){
  const cell=make("div","atlas-detail-cell");
  cell.append(make("span","",label),make("strong","",value));grid.append(cell);
 }
 host.append(grid);
 const sum=Core.summary(n),tags=make("div","atlas-relation-types");
 for(const group of sum.categories)tags.append(make("span","",group.label+" "+group.count));
 host.append(make("div","atlas-relation-title","模型关系来源 · "+sum.total+" 条"),tags);
 if(!n.relations.length){host.append(make("p","","当前场景无相关模型边。"));return;}
 const rels=make("div","atlas-relations");
 for(const rel of n.relations){
  const item=make("div","atlas-relation");
  item.append(make("strong","",rel.name),make("small","",rel.layerLabel+(rel.note?" · "+rel.note:"")+"；仅表示模型边"));
  rels.append(item);
 }
 host.append(rels);
}
function render(){
 if(!atlas)return;
 const found=Core.find(atlas,{status,query,type});
 el("atlas-found").textContent=String(found.length);
 el("atlas-page-label").textContent="匹配 "+found.length+" / 共 "+atlas.total;
 const page=expanded?found:found.slice(0,12),host=el("atlas-list");
 host.replaceChildren();
 if(!page.length){
  host.append(make("p","atlas-placeholder","没有匹配的主体。试试清空关键词或切换筛选条件。"));
 }
 for(const [i,n] of page.entries()){
  const item=make("button","atlas-item");item.type="button";
  item.dataset.atlasName=n.name;item.setAttribute("aria-pressed",String(n.name===selected));
  item.setAttribute("aria-label","选择模型主体："+n.name+"，"+n.typeName+"，"+state(n));
  const top=make("span","atlas-item-top");
  top.append(make("span","atlas-item-num",num(i+1)),make("span","atlas-item-status"+(n.alive?"":" inactive"),state(n)));
  item.append(top,make("strong","atlas-item-name",n.name),make("span","atlas-item-sub",n.typeName));
  const bottom=make("span","atlas-item-foot");
  bottom.append(make("span","atlas-item-tag","权重 "+n.weight),make("b","",n.relations.length+" 模型关系"));
  item.append(bottom);
  item.addEventListener("click",()=>choose(n.name,{scroll:false}));
  host.append(item);
 }
 el("atlas-more").hidden=expanded||found.length<=12;
 el("atlas-more").textContent="展开全部 "+found.length+" 个筛选结果 ↓";
}
function update({preserveSelection=true}={}){
 const next=current();
 if(!next){el("atlas-scene").textContent="等待模型三维网络初始化";return;}
 atlas=next;
 const bridge=window.ZKAtlasBridge;
 if(bridge){const info=bridge.getScene();el("atlas-scene").textContent=info.label;}
 el("atlas-total").textContent=String(atlas.total);
 el("atlas-active").textContent=String(atlas.active);
 const select=el("atlas-type"),old=select.value;
 select.replaceChildren();
 for(const value of ["all",...atlas.types]){
  const option=document.createElement("option");option.value=value;option.textContent=value==="all"?"所有类型":value;
  select.append(option);
 }
 if(["all",...atlas.types].includes(type))select.value=type;
 else{type="all";select.value="all";}
 if(!preserveSelection||!atlas.items.some(n=>n.name===selected))selected=null;
 render();showSelected();
}
el("atlas-search").addEventListener("input",e=>{query=e.target.value;expanded=false;render();});
el("atlas-type").addEventListener("change",e=>{type=e.target.value;expanded=false;render();});
document.querySelectorAll("[data-atlas-filter]").forEach(btn=>{
 btn.addEventListener("click",()=>{
  status=btn.dataset.atlasFilter;expanded=false;
  document.querySelectorAll("[data-atlas-filter]").forEach(b=>b.setAttribute("aria-pressed",String(b===btn)));
  render();
 });
});
el("atlas-more").addEventListener("click",()=>{expanded=true;render();});
el("atlas-focus").addEventListener("click",()=>{if(selected&&window.ZKAtlasBridge)window.ZKAtlasBridge.focus(selected,{scroll:true});});
window.addEventListener("zk:atlas-selected",e=>{
 const name=e.detail&&e.detail.name;
 if(!name||!atlas||!atlas.items.some(n=>n.name===name))return;
 selected=name;render();showSelected();
});
window.addEventListener("zk:atlas-refresh",()=>update());
// The normal app.js script precedes this file; its bridge is already initialized.
update();
})();
