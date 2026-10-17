/* Model-only story evidence: one-on-one matching of real A/B snapshots.
   Never infer causality, orders, jobs, investment or actual company status.
   No synthetic observations: empty findings remain empty. */
(function(root,factory){"use strict";const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.ZKStoryEvidence=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const typeNames={oem:"整机与核心企业",chip:"芯片与上游",panel:"显示与材料",
  battery:"电池与新能源",capital:"产业资本",service:"生产性服务",
  infra:"基础设施",talent:"人才资源",land:"土地载体",gov:"公共治理",
  consumer:"市场需求",logistics:"物流服务",factory:"制造配套",research:"科技研发",other:"产业角色"};
 const THRESHOLD=.035;
 const finite=x=>typeof x==="number"&&Number.isFinite(x);
 function compare(a,b,edges,maximum=3){
  if(!a||!b||!Array.isArray(a.agents)||!Array.isArray(b.agents))return {ok:false,items:[],why:"尚无可比较的两组模型结果"};
  const left=new Map(a.agents.filter(x=>x&&typeof x.name==="string").map(x=>[x.name,x]));
  const result=[];
  const neighbors=new Map();
  for(const e of Array.isArray(edges)?edges:[]){
   if(!e||typeof e.a!=="string"||typeof e.b!=="string"||e.a===e.b)continue;
   if(!neighbors.has(e.a))neighbors.set(e.a,new Set());
   if(!neighbors.has(e.b))neighbors.set(e.b,new Set());
   neighbors.get(e.a).add(e.b);neighbors.get(e.b).add(e.a);
  }
  for(const item of b.agents){
   if(!item||typeof item.name!=="string")continue;
   const prior=left.get(item.name);if(!prior)continue; // cannot match names safely
   const from=prior.alive===true,to=item.alive===true;
   let kind="",change=null,rank=0;
   if(from&&!to){kind="exit";rank=3;}
   else if(!from&&to){kind="active";rank=3;}
   else if(from&&to&&finite(prior.energy)&&finite(item.energy)){
    change=item.energy-prior.energy;
    if(change<=-THRESHOLD){kind="lower";rank=2;}
    else if(change>=THRESHOLD){kind="higher";rank=1;}
   }
   if(!kind)continue;
   const related=[...(neighbors.get(item.name)||new Set())]
    .filter(name=>left.has(name)&&b.agents.some(n=>n.name===name));
   const delta=finite(change)?change:null;
   const explanation={
    exit:"在这个假设里退出了模拟网络；没有发生该变化的对照情景中仍在。",
    active:"在这个假设里仍在运转；对照情景中没有继续运转。",
    lower:"在这个假设里的模型状态，比没有发生变化时弱。",
    higher:"在这个假设里的模型状态，比没有发生变化时强。"
   }[kind];
   result.push({name:item.name,role:typeNames[item.type]||"产业角色",type:item.type||"other",
    kind,energyA:finite(prior.energy)?prior.energy:null,energyB:finite(item.energy)?item.energy:null,
    delta,relatedCount:related.length,explanation,rank,
    // Stable relevance ranking, measured strictly from same-named model snapshots.
    magnitude:delta===null?1:Math.abs(delta)});
  }
  result.sort((x,y)=>y.rank-x.rank||y.magnitude-x.magnitude||x.name.localeCompare(y.name,"zh-CN"));
  const limit=Math.min(5,Math.max(1,Number.isInteger(maximum)?maximum:3));
  return {ok:true,items:result.slice(0,limit),total:result.length,threshold:THRESHOLD,
   changedComparedTo:"无情景变化的模型对照，同一种子、同一步数；不是现实因果关系",
   why:result.length?"":"这一刻与对照相比，没有足够明显的角色状态差异；不能为了演示而编出变化"};
 }
 return {compare,THRESHOLD};
});