/* V3.7 immersive windtunnel scientific core.
 * Reuses the original Sim unmodified. Deterministic, seeded, explicit model-only intervals.
 * Browser window.ZKWindCore, Node module.exports. No reality-calibrated probability claims. */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.ZKWindCore=api;
})(typeof window!=="undefined"?window:(typeof globalThis!=="undefined"?globalThis:null),function(){
 "use strict";
 const shockGroups={
  negative:["链主外迁","芯片断供","限电","订单外流","融资难","供应链中断","关税摩擦","用地收紧"],
  positive:["订单爆发","政策利好","技术突破"]
 };
 const shocks=Object.freeze(shockGroups.negative.concat(shockGroups.positive));
 const interventions=Object.freeze({
  none:{name:"不增加额外干预",changes:{}},
  invest:{name:"提高投资强度",changes:{invest:.14}},
  service:{name:"加强生产性服务配套",changes:{service:.14}},
  land:{name:"改善用地支持",changes:{land:.14}},
  bundle:{name:"投资 + 配套组合",changes:{invest:.1,service:.1}}
 });
 const factors=Object.freeze([
  {key:"invest",name:"投资强度",grade:"B"},
  {key:"service",name:"服务配套",grade:"B"},
  {key:"land",name:"用地供给",grade:"C"},
  {key:"external",name:"外部依赖",grade:"B"},
  {key:"spread_rate",name:"传播速率",grade:"C"},
  {key:"disaster_rate",name:"风险累积",grade:"C"}
 ]);
 const metrics=Object.freeze({
  abundance:{label:"景气",range:[0,1]},
  order:{label:"协同",range:[0,1]},
  disaster:{label:"风险",range:[0,1]},
  mood:{label:"信心",range:[-1,1]},
  survivors:{label:"存续率",range:[0,1]}
 });
 const finite=x=>typeof x==="number"&&Number.isFinite(x);
 const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
 const quantile=(samples,p)=>{
  const arr=[...samples].sort((a,b)=>a-b),pos=(arr.length-1)*p,lo=Math.floor(pos);
  return arr[lo]+(arr[Math.min(arr.length-1,lo+1)]-arr[lo])*(pos-lo);
 };
 const rounded=n=>Number(n.toFixed(6));
 function sanitize(input){
  const seed=Number(input&&input.seed),shock=input&&input.shock,intervention=input&&input.intervention;
  const validSeed=Number.isSafeInteger(seed)&&seed>=1&&seed<=2147483647;
  const intensity=Number(input&&input.intensity);
  return {
   seed:validSeed?seed:2026,
   shock:shocks.includes(shock)?shock:"链主外迁",
   intervention:Object.hasOwn(interventions,intervention)?intervention:"none",
   intensity:finite(intensity)?clamp(Math.round(intensity*100)/100,.05,.25):.14
  };
 }
 // Parameters are *model dimensions*, not observed growth percentages or policy elasticities.
 function scenarioParams(base,config){
  const p={...base};
  for(const [key,addition] of Object.entries(interventions[config.intervention].changes))
    p[key]=clamp(p[key]+addition*config.intensity/.14,0,1);
  return p;
 }
 function value(model,key){
  return key==="survivors"?model.survivors():model.state[key];
 }
 function values(snapshot){
  const s=snapshot.state,agents=snapshot.agents;
  return {abundance:s.abundance,order:s.order,disaster:s.disaster,mood:s.mood,
    survivors:agents.length?agents.filter(a=>a.alive).length/agents.length:0};
 }
 function one(Sim,raw,seedOverride,baseOverride){
  if(typeof Sim!=="function")throw Error("缺少原版 Sim 内核");
  const c=sanitize(raw),seed=seedOverride||c.seed;
  const A=new Sim(seed,baseOverride),B=new Sim(seed,scenarioParams(A.params,c));
  const applied=B.shock(c.shock);
  if(!applied||!applied.ok)throw Error("原版内核不支持所选冲击");
  const ticks=Math.min(A.params.ticks||20,B.params.ticks||20);
  for(let t=0;t<ticks;t++){A.step();B.step();}
  const a=A.snapshots.map(x=>values(x)),b=B.snapshots.map(x=>values(x));
  if(a.length!==ticks+1||b.length!==ticks+1)throw Error("模型快照数与时间步不一致");
  const lastA=a[ticks],lastB=b[ticks];
  const diff=Object.fromEntries(Object.keys(metrics).map(k=>[k,rounded(lastB[k]-lastA[k])]));
  return {config:c,seed,ticks,A,B,a,b,diff,modelOnly:true,appliedKill:applied.killed||0};
 }
 function multiple(Sim,raw,n=16){
  if(!Number.isInteger(n)||n<3||n>64)throw Error("种子数量需要在3—64组之间");
  const cfg=sanitize(raw),fields=Object.keys(metrics),samples=Object.fromEntries(fields.map(k=>[k,[]]));
  for(let i=0;i<n;i++){
   const seed=1+((cfg.seed-1+i*104729)%2147483647);
   const ex=one(Sim,cfg,seed);
   fields.forEach(k=>samples[k].push(ex.diff[k]));
  }
  const summary=Object.fromEntries(fields.map(k=>{
   const x=samples[k];
   return [k,{p10:rounded(quantile(x,.1)),median:rounded(quantile(x,.5)),
    p90:rounded(quantile(x,.9)),min:rounded(Math.min(...x)),max:rounded(Math.max(...x)),
    positive:x.filter(v=>v>1e-8).length,negative:x.filter(v=>v< -1e-8).length,
    zero:x.filter(v=>Math.abs(v)<=1e-8).length,n}];
  }));
  return {config:cfg,n,summary,modelOnly:true,
   disclaimer:"分位范围只反映当前模型设定及随机种子的结果差异；不是现实发生概率、可信区间或预测准确率。"};
 }
 function scan(Sim,raw,metric="abundance",n=6){
  if(!metrics[metric])throw Error("不支持该状态指标");
  if(!Number.isInteger(n)||n<2||n>20)throw Error("敏感性实验数不合法");
  const cfg=sanitize(raw),factorsResult=[];
  for(const f of factors){
   const changes={low:[],high:[]};
   for(let i=0;i<n;i++){
    const seed=1+((cfg.seed-1+i*104729)%2147483647);
    const anchor=new Sim(seed);
    const start=anchor.params[f.key];
    const low={...anchor.params,[f.key]:clamp(start-.12,0,1)};
    const high={...anchor.params,[f.key]:clamp(start+.12,0,1)};
    // Compare each perturbation with same-seed default scenario; never assume perfect RNG alignment.
    const baseline=one(Sim,cfg,seed,anchor.params);
    const negative=oneWithParams(Sim,cfg,seed,low),positive=oneWithParams(Sim,cfg,seed,high);
    changes.low.push(negative.B&&value(negative.B,metric)-value(baseline.B,metric));
    changes.high.push(positive.B&&value(positive.B,metric)-value(baseline.B,metric));
   }
   const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
   const down=mean(changes.low),up=mean(changes.high);
   const score=Math.max(Math.abs(down),Math.abs(up));
   factorsResult.push({key:f.key,name:f.name,grade:f.grade,
     down:rounded(down),up:rounded(up),magnitude:rounded(score),
     direction:up>0&&down<0?"正向":up<0&&down>0?"负向":"非单调/混合",
     n,perturbation:.12});
  }
  factorsResult.sort((a,b)=>b.magnitude-a.magnitude);
  return {metric,n,factors:factorsResult,modelOnly:true,
    disclaimer:"一次一因子 ±0.12、多个种子的模型状态敏感性。不是因果系数、现实概率或统计显著性排名。"};
 }
 function oneWithParams(Sim,raw,seed,base){
  const cfg=sanitize(raw),A=new Sim(seed,base),B=new Sim(seed,scenarioParams(base,cfg));
  const r=B.shock(cfg.shock);if(!r||!r.ok)throw Error("冲击不可用");
  for(let t=0;t<Math.min(A.params.ticks,B.params.ticks);t++){A.step();B.step();}
  return {A,B};
 }
 function linkConfig(search){
  const p=new URLSearchParams(search||"");
  return sanitize({seed:p.get("seed"),shock:p.get("shock"),intervention:p.get("try"),intensity:p.get("strength")});
 }
 function serialize(config){
  const c=sanitize(config);
  const p=new URLSearchParams();
  p.set("seed",String(c.seed));p.set("shock",c.shock);p.set("try",c.intervention);p.set("strength",String(c.intensity));
  return p.toString();
 }
 return {shocks,shockGroups,interventions,factors,metrics,sanitize,scenarioParams,values,one,multiple,scan,linkConfig,serialize};
});
