/* Story experiment orchestration and read-only observations over the existing Sim.
   No new economic equations, propagation rules, or scenario severity parameters. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ZKHomeStory=api;})(typeof window!=="undefined"?window:null,function(){
"use strict";
function hero(agents){return agents.find(a=>a.name==="TCL华星"&&a.alive)||agents.find(a=>a.type==="anchor"&&a.alive)||null;}
function counts(snapshot,edges){
 const alive=new Set(snapshot.agents.filter(a=>a.alive).map(a=>a.name));
 return {alive:alive.size,total:snapshot.agents.length,
  links:edges.filter(e=>alive.has(e.a)&&alive.has(e.b)).length,totalLinks:edges.length};
}
function changes(a,b){
 const prior=new Map(a.agents.map(n=>[n.name,n]));
 return b.agents.flatMap(n=>{
  const was=prior.get(n.name);if(!was)return [];
  const change=Number.isFinite(n.energy)&&Number.isFinite(was.energy)?n.energy-was.energy:0;
  const exit=!!was.alive&&!n.alive,returning=!was.alive&&!!n.alive;
  if(!exit&&!returning&&(!n.alive||Math.abs(change)<.005))return [];
  return [{name:n.name,exit,returning,change,direction:exit?"退出模拟":returning?"仍在运转":change<0?"状态更弱":"状态更强"}];
 });
}
function keyTick(A,B){
 let tick=0,score=-1;
 // Earliest frame with the most observable A/B role differences. Not a worst-case claim.
 for(let t=0;t<A.length;t++){
  const value=changes(A[t],B[t]).length;
  if(value>score){score=value;tick=t;}
 }
 return tick;
}
function exitRun(Sim,seed,size,target,ticks=20){
 const a=new Sim(seed,{n_agents:size,ticks}),b=new Sim(seed,{n_agents:size,ticks});
 const protagonist=b.agents.find(n=>n.name===target&&n.type==="anchor"&&n.alive);
 if(!protagonist)throw Error("所选主角不是当前模型中的在场链主");
 const initial=a._snap(),result=b.removeAgent(target);
 if(!result.ok)throw Error(result.msg||"主角未能退出");
 const A=[a._snap()],B=[b._snap()];
 for(let t=0;t<ticks;t++){a.step();b.step();A.push(a._snap());B.push(b._snap());}
 return {kind:"exit",target,shock:target+"退出",initial,A,B,edges:a.edges,
  incident:a.edges.filter(e=>e.a===target||e.b===target).length,keyTick:keyTick(A,B)};
}
function frameInfo(run,t){
 const a=run.A[t],b=run.B[t],delta=changes(a,b);
 return {a:counts(a,run.edges),b:counts(b,run.edges),initial:counts(run.initial||run.A[0],run.edges),
  changes:delta,exits:delta.filter(n=>n.exit),returns:delta.filter(n=>n.returning),
  weaker:delta.filter(n=>!n.exit&&!n.returning&&n.change<0),stronger:delta.filter(n=>!n.exit&&!n.returning&&n.change>0)};
}
return {hero,counts,changes,keyTick,exitRun,frameInfo};
});
