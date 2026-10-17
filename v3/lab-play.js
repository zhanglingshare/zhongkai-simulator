/* Direct manipulation of existing A[t] / B[t] snapshots. No simulation equations. */
(function(){
"use strict";
const $=id=>document.getElementById(id),K=window.ZKImpact;
const host=$("lab-play-stage"),slider=$("lab-play-time");
if(!host||!K)return;
let current=null;
const active=s=>s.agents.filter(n=>n.alive).length;
const formatted=(key,s,value)=>key==="survivors"?active(s)+"个":value.toFixed(3);
function empty(stale=false){
 current=null;host.dataset.state=stale?"stale":"waiting";
 slider.disabled=true;$("lab-play-final").disabled=true;slider.value="20";
 $("lab-play-time-out").textContent=stale?"条件已变":"等待运行";
 $("lab-play-hint").textContent=stale?
   "条件变了，刚才的柱子已清空。重新运行后，再看新的差距。":
   "先运行一次，再拖动。柱高显示原模型的实际快照，不预填结果。";
 host.querySelectorAll(".lab-play-fill").forEach(b=>{b.style.height="0%";delete b.dataset.value;});
 host.querySelectorAll(".lab-play-number,.lab-play-gap").forEach(n=>{n.textContent="—";delete n.dataset.tone;});
 host.querySelectorAll(".lab-play-chart").forEach(n=>n.setAttribute("aria-label","尚无有效的模型结果"));
}
function render(data){
 if(!data||data.stale){empty(true);return;}
 let metrics;try{metrics=K.compare(data.a,data.b);}catch{empty(true);return;}
 current=data;host.dataset.state="ready";
 host.querySelectorAll("[data-play-shock]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.playShock===data.shock)));
 host.querySelectorAll(".lab-play-group").forEach(group=>{
   const key=group.dataset.metric,m=metrics.find(m=>m.key===key);
   if(!m)return;
   for(const path of ["a","b"]){
     const fill=group.querySelector('[data-path="'+path+'"] .lab-play-fill');
     const value=m[path];
     // All three shown indicators already have a 0–1 model domain.
     fill.style.height=(Math.min(1,Math.max(0,value))*100)+"%";
     fill.dataset.value=String(value);
     fill.querySelector("span").textContent=formatted(key,data[path],value);
   }
   const gap=group.querySelector(".lab-play-gap");gap.dataset.tone=m.favorability==="favorable"?"good":m.favorability==="unfavorable"?"bad":"neutral";
   const delta=key==="survivors"?active(data.b)-active(data.a):m.delta;
   const nearZero=key==="survivors"?delta===0:Math.abs(delta)<.0005;
   gap.textContent=nearZero?"两边相同":key==="survivors"?
     (delta<0?"少 ":"多 ")+Math.abs(delta)+" 个":
     (delta>0?"+":"")+delta.toFixed(3);
   group.querySelector(".lab-play-chart").setAttribute("aria-label",
     group.querySelector("h4").textContent+"，第"+data.tick+"步，A "+formatted(key,data.a,m.a)+"，B "+formatted(key,data.b,m.b));
 });
 slider.disabled=false;slider.max=String(data.ticks);slider.value=String(data.tick);
 $("lab-play-time-out").textContent="第 "+data.tick+" / "+data.ticks+" 步";
 $("lab-play-end").textContent="第 "+data.ticks+" 步";$("lab-play-final").disabled=false;
 const a=active(data.a),b=active(data.b),risk=metrics.find(m=>m.key==="disaster").delta;
 const riskText=Math.abs(risk)<.0005?"压力风险接近":risk>0?"压力风险更高":"压力风险更低";
 $("lab-play-hint").textContent="第 "+data.tick+" 步，B 比 A "+(a===b?"运转角色一样多":b<a?"少了 "+(a-b)+" 个运转角色":"多了 "+(b-a)+" 个运转角色")+"，"+riskText+"。继续拖动，检查差距是否一直如此。";
}
function move(t){
 if(!current)return;
 // Route through the original timeline: every existing chart stays synchronized.
 const legacy=$("compare-tick");legacy.value=String(t);
 legacy.dispatchEvent(new Event("input",{bubbles:true}));
}
slider.addEventListener("input",()=>move(Number(slider.value)));
$("lab-play-final").addEventListener("click",()=>{if(current)move(current.ticks);});
host.querySelectorAll("[data-play-shock]").forEach(button=>button.addEventListener("click",()=>{
 const select=$("lab-all-shocks");select.value=button.dataset.playShock;
 select.dispatchEvent(new Event("change",{bubbles:true}));$("wind-run").click();
}));
window.addEventListener("zk:comparison",e=>render(e.detail));
window.addEventListener("zk:compare-stale",()=>empty(true));
window.addEventListener("zk:compare-clear",()=>empty());
empty();
})();
