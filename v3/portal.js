/* V3.10 front-door to an open research simulation. No new economic model.
   Only actual Sim agents/edges/snapshots reach ZKHolo. */
(function(){
"use strict";
const $=id=>document.getElementById(id),S=window.ZKSim,H=window.ZKHolo;
const Core=window.ZKHoloCore;
if(!S||!H||!Core){$("scene-message").textContent="模型或三维渲染模块未载入，请刷新页面或进入模拟实验室。";return;}
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
 // Story captions are derived only from the original model's completed A/B
 // snapshots at the selected tick, not from real company data or causal inference.
 const story=$("portal-story-result"),phase=$("story-phase");
 if(phase)phase.textContent=!frames?"等你按播放":t===0?"故事开始了":t===MAX_TICKS?"已经播完 · 可以再试":"正在播放 · "+t+"/"+MAX_TICKS;
 if(story){
   if(frames&&reference&&t>0){
     const activeB=snap.agents.filter(a=>a.alive).length,activeA=reference.agents.filter(a=>a.alive).length;
     const risk=snap.state.disaster-reference.state.disaster;
     const count=activeB===activeA?"数量和不发生变化时一样":
       "比不发生变化时"+(activeB<activeA?"少了 ":"多了 ")+Math.abs(activeA-activeB)+" 个";
     const direction=Math.abs(risk)<.0005?"变化很小":risk>0?"更高":"更低";
     story.textContent="模拟第 "+t+" 步：模型里还有 "+activeB+" 个产业角色在运转，"+
       count+"（基准情景 "+activeA+" 个）。模型中的压力提示"+direction+"。"+
       "这不是现实企业受损名单，也不是现实会发生的预测。";
   }else if(frames){
     story.textContent="「"+frames.shock+"」只是一个假设。看着这些点和线，观察接下来哪些模型角色会变化。";
   }else{
     story.textContent="点上面的播放按钮，看看模型里的产业角色会怎样变化。";
   }
 }
  // Pair each ordinary-language result with named, actual model snapshot differences.
  const who=$("story-affected");
  if(who){
    who.replaceChildren();
    const rows=frames&&reference&&t>0?window.ZKStoryAffected.changes(reference,snap,3):[];
    if(rows.length){
      const heading=document.createElement("strong");heading.className="story-affected-title";
      heading.textContent="哪些角色发生了不同的变化？点名字，网络会帮你找到它。";
      const list=document.createElement("div");list.className="story-affected-list";
      for(const entry of rows){
        const btn=document.createElement("button");
        btn.type="button";btn.className="story-affected-role";
        btn.setAttribute("aria-pressed",selected===entry.name?"true":"false");
        const name=document.createElement("b");name.textContent=entry.name;
        const desc=document.createElement("span");desc.textContent=entry.description;
        btn.append(name,desc);
        btn.addEventListener("click",()=>{
          focusNode(entry.name);
          who.querySelectorAll(".story-affected-role").forEach(x=>x.setAttribute("aria-pressed",String(x===btn)));
        });
        list.append(btn);
      }
      who.append(heading,list);
      // Persistent highlighting, not a fabricated causal chain or real-world claim.
      if(!selected||!rows.some(x=>x.name===selected)){selected=rows[0].name;view.select(selected);}
    }else{
      const note=document.createElement("p");note.className="story-affected-empty";
      note.textContent=frames&&t>0?"这一步还没有足够明显的单个角色差异；不能硬编一个受影响名单。":
        "开始播放后，这里会直接指出模型里变化明显的角色。";
      who.append(note);
    }
    if(frames&&t>0){
      const caution=document.createElement("p");caution.className="story-affected-disclaimer";
      caution.textContent="名单只按两条模型路径的状态差异排列，不证明企业之间真实的影响关系。";
      who.append(caution);
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
