/* V3.21 story commentary is ONLY a comparison of stored model snapshots.
   No inferred causal chain, business transactions, jobs, GDP or actual losses. */
(function(root,factory){"use strict";const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.ZKStoryInsight=api;
})(typeof window!=="undefined"?window:typeof globalThis!=="undefined"?globalThis:null,function(){
"use strict";
const THRESHOLD=0.045;
const verbs=Object.freeze({exit:"在这条模拟路线里退出了",enter:"在这条模拟路线里仍然运转",down:"模型状态更弱了",up:"模型状态更强了"});
const sign=Object.freeze({exit:"down",enter:"up",down:"down",up:"up"});
function compare(reference,alternative,limit=3){
 if(!reference||!alternative||!Array.isArray(reference.agents)||!Array.isArray(alternative.agents))throw Error("须提供同一模型步的两条真实快照");
 const ref=new Map(reference.agents.map(n=>[n.name,n]));
 const all=[];
 for(const b of alternative.agents){
  const a=ref.get(b.name);
  if(!a||!a.name)continue;
  let kind=null,score=0;
  if(!!a.alive!==!!b.alive){kind=b.alive?"enter":"exit";score=2;}
  else if(a.alive&&b.alive&&Number.isFinite(a.energy)&&Number.isFinite(b.energy)){
   const d=b.energy-a.energy;
   if(Math.abs(d)>=THRESHOLD){kind=d<0?"down":"up";score=Math.abs(d);}
  }
  if(!kind)continue;
  all.push({name:b.name,kind,tone:sign[kind],text:verbs[kind],score,
   // This is a model energy difference, not economic growth or empirical impact.
   modelEnergyDifference:Number.isFinite(a.energy)&&Number.isFinite(b.energy)?b.energy-a.energy:null});
 }
 all.sort((x,y)=>y.score-x.score||x.name.localeCompare(y.name,"zh-CN"));
 const actual=all.slice(0,Math.max(0,Math.min(3,limit)));
 return {total:all.length,items:actual,counts:{
  exit:all.filter(x=>x.kind==="exit").length,
  enter:all.filter(x=>x.kind==="enter").length,
  down:all.filter(x=>x.kind==="down").length,
  up:all.filter(x=>x.kind==="up").length
 }};
}
function narrate(a,b,t,shock){
 if(!a||!b)return {phase:"还未开始",title:"点一下，看看产业关系会怎么变",description:"这是一个假设实验，不是真实企业事件。",items:[],total:0};
 const data=compare(a,b);
 const phase=t===0?"故事刚开始":t>=20?"看看最后有什么不同":"变化正在展开";
 if(!data.items.length)return {...data,phase,
  title:"目前，两种模拟还没有明显的主体差别",
  description:"与没有加入「"+shock+"」假设的模拟相比，这一步尚未出现达到展示门槛的主体变化。"};
 const lead=data.items[0];
 const headline=lead.name+"："+lead.text;
 const more=data.total>1?"另外还有 "+(data.total-1)+" 个模型角色出现差别。":"其他模型角色暂未出现足够明显的差别。";
 return {...data,phase,title:headline,
  description:"与没有加入「"+shock+"」假设的另一条模拟路线相比，"+more+
   "画面上标出的名字，就是本步两条模拟差异最明显的角色。"};
}
return {THRESHOLD,compare,narrate};
});