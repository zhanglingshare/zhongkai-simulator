/* V3.9 supplemental A/B impact viewer, downstream of the frozen hologram.
   Sole input: zk:comparison events emitted by the existing Sim orchestration. */
(function(){
"use strict";
const K=window.ZKImpact,el=id=>document.getElementById(id),svgNS="http://www.w3.org/2000/svg";
if(!K||!el("v39-lens"))return;
let current=null,stale=false;
const create=(tag,cls,text)=>{
 const item=document.createElement(tag);if(cls)item.className=cls;
 if(text!==undefined)item.textContent=String(text);return item;
};
const svg=(name,attrs,text)=>{
 const item=document.createElementNS(svgNS,name);
 for(const [key,val] of Object.entries(attrs||{}))item.setAttribute(key,String(val));
 if(text!==undefined)item.textContent=String(text);return item;
};
const format=x=>(x>0?"+":"")+x.toFixed(3);
function empty(message,state){
 current=null;stale=state==="stale";
 const ready=el("v39-lens-state");ready.dataset.state=state||"waiting";
 ready.textContent=state==="stale"?"输入已变化 · 需要重新运行":"WAITING FOR EXPERIMENT";
 el("v39-scenario").textContent=state==="stale"?"研究条件已变化 · 旧结果已清空":"选择情景，打开模型内的另一条路径";
 el("v39-context").textContent=message;
 el("v39-deltas").replaceChildren();
 const box=create("div","v39-empty");
 box.append(create("span","",state==="stale"?"↻":"◇"),
  create("strong","",state==="stale"?"重新运行，才能比较新的条件":"等待第一次模型实验"),
  create("p","",message));
 el("v39-deltas").append(box);
 el("v39-agents").replaceChildren(create("div","v39-wait-icon","✧"),
   create("p","","没有当前有效 A/B 计算，不显示主体排行。"));
 el("v39-chart").replaceChildren();
 el("v39-detail-button").disabled=true;
 el("v39-time").disabled=true;
 el("v39-time-out").textContent="—";
 el("v39-insight-hint").textContent="当前无有效 A/B 结果。公开证据与模型参数不等于现实因果证明。";
}
function deltaRow(m,scale){
 const row=create("div","v39-delta");
 row.append(create("span","v39-delta-name",m.name));
 const track=create("div","v39-delta-track");
 track.setAttribute("role","img");
 track.setAttribute("aria-label",m.name+"：B 减 A 等于 "+format(m.delta));
 const bar=create("span","v39-delta-fill "+m.favorability);
 const width=Math.max(Math.abs(m.delta)>1e-9?2:0,Math.min(45,45*Math.abs(m.delta)/scale));
 bar.style.width=width+"%";
 bar.style.left=m.delta>=0?"50%":(50-width)+"%";
 track.append(bar);row.append(track);
 const value=create("div","v39-delta-value "+m.favorability);
 value.append(create("strong","",format(m.delta)));
 const detail=m.favorability==="favorable"?"模型内改善":m.favorability==="unfavorable"?"模型内承压":"基本持平";
 value.append(create("span","",detail));row.append(value);
 return row;
}
function renderAgents(rows){
 const host=el("v39-agents");host.replaceChildren();
 if(!rows.length){host.append(create("p","", "当前模型时间步，未观察到主体的存续、能量或预期差异。"));return;}
 for(const a of rows.slice(0,5)){
  const row=create("div","v39-agent"),main=create("div","v39-agent-main");
  const explanation=a.exit!==0?(a.exit<0?"B 退出，A 仍存续":"B 存续，A 已退出"):
   "经营能量 Δ"+format(a.energy)+" · 预期 Δ"+format(a.sentiment);
  main.append(create("strong","",a.name),create("span","",explanation));
  const badge=create("div","v39-agent-value "+(a.exit>0||a.energy>0?"favorable":"unfavorable"),
    a.exit!==0?"存续 Δ"+(a.exit>0?"+":"")+a.exit:"Δ "+format(a.energy));
  row.append(main,badge);host.append(row);
 }
}
function renderTrends(trends,tick){
 const host=el("v39-chart");host.replaceChildren();
 const selected=trends.filter(x=>x.key==="abundance"||x.key==="disaster");
 if(selected.length!==2)return;
 for(let k=0;k<2;k++){
  const dataset=selected[k],top=18+k*65,bottom=top+40;
  host.append(svg("text",{x:7,y:top-5,fill:"#91bfce","font-size":10},dataset.name));
  host.append(svg("line",{x1:39,x2:333,y1:bottom,y2:bottom,stroke:"#4b7688","stroke-opacity":.5}));
  const n=Math.max(dataset.a.length,dataset.b.length);
  const xy=p=>[39+(p.tick/Math.max(1,n-1))*287,bottom-p.value*39];
  const line=(pts,color)=>{
   const valid=pts.filter(p=>Number.isFinite(p.value));
   if(!valid.length)return;
   host.append(svg("polyline",{points:valid.map(p=>xy(p).map(x=>x.toFixed(1)).join(",")).join(" "),fill:"none",stroke:color,"stroke-width":2,"stroke-linejoin":"round","stroke-linecap":"round"}));
   const latest=valid.find(p=>p.tick===tick);
   if(latest){const [x,y]=xy(latest);host.append(svg("circle",{cx:x,cy:y,r:3.2,fill:color,stroke:"#0e2b40","stroke-width":1.2}));}
  };
  line(dataset.a,"#54acc8");line(dataset.b,"#edab80");
  const x=39+(tick/Math.max(1,n-1))*287;
  host.append(svg("line",{x1:x,y1:top-1,x2:x,y2:bottom,stroke:"#bad8dd","stroke-width":.7,"stroke-dasharray":"2 3","stroke-opacity":.6}));
 }
}
function update(detail){
 if(!detail||detail.stale){empty("此情景已失效，请重新计算。","stale");return;}
 let data;
 try{data=K.prepare(detail.a,detail.b,detail.base,detail.scenario);}
 catch(error){empty("模型快照不完整，无法生成影响透视："+error.message,"stale");return;}
 current=detail;stale=false;
 const badge=el("v39-lens-state");
 badge.dataset.state="ready";badge.textContent="MODEL RUN / T"+String(detail.tick).padStart(2,"0");
 el("v39-scenario").textContent="「"+detail.shock+"」· 模型第 "+detail.tick+" 步";
 el("v39-context").textContent="随机种子 "+detail.seed+" · A 基线 / B 情景 · "+detail.ticks+" 个模型步 · 比较的是同一模型内的状态";
 const d=el("v39-deltas");d.replaceChildren();
 const scale=Math.max(.025,...data.metrics.map(m=>Math.abs(m.delta)));
 data.metrics.forEach(m=>d.append(deltaRow(m,scale)));
 renderAgents(data.agents);
 renderTrends(data.trends,detail.tick);
 el("v39-detail-button").disabled=false;
 el("v39-time").disabled=false;el("v39-time").max=String(detail.ticks);
 el("v39-time").value=String(detail.tick);
 el("v39-time-out").textContent="T "+String(detail.tick).padStart(2,"0")+" / "+detail.ticks;
 el("v39-insight-hint").textContent="已对照 "+data.metrics.length+" 项模型指标；"+data.agents.length+
  " 个模型主体存在观察差异。该数量和排序不是因果贡献，也不是现实风险概率。";
}
function openCompare(){
 if(!current||stale)return;
 if(window.matchMedia("(max-width:760px)").matches){
  const trigger=document.querySelector('[data-mobile-to="compare"]');if(trigger)trigger.click();
 }
 el("compare-section").scrollIntoView({block:"start",behavior:"auto"});
}
el("v39-detail-button").addEventListener("click",openCompare);
el("v39-time").addEventListener("input",()=>{
 if(!current||stale)return;
 const old=el("compare-tick");old.value=el("v39-time").value;
 old.dispatchEvent(new Event("input",{bubbles:true}));
});
window.addEventListener("zk:comparison",e=>update(e.detail));
window.addEventListener("zk:compare-stale",()=>empty("模拟条件发生变化。请重新点击“运行 A/B 情景”，避免误读过期数字。","stale"));
window.addEventListener("zk:compare-clear",()=>empty("对照结果已清空，等待运行新的实验。","waiting"));
empty("先在上方实验台选择风险或增长情景，点击运行后才显示模型结果。","waiting");
})();
