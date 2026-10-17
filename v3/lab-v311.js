/* V3.11 second-page interaction layer.
   Uses original app.js Sim A/B calculation; no new model formulas or synthetic scores. */
(function(){
"use strict";
const el=id=>document.getElementById(id);
const K=window.ZKImpact;
if(!K||!el("lab-stage"))return;
const all=el("lab-all-shocks"),legacy=el("shock-sel");
const seed=el("lab-seed"),legacySeed=el("seed-input");
const advanced=el("lab-evidence");
let validResult=false;
function make(tag,cls,text){
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(text!==undefined)n.textContent=String(text);
 return n;
}
function updateAll(){
 all.value=legacy.value;
 el("lab-b-name").textContent=legacy.value||"待选择情景";
}
for(const option of legacy.options)all.append(new Option(option.textContent,option.value));
updateAll();
all.addEventListener("change",()=>{
 legacy.value=all.value;legacy.dispatchEvent(new Event("change",{bubbles:true}));
});
legacy.addEventListener("change",updateAll);
seed.value=legacySeed.value;
seed.addEventListener("input",()=>{
 const n=Number(seed.value);
 if(!Number.isSafeInteger(n)||n<1||n>2147483647){
  el("lab-input-warning").textContent="随机种子必须是 1～2147483647 的整数。";
 }else el("lab-input-warning").textContent="";
 legacySeed.value=seed.value;
 legacySeed.dispatchEvent(new Event("input",{bubbles:true}));
});
legacySeed.addEventListener("input",()=>{seed.value=legacySeed.value;});
function explain(metrics){
 const box=el("lab-plain-result");if(!box)return;
 box.replaceChildren();
 const important=metrics.slice().filter(x=>Number.isFinite(x.delta))
  .sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta))[0];
 if(!important)return;
 const nearZero=Math.abs(important.delta)<.0005;
 const names={abundance:"产业活力",order:"产业角色的协同程度",disaster:"模型里的风险压力",
  mood:"产业角色的信心",survivors:"仍在运转的角色比例"};
 const name=names[important.key]||important.name;
 const sentence=nearZero?
  "这次实验的五项模型指数几乎没有变化。":
  "这次模型对照里，变化最明显的是「"+name+"」："+
   "与没有发生这件事的情景相比，它"+(important.delta>0?"增加了":"减少了")+"。";
  box.append(make("strong","",sentence),
   make("p","","你看到的只是模拟世界中的两条可能路径，不是现实的经济损失、岗位变化或政策预测。想查数字？下面保留原来的全部研究指标。"));
}
function empty(stale=false){
 validResult=false;
 const plain=el("lab-plain-result");if(plain){
   plain.replaceChildren(make("strong","",stale?"条件变了，结果需要重算":"还没有进行实验"),
     make("p","",stale?"刚才的数字已经失效，请重新运行后再比较。":"选择一种风险或机会，点击运行，先看一句话结果，再看完整数字。"));
 }
 const host=el("lab-preview-metrics");host.replaceChildren();
 const card=make("div","lab-preview-empty");
 card.append(make("span","",stale?"↺":"⌁"),
  make("strong","",stale?"研究条件已改变":"结果留白，直到模型运行"),
  make("p","",stale?
    "原结果已失效。请重新运行 A/B，才会显示与新条件一致的数据。":
    "选择一个情景，点击运行 A/B。这里才会显示模型实际算出的差异。"));
 host.append(card);
 const badge=el("lab-preview-status");badge.dataset.state=stale?"stale":"waiting";
 badge.textContent=stale?"SETTINGS CHANGED / RE-RUN":"等待运行 · NO COMPUTED DATA";
}
function render(event){
 if(!event||event.stale){empty(true);return;}
 let metrics;
 try{metrics=K.compare(event.a,event.b);}
 catch(e){empty(true);return;}
 explain(metrics);
 const host=el("lab-preview-metrics");host.replaceChildren();
 const scale=Math.max(...metrics.map(item=>Math.abs(item.delta)),.02);
 for(const item of metrics){
  const line=make("div","lab-quick-row");
  line.append(make("span","",item.name));
  const track=make("div","lab-quick-track");
  const bar=make("span","lab-quick-fill "+(item.favorability==="favorable"?"good":item.favorability==="unfavorable"?"bad":""));
  const pct=Math.min(45,45*Math.abs(item.delta)/scale);
  bar.style.width=(Math.abs(item.delta)<1e-9?0:Math.max(1.5,pct))+"%";
  bar.style.left=(item.delta>=0?50:50-pct)+"%";
  track.append(bar);line.append(track);
  const v=make("strong",item.favorability==="favorable"?"good":item.favorability==="unfavorable"?"bad":"",
   (item.delta>0?"+":"")+item.delta.toFixed(3));
  line.append(v);host.append(line);
 }
 el("lab-preview-status").textContent="MODEL RESULTS · T "+String(event.tick).padStart(2,"0")+" / "+event.ticks;
 el("lab-preview-status").dataset.state="ready";
 el("lab-b-name").textContent=event.shock;
 validResult=true;
 document.body.classList.add("lab-has-results");
}
window.addEventListener("zk:comparison",e=>render(e.detail));
window.addEventListener("zk:compare-stale",()=>{empty(true);document.body.classList.remove("lab-has-results");});
window.addEventListener("zk:compare-clear",()=>{empty(false);document.body.classList.remove("lab-has-results");});
el("lab-story-start")?.addEventListener("click",()=>{
 const shock="链主外迁";
 if(![...all.options].some(option=>option.value===shock)){
  el("lab-input-warning").textContent="当前模型没有这个演示情景，请从下方选择另一种变化。";
  return;
 }
 all.value=shock;all.dispatchEvent(new Event("change",{bubbles:true}));
 el("wind-run").click();
 window.requestAnimationFrame(()=>el("lab-preview")?.scrollIntoView({block:"start",behavior:"auto"}));
});
el("wind-run").addEventListener("click",()=>{
 const n=Number(seed.value);
 if(!Number.isSafeInteger(n)||n<1||n>2147483647){
  el("lab-input-warning").textContent="请先输入有效的随机种子。";return;
 }
});
function openAdvanced(target){
 advanced.open=true;
 window.requestAnimationFrame(()=>{if(target)el(target)?.scrollIntoView({block:"start",behavior:"auto"});});
}
el("v39-detail-button").addEventListener("click",()=>openAdvanced("compare-section"),{capture:true});
document.querySelectorAll(".lab-advanced-content a[href^='#']").forEach(a=>{
 a.addEventListener("click",()=>advanced.open=true,{capture:true});
});
document.querySelectorAll('a[href="#lab-evidence"]').forEach(a=>a.addEventListener("click",()=>{advanced.open=true;}));
const flow=document.querySelectorAll(".lab-flow a");
flow.forEach(link=>link.addEventListener("click",()=>{
 flow.forEach(x=>x.classList.toggle("active",x===link));
 if(link.hash==="#lab-evidence")advanced.open=true;
}));
const first=document.querySelector('.lab-v311 .rail-link.active');
if(first){first.href="lab.html";first.setAttribute("aria-current","page");}
window.ZKLab={openAdvanced};
empty();
})();
