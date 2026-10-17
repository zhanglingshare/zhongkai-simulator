/* V3.13 · Visualization bound solely to real ZKSim snapshots produced by ZKInflow. */
(function(){
"use strict";
const $=id=>document.getElementById(id),NS="http://www.w3.org/2000/svg";
const Core=window.ZKInflow,Sim=window.ZKSim;
const reduced=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let latest=null,displayTick=0,timer=null,nonce=0;
const $form=$("inflow-form"),$slider=$("inflow-tick");
const METRICS=Core?Core.METRICS:[];
const FRIENDLY={abundance:"产业活跃程度",order:"协作顺畅程度",disaster:"系统承受的风险",mood:"参与者信心"};
function element(name,cls,text){
 const e=document.createElement(name);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;
}
function svg(name,attrs={}){
 const n=document.createElementNS(NS,name);
 Object.entries(attrs).forEach(([key,val])=>n.setAttribute(key,String(val)));
 return n;
}
function message(content,kind=""){
 $("form-message").textContent=content;$("form-message").className="form-message "+kind;
}
function input(){
 return {name:$("company-name").value,type:$("company-type").value,
  weight:Number($("company-weight").value),seed:Number($("seed").value),
  targets:[$("link-one").value,$("link-two").value,$("link-three").value].filter(Boolean),
  evidence:$("evidence").value,source:$("source").value,notes:$("notes").value};
}
function stop(){
 nonce++;if(timer!==null){clearInterval(timer);timer=null;}
 $("inflow-play").textContent="▶ 逐步播放";
}
function stale(){
 if(!latest)return;
 stop();latest=null;$slider.value="0";$slider.disabled=true;
 $("inflow-play").disabled=true;$("inflow-export").disabled=true;
 $("scene-badge").textContent="条件已变更";
 $("play-status").textContent="输入条件已变更，请重新计算";
 $("count-a").textContent="—";$("count-b").textContent="—";$("new-status").textContent="—";
 $("inflow-metrics").replaceChildren(element("div","empty-wide","条件已变更；旧结果已清空。请重新运行。"));
 $("inflow-uq").replaceChildren(element("p","","需要重新运行才可比较新的假设。"));
 $("inflow-chart").replaceChildren();
 $("inflow-subjects").textContent="当前暂无有效计算。";
 message("已清除过期结果；新情景尚未运行。");
 refreshBaseline();
}
function repopulate(){
 const choices=[$("link-one"),$("link-two"),$("link-three")];
 const prior=choices.map(n=>n.value);
 const seed=Number($("seed").value);
 let base;
 try{
  if(!Number.isSafeInteger(seed)||seed<1||seed>999999)throw new Error("seed");
  base=new Sim(seed,{n_agents:Core.BASE_COUNT,ticks:Core.TICKS});
 }catch{return null;}
 const candidates=[...base.agents].sort((a,b)=>b.w-a.w||a.name.localeCompare(b.name,"zh-CN"));
 choices.forEach((node,index)=>{
  const current=prior[index];
  node.replaceChildren(element("option","",index===0?"请选择既有模型主体":"暂不增加"));
  node.firstChild.value="";
  candidates.forEach(a=>{
   const opt=element("option","",a.name+" / "+a.type+" / 模型权重 "+a.w);
   opt.value=a.name;node.append(opt);
  });
  if(candidates.some(a=>a.name===current))node.value=current;
 });
 return base;
}
function hash(name){
 let v=2166136261;
 for(let i=0;i<name.length;i++){v^=name.charCodeAt(i);v=Math.imul(v,16777619);}
 return v>>>0;
}
function layout(agents,addedName){
 const list=agents.filter(a=>a.name!==addedName);
 const loc={};
 list.forEach((a,i)=>{
  const angle=2*Math.PI*i/Math.max(list.length,1)-Math.PI/2;
  const wobble=hash(a.name)%18;
  const r=110+wobble;
  loc[a.name]={x:320+Math.cos(angle)*r*1.95,y:170+Math.sin(angle)*r*.95};
 });
 if(agents.some(a=>a.name===addedName))loc[addedName]={x:320,y:170};
 return loc;
}
function drawNetwork(agents,edges,newName,targets){
 const canvas=$("inflow-network");canvas.replaceChildren();
 const loc=layout(agents,newName),byName=new Map(agents.map(a=>[a.name,a]));
 for(const e of edges){
  const a=loc[e.a],b=loc[e.b];
  if(!a||!b)continue;
  const hypothetical=e.layer==="hypothesis";
  canvas.append(svg("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,
   class:hypothetical?"assumed-edge":"edge","data-layer":e.layer}));
 }
 for(const a of agents){
  const p=loc[a.name];if(!p)continue;
  const isNew=a.name===newName,isTarget=targets.includes(a.name);
  const r=isNew?14:isTarget?6.8:a.w>=3?6:3.7;
  const group=svg("g",{"data-subject":a.name});
  if(isNew)group.append(svg("circle",{cx:p.x,cy:p.y,r:23,class:"halo"}));
  const circle=svg("circle",{cx:p.x,cy:p.y,r,
   class:"subject"+(!a.alive?" off":"")+(isNew?" new":isTarget?" target":"")});
  group.append(circle);
  const tip=svg("title");tip.textContent=a.name+" · "+a.type+" · "+(a.alive?"存续":"退出")+" · 模型能量 "+Number(a.energy).toFixed(3);
  group.append(tip);
  if(isNew||isTarget){
   const label=svg("text",{x:p.x,y:p.y-(isNew?26:11),"text-anchor":"middle",class:isNew?"new-label":"node-label"});
   label.textContent=a.name.length>13?a.name.slice(0,12)+"…":a.name;
   group.append(label);
  }
  canvas.append(group);
 }
}
function refreshBaseline(){
 if(!Core||!Sim)return;
 const base=repopulate();
 if(!base)return;
 drawNetwork(base.agents,base.edges,"",[]);
 $("scene-count").textContent=base.agents.length+" 个原模型主体 · 等待用户接入假设";
}
function fmt(n,d=3){return Number.isFinite(n)?(n>0?"+":"")+n.toFixed(d):"—";}
function fmtBare(n){return Number.isFinite(n)?n.toFixed(3):"—";}
function showMetric(frame){
 const root=$("inflow-metrics");root.replaceChildren();
 for(const m of METRICS){
  const item=frame.metrics[m.key],risk=m.key==="disaster";
  const card=element("article","metric"),name=element("span","",FRIENDLY[m.key]||m.label);
  const strong=element("strong",item.delta>0?(risk?"neg":"pos"):item.delta<0?(risk?"pos":"neg"):"",fmt(item.delta));
  strong.dataset.modelValue=String(item.delta);
  const detail=element("small","","未引入 "+fmtBare(item.a)+" / 引入后 "+fmtBare(item.b));
  const interpretation=item.delta===0?"模型内无差值":risk?
    (item.delta>0?"模型风险增加 / 承压":"模型风险下降 / 减压"):
    (item.delta>0?"模型值上升 / 非现实收益":"模型值下降 / 非现实损失");
  card.append(name,strong,detail,element("div","direction",interpretation));root.append(card);
 }
}
function drawChart(tick){
 const host=$("inflow-chart");host.replaceChildren();
 if(!latest)return;
 const L=38,T=13,W=467,H=149;
 for(const y of [0,.25,.5,.75,1]){
  const py=T+(1-y)*H;
  host.append(svg("line",{x1:L,y1:py,x2:L+W,y2:py,stroke:"#335365","stroke-width":".7"}));
  const text=svg("text",{x:2,y:py+4,fill:"#8eb6c8","font-size":"10"});text.textContent=y.toFixed(2);host.append(text);
 }
 function path(key,scenario,color){
  const coordinates=latest.series.slice(0,tick+1).map((f,i)=>{
   const value=f.metrics[key][scenario];
   return [L+i/20*W,T+(1-value)*H];
  });
  if(coordinates.length<1)return;
  const d=coordinates.map((p,i)=>(i?"L":"M")+p[0].toFixed(2)+" "+p[1].toFixed(2)).join(" ");
  host.append(svg("path",{d,fill:"none",stroke:color,"stroke-width":2.5,"stroke-linejoin":"round","data-points":coordinates.length}));
  const last=coordinates[coordinates.length-1];
  host.append(svg("circle",{cx:last[0],cy:last[1],r:3.5,fill:color}));
 }
 path("abundance","a","#458ba8");
 path("abundance","b","#7fdfe0");
 path("disaster","a","#ca995d");
 path("disaster","b","#ea7777");
 host.append(svg("line",{x1:L+tick/20*W,y1:T,x2:L+tick/20*W,y2:T+H,stroke:"#a6d8e3","stroke-dasharray":"3 5","stroke-opacity":".3"}));
 for(const t of [0,5,10,15,20]){
  const n=svg("text",{x:L+t/20*W,y:186,fill:"#9fbecb","text-anchor":"middle","font-size":"10"});n.textContent="T"+t;host.append(n);
 }
}
function showTick(tick){
 if(!latest)return;
 displayTick=Math.min(20,Math.max(0,tick));$slider.value=String(displayTick);
 $("tick-label").textContent="T "+String(displayTick).padStart(2,"0")+" / 20";
 const frame=latest.series[displayTick];
 showMetric(frame);drawChart(displayTick);
 const actors=latest.actorsByTick[displayTick];
 drawNetwork(actors,latest.edges,latest.input.name,latest.input.targets);
 const newAgent=actors.find(a=>a.name===latest.input.name);
 $("new-status").textContent=newAgent?.alive?"存续":"退出";
 $("scene-badge").textContent="T"+String(displayTick).padStart(2,"0")+" · 已计算模型快照";
}
function play(){
 if(!latest||reduced)return;
 stop();showTick(0);
 $("inflow-play").textContent="Ⅱ 暂停";
 $("play-status").textContent="正在回放已计算的模型快照";
 const id=nonce;
 timer=setInterval(()=>{
  if(id!==nonce||!latest){stop();return;}
  const next=Number($slider.value)+1;
  if(next>20){stop();$("play-status").textContent="完整轨迹已播放";return;}
  showTick(next);
  if(next===20){stop();$("play-status").textContent="完整轨迹已播放 · 可手动检查";}
 },330);
}
function showUQ(data){
 const root=$("inflow-uq");root.replaceChildren();
 root.append(element("p","",data.includedSeeds+" 个有效种子 / "+data.samples.length+
  " 次尝试；"+data.excludedSeeds+" 次因指定联系对象没有进入该次模拟而未统计。不是现实发生概率。"));
 for(const m of METRICS){
  const d=data.distribution[m.key],row=element("div","uq-row");
  row.append(element("strong","",(FRIENDLY[m.key]||m.label)+" · 有效重复实验 "+d.n));
  row.append(element("code","","较低值 "+fmtBare(d.p10)+" / 中间值 "+fmtBare(d.p50)+" / 较高值 "+fmtBare(d.p90)));
  row.append(element("small","","按模型重复运行结果从小到大排序，取10%、50%、90%位置的值；不等于现实预测范围。"));
  root.append(row);
 }
 if(data.includedSeeds<8)root.append(element("p","","有效样本不足 8 个，分位数可能非常不稳定；建议改选不同的关系主体后重新探索。"));
 root.append(element("p","","这里只是让模型换不同的随机起点重复运行，并没有验证企业规模、用地、订单或真实政策效果。"));
}
function showChanges(data){
 const root=$("inflow-subjects");root.replaceChildren();
 if(!data.existingChanges.length){root.append(element("p","","T20 下未观察到存量主体的存续或能量差异。"));return;}
 data.existingChanges.slice(0,8).forEach(x=>{
  const row=element("div","subject-row");row.append(element("strong","",x.name),
    element("span","",(x.aliveA!==x.aliveB?"存续不同 · ":"")+"能量差 "+fmt(x.energyDelta)));
  root.append(row);
 });
 root.append(element("p","","展示最多 8 名变化主体；仅是模型状态差异，不代表商业联系或现实损益。"));
}
function showEvidence(data){
 const root=$("inflow-warnings"),qs=$("inflow-questions");
 root.replaceChildren();qs.replaceChildren();
 const notes=[...data.warnings,"本次仅 "+data.includedSeeds+" 个种子满足完整指定关系条件"];
 const ul=element("ul");
 notes.forEach(v=>ul.append(element("li","",v)));
 root.append(ul);
 Core.questions(data.input).forEach(v=>qs.append(element("li","",v)));
}
function render(data){
 latest=data;
 $("count-a").textContent=String(data.baseCount);$("count-b").textContent=String(data.addedCount);
 $("scene-count").textContent=data.baseCount+" → "+data.addedCount+" 个模型主体 · "+
  data.input.targets.length+" 条假设关系";
 $slider.disabled=false;$("inflow-play").disabled=!!reduced;
 $("inflow-export").disabled=false;
 $("play-status").textContent=reduced?"已按系统设置减少动画，可手动拖动":"播放模拟的 20 步变化";
 showUQ(data);showChanges(data);showEvidence(data);
 showTick(reduced?20:0);
 message("实验已完成：模型结果只用于条件性比较，不是现实政策收益估计。","success");
 if(!reduced)play();
}
$form.addEventListener("submit",e=>{
 e.preventDefault();stop();
 if(!$("company-confirm").checked){message("请先核对企业资料，并勾选确认信息与联系仍是待核实假设。","error");return;}
 if(!Core||!Sim){message("原始 Sim 模型无法加载，不能运行实验。","error");return;}
 const check=Core.validate(Sim,input());
 if(!check.ok){stale();message(check.errors.join("；"),"error");return;}
 try{
  const data=Core.run(Sim,check.input,24);
  if(data.ok&&window.ZKCompanyResearchUI){data.companyResearch=window.ZKCompanyResearchUI.snapshot();}
  if(!data.ok){stale();message(data.errors.join("；"),"error");return;}
  render(data);
 }catch(err){stale();message("实验计算失败："+err.message,"error");}
});
$form.addEventListener("input",e=>{
 if(e.target.id==="seed"){stale();return;}
 stale();
});
$form.addEventListener("change",e=>{if(e.target.id==="seed"||e.target.id==="company-type")refreshBaseline();else stale();});
$slider.addEventListener("input",()=>{if(!latest)return;stop();showTick(Number($slider.value));$("play-status").textContent="手动查看真实模型步";});
$("inflow-play").addEventListener("click",()=>{if(timer!==null){stop();$("play-status").textContent="已暂停";}else play();});
$("inflow-reset").addEventListener("click",()=>{
 stale();$("scene-badge").textContent="等待运行";
 $("inflow-warnings").textContent="等待实验输入。";
 $("inflow-questions").replaceChildren(element("li","","先填写企业接入假设。"));
});
$("inflow-export").addEventListener("click",()=>{
 if(!latest)return;
 const blob=new Blob([JSON.stringify(latest,null,2)],{type:"application/json;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="zhongkai-inflow-research-v313.json";document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),5000);
});
refreshBaseline();
if(!Core||!Sim)message("仿真核心未能加载，实验不可用。","error");
})();