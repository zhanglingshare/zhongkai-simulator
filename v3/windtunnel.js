/* V3.7 immersive windtunnel UI — visual effects follow real snapshots and edges.
 * No static fabricated network outcomes, no GPS, no uploads. */
(function(){
 "use strict";
 const C=window.ZKWindCore,$=id=>document.getElementById(id);
 const SVG="http://www.w3.org/2000/svg";
 const mk=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;
   if(text!==undefined)n.textContent=String(text);return n;};
 const sv=(tag,attrs,text)=>{const n=document.createElementNS(SVG,tag);
   Object.entries(attrs||{}).forEach(([key,value])=>n.setAttribute(key,String(value)));
   if(text!==undefined)n.textContent=String(text);return n;};
 let experiment=null,ensemble=null,factorResult=null,activeWorld="B",tick=0,
   timer=null,positions={},selected=null;
 const typeName={anchor:"链主",oem:"整机",supplier:"配套",capital:"资本",talent:"人才",infra:"基础设施",
   service:"服务",land:"空间",policy:"政策",gov:"治理"};
 function fail(message){$("runtime-error").hidden=false;$("runtime-error").textContent=String(message);}
 function formatter(x){return (x>=0?"+":"")+x.toFixed(3);}
 function safeSeed(){
   const n=Number($("seed-input").value);
   if(!Number.isSafeInteger(n)||n<1||n>2147483647)throw Error("种子需是 1 至 2147483647 的整数");
   return n;
 }
 const currentConfig=()=>({seed:safeSeed(),shock:document.querySelector(".scenario-chip.is-selected")?.dataset.shock||"链主外迁",
    intervention:$("rescue-select").value,intensity:Number($("intensity-slider").value)});
 function setScenario(name){
   const valid=C.shocks.includes(name)?name:C.shocks[0];
   document.querySelectorAll(".scenario-chip").forEach(btn=>{
     const yes=btn.dataset.shock===valid;
     btn.classList.toggle("is-selected",yes);btn.setAttribute("aria-pressed",String(yes));
   });
   dirty();
 }
 function dirty(){
   if(experiment){
     $("share-status").textContent="当前设置已修改；请先重新运行，旧的分享与导出已暂时停用。";
     ["copy-link","download-card","download-json"].forEach(id=>$(id).disabled=true);
   }
 }
 function scenarioOptions(){
   for(const [id,group] of [["negative-options","negative"],["positive-options","positive"]]){
     for(const name of C.shockGroups[group]){
       const b=mk("button","scenario-chip"+(group==="positive"?" positive":""),name);
       b.type="button";b.dataset.shock=name;b.setAttribute("aria-pressed","false");
       b.addEventListener("click",()=>setScenario(name));
       $(id).append(b);
     }
   }
 }
 function layout(agents){
   const position={};
   const byCategory={anchor:[],factory:[],eco:[]};
   for(const agent of agents){
     const category=agent.type==="anchor"?"anchor":["supplier","oem"].includes(agent.type)?"factory":"eco";
     byCategory[category].push(agent);
   }
   const put=(arr,radius,start)=>{
     arr.forEach((a,i)=>{
       const a0=start+2*Math.PI*(i/Math.max(1,arr.length));
       const oval=radius*(1+.075*Math.sin(i*7.1));
       position[a.name]={x:450+Math.cos(a0)*oval*1.21,y:295+Math.sin(a0)*oval*.84};
     });
   };
   put(byCategory.anchor,116,-Math.PI/2);
   put(byCategory.factory,260,.18);
   put(byCategory.eco,312,-.9);
   return position;
 }
 function drawGraph(){
   if(!experiment)return;
   const model=activeWorld==="B"?experiment.B:experiment.A;
   const snap=model.snapshots[tick],svg=$("wind-network");
   const agents=snap.agents,alive=new Map(agents.map(a=>[a.name,a]));
   const active=selected&&alive.has(selected)?selected:null;
   positions=layout(experiment.B.agents);
   svg.replaceChildren();
   const bg=sv("g");
   for(const r of [100,185,280]){
     bg.append(sv("ellipse",{cx:450,cy:295,rx:r*1.28,ry:r*.88,fill:"none",
       stroke:"#4a8ba1","stroke-width":1,"stroke-dasharray":"4 10","stroke-opacity":.11}));
   }
   for(const rad of [0,90,180,270]){
     const theta=rad*Math.PI/180;
     bg.append(sv("line",{x1:450+Math.cos(theta)*48,y1:295+Math.sin(theta)*40,
       x2:450+Math.cos(theta)*395,y2:295+Math.sin(theta)*260,
       stroke:"#3f8295","stroke-width":1,"stroke-opacity":.075}));
   }
   svg.append(bg);
   const edges=sv("g");
   for(const e of model.edges){
     const a=positions[e.a],b=positions[e.b],aa=alive.get(e.a),bb=alive.get(e.b);
     if(!a||!b||!aa||!bb)continue;
     const down=!aa.alive||!bb.alive;
     const hit=active&&(active===e.a||active===e.b);
     const line=sv("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,
       class:"wind-edge"+(e.layer==="hist"?" hist":"")+(down?" dead":"")+(hit?" highlight":"")});
     edges.append(line);
   }
   svg.append(edges);
   const nodeLayer=sv("g");
   for(const a of agents){
     const pos=positions[a.name];if(!pos)continue;
     const cls=a.type==="anchor"?"anchor":["oem","supplier"].includes(a.type)?"firm":"infra";
     const g=sv("g",{class:"wind-node "+cls+(a.alive?"":" dead")+(active===a.name?" selected":""),
       transform:"translate("+pos.x.toFixed(2)+" "+pos.y.toFixed(2)+")",tabindex:"0",
       role:"button","aria-label":a.name+"，"+(typeName[a.type]||a.type)+(a.alive?"，存续":"，退出")});
     g.append(sv("circle",{class:"halo",r:a.type==="anchor"?20:15}));
     g.append(sv("circle",{class:"core",r:a.type==="anchor"?11:a.w>=2?8:6.3}));
     if(a.w>=2||a.type==="anchor"){
       const label=a.name.length>9?a.name.slice(0,9)+"…":a.name;
       g.append(sv("text",{y:a.type==="anchor"?-22:-15,"text-anchor":"middle"},label));
     }
     const visit=()=>{selected=a.name;showDetail(a);drawGraph();};
     g.addEventListener("click",visit);
     g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();visit();}});
     nodeLayer.append(g);
   }
   svg.append(nodeLayer);
   const shockText=activeWorld==="B"?experiment.config.shock:"无冲击的基准世界";
   $("network-stamp").textContent=shockText;
   if(!active){
     $("node-detail").textContent="点击网络节点，查看其模型角色、存续状态与相邻节点。";
   }
 }
 function showDetail(a){
   const model=activeWorld==="B"?experiment.B:experiment.A;
   const ne=model.edges.filter(e=>e.a===a.name||e.b===a.name).length;
   $("node-detail").textContent=a.name+" · "+(typeName[a.type]||a.type)+" | "+
     (a.alive?"仍在模型中":"已退出")+
     " | 关联 "+ne+" 条模型边；边可能是历史预设或启发式关系。";
 }
 function updateKpis(){
   if(!experiment)return;
   const a=experiment.a[tick],b=experiment.b[tick],container=$("kpi-stack");
   container.replaceChildren();
   for(const [key,spec] of Object.entries(C.metrics)){
     const diff=b[key]-a[key];
     const fav=(key==="disaster"?-diff:diff),cls=Math.abs(diff)<.0005?"neutral":fav>0?"positive":"negative";
     const card=mk("div","kpi-card"),top=mk("div","kpi-top");
     top.append(mk("span","",spec.label),mk("strong",cls,formatter(diff)));
     card.append(top);
     const values=mk("div","kpi-values");
     values.append(mk("span","","A "+a[key].toFixed(3)),mk("span","","B "+b[key].toFixed(3)));
     card.append(values);
     const meter=mk("div","kpi-meter"),fill=mk("span",cls==="negative"?"negative":"");
     fill.style.width=Math.min(100,Math.abs(diff)/Math.max(.01,spec.range[1]-spec.range[0])*140)+"%";
     meter.append(fill);card.append(meter);container.append(card);
   }
   const timeline=(activeWorld==="B"?experiment.B:experiment.A).snapshots[tick].timeline;
   const latest=timeline.filter(e=>e.tick<=tick).slice(-1)[0];
   const ranking=Object.entries(C.metrics).map(([key,spec])=>({
     name:spec.label,abs:Math.abs(b[key]-a[key]),difference:b[key]-a[key]
   })).sort((x,y)=>y.abs-x.abs);
   $("event-text").textContent=(latest?"原模型叙事事件（不代表实时核实的官方事实）："+latest.text+"。 ":"")+
    "第 "+tick+" 步，最明显的模型状态差异为「"+ranking[0].name+"」"+
    formatter(ranking[0].difference)+"。此差异仅描述原 Sim 的条件性运行。";
 }
 function setTick(value){
   if(!experiment)return;
   tick=Math.max(0,Math.min(experiment.ticks,Math.round(value)));
   $("timeline-slider").value=String(tick);
   $("current-tick").textContent=String(tick).padStart(2,"0");
   drawGraph();updateKpis();
 }
 function stop(){
   if(timer){clearInterval(timer);timer=null;}
   $("play-pause").textContent="▶";$("play-pause").setAttribute("aria-label","播放情景演化");
 }
 function togglePlay(){
   if(timer){stop();return;}
   if(tick>=experiment.ticks)setTick(0);
   $("play-pause").textContent="Ⅱ";$("play-pause").setAttribute("aria-label","暂停情景演化");
   timer=setInterval(()=>{
     if(tick>=experiment.ticks){stop();return;}
     setTick(tick+1);
   },480);
 }
 function switchWorld(which){
   stop();activeWorld=which;selected=null;
   for(const code of ["A","B"]){
     const button=$("world-"+code.toLowerCase()),yes=code===which;
     button.classList.toggle("is-current",yes);button.setAttribute("aria-pressed",String(yes));
   }
   drawGraph();updateKpis();
 }
 function updateShare(){
   const target=new URL("windtunnel.html",window.location.href);
   target.search=C.serialize(experiment.config);
   $("share-link").value=target.href;
 }
 function resetAnalyses(){
   ensemble=null;factorResult=null;
   $("ensemble-result").className="research-empty";
   $("ensemble-result").textContent="尚未运行多种子检查。此处不会显示编造的概率或区间。";
   $("factor-result").className="research-empty";
   $("factor-result").textContent="尚未运行因子扫描。结果必须来自实际模型重跑。";
 }
 function run(){
   stop();
   const config=currentConfig();
   experiment=C.one(Sim,config);
   setTick(0);switchWorld("B");selected=null;
   $("timeline-slider").max=String(experiment.ticks);
   document.querySelector(".timeline-count span").textContent=" / "+experiment.ticks+" STEPS";
   $("run-experiment").querySelector("span").textContent="重新运行这个情景";
   updateShare();resetAnalyses();
   ["copy-link","download-card","download-json"].forEach(id=>$(id).disabled=false);
   $("share-status").textContent="新的实验已就绪，可复制链接邀请他人复现。";
   if(window.history&&window.history.replaceState)
     window.history.replaceState(null,"",new URL("windtunnel.html?"+C.serialize(config),window.location.href).href);
 }
 function factorScan(){
   if(!experiment)return;
   $("analyze-factors").disabled=true;
   try{
     factorResult=C.scan(Sim,experiment.config,"abundance",4);
     const root=$("factor-result");root.className="research-list";root.replaceChildren();
     const ceiling=Math.max(...factorResult.factors.map(f=>f.magnitude),.001);
     for(const f of factorResult.factors){
       const row=mk("div","factor-row");
       const label=mk("span","",f.name);label.append(mk("small","factor-grade",f.grade));
       row.append(label);
       const track=mk("div","factor-bar"),bar=mk("span");
       bar.style.width=(100*f.magnitude/ceiling)+"%";
       track.append(bar);row.append(track);
       row.append(mk("small","",f.direction));
       root.append(row);
     }
     root.append(mk("p","research-remark","单因子上下调 0.12，4 个种子。按最大平均模型状态变化排序，结果并非现实政策作用方向。"));
   }catch(e){fail(e.message);}
   finally{$("analyze-factors").disabled=false;}
 }
 function ensembleScan(){
   if(!experiment)return;
   $("analyze-ensemble").disabled=true;
   try{
     ensemble=C.multiple(Sim,experiment.config,16);
     const root=$("ensemble-result");root.className="research-list";root.replaceChildren();
     const maxRange=.8;
     for(const [key,stats] of Object.entries(ensemble.summary)){
       const row=mk("div","research-row");
       row.append(mk("span","",C.metrics[key].label));
       const bar=mk("div","range-track");
       const start=Math.max(0,Math.min(100,50+stats.p10/maxRange*50));
       const end=Math.max(0,Math.min(100,50+stats.p90/maxRange*50));
       const mark=mk("div","whisker"+(stats.median<0?" negative":""));
       mark.style.left=Math.min(start,end)+"%";mark.style.width=Math.max(2,Math.abs(end-start))+"%";
       const mid=mk("span","median");mid.style.left=Math.max(0,Math.min(100,50+stats.median/maxRange*50))+"%";
       bar.append(mark,mid);row.append(bar);
       row.append(mk("span","value",stats.p10.toFixed(3)+" ~ "+stats.p90.toFixed(3)));
       root.append(row);
     }
     root.append(mk("p","research-remark","16 组种子：P10—P90 为模型差值的样本分位；中位数用白线表示，非现实事件概率。"));
   }catch(e){fail(e.message);}
   finally{$("analyze-ensemble").disabled=false;}
 }
 async function copyLink(){
   const value=$("share-link").value;
   try{
     if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(value);
     else{
       const inp=$("share-link");inp.focus();inp.select();
       if(!document.execCommand("copy"))throw Error("无法直接复制");
     }
     $("share-status").textContent="实验链接已复制。任何人打开后都能复算同样的输入参数。";
   }catch{
     $("share-link").focus();$("share-link").select();
     $("share-status").textContent="浏览器限制自动复制。链接已选中，请手动复制。";
   }
 }
 function download(name,blob){
   const url=URL.createObjectURL(blob),a=mk("a");a.href=url;a.download=name;
   document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);
 }
 function downloadReport(){
   if(!experiment)return;
   const x=experiment;
   const report={schema:"zk-windtunnel-scenario-v1",version:"V3.7",researchType:"conditioned-model-exploration",
     config:x.config,modelKernel:"original model.js",ticks:x.ticks,
     comparison:"same seed, different shock/params, not causal identification",pairedFinalDelta:x.diff,
     snapshots:{baseline:x.a,scenario:x.b},
     ensembleModelSeeds:ensemble?ensemble.summary:null,factorScan:factorResult?factorResult.factors:null,
     inputAssumptions:"Original Sim parameters and fixed shock definitions, no government-internal data.",
     limitations:["Not economic predictions","Ranges are model seed quantiles not real confidence intervals",
       "Edges include heuristic relations","Shock can change RNG consumption","No independently validated calendar-to-tick correspondence"]};
   download("zhongkai-windtunnel-"+x.config.seed+".json",
     new Blob([JSON.stringify(report,null,2)],{type:"application/json;charset=utf-8"}));
   $("share-status").textContent="研究 JSON 已生成：包含情景输入、模型轨迹和限制说明。";
 }
 function drawShareCard(){
   if(!experiment)return;
   const x=experiment,canvas=document.createElement("canvas");canvas.width=1200;canvas.height=630;
   const c=canvas.getContext("2d");if(!c){fail("浏览器不支持 Canvas 分享卡片");return;}
   const grad=c.createLinearGradient(0,0,1200,630);grad.addColorStop(0,"#081b2c");grad.addColorStop(.8,"#143445");grad.addColorStop(1,"#09202f");
   c.fillStyle=grad;c.fillRect(0,0,1200,630);
   c.strokeStyle="rgba(103,223,212,.12)";c.lineWidth=1;
   for(let i=0;i<=1200;i+=45){c.beginPath();c.moveTo(i,0);c.lineTo(i,630);c.stroke();}
   for(let i=0;i<=630;i+=45){c.beginPath();c.moveTo(0,i);c.lineTo(1200,i);c.stroke();}
   c.fillStyle="#75e9dc";c.font="800 26px sans-serif";c.fillText("Z.  ZHONGKAI WINDTUNNEL",68,75);
   c.fillStyle="#89a9b6";c.font="600 20px sans-serif";c.fillText("公开研究  /  复现实验  /  V3.7",68,116);
   c.fillStyle="#f1fcfd";c.font='bold 62px "Microsoft YaHei",sans-serif';c.fillText(x.config.shock,68,223);
   c.fillStyle="#9db6c4";c.font="26px sans-serif";c.fillText("探索条件  ·  "+C.interventions[x.config.intervention].name,68,278);
   const list=[["景气",x.diff.abundance],["协同",x.diff.order],["风险",x.diff.disaster]];
   list.forEach(([name,num],i)=>{
     const xx=68+i*365;c.fillStyle="rgba(122,201,205,.1)";c.fillRect(xx,330,326,132);
     c.fillStyle="#aac8d2";c.font="22px sans-serif";c.fillText(name+"  B - A",xx+24,371);
     c.fillStyle=num<0?"#f6a372":"#76e7d4";c.font="bold 43px monospace";
     c.fillText(formatter(num),xx+24,427);
   });
   c.fillStyle="#91b0c1";c.font="19px sans-serif";c.fillText("SEED  "+x.config.seed+"  /  "+x.ticks+" STEPS  /  ORIGINAL SIM",68,510);
   c.fillStyle="#b8a28a";c.font="19px sans-serif";c.fillText("模型情景指数 ≠ 现实经济预测、发生概率或官方决策",68,565);
   c.strokeStyle="#64bcb5";c.lineWidth=2;c.beginPath();c.moveTo(68,596);c.lineTo(1130,596);c.stroke();
   canvas.toBlob(blob=>{
     if(blob){download("zhongkai-windtunnel-"+x.config.seed+".png",blob);$("share-status").textContent="可分享的实验卡片已生成，含模型限定声明。";}
     else fail("分享卡片生成失败");
   },"image/png");
 }
 function boot(){
   if(!C||typeof Sim!=="function"){fail("原版 Sim 模型或试验内核未加载");return;}
   scenarioOptions();
   const cfg=C.linkConfig(window.location.search);
   setScenario(cfg.shock);
   $("seed-input").value=String(cfg.seed);
   $("rescue-select").value=cfg.intervention;
   $("intensity-slider").value=String(cfg.intensity);
   $("intensity-display").textContent="+"+cfg.intensity.toFixed(2);
   $("rescue-select").addEventListener("change",()=>{
     $("intensity-slider").disabled=$("rescue-select").value==="none";dirty();
   });
   $("intensity-slider").disabled=$("rescue-select").value==="none";
   $("intensity-slider").addEventListener("input",()=>{
     $("intensity-display").textContent="+"+Number($("intensity-slider").value).toFixed(2);dirty();
   });
   $("seed-input").addEventListener("input",dirty);
   $("run-experiment").addEventListener("click",()=>{
     try{$("runtime-error").hidden=true;run();}catch(e){fail(e.message);}
   });
   $("world-a").addEventListener("click",()=>switchWorld("A"));
   $("world-b").addEventListener("click",()=>switchWorld("B"));
   $("timeline-slider").addEventListener("input",()=>{stop();setTick(Number($("timeline-slider").value));});
   $("reset-time").addEventListener("click",()=>{stop();setTick(0);});
   $("play-pause").addEventListener("click",togglePlay);
   $("analyze-ensemble").addEventListener("click",ensembleScan);
   $("analyze-factors").addEventListener("click",factorScan);
   $("copy-link").addEventListener("click",copyLink);
   $("download-card").addEventListener("click",drawShareCard);
   $("download-json").addEventListener("click",downloadReport);
   document.addEventListener("visibilitychange",()=>{if(document.hidden)stop();});
   try{run();if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches)setTick(Math.min(8,experiment.ticks));}
   catch(e){fail(e.message);}
 }
 boot();
})();
