/* Story explanation is a descriptive comparison of existing Sim A/B agent snapshots.
 * Not a causal attribution, real-world incident, or independently verified industry link. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ZKRoleStory=api;})(typeof window!=="undefined"?window:null,function(){
"use strict";
function compare(a,b,limit=3){
 if(!a||!b||!Array.isArray(a.agents)||!Array.isArray(b.agents))return [];
 const prior=new Map(a.agents.map(x=>[x.name,x]));
 return b.agents.filter(x=>prior.has(x.name)).map(x=>{
  const y=prior.get(x.name),old=Number.isFinite(y.energy)?y.energy:null,
   now=Number.isFinite(x.energy)?x.energy:null;
  let change=old!==null&&now!==null?now-old:null;
  const left=Boolean(y.alive),right=Boolean(x.alive);
  const exit=left&&!right,returning=!left&&right;
  if(!exit&&!returning&&(change===null||Math.abs(change)<.005))return null;
  const direction=exit?"退出模拟":returning?"重新运转":change>0?"状态更强":"状态更弱";
  const magnitude=exit||returning?2:Math.abs(change);
  return {name:x.name,type:x.type||"other",direction,change,exit,returning,magnitude,
   explanation:exit?"在本次假设中不再运转":returning?"在本次假设中恢复运转":
      "模型经营状态比没有发生这件事时"+(change>0?"更强":"更弱")};
 }).filter(Boolean).sort((x,y)=>y.magnitude-x.magnitude||x.name.localeCompare(y.name,"zh-Hans-CN")).slice(0,Math.max(0,Math.min(8,limit)));
}
function summary(changes,shock,t){
 if(!t)return "这是一个「"+shock+"」的假设情景。看网络里哪些点改变颜色，下面会显示它们是谁。";
 if(!changes.length)return "模拟进行到第"+t+"步：与没有这次假设的模型路径相比，还没有发现明显的个体状态差异。";
 const first=changes[0];
 return "模拟第 "+t+" 步：变化最明显的模型角色之一是「"+first.name+"」，它"+first.explanation+"。下面还能看到其他发生变化的角色。";
}
return {compare,summary};
});