/* V3.8: deterministic 3D visual coordinates for the unchanged Sim graph.
   Coordinates are NOT geography, distance, traffic or real trade volume. */
(function(root,factory){
  const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.ZKHoloCore=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 const typeLabel={oem:"链主/整机",chip:"芯片/上游",panel:"显示/材料",battery:"电池/新能源",capital:"产业资本",service:"生产性服务",infra:"基础设施",talent:"人才资源",land:"土地空间",gov:"公共治理",consumer:"市场需求",logistics:"物流",factory:"制造配套",research:"科技研发",other:"产业主体"};
 function hash(s){
  let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
 }
 const rand=(h,n)=>((Math.imul((h^(n*0x9e3779b9))>>>0,2246822519)>>>0)%100000)/100000;
 function position(a,i,total){
  const h=hash(a.name),w=Number(a.w)||1;
  const offset=rand(h,11),phi=Math.acos(clamp(1-2*((i+.4+offset*.2)/(total+.5)),-1,1));
  const theta=i*2.3999632297 + rand(h,5)*.6;
  const radius=(w>=3?.75:w===2?1.5:2.12)+rand(h,9)*.43;
  return [Math.sin(phi)*Math.cos(theta)*radius,(Math.cos(phi)*radius*.82),Math.sin(phi)*Math.sin(theta)*radius];
 }
 function build(agents,edges){
  if(!Array.isArray(agents)||!Array.isArray(edges))throw Error("缺少模型真实节点或关系");
  const names=new Set(),nodes=[];
  agents.forEach((a,i)=>{
   if(!a||typeof a.name!=="string"||!a.name||names.has(a.name))throw Error("模型节点名称缺失或重复");
   names.add(a.name);
   const p=position(a,i,agents.length);
   nodes.push({name:a.name,type:a.type||"other",typeName:typeLabel[a.type]||a.type||"产业主体",
     w:Number(a.w)||1,energy:Number.isFinite(a.energy)?clamp(a.energy,0,1):0,
     alive:!!a.alive,sentiment:Number.isFinite(a.sentiment)?a.sentiment:0,x:p[0],y:p[1],z:p[2]});
  });
  const realEdges=edges.filter(e=>e&&names.has(e.a)&&names.has(e.b)&&e.a!==e.b)
   .map(e=>({a:e.a,b:e.b,layer:e.layer||"unknown",rel:e.rel||"未注明"}));
  return {nodes,edges:realEdges,total:nodes.length,alive:nodes.filter(n=>n.alive).length};
 }
 function update(base,agents){
  if(!base||!Array.isArray(base.nodes)||!Array.isArray(agents))throw Error("无法更新模型状态");
  const lookup=new Map(agents.map(a=>[a.name,a]));
  return {...base,nodes:base.nodes.map(n=>{
    const a=lookup.get(n.name);
    return {...n,alive:a?!!a.alive:false,
      energy:a&&Number.isFinite(a.energy)?clamp(a.energy,0,1):0,
      sentiment:a&&Number.isFinite(a.sentiment)?a.sentiment:0};
  }),alive:agents.filter(x=>x.alive).length};
 }
 function project(n,cam,aspect){
  const cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw),cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch);
  const x=n.x*cy-n.z*sy,z0=n.x*sy+n.z*cy;
  const y=n.y*cp-z0*sp,z=n.y*sp+z0*cp;
  const depth=Math.max(.8,cam.distance-z);
  return {x:x*1.9/(depth*aspect),y:y*1.9/depth,depth};
 }
 function metric(snapshot,key){
  if(!snapshot||!snapshot.state)return null;
  if(key==="survivors")return snapshot.agents.length?snapshot.agents.filter(a=>a.alive).length/snapshot.agents.length:0;
  const v=snapshot.state[key];return Number.isFinite(v)?v:null;
 }
 function palette(n){
  if(!n.alive)return [0.36,0.40,0.47,0.3];
  if(n.energy<.32)return [1,.41,.30,.97];
  if(n.w>=3)return [.36,.91,1,1];
  if(n.type==="talent"||n.type==="service")return [.47,.89,.73,.9];
  return [.24,.72,.92,.87];
 }
 return {build,update,project,metric,palette,hash,typeLabel};
});
