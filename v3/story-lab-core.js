/* Story-only orchestration over the original Sim and homepage experiment. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./home-story-core.js'):root.ZKHomeStory);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ZKStoryLab=api;})(typeof window!=='undefined'?window:null,function(H){
'use strict';
const SIZES=[24,32,41],MAX=2147483647;
function valid(Sim,s){
 if(!s||!Number.isSafeInteger(s.seed)||s.seed<1||s.seed>MAX||!SIZES.includes(s.pop)||!Number.isInteger(s.tick)||s.tick<0||s.tick>20)return false;
 const sim=new Sim(s.seed,{n_agents:s.pop,ticks:20});
 if(s.kind==='exit')return sim.agents.some(n=>n.name===s.target&&n.type==='anchor'&&n.alive);
 return s.kind==='shock'&&Array.isArray(Sim.storyShocks)&&Sim.storyShocks.includes(s.shock);
}
function decode(Sim,raw){
 try{
  if(typeof raw!=='string'||raw.length>600)return null;
  const d=JSON.parse(decodeURIComponent(raw));
  const s={seed:d.seed,pop:d.v===1?24:d.pop,tick:d.tick??20,kind:d.v===3&&d.kind==='exit'?'exit':'shock'};
  if(s.kind==='exit')s.target=d.target;else if(d.v===1||d.v===2)s.shock=d.shock;else return null;
  return valid(Sim,s)?s:null;
 }catch{return null;}
}
function payload(s){return s.kind==='exit'?{v:3,kind:'exit',target:s.target,seed:s.seed,pop:s.pop,tick:s.tick}:{v:2,shock:s.shock,seed:s.seed,pop:s.pop,tick:s.tick};}
function run(Sim,s){
 if(!valid(Sim,s))throw Error('实验条件无效，请检查主体、规模与起点。');
 if(s.kind==='exit')return H.exitRun(Sim,s.seed,s.pop,s.target);
 const a=new Sim(s.seed,{n_agents:s.pop,ticks:20}),b=new Sim(s.seed,{n_agents:s.pop,ticks:20});
 const result=b.shock(s.shock);if(!result.ok)throw Error('原模型未接受这个情景。');
 const A=[a._snap()],B=[b._snap()];for(let t=0;t<20;t++){a.step();b.step();A.push(a._snap());B.push(b._snap());}
 return {kind:'shock',shock:s.shock,A,B,initial:A[0],edges:a.edges,keyTick:H.keyTick(A,B)};
}
function outcome(r){const f=H.frameInfo(r,20),delta=f.b.alive-f.a.alive;return {a:f.a.alive,b:f.b.alive,delta,choice:delta<0?'less':delta>0?'more':'same'};}
function seedAt(seed,i){return ((seed-1+i)%MAX)+1;}
function summarize(values){return {less:values.filter(n=>n<0).length,same:values.filter(n=>n===0).length,more:values.filter(n=>n>0).length,min:Math.min(...values),max:Math.max(...values)};}
return {valid,decode,payload,run,outcome,seedAt,summarize};
});
