/* V3.9 read-only scientific lens on REAL existing Sim snapshots.
   No policy attribution or real-world economic probability inferred here. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ZKImpact=api;})(typeof window!=="undefined"?window:null,function(){
"use strict";
const specs=[
 {key:"abundance",name:"景气",upGood:true},{key:"order",name:"协同",upGood:true},
 {key:"disaster",name:"风险",upGood:false},{key:"mood",name:"信心",upGood:true},
 {key:"survivors",name:"存续率",upGood:true}
];
function value(s,key){
 if(!s||!Array.isArray(s.agents)||!s.state)return null;
 if(key==="survivors")return s.agents.length?s.agents.filter(a=>a.alive).length/s.agents.length:null;
 const x=s.state[key];return typeof x==="number"&&Number.isFinite(x)?x:null;
}
function compare(a,b){
 if(!a||!b)throw Error("缺少 A/B 模型真实快照");
 return specs.map(k=>{
  const A=value(a,k.key),B=value(b,k.key);
  if(A===null||B===null)throw Error("模型状态不完整："+k.key);
  const d=B-A;return {...k,a:A,b:B,delta:d,
   direction:d>1e-9?"up":d< -1e-9?"down":"flat",
   favorability:Math.abs(d)<1e-9?"neutral":(d>0)===k.upGood?"favorable":"unfavorable"};
 });
}
function affected(a,b){
 if(!a||!b||!Array.isArray(a.agents)||!Array.isArray(b.agents))throw Error("缺少两组模型主体");
 const lookup=new Map(a.agents.map(x=>[x.name,x]));
 return b.agents.flatMap(x=>{
  const old=lookup.get(x.name);if(!old)return [];
  const exit=Number(!!x.alive)-Number(!!old.alive);
  const energy=(Number(x.energy)||0)-(Number(old.energy)||0);
  const sentiment=(Number(x.sentiment)||0)-(Number(old.sentiment)||0);
  const magnitude=Math.abs(exit)*2+Math.abs(energy)+Math.abs(sentiment)*.5;
  return magnitude>1e-6?[{name:x.name,exit,energy,sentiment,magnitude}]:[];
 }).sort((x,y)=>y.magnitude-x.magnitude||x.name.localeCompare(y.name,"zh-CN"));
}
function range(series,key){
 if(!Array.isArray(series))return null;
 const pts=series.map((snap,tick)=>({tick,value:value(snap,key)}))
 .filter(p=>p.value!==null);
 return pts.length?pts:null;
}
function prepare(a,b,base,shock){
 const metrics=compare(a,b),agents=affected(a,b),trends=[];
 if(Array.isArray(base)&&Array.isArray(shock)){
  for(const spec of specs){
   const A=range(base,spec.key),B=range(shock,spec.key);
   if(A&&B)trends.push({key:spec.key,name:spec.name,a:A,b:B});
  }
 }
 return {metrics,agents,trends,observedChanged:agents.length};
}
return {specs,value,compare,affected,prepare};
});
