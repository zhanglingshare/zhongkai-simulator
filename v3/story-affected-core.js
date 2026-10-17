/* Real model A/B snapshots only: rank *differences*, not causal impacts. */
(function(root,factory){
 const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.ZKStoryAffected=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 function changes(reference,scenario,limit=3){
  if(!reference||!scenario||!Array.isArray(reference.agents)||!Array.isArray(scenario.agents))return [];
  const a=new Map(reference.agents.map(x=>[x.name,x])),items=[];
  for(const n of scenario.agents){
   const old=a.get(n.name);if(!old)continue;
   const lost=!!old.alive&&!n.alive,revived=!old.alive&&!!n.alive;
   const comparable=Number.isFinite(n.energy)&&Number.isFinite(old.energy);
   const diff=comparable?n.energy-old.energy:0;
   if(!lost&&!revived&&(!comparable||Math.abs(diff)<.045))continue;
   const type=lost?"exit":revived?"return":diff<0?"lower":"higher";
   items.push({name:n.name,type,change:diff,
    description:type==="exit"?"这一条路径中已退出，另一条仍在运转":
    type==="return"?"这一条路径中在运转，另一条已退出":
    type==="lower"?"这一条路径的模型状态比另一条弱":"这一条路径的模型状态比另一条强",
    weight:(lost||revived?10:0)+Math.abs(diff)});
  }
  return items.sort((x,y)=>y.weight-x.weight||x.name.localeCompare(y.name,"zh")).slice(0,Math.max(0,Math.min(5,limit)));
 }
 return {changes};
});