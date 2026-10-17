/* Presentation timing only. Never changes a Sim node, edge, or state. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ZKVisualEntry=api;})(typeof window!=="undefined"?window:null,function(){
"use strict";
const groups=[
 {label:"链主与整机",types:["anchor","oem"]},
 {label:"制造配套",types:["supplier"]},
 {label:"服务与人才",types:["service","talent"]},
 {label:"产业资本",types:["capital"]},
 {label:"园区载体",types:["land"]},
 {label:"公共设施",types:["infra"]}
];
const clamp=x=>Math.max(0,Math.min(1,x));
function plan(nodes){
 const members=new Map();
 const batches=groups.map(g=>({...g,nodes:nodes.filter(n=>g.types.includes(n.type))})).filter(g=>g.nodes.length);
 const known=new Set(batches.flatMap(g=>g.nodes.map(n=>n.name)));
 const other=nodes.filter(n=>!known.has(n.name));
 if(other.length)batches.push({label:"其他主体",nodes:other});
 batches.forEach((g,i)=>g.nodes.forEach((n,j)=>members.set(n.name,{batch:i,start:i*430+j*23,land:i*430+j*23+420})));
 const duration=Math.max(0,...[...members.values()].map(n=>n.land))+380;
 return {members,batches:batches.map(g=>({label:g.label,count:g.nodes.length})),duration};
}
function node(plan,name,time){
 const spec=plan.members.get(name);return spec?clamp((time-spec.start)/420):1;
}
function edge(plan,a,b,time){
 const A=plan.members.get(a),B=plan.members.get(b);
 if(!A||!B)return 0;
 // No edge is visible until BOTH of its own endpoints have landed.
 return clamp((time-Math.max(A.land,B.land))/360);
}
function status(plan,time,edges){
 const arrived=[...plan.members.values()].filter(n=>time>=n.land).length;
 const linked=edges.filter(e=>edge(plan,e.a,e.b,time)>=1).length;
 const batch=Math.min(plan.batches.length-1,Math.max(0,Math.floor(time/430)));
 const stages=plan.batches.map((g,i)=>{
   const members=[...plan.members.values()].filter(n=>n.batch===i);
   return members.every(n=>time>=n.land)?"done":members.some(n=>time>=n.start)?"active":"waiting";
 });
 return {arrived,linked,batch,stages,done:time>=plan.duration};
}
return {plan,node,edge,status};
});
