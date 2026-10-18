/* V3.10 front-door to an open research simulation. No new economic model.
   Only actual Sim agents/edges/snapshots reach ZKHolo. */
(function(){
"use strict";
const $=id=>document.getElementById(id),S=window.ZKSim,H=window.ZKHolo;
const Core=window.ZKHoloCore,Story=window.ZKHomeStory,Stage=window.ZKStoryStage;
if(!S||!H||!Core||!Story||!Stage){$("scene-message").textContent="模型或三维渲染模块未载入，请刷新页面或进入模拟实验室。";return;}
const SHOCKS=window.ZKRegisteredShocks||[];
const SIZES=[24,32,41],MAX_TICKS=20;
let seed=7,base=null,view=null,frames=null,cursor=0,timer=null,sceneTimer=null,selected=null;
let phase="idle",peek=false,running=false,protagonist=null;
const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const contrast=Stage.contrast($("home-contrast"),{metric:"links"});
const scrubber=Stage.timeline($("timeline-slider"),{stage:$("world-stage"),onStart:stop});
const msg=text=>$("scene-message").textContent=text;
const safeInt=(v,lo,hi)=>Number.isSafeInteger(Number(v))&&Number(v)>=lo&&Number(v)<=hi?Number(v):null;
function pop(){return safeInt($("portal-population").value,24,41)||41;}
function selectedSize(){const size=pop();return SIZES.includes(size)?size:41;}
function stop(){
 if(timer!==null){window.clearInterval(timer);timer=null;}
 if(sceneTimer!==null){window.clearTimeout(sceneTimer);sceneTimer=null;}
 running=false;
 $("timeline-play").textContent="▶";$("timeline-play").setAttribute("aria-label","播放模型演化");
}
function markPlaying(){running=true;$("timeline-play").textContent="Ⅱ";$("timeline-play").setAttribute("aria-label","暂停演化");}
function later(fn,ms){sceneTimer=window.setTimeout(()=>{sceneTimer=null;fn();},ms);}
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
function setText(id,text){const node=$(id);if(node)node.textContent=text;}
function renderRoles(changes){
 const box=$("role-story-focus");if(!box)return;
 box.hidden=peek||phase==="intro";box.replaceChildren();
 if(!frames){setText("portal-story-result","点上面的播放按钮，看看模型里的产业角色会怎样变化。");return;}
 const sorted=changes.slice().sort((a,b)=>Number(b.name===frames.target)-Number(a.name===frames.target)||Number(b.exit)-Number(a.exit)||Math.abs(b.change||0)-Math.abs(a.change||0)||a.name.localeCompare(b.name,"zh-CN")).slice(0,3);
 if(!sorted.length){const p=document.createElement("p");p.textContent="这一步没有明显的角色状态差异。";box.append(p);return;}
 const title=document.createElement("strong");title.textContent="同一步，两条路径中不同的模型角色";box.append(title);
 const list=document.createElement("ol");list.className="role-story-list";
 sorted.forEach(c=>{
  const li=document.createElement("li"),button=document.createElement("button"),detail=document.createElement("span");
  button.type="button";button.className="role-story-person";button.textContent=c.name+" · "+c.direction;
  button.setAttribute("aria-pressed",String(selected===c.name));
  button.setAttribute("aria-label","在网络中查看"+c.name+"："+c.direction);
  detail.textContent=c.exit?"当前情景中已退出，另一条路径中仍运转":c.returning?"当前情景中仍运转，另一条路径中已退出":"模型经营状态与另一条路径相比"+(c.change<0?"较弱":"较强");
  button.addEventListener("click",()=>{focusNode(c.name);box.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));$("world-stage").scrollIntoView({behavior:reduced?"auto":"smooth",block:"start"});});
  li.append(button,detail);list.append(li);
 });box.append(list);
}
function paint(t){
 if(!view||!base)return;
 t=Math.max(0,Math.min(MAX_TICKS,Math.trunc(t)));cursor=t;
 const B=frames?frames.B[t]:base.snapshots[0],A=frames?frames.A[t]:null;
 const before=peek||phase==="intro",snapshot=before&&A?A:B;
 const info=frames?Story.frameInfo(frames,t):null;
 const changes=info?info.changes:[];
 const counts=Story.counts(snapshot,base.edges),initial=Story.counts(frames?.initial||base.snapshots[0],base.edges);
 if(!view.graph||view.graph.total!==snapshot.agents.length)view.setGraph(snapshot.agents,base.edges,{tick:t});
 else view.setFrame(snapshot.agents,{tick:t});
 view.setStoryFocus(before?[]:changes);
 view.setStoryScene({hero:frames?.kind==="exit"?frames.target:protagonist?.name,
   phase,peek:before,reference:A?.agents||null,changes});
 updateStats(snapshot,A);
 setText("world-node-count",counts.alive);setText("world-edge-count",counts.links);
 setText("home-alive-detail","初始 "+initial.alive+" 个 · "+(before?"当前为对照路径":frames?"当前为改变后的路径":"全部在场"));
 setText("home-links-detail","初始 "+initial.links+" 条 · 两端都仍运转");
 $("world-stage").dataset.phase=phase;$("world-stage").dataset.peek=String(before);
 document.body.dataset.storyState=phase;
 contrast.update(phase==="intro"?null:info,{tick:t,peek:before});$("home-current-counts").hidden=!!info&&phase!=="intro";
 scrubber.update(t,frames?.keyTick??null,!!frames);
 $("home-peek").disabled=!frames||phase==="intro";
 $("home-peek").textContent=frames?.kind==="exit"?"按住看未退出时":"按住看未发生时";
 $("home-peek").setAttribute("aria-pressed",String(peek));
 $("home-next").disabled=false;
 setText("home-next",!frames?"让这家链主退出":phase==="intro"?"直接看退出":cursor>=MAX_TICKS?(frames.kind==="exit"?"再看一次退出":"重放这个情景"):running?"暂停看清楚":"继续看后续");
 const target=frames?.target||protagonist?.name||"这家链主";
 let title,caption,chapter,explanation,plain;
 if(!frames){
  title="先认出「"+target+"」";
  const links=base.edges.filter(e=>e.a===target||e.b===target).length;
  caption="点播放，看它退出模型，以及 "+links+" 条相邻模型连线的变化。";
  chapter="01 · 先看清主角";explanation="退出会留下清楚的空位；按住按钮可以对照。";
  plain="点上面的播放按钮，看看模型里的产业角色会怎样变化。";
 }else if(peek){
  chapter="对照 · 同一个镜头，同一个模型步";title=frames.kind==="exit"?"如果「"+target+"」没有退出":"如果没有注入这次变化";
  caption="这是第 "+t+" 步的未改变路径，松开按钮回到改变后的路径。";
  explanation="当前画面："+counts.alive+" 个角色运转，"+counts.links+" 条模型连线亮着。";plain=caption;
 }else if(phase==="intro"){
  chapter="01 · 先看清主角";title="先看「"+target+"」";
  caption="亮起的是它和直接相邻的模型角色。接下来，只让它退出。";
  explanation="先记住这个位置和相邻连线，再看它离开的一刻。";plain=caption;
 }else if(frames.kind==="exit"&&t===0){
  chapter="02 · 退出发生了";title="「"+target+"」退出了模型";
  const lost=info.a.links-info.b.links;
  caption=lost+" 条相邻模型连线不再亮起。原来的位置留下退出标记。";
  explanation="接下来观察其他角色；后续变化由原模型计算。";
  plain="模拟第 0 步：「"+target+"」已退出，"+lost+" 条相邻模型连线停止亮起。";
 }else if(frames.kind==="exit"){
  chapter=(phase==="key"?"03 · 停在这里，对照一下":t===MAX_TICKS?"04 · 看完后续结果":"03 · 观察后续变化")+" · 第 "+t+" 步";
  title=t===MAX_TICKS?"仍有 "+info.b.alive+" 个角色在运转":phase==="key"?"同一步，"+changes.length+" 个角色不同":"退出之后，其他角色怎样了？";
  caption=phase==="key"?"演示已暂停。按住下方按钮，看同一步的未退出路径。":t===MAX_TICKS?"未退出路径为 "+info.a.alive+" 个；这里呈现的是本次模型结果。":"有变化的角色持续标色，退出的角色保留位置和名字。";
  explanation="与未退出时相比："+info.exits.length+" 个角色只在这里退出；"+info.returns.length+" 个角色只在这里保持运转。";
  plain="模拟第 "+t+" 步：「"+target+"」保持退出。当前有 "+info.b.alive+" 个模型角色运转，未退出路径为 "+info.a.alive+" 个。角色差异见下方名单。";
 }else{
  chapter="另一种模型情景 · 第 "+t+" 步";title="「"+frames.shock+"」之后";
  caption="按住下方按钮，在同一步查看没有这次冲击的路径。";
  explanation="T"+String(t).padStart(2,"0")+" 模型观察 · "+info.weaker.length+" 个角色状态更弱 · "+info.exits.length+" 个角色退出";
  plain="模拟第 "+t+" 步：当前 "+info.b.alive+" 个角色运转，对照路径 "+info.a.alive+" 个。";
 }
 setText("home-story-chapter",chapter);setText("home-story-title",title);setText("home-story-caption",caption);
 setText("home-view-label",!frames?"初始模型世界":frames.kind==="exit"?(before?"未退出":"已退出")+" · 第 "+t+" 步":(before?"未改变路径":"改变后路径")+" · 第 "+t+" 步");
 setText("world-variation",explanation);$("world-variation").dataset.changed=String(!!changes.length);
 setText("portal-story-result",plain);
 setText("story-phase",!frames?"等你按播放":peek?"正在查看对照":phase==="intro"?"先认出主角":phase==="key"?"关键变化 · 已暂停":t===MAX_TICKS?"已经播完 · 可以再试":"模拟第 "+t+" 步");
 renderRoles(changes);
 // Keep the story's next page on exactly this experiment and time step.
 const handoff=frames?(frames.kind==="exit"?{v:3,kind:"exit",target:frames.target,seed,pop:selectedSize(),tick:t}:{v:2,shock:frames.shock,seed,pop:selectedSize(),tick:t}):null;
 document.querySelectorAll('a[href^="story-lab.html"]').forEach(link=>{
  const url=new URL("story-lab.html",location.href);
  if(handoff)url.searchParams.set("scenario",encodeURIComponent(JSON.stringify(handoff)));
  link.setAttribute("href",handoff?"story-lab.html"+url.search:"story-lab.html");
 });
 $("timeline-slider").value=String(t);setText("timeline-output","T "+String(t).padStart(2,"0")+" / "+MAX_TICKS);
 if(selected){const node=view.graph.nodes.find(n=>n.name===selected);if(node){view.select(selected);selectNode(node);}}
 window.dispatchEvent(new CustomEvent("zk:home-frame",{detail:{kind:frames?.kind||"baseline",target:frames?.target||null,tick:t,phase,peek:before,
   displayed:snapshot,baseline:A,scenario:frames?B:null,edges:base.edges,keyTick:frames?.keyTick??null}}));
}
function reset({preserveSeed=true}={}){
 stop();peek=false;phase="idle";
 if(!preserveSeed)seed=7;
 frames=null;cursor=0;selected=null;
 base=new S(seed,{n_agents:selectedSize(),ticks:MAX_TICKS});protagonist=Story.hero(base.agents);
 $("portal-population").value=String(base.agents.length);previousTargets.clear();
 $("timeline-play").disabled=true;$("timeline-slider").disabled=true;
 setText("subject-name","点击网络节点");setText("subject-detail","查看主体类别、模型状态与关系来源。");
 setText("scene-title","基线 · 产业关系网络");
 if(protagonist){setText("hero-deck","这次只让「"+protagonist.name+"」退出模型。先看哪些连线熄灭，再拖动看后续。");setText("hero-quickstart","▶ 让 "+protagonist.name+" 退出模型");}
 if(view)view.setGraph(base.snapshots[0].agents,base.edges,{tick:0});
 paint(0);msg("初始模型世界已就绪，可播放指定链主退出的假设演示。");
}
function enableTimeline(){ $("timeline-play").disabled=false;$("timeline-slider").disabled=false; }
function run(shock,atTick=0){
 if(!SHOCKS.includes(shock)){msg("未登记在原模型的冲击类型，无法执行。");return;}
 stop();peek=false;phase="playing";view.finishEntrance();$("portal-shock").value=shock;
 const size=selectedSize();base=new S(seed,{n_agents:size,ticks:MAX_TICKS});
 const b=new S(seed,{n_agents:size,ticks:MAX_TICKS}),result=b.shock(shock);
 if(!result.ok){msg("该冲击不能运行。");return;}
 const A=[base._snap()],B=[b._snap()];for(let i=0;i<MAX_TICKS;i++){base.step();b.step();A.push(base._snap());B.push(b._snap());}
 frames={kind:"shock",A,B,shock,edges:base.edges,initial:A[0],keyTick:Story.keyTick(A,B)};enableTimeline();
 setText("scene-title",shock+" · 条件情景");setText("portal-run","↻ 重新运行此情景");
 paint(atTick);msg("当前为原模型的「"+shock+"」情景，可按住对照未发生时。");
 if(!reduced)play();
}
function runExit(target,atTick=null){
 stop();peek=false;view.finishEntrance();
 const size=selectedSize();base=new S(seed,{n_agents:size,ticks:MAX_TICKS});
 try{frames=Story.exitRun(S,seed,size,target,MAX_TICKS);}catch(e){msg(e.message);return;}
 selected=target;enableTimeline();setText("scene-title",target+"退出 · 假设演示");
 view.resetCamera();
 if(atTick!==null){phase="scrub";paint(atTick);focusNode(target);return;}
 if(reduced){phase="final";paint(MAX_TICKS);focusNode(target);return;}
 phase="intro";paint(0);focusNode(target);startIntro();
}
function startIntro(){
 markPlaying();later(()=>{
  phase="event";paint(0);
  later(()=>advanceStory(1),1600);
 },1100);
}
function advanceStory(t){
 if(!frames||frames.kind!=="exit")return;
 if(t>MAX_TICKS){stop();phase="final";paint(MAX_TICKS);return;}
 if(t===frames.keyTick&&t<MAX_TICKS){stop();phase="key";paint(t);return;}
 phase=t===MAX_TICKS?"final":"playing";
 if(t===MAX_TICKS)stop();
 paint(t);
 if(t<MAX_TICKS)later(()=>advanceStory(t+1),t<frames.keyTick?350:250);
}
function play(){
 if(!frames)return;
 stop();peek=false;
 if(frames.kind==="exit"){
  if(cursor>=MAX_TICKS){runExit(frames.target);return;}
  markPlaying();
  if(phase==="intro"){startIntro();return;}
  advanceStory(cursor+1);return;
 }
 if(cursor>=MAX_TICKS)paint(0);
 markPlaying();timer=window.setInterval(()=>{
  if(!frames||cursor>=MAX_TICKS){stop();return;}
  phase=cursor+1>=MAX_TICKS?"final":"playing";paint(cursor+1);
  if(cursor>=MAX_TICKS)stop();
 },420);
}
function beginPeek(){
 if(!frames||phase==="intro")return;
 stop();peek=true;paint(cursor);
}
function endPeek(){if(!peek)return;peek=false;paint(cursor);}
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
 const encoded=new URLSearchParams(window.location.search).get("scenario");if(!encoded)return false;
 try{
  if(encoded.length>500)throw Error("too long");const d=JSON.parse(decodeURIComponent(encoded));
  const shareSeed=safeInt(d.seed,1,2147483647),size=d.v===1?24:safeInt(d.pop,24,41),tick=safeInt(d.tick??0,0,MAX_TICKS);
  if(!shareSeed||!SIZES.includes(size)||tick===null)throw Error("invalid");
  seed=shareSeed;$("portal-population").value=String(size);reset();
  if(d.v===3&&d.kind==="exit"&&typeof d.target==="string"&&base.agents.some(n=>n.name===d.target&&n.type==="anchor")){
   runExit(d.target,tick);return true;
  }
  if((d.v===1||d.v===2)&&SHOCKS.includes(d.shock)){ $("portal-shock").value=d.shock;run(d.shock,tick);return true; }
  throw Error("invalid");
 }catch{reset();msg("分享链接格式无效，已恢复模型基线。");return false;}
}
function share(){
 const payload=frames?.kind==="exit"?{v:3,kind:"exit",target:frames.target,seed,pop:selectedSize(),tick:cursor}:
  {v:2,seed,pop:selectedSize(),shock:frames?.shock||$("portal-shock").value,tick:frames?cursor:0};
 const url=new URL(window.location.href);url.searchParams.set("scenario",encodeURIComponent(JSON.stringify(payload)));url.hash="";
 const copy=url.toString();
 if(navigator.clipboard?.writeText)navigator.clipboard.writeText(copy).then(()=>msg("已复制这次模型实验的输入和时间步链接。"),()=>manualCopy(copy));
 else manualCopy(copy);
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
  status:$("render-mode"),onSelect:selectNode,entrance:true,onEntrance:info=>{
    const status=$("world-build-status"),list=$("build-batches");
    if(status)status.textContent=info.done?
      "组网完成 · "+info.total+" 个模型主体 / "+info.edges+" 条模型连线":
      "正在接入 · "+(info.batches[info.batch]?.label||"产业主体")+" · "+info.arrived+" / "+info.total+" 个主体已到位";
    if(list){
      if(list.children.length!==info.batches.length){
        list.replaceChildren(...info.batches.map(g=>{const li=document.createElement("li");li.textContent=g.label+" "+g.count;return li;}));
      }
      [...list.children].forEach((li,i)=>{li.dataset.state=info.done?"done":info.stages[i];});
    }
  }});
 $("world-build-replay")?.addEventListener("click",()=>{reset();$("world-stage")?.scrollIntoView({behavior:reduced?"auto":"smooth",block:"center"});});
 view.setLabelMode($("portal-labels").value);
 $("portal-run").addEventListener("click",()=>run($("portal-shock").value));
 $("preset-risk").addEventListener("click",()=>run("链主外迁"));
 $("hero-quickstart")?.addEventListener("click",()=>{
   if(protagonist)runExit(protagonist.name);
   $("world-stage")?.scrollIntoView({behavior:"auto",block:"start"});
 });
 $("preset-growth").addEventListener("click",()=>run("技术突破"));
 $("portal-population").addEventListener("change",()=>{reset();$("portal-run").textContent="▶ 开始情景推演";});
 $("portal-shock").addEventListener("change",()=>{if(frames){reset();$("portal-run").textContent="▶ 开始情景推演";}});
 $("portal-labels").addEventListener("change",()=>view.setLabelMode($("portal-labels").value));
 $("portal-reset").addEventListener("click",()=>{reset();$("portal-run").textContent="▶ 开始情景推演";});
 $("timeline-slider").addEventListener("input",()=>{stop();peek=false;const t=Number($("timeline-slider").value);phase=t===frames?.keyTick?"key":"scrub";paint(t);});
 $("timeline-play").addEventListener("click",()=>{if(running){stop();paint(cursor);}else play();});
 $("home-next").addEventListener("click",()=>{
  if(!frames){if(protagonist)runExit(protagonist.name);return;}
  if(running){stop();if(phase==="intro")phase="event";paint(cursor);return;}
  if(cursor>=MAX_TICKS){if(frames.kind==="exit")runExit(frames.target);else run(frames.shock);return;}
  play();
 });
 const peekButton=$("home-peek");
 peekButton.addEventListener("pointerdown",e=>{if(peekButton.disabled)return;e.preventDefault();peekButton.setPointerCapture(e.pointerId);beginPeek();});
 peekButton.addEventListener("pointerup",endPeek);peekButton.addEventListener("pointercancel",endPeek);peekButton.addEventListener("lostpointercapture",endPeek);
 peekButton.addEventListener("keydown",e=>{if(e.code==="Space"||e.code==="Enter"){e.preventDefault();if(!e.repeat)beginPeek();}});
 peekButton.addEventListener("keyup",e=>{if(e.code==="Space"||e.code==="Enter"){e.preventDefault();endPeek();}});
 peekButton.addEventListener("blur",endPeek);window.addEventListener("blur",()=>{stop();endPeek();});
 document.addEventListener("visibilitychange",()=>{if(document.hidden){stop();endPeek();}});
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
