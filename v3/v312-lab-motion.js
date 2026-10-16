/* V3.12: motion is an explanation layer over existing, calculated Sim A/B snapshots.
   It never mutates Sim, interpolates new economic data, or infers causal flows. */
(function(){
"use strict";
const K=window.ZKImpact,$=id=>document.getElementById(id);
if(!K||!$("v312-replay")||!$("compare-tick"))return;
const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const playBtn=$("v312-replay"),label=$("v312-replay-status"),timeline=$("compare-tick");
let latest=null,interval=null,internal=false,serial=0;
const numericPrevious=new Map();
const frames=new Set();
function cancelTweens(){
 for(const request of frames)cancelAnimationFrame(request);
 frames.clear();
}
function stop(reason){
 if(interval!==null){clearInterval(interval);interval=null;}
 playBtn.textContent="↻ 从头重放 A/B 分化";
 if(reason)label.textContent=reason;
}
function move(tick){
 internal=true;
 try{
  timeline.value=String(tick);
  timeline.dispatchEvent(new Event("input",{bubbles:true}));
 }finally{internal=false;}
}
function play(){
 if(!latest||latest.stale)return;
 stop();
 move(0);
 const runId=++serial,total=latest.ticks;
 playBtn.textContent="Ⅱ 暂停动态回放";
 label.textContent="T 00 / "+total+" · 正在显示真实模型快照";
 interval=setInterval(()=>{
  if(runId!==serial||!latest||latest.stale){stop();return;}
  const tick=Number(timeline.value);
  if(tick>=total){stop("完整轨迹已呈现 · 可拖动时间轴逐步检查");return;}
  move(tick+1);
  label.textContent="T "+String(tick+1).padStart(2,"0")+" / "+total+" · 模型 A/B 正在分化";
  if(tick+1===total)stop("已到第 "+total+" 个模型时间步 · 可以重放或手动检查");
 },340);
}
function valueTween(node,from,to,duration){
 if(reduced||!Number.isFinite(from)||Math.abs(from-to)<.0005){
  node.textContent=(to>0?"+":"")+to.toFixed(3);return;
 }
 const began=performance.now();let request=0;
 const step=now=>{
  frames.delete(request);
  const u=Math.min(1,(now-began)/duration);
  const ease=1-(1-u)*(1-u)*(1-u);
  const value=from+(to-from)*ease;
  node.textContent=(value>0?"+":"")+value.toFixed(3);
  if(u<1){request=requestAnimationFrame(step);frames.add(request);}
  else node.textContent=(to>0?"+":"")+to.toFixed(3);
 };
 request=requestAnimationFrame(step);frames.add(request);
}
function animateTruth(event){
 if(!event||event.stale)return;
 let metrics;
 try{metrics=K.compare(event.a,event.b);}catch{return;}
 cancelTweens();
 metrics.forEach((m,i)=>{
  for(const [prefix,selector] of [["preview","#lab-preview-metrics .lab-quick-row strong"],
    ["lens","#v39-deltas .v39-delta-value strong"]]){
   const key=prefix+"-"+m.key;
   const node=document.querySelectorAll(selector)[i];
   if(!node)continue;
   const previous=numericPrevious.get(key);
   numericPrevious.set(key,m.delta);
   node.dataset.modelValue=String(m.delta);
   node.setAttribute("aria-label",m.name+"模型 B 减 A 精确值为 "+
     (m.delta>0?"+":"")+m.delta.toFixed(3)+"，数字过渡仅为显示动画");
   valueTween(node,previous,m.delta,240);
  }
 }
 // Every curve displays only actual completed steps; reveal animation never fabricates points.
 const chart=$("v39-chart");
 if(chart)chart.classList.toggle("v312-animating",!reduced);
}
function onModel(e){
 latest=e.detail;
 animateTruth(latest);
 playBtn.disabled=false;
}
window.addEventListener("zk:comparison",onModel);
window.addEventListener("zk:compare-stale",()=>{
 serial++;stop("实验条件已变化，请重新运行，旧轨迹已清空");
 playBtn.disabled=true;latest=null;numericPrevious.clear();cancelTweens();
});
window.addEventListener("zk:compare-clear",()=>{
 serial++;stop("A/B 已清空，等待新的实验");playBtn.disabled=true;
 latest=null;numericPrevious.clear();cancelTweens();
});
playBtn.addEventListener("click",()=>{
 if(interval!==null){serial++;stop("播放已暂停 · 可拖动时间轴或从头重放");}
 else play();
});
for(const id of ["v39-time","compare-tick"]){
 $(id)?.addEventListener("input",()=>{
  if(!internal&&interval!==null){serial++;stop("已切换为手动检查 · 按重放可从 T0 重新观看");}
 });
}
$("wind-run")?.addEventListener("click",()=>{
 const eventAtClick=latest,nowSerial=++serial;
 if(interval!==null)stop();
 // Existing click handlers calculate a real A/B run synchronously.
 // Begin from T0 after they finish, not from an imaginary score.
 queueMicrotask(()=>{
  if(nowSerial!==serial||!latest||latest.stale||latest===eventAtClick)return;
  if(reduced){label.textContent="已计算到最终时间步 · 已遵从系统减少动态效果设置";return;}
  play();
 });
});
label.textContent="运行实验后，能从 T0 观看真实模型结果逐步分化";
})();
