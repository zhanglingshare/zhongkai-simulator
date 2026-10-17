/* V3.10 front-door to an open research simulation. No new economic model.
   Only actual Sim agents/edges/snapshots reach ZKHolo. */
(function(){
"use strict";
const $=id=>document.getElementById(id),S=window.ZKSim,H=window.ZKHolo;
const Core=window.ZKHoloCore,Story=window.ZKStoryEvidence;
if(!S||!H||!Core||!Story){$("scene-message").textContent="模型或三维渲染模块未载入，请刷新页面或进入模拟实验室。";return;}
const SHOCKS=window.ZKRegisteredShocks||[];
const SIZES=[24,32,41],MAX_TICKS=20;
let seed=7,base=null,view=null,frames=null,cursor=0,timer=null,chosen=null,selected=null;
const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const msg=text=>$("scene-message").textContent=text;
const safeInt=(v,lo,hi)=>Number.isSafeInteger(Number(v))&&Number(v)>=lo&&Number(v)<=hi?Number(v):null;
function pop(){return safeInt($("portal-population").value,24,41)||41;}
function selectedSize(){const size=pop();return SIZES.includes(size)?size:41;}
function stop(){
 if(timer!==null){window.clearInterval(timer);timer=null;}
 $("timeline-play").textContent="▶";$("timeline-play").setAttribute("aria-label","播放模型演化");
}
const numberAnimations=new Map(),previousTargets=new Map();
function metric(id,value){
 const node=$(id);if(!node)return;
 const last=previousTargets.get(id),running=numberAnimations.get(id);
 if(running)cancelAnimationFrame(running);
 numberAnimations.delete(id);
 previousTargets.set(id,value);
 if(!Number.isFinite(value)){node.textContent="—";return;}
 // Intermediate digits are a visual tween; only T0–T20 snapshot endpoints are model values.
 if(reduced||!Number.isFinite(last)||Math.abs(value-last)<.0005){
   node.textContent=value.toFixed(3);return;
 }
 const start=performance.now(),duration=240;
 const frame=now=>{
   const u=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-u,3);
   node.textContent=(last+(value-last)*ease).toFixed(3);
   if(u<1)numberAnimations.set(id,requestAnimationFrame(frame));
   else{node.textContent=value.toFixed(3);numberAnimations.delete(id);}
 };
 numberAnimations.set(id,requestAnimationFrame(frame));
}
function updateStats(snapshot,baseSnapshot){
 if(!snapshot)return;
 metric("metric-abundance",snapshot.state.abundance);
 metric("metric-order",snapshot.state.order);
 metric("metric-disaster",snapshot.state.disaster);
 $("metric-active").textContent=snapshot.agents.filter(a=>a.alive).length+" / "+snapshot.agents.length;
 for(const [key,id,positive] of [["abundance","delta-abundance",true],["order","delta-order",true],["disaster","delta-disaster",false]]){
  const label=$(id);
  label.classList.remove("positive","negative");
  if(!baseSnapshot){label.textContent="模型内指数 · 初始基线";continue;}
  const delta=snapshot.state[key]-baseSnapshot.state[key];
  const magnitude=(delta>=0?"+":"")+delta.toFixed(3);
  const neutral=Math.abs(delta)<.0005;
  label.textContent="相对基线 B−A "+magnitude;
  if(!neutral)label.classList.add(delta>0===positive?"positive":"negative");
 }
}
function selectNode(node){
 if(!node)return;
 selected=node.name;
 $("subject-name").textContent=node.name;
 const type=node.typeName||node.type||"模型主体";
 const edges=view&&view.graph?view.graph.edges.filter(e=>e.a===node.name||e.b===node.name):[];
 const counts={hist:0,affinity:0,contact:0,unknown:0};
 edges.forEach(e=>{if(Object.hasOwn(counts,e.layer))counts[e.layer]++;else counts.unknown++;});
 const energy=Number.isFinite(node.energy)?node.energy.toFixed(2):"未提供";
 $("subject-detail").textContent=type+" · "+(node.alive?"模型内存续":"模型内退场")+
  " · 能量 "+energy+" · "+edges.length+" 条模型关系（历史/预设 "+counts.hist+
  "，模型推断 "+(counts.affinity+counts.contact+counts.unknown)+"）。"+
  "非经核实的商业交易关系。";
}
function paint(t){
 if(!view||!base)return;
 const snap=frames?frames.B[t]:base.snapshots[0];
 const reference=frames?frames.A[t]:null;
 cursor=t;
 const graph=view.graph;
 if(!graph||graph.total!==snap.agents.length||
    graph.nodes.some((x,i)=>x.name!==snap.agents[i]?.name)){
   view.setGraph(snap.agents,base.edges,{tick:t});
 }else view.setFrame(snap.agents,{tick:t});
 updateStats(snap,reference);
 // Counts are factual comparisons of consecutive *model* snapshots; no attribution asserted.
 const banner=$("world-variation");
 if(banner){
   if(frames&&t>0){
     const earlier=new Map(frames.B[t-1].agents.map(n=>[n.name,n]));
     const exits=snap.agents.filter(n=>earlier.get(n.name)?.alive&&!n.alive).length;
     const declined=snap.agents.filter(n=>earlier.get(n.name)?.alive&&n.alive&&
       Number.isFinite(n.energy)&&Number.isFinite(earlier.get(n.name).energy)&&
       n.energy<earlier.get(n.name).energy-.045).length;
     const riskDelta=snap.state.disaster-frames.B[t-1].state.disaster;
     banner.textContent="T"+String(t).padStart(2,"0")+" 模型观察 · "+
       declined+" 个角色状态变弱 · "+exits+" 个角色退出";
     banner.dataset.changed=exits||declined?"true":"false";
   }else{
     banner.textContent=frames?"假设变化已开始 · 看看网络会怎样发展":"模型里的产业关系 · 点击播放开始";
     banner.dataset.changed="false";
   }
 }
 // Scene meaning, named focus and 3D highlights are all driven by the *same*
 // already computed model snapshots at this selected tick. Never infer causal spread.
 const story=$("portal-story-result"),phase=$("story-phase"),people=$("story-people");
 const spotlight=$("story-spotlight");
 const result=frames&&reference?Story.compare(reference,snap,base.edges,3):{ok:false,items:[],total:0};
 const items=result.items||[];
 view.setHighlights(items);
 // This trace matches the visible named cards exactly, useful for accessible
 // browser tests and checking frame-synced graph emphasis.
 $("world-stage").dataset.storyTick=String(t);
 $("world-stage").dataset.highlightedActors=items.map(x=>x.name).join("|");
 if(phase)phase.textContent=!frames?"等你按播放":t===0?"故事开始了":t===MAX_TICKS?"故事播完 · 还可以再试":"故事进行中 · "+t+"/"+MAX_TICKS;
 if(spotlight){
   spotlight.hidden=items.length===0||!frames;
   if(items.length){
     $("story-spotlight-name").textContent=items[0].name;
     $("story-spotlight-status").textContent=items[0].kind==="exit"?"模型里退出了":
       items[0].kind==="active"?"模型里继续运转":items[0].kind==="lower"?"状态变弱":"状态变强";
   }
 }
 if(story){
   if(frames&&reference){
     if(items.length){
       const top=items[0],description=top.kind==="exit"?"退出了模拟网络":
         top.kind==="active"?"继续在模型里运转":
         top.kind==="lower"?"在模型里的状态变弱了":"在模型里的状态变强了";
       story.textContent="模拟第 "+t+" 步：先看「"+top.name+"」，"+
         "与没有这件事的模型相比，它"+description+"。"+
         "下方还列出其他明显变化，点名字就能在网络中找到。"+
         "这不是现实企业受损名单。";
     }else{
       story.textContent="模拟第 "+t+" 步：现在还没有发现明显不同的产业角色。"+
         "有时候画面在动，结果也不一定和另一种情景不同；继续看，或者自己拖动进度条。"+
         "这不是现实企业受损名单。";
     }
   }else{
     story.textContent="点上面的播放按钮，看看模型里的产业角色会怎样变化。";
   }
 }
 if(people){
   people.replaceChildren();
   if(!items.length){
     const p=document.createElement("p");p.className="story-people-empty";
     p.textContent=!frames?"开始播放后，这里才会列出真实算出的角色变化。":
       "这一刻没有超过比较门槛的角色差异。没有名单，不等于现实中没有变化。";
     people.append(p);
   }else for(const item of items){
     const btn=document.createElement("button");btn.type="button";
     btn.className="story-person";
     btn.dataset.actor=item.name;btn.dataset.kind=item.kind;
     btn.setAttribute("aria-label","在全息网络中定位 "+item.name+"："+item.explanation);
     const title=document.createElement("strong");title.textContent=item.name;
     const role=document.createElement("span");role.className="story-person-role";role.textContent=item.role;
     const desc=document.createElement("span");desc.className="story-person-desc";desc.textContent=item.explanation;
     const look=document.createElement("span");look.className="story-person-action";look.textContent="看它在哪里 ↗";
     btn.append(title,role,desc,look);
     btn.addEventListener("click",()=>focusNode(item.name));
     people.append(btn);
   }
 }
   $("timeline-slider").value=String(t);
 $("timeline-output").textContent="T "+String(t).padStart(2,"0")+" / "+MAX_TICKS;
 $("world-node-count").textContent=snap.agents.length;
 $("world-edge-count").textContent=base.edges.length;
 if(selected){
   const node=view.graph.nodes.find(x=>x.name===selected);
   if(node){view.select(selected);selectNode(node);}
 }
}
function reset({preserveSeed=true}={}){
 stop();
 if(!preserveSeed)seed=7;
 frames=null;cursor=0;selected=null;
 base=new S(seed,{n_agents:selectedSize(),ticks:MAX_TICKS});
 $("portal-population").value=String(base.agents.length);
 previousTargets.clear();
 $("timeline-play").disabled=true;$("timeline-slider").disabled=true;
 $("subject-name").textContent="点击网络节点";
 $("subject-detail").textContent="查看主体类别、模型能量与已建模关系。节点包括企业和产业角色，不是行政企业名录。";
 $("scene-title").textContent="基线 · 产业关系网络";
 if(view)view.setGraph(base.snapshots[0].agents,base.edges,{tick:0});
 paint(0);
 msg("已载入 "+base.agents.length+" 个模型主体，"+base.edges.length+" 条已建模关系。请选择情景进行条件性推演。");
}
function run(shock,atTick=0){
 if(!SHOCKS.includes(shock)){msg("未登记在原模型的冲击类型，无法执行。");return;}
 stop();$("portal-shock").value=shock;chosen=shock;
 const size=selectedSize();
 base=new S(seed,{n_agents:size,ticks:MAX_TICKS});
 const b=new S(seed,{n_agents:size,ticks:MAX_TICKS});
 const result=b.shock(shock);
 if(!result.ok){msg("该冲击不能运行："+(result.msg||"未知原因"));return;}
 const A=[base._snap()],B=[b._snap()];
 for(let i=0;i<MAX_TICKS;i++){base.step();b.step();A.push(base._snap());B.push(b._snap());}
 frames={A,B,shock};
 $("timeline-play").disabled=false;$("timeline-slider").disabled=false;
 $("scene-title").textContent=shock+" · 条件情景";
 $("portal-run").textContent="↻ 重新运行此情景";
 paint(Math.max(0,Math.min(MAX_TICKS,atTick)));
 msg("模型中已注入「"+shock+"」；可拖动时间轴观察 "+size+
  " 个主体的变化。结果不代表真实经济发生概率。");
 if(!reduced)play();
}
function play(){
 if(!frames)return;
 stop();
 if(cursor>=MAX_TICKS)paint(0);
 $("timeline-play").textContent="Ⅱ";$("timeline-play").setAttribute("aria-label","暂停演化");
 timer=window.setInterval(()=>{
  if(!frames){stop();return;}
  if(cursor>=MAX_TICKS){stop();return;}
  paint(cursor+1);
 },420);
}
function focusNode(name){
 if(!view||!view.graph)return;
 const node=view.select(name);
 if(!node)return;
 const yaw=Math.atan2(node.x,node.z);
 const pitch=Math.atan2(node.y,Math.hypot(node.x,node.z));
 const camera=view.camera;
 let dif=yaw-camera.yaw;
 while(dif>Math.PI)dif-=2*Math.PI;while(dif< -Math.PI)dif+=2*Math.PI;
 view.orbit(dif,pitch-camera.pitch);
 selectNode(node);
}
function handleScenarioLink(){
 const encoded=new URLSearchParams(window.location.search).get("scenario");
 if(!encoded)return false;
 try{
  if(encoded.length>350)throw Error("too long");
  const d=JSON.parse(decodeURIComponent(encoded));
  const shareSeed=safeInt(d.seed,1,2147483647);
  const shareSize=d.v===1?24:safeInt(d.pop,24,41);
  if(!shareSeed||!SIZES.includes(shareSize)||!SHOCKS.includes(d.shock)||(d.v!==1&&d.v!==2))throw Error("invalid");
  seed=shareSeed;$("portal-population").value=String(shareSize);$("portal-shock").value=d.shock;
  reset();run(d.shock,d.v===2?(safeInt(d.tick,0,MAX_TICKS)||0):0);
  return true;
 }catch{msg("分享链接格式无效，已恢复默认模型基线。");return false;}
}
function share(){
 const encoded=encodeURIComponent(JSON.stringify({v:2,seed,pop:selectedSize(),
  shock:frames?frames.shock:$("portal-shock").value,tick:frames?cursor:0}));
 const url=new URL(window.location.href);
 url.searchParams.set("scenario",encoded);url.hash="";
 const copy=url.toString();
 if(navigator.clipboard&&navigator.clipboard.writeText){
  navigator.clipboard.writeText(copy).then(()=>msg("已复制情景输入与模型时间步链接。它不是永久模型快照，未来版本可能变化。"),
   ()=>manualCopy(copy));
 }else manualCopy(copy);
}
function manualCopy(link){
 const field=document.createElement("textarea");field.value=link;field.readOnly=true;
 field.setAttribute("aria-label","手动复制的模型情景链接");
 Object.assign(field.style,{position:"fixed",bottom:"12px",left:"12px",width:"min(92vw,640px)",height:"100px",zIndex:"99",
 background:"#113449",color:"white",border:"1px solid #75cbdb",padding:"10px"});
 document.body.append(field);field.focus();field.select();
 msg("浏览器剪贴板不可用，请复制屏幕下方已选中的链接。");
}
try{
 view=H.mount({canvas:$("holo-canvas"),labels:$("holo-labels"),tooltip:$("holo-hover"),
  status:$("render-mode"),onSelect:selectNode});
 view.setLabelMode($("portal-labels").value);
 $("portal-run").addEventListener("click",()=>run($("portal-shock").value));
 $("preset-risk").addEventListener("click",()=>run("链主外迁"));
 $("hero-quickstart")?.addEventListener("click",()=>{
   run("链主外迁");
   // Reduced-motion visitors should still get a complete, computed result.
   if(reduced&&frames)paint(MAX_TICKS);
   $("world-stage")?.scrollIntoView({behavior:reduced?"auto":"smooth",block:"center"});
 });
 $("preset-growth").addEventListener("click",()=>run("技术突破"));
 $("portal-population").addEventListener("change",()=>{reset();$("portal-run").textContent="▶ 开始情景推演";});
 $("portal-shock").addEventListener("change",()=>{if(frames){reset();$("portal-run").textContent="▶ 开始情景推演";}});
 $("portal-labels").addEventListener("change",()=>view.setLabelMode($("portal-labels").value));
 $("portal-reset").addEventListener("click",()=>{reset();$("portal-run").textContent="▶ 开始情景推演";});
 $("timeline-slider").addEventListener("input",()=>{stop();paint(Number($("timeline-slider").value));});
 $("timeline-play").addEventListener("click",()=>timer!==null?stop():play());
 $("camera-in").addEventListener("click",()=>view.zoom(.82));
 $("camera-out").addEventListener("click",()=>view.zoom(1.2));
 $("camera-reset").addEventListener("click",()=>view.resetCamera());
 $("subject-clear").addEventListener("click",()=>{selected=null;view.select("");$("subject-name").textContent="点击网络节点";$("subject-detail").textContent="三维世界中的每一个发光节点均可选取。";});
 $("share-scene").addEventListener("click",share);
 reset();
 handleScenarioLink();
}catch(error){
 $("render-mode").textContent="图形显示暂不可用";
 msg("全息渲染遇到问题："+error.message+"。仍可从顶部进入完整模拟实验室。");
}
})();
