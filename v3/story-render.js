/* V3.8 native GPU WebGL hologram, with fully interactive Canvas2D fallback.
   All 3D points/links and changing states come from the existing Sim graph.
   Decorative light trails do NOT imply verified material/financial flows. */
(function(root){
 "use strict";
 const Core=root.ZKHoloCore;
 if(!Core)return;
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 const vsrc=String.raw`
attribute vec3 aPos;
attribute vec4 aColor;
attribute float aSize;
uniform float uYaw,uPitch,uDist,uAspect,uRatio,uPoint;
varying vec4 vColor;
void main(){
 float cy=cos(uYaw),sy=sin(uYaw),cp=cos(uPitch),sp=sin(uPitch);
 vec3 a=vec3(aPos.x*cy-aPos.z*sy,aPos.y,aPos.x*sy+aPos.z*cy);
 vec3 b=vec3(a.x,a.y*cp-a.z*sp,a.y*sp+a.z*cp);
 float depth=max(0.8,uDist-b.z);
 gl_Position=vec4(b.x*1.9/(depth*uAspect),b.y*1.9/depth,0.0,1.0);
 gl_PointSize=clamp(aSize*5.6/depth*uRatio,2.0,68.0);
 vColor=aColor;
}
`;
 const fsrc=String.raw`
precision mediump float;
varying vec4 vColor;
uniform float uPoint;
void main(){
 if(uPoint>.5){
   vec2 d=gl_PointCoord-vec2(.5);
   float r=length(d);
   float light=exp(-r*r*17.0),core=smoothstep(.20,.04,r);
   float alpha=(.55*light+.58*core)*vColor.a;
   if(alpha<.009)discard;
   gl_FragColor=vec4(vColor.rgb*(.8+core*.4),alpha);
 }else gl_FragColor=vColor;
}
`;
 function compile(gl,type,src){
   const shader=gl.createShader(type);gl.shaderSource(shader,src);gl.compileShader(shader);
   if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const msg=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error(msg);}
   return shader;
 }
 function gpu(canvas){
  const gl=canvas.getContext("webgl",{alpha:true,antialias:true,depth:false,preserveDrawingBuffer:false,powerPreference:"low-power"});
  if(!gl)return null;
  const program=gl.createProgram(),vs=compile(gl,gl.VERTEX_SHADER,vsrc),fs=compile(gl,gl.FRAGMENT_SHADER,fsrc);
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const loc={
    aPos:gl.getAttribLocation(program,"aPos"),aColor:gl.getAttribLocation(program,"aColor"),
    aSize:gl.getAttribLocation(program,"aSize"),
    yaw:gl.getUniformLocation(program,"uYaw"),pitch:gl.getUniformLocation(program,"uPitch"),
    dist:gl.getUniformLocation(program,"uDist"),aspect:gl.getUniformLocation(program,"uAspect"),
    ratio:gl.getUniformLocation(program,"uRatio"),point:gl.getUniformLocation(program,"uPoint")
  };
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  const stride=8*4;
  gl.enableVertexAttribArray(loc.aPos);gl.vertexAttribPointer(loc.aPos,3,gl.FLOAT,false,stride,0);
  gl.enableVertexAttribArray(loc.aColor);gl.vertexAttribPointer(loc.aColor,4,gl.FLOAT,false,stride,12);
  gl.enableVertexAttribArray(loc.aSize);gl.vertexAttribPointer(loc.aSize,1,gl.FLOAT,false,stride,28);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  return {gl,program,loc,buffer,draw(data,mode,cam,width,height,ratio){
   gl.viewport(0,0,canvas.width,canvas.height);
   gl.useProgram(program);
   gl.uniform1f(loc.yaw,cam.yaw);gl.uniform1f(loc.pitch,cam.pitch);gl.uniform1f(loc.dist,cam.distance);
   gl.uniform1f(loc.aspect,width/height);gl.uniform1f(loc.ratio,ratio);gl.uniform1f(loc.point,mode==="points"?1:0);
   gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);
   gl.drawArrays(mode==="lines"?gl.LINES:gl.POINTS,0,data.length/8);
  }};
 }
 function push(arr,pos,color,size){
  arr.push(pos[0],pos[1],pos[2],color[0],color[1],color[2],color[3],size);
 }
 function mount(opts){
  const canvas=opts.canvas,tip=opts.tooltip,status=opts.status;
  const labels=opts.labels,labelMap=new Map();
  let labelMode="core";
  let renderer=null,context2d=null,mode="fallback",graph=null,meta={},selected=null,hover=null;
  let cam={yaw:-.36,pitch:.18,distance:5.1},raf=0,lastFrame=0,visible=true,disposed=false;
  let start={x:0,y:0},dragged=false;
  let changeGlow=null; // Visual-only observed state transitions, never causal transmission.
  const entryCore=root.ZKVisualEntry;
  let entrance=null,storyFocus=new Map(),drawTime=0;
  let storyScene=null,sceneChanges=new Map(),neighbors=new Set();
  const absence=labels?document.createElement("div"):null;
  if(absence){absence.className="story-absence";absence.hidden=true;absence.append(document.createElement("b"));labels.append(absence);}
  const pointers=new Map();
  let oldPinch=0;
  const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
  try{renderer=gpu(canvas);if(renderer)mode="webgl";}catch(err){renderer=null;}
  if(!renderer){context2d=canvas.getContext("2d");mode="canvas2d";}
  if(status)status.textContent=renderer?"WEBGL · 真实模型网络":"2.5D 降级 · 真实模型网络";
  const edgeColors={hist:[.38,.84,.95,.38],affinity:[.19,.53,.66,.22],contact:[.29,.64,.67,.17],unknown:[.29,.55,.65,.22]};
  function storyActive(){return storyScene&&storyScene.phase!=="idle";}
  function roleState(n){
   if(!storyActive())return "normal";
   if(storyScene.phase==="intro")return "intro";
   if(storyScene.peek)return n.alive?"before":"absent";
   const d=sceneChanges.get(n.name);
   return d?d.exit?"exited":d.returning?"stronger":d.change<0?"weaker":"stronger":n.alive?"unchanged":"absent";
  }
  function nodeColor(n){
   if(!storyActive())return Core.palette(n);
   const state=roleState(n),hero=n.name===storyScene.hero;
   if(state==="intro")return hero?[.64,.95,1,1]:neighbors.has(n.name)?[.35,.75,.86,.75]:[.28,.48,.56,.11];
   if(state==="exited")return [1,.55,.45,.78];
   if(state==="weaker")return [1,.74,.46,.97];
   if(state==="stronger")return [.53,.94,.73,.98];
   if(state==="absent")return [.4,.48,.52,.12];
   const emphasis=hero||sceneChanges.has(n.name);
   return [.36,.78,.88,emphasis?.98:neighbors.has(n.name)?.38:.19];
  }
  function relationColor(edge,a,b){
   if(!storyActive())return a.alive&&b.alive?(edgeColors[edge.layer]||edgeColors.unknown):[.34,.43,.54,.09];
   if(!a.alive||!b.alive)return [.73,.5,.41,.16];
   if(storyScene.phase==="intro")return edge.a===storyScene.hero||edge.b===storyScene.hero?[.4,.86,.95,.7]:[.25,.5,.58,.055];
   const changes=[sceneChanges.get(a.name),sceneChanges.get(b.name)].filter(Boolean);
   if(changes.length&&!storyScene.peek){
    const negative=changes.some(n=>n.exit||n.change<0&&!n.returning);
    return negative?[.98,.71,.44,.5]:[.45,.83,.66,.5];
   }
   return [.31,.66,.76,changes.length?.5:.1];
  }
  function resize(){
   const box=canvas.getBoundingClientRect(),w=Math.max(1,box.width),h=Math.max(1,box.height),ratio=Math.min(devicePixelRatio||1,2);
   if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
   return [w,h,ratio];
  }
  function presented(n){
   if(!entrance||!entryCore)return n;
   const p=entryCore.node(entrance.plan,n.name,drawTime-entrance.started);
   const ease=1-Math.pow(1-p,3),side=(Core.hash(n.name)%2?1:-1);
   return {...n,x:n.x+side*3.3*(1-ease),y:n.y+2.1*(1-ease),z:n.z-1.8*(1-ease)};
  }
  function nodeProgress(n){return entrance?entryCore.node(entrance.plan,n.name,drawTime-entrance.started):1;}
  function edgeProgress(e){return entrance?entryCore.edge(entrance.plan,e.a,e.b,drawTime-entrance.started):1;}
  function screen(n){
   const [width,height]=[Math.max(1,canvas.clientWidth),Math.max(1,canvas.clientHeight)];
   const p=Core.project(presented(n),cam,width/height);
   return {x:(p.x+1)*width/2,y:(1-p.y)*height/2,depth:p.depth};
  }
  function nearest(x,y){
   if(!graph)return null;
   let best=null,d=Infinity;
   graph.nodes.forEach(n=>{
     if(nodeProgress(n)<1)return;
     const p=screen(n),distance=Math.hypot(p.x-x,p.y-y);
     if(distance<Math.max(17,24*(5.1/p.depth))&&distance<d){best=n;d=distance;}
   });
   return best;
  }
  function glowAt(name,now){
    if(!changeGlow||reduced)return 0;
    const elapsed=now-changeGlow.started;
    if(elapsed>=680){changeGlow=null;return 0;}
    const weight=changeGlow.weights.get(name)||0;
    return weight*Math.sin(Math.PI*Math.min(1,elapsed/680));
  }
  function updateGlow(previous,next){
    if(reduced||!previous){changeGlow=null;return;}
    const prior=new Map(previous.nodes.map(n=>[n.name,n]));
    const changed=new Map();
    for(const n of next.nodes){
      const was=prior.get(n.name);if(!was)continue;
      const drift=Math.abs(n.energy-was.energy);
      if(was.alive!==n.alive)changed.set(n.name,n.alive?1:-1);
      else if(drift>.045)changed.set(n.name,Math.sign(n.energy-was.energy)*Math.min(.9,.3+drift*2));
    }
    changeGlow=changed.size?{started:performance.now(),weights:changed}:null;
  }
  function render2d(now,w,h,ratio){
    const ctx=context2d;if(!ctx)return;
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
    if(!graph)return;
    const nodeMap=new Map(graph.nodes.map(n=>[n.name,n]));
    for(const edge of graph.edges){
      const a=nodeMap.get(edge.a),b=nodeMap.get(edge.b);if(!a||!b)continue;
      const progress=edgeProgress(edge);if(progress<=0)continue;
      const pa=screen(a),end=screen(b),pb={x:pa.x+(end.x-pa.x)*progress,y:pa.y+(end.y-pa.y)*progress};
      const rc=relationColor(edge,a,b);ctx.strokeStyle="rgba("+rc.slice(0,3).map(v=>Math.round(v*255)).join(",")+","+rc[3]+")";
      const one=storyActive()?0:glowAt(a.name,now),two=storyActive()?0:glowAt(b.name,now);
      const glow=Math.abs(one)>=Math.abs(two)?one:two,level=Math.abs(glow);
      if(level>0){
        // Warm means observed energy decline/exit; teal means improvement/recovery.
        // Edge emphasis shows adjacency only, NOT an identified causal path.
        ctx.strokeStyle=(glow<0?"rgba(242,170,117,":"rgba(114,226,192,")+(level*.63)+")";
      }
      ctx.lineWidth=(edge.layer==="hist"?1.25:.8)+level*1.8;
      ctx.setLineDash(storyActive()&&(!a.alive||!b.alive)?[3,6]:[]);
      ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();ctx.setLineDash([]);
      if(edge.layer==="hist"&&a.alive&&b.alive&&!reduced&&progress>=1&&!storyActive()){
        const phase=((now/2700)+(Core.hash(edge.a+edge.b)%97)/97)%1;
        const x=pa.x+(pb.x-pa.x)*phase,y=pa.y+(pb.y-pa.y)*phase;
        ctx.fillStyle="rgba(152,241,252,.8)";ctx.beginPath();ctx.arc(x,y,1.75,0,Math.PI*2);ctx.fill();
      }
    }
    [...graph.nodes].sort((a,b)=>screen(b).depth-screen(a).depth).forEach(n=>{
     const arrival=nodeProgress(n);if(arrival<=0)return;
     if(storyActive()&&n.name===storyScene.hero&&!n.alive)return;
     const p=screen(n),scale=clamp(5.1/p.depth,.55,1.7);
     const rad=(n.w>=3?11:n.w===2?7:4.6)*scale;
     const color=nodeColor(n),rgb=color.slice(0,3).map(x=>Math.round(x*255)).join(",");
     const glow=storyActive()?0:glowAt(n.name,now),level=Math.abs(glow);
     if(storyFocus.has(n.name)){
       ctx.strokeStyle=storyFocus.get(n.name)>0?"#96f3d1":"#ffd1a0";ctx.lineWidth=2.5;
       ctx.beginPath();ctx.arc(p.x,p.y,rad+10,0,Math.PI*2);ctx.stroke();
     }
     if(level>0){
       ctx.strokeStyle=(glow<0?"rgba(255,190,128,":"rgba(123,243,213,")+(level*.88)+")";
       ctx.lineWidth=1.4+level*2.7;
       ctx.beginPath();ctx.arc(p.x,p.y,rad+7+level*11,0,Math.PI*2);ctx.stroke();
     }
     ctx.shadowBlur=n.alive?rad*(2.6+level*4):0;ctx.shadowColor="rgba("+rgb+",.7)";
     ctx.fillStyle="rgba("+rgb+","+(color[3]*arrival)+")";
     ctx.beginPath();ctx.arc(p.x,p.y,rad,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
     ctx.strokeStyle=n.name===selected?"#fff":"rgba("+rgb+",.72)";
     ctx.lineWidth=n.name===selected?2:1;ctx.beginPath();ctx.arc(p.x,p.y,rad+4,0,Math.PI*2);ctx.stroke();
     if(n.w>=3&&!storyActive()){ctx.textAlign="center";ctx.font="600 11px system-ui";ctx.fillStyle="#c9f8ff";ctx.fillText(n.name,p.x,p.y-rad-13);}
    });
  }
  function render3d(now,w,h,ratio){
    if(!renderer||!graph)return;
    const gl=renderer.gl;gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    const map=new Map(graph.nodes.map(n=>[n.name,n]));
    const lines=[],particles=[],points=[];
    for(const e of graph.edges){
      const a=map.get(e.a),b=map.get(e.b);if(!a||!b)continue;
      const progress=edgeProgress(e);if(progress<=0)continue;
      const pa=presented(a),pb=presented(b);
      const isActive=a.alive&&b.alive,c=edgeColors[e.layer]||edgeColors.unknown;
      const first=storyActive()?0:glowAt(a.name,now),second=storyActive()?0:glowAt(b.name,now);
      const edgeGlow=Math.abs(first)>=Math.abs(second)?first:second;
      const level=Math.abs(edgeGlow);
      const color=level>0?
        edgeGlow<0?[.99,.65,.41,Math.min(.85,c[3]+level*.5)]:
          [.39,.96,.78,Math.min(.85,c[3]+level*.5)]:
        relationColor(e,a,b);
      const segments=storyActive()&&!isActive?7:1;
      for(let j=0;j<segments;j++){
       const start=j/segments*progress,end=(j+(segments===1?1:.38))/segments*progress;
       push(lines,[pa.x+(pb.x-pa.x)*start,pa.y+(pb.y-pa.y)*start,pa.z+(pb.z-pa.z)*start],color,1);
       push(lines,[pa.x+(pb.x-pa.x)*end,pa.y+(pb.y-pa.y)*end,pa.z+(pb.z-pa.z)*end],color,1);
      }
      if(isActive&&e.layer==="hist"&&!reduced&&progress>=1&&!storyActive()){
       const k=((now/3100)+(Core.hash(e.a+e.b)%131)/131)%1;
       push(particles,[a.x+(b.x-a.x)*k,a.y+(b.y-a.y)*k,a.z+(b.z-a.z)*k],[.72,.96,1,.79],9);
      }
    }
    graph.nodes.forEach(n=>{
     const arrival=nodeProgress(n);if(arrival<=0)return;
     if(storyActive()&&n.name===storyScene.hero&&!n.alive)return;
     const pos=presented(n),xyz=[pos.x,pos.y,pos.z];
     const col=nodeColor(n);
     const glow=storyActive()?0:glowAt(n.name,now),level=Math.abs(glow);
     if(level>0){
       const tint=glow<0?[1,.69,.40]:[.49,1,.81];
       push(points,xyz,[...tint,level*.54],(n.w>=3?43:27)+level*65);
     }
     const size=(n.w>=3?43:n.w===2?28:19);
     if(storyFocus.has(n.name))push(points,xyz,storyFocus.get(n.name)>0?[.5,1,.78,.35]:[1,.72,.43,.4],size+45);
     if(n.name===selected)push(points,xyz,[1,.98,.84,.27],size+30);
     push(points,xyz,[col[0],col[1],col[2],col[3]*.24*arrival],size*2.4);
     push(points,xyz,[col[0],col[1],col[2],col[3]*arrival],size);
    });
    renderer.draw(lines,"lines",cam,w,h,ratio);
    renderer.draw(particles,"points",cam,w,h,ratio);
    renderer.draw(points,"points",cam,w,h,ratio);
  }
  function syncLabels(){
    if(!labels||!graph)return;
    const width=canvas.clientWidth,height=canvas.clientHeight;
    const hero=storyScene&&graph.nodes.find(n=>n.name===storyScene.hero);
    if(absence){
     absence.hidden=!storyActive()||!hero||hero.alive;
     if(!absence.hidden){const p=screen(hero);absence.style.left=p.x+"px";absence.style.top=p.y+"px";absence.firstChild.textContent=hero.name+" · 已退出";}
    }
    const introLabels=new Set(storyScene?.phase==="intro"?graph.nodes.filter(n=>neighbors.has(n.name)).sort((a,b)=>b.w-a.w||a.name.localeCompare(b.name,"zh-CN")).slice(0,3).map(n=>n.name):[]);
    const nodes=graph.nodes.filter(n=>nodeProgress(n)>=1&&!(storyActive()&&n.name===storyScene.hero&&!n.alive)&&
      (storyActive()?(n.name===storyScene.hero||sceneChanges.has(n.name)||n.name===selected||introLabels.has(n.name)):labelMode==="all"||storyFocus.has(n.name)||n.name===selected||n.w>=3&&n.alive))
      .sort((a,b)=>
        Number(b.name===selected)-Number(a.name===selected)||
        Number(storyFocus.has(b.name))-Number(storyFocus.has(a.name))||
        b.w-a.w||Number(b.alive)-Number(a.alive)||
        Core.hash(a.name)-Core.hash(b.name));
    const accepted=[],retained=new Set();
    for(const n of nodes){
      const p=screen(n);
      const state=roleState(n),suffix=!storyActive()?"":state==="exited"?" · 已退出":state==="weaker"?" · 较弱":state==="stronger"?" · 较强":n.name===storyScene.hero?storyScene.peek?" · 未退出":" · 主角":"";
      const text=n.name+suffix,chars=[...text].length;
      const w=Math.min(Math.max(57,chars*12+18),180),h=23;
      const offset=Math.max(13,40/p.depth);
      const left=p.x-w/2,top=p.y+offset;
      // Hide only labels that physically cannot fit inside the canvas; never hide underlying nodes.
      if(left<4||left+w>width-4||top<3||top+h>height-14)continue;
      const box={l:left-7,r:left+w+7,t:top-5,b:top+h+5};
      if(accepted.some(x=>x.l<box.r&&x.r>box.l&&x.t<box.b&&x.b>box.t))continue;
      accepted.push(box);retained.add(n.name);
      let element=labelMap.get(n.name);
      if(!element){element=document.createElement("span");element.className="holo-node-label";labels.append(element);labelMap.set(n.name,element);}
      element.textContent=text;
      element.style.left=p.x+"px";element.style.top=top+"px";
      element.hidden=false;
      element.classList.toggle("inactive",!n.alive);
      element.classList.toggle("story-focus",storyFocus.has(n.name));
      for(const cls of ["exited","weaker","stronger","unchanged"])element.classList.toggle("story-"+cls,state===cls);
    }
    for(const [name,element] of labelMap){
      if(!retained.has(name)){element.remove();labelMap.delete(name);}
    }
  }
  function draw(now){
   raf=0;if(disposed||!visible)return;
   if(now-lastFrame<30){raf=requestAnimationFrame(draw);return;}
   lastFrame=now;drawTime=now;
   if(entrance){
    const info=entryCore.status(entrance.plan,now-entrance.started,graph.edges);
    if(opts.onEntrance)opts.onEntrance({...info,total:graph.nodes.length,edges:graph.edges.length,batches:entrance.plan.batches});
    if(info.done)entrance=null;
   }
   const [w,h,r]=resize();
   if(renderer)render3d(now,w,h,r);else render2d(now,w,h,r);
   syncLabels();
   if(!reduced)raf=requestAnimationFrame(draw);
  }
  function schedule(){if(!raf&&!disposed&&visible)raf=requestAnimationFrame(draw);}
  function cameraChange(){tip.hidden=true;hover=null;schedule();}
  function showTip(n,x,y){
   if(!tip)return;
   if(!n){tip.hidden=true;return;}
   tip.hidden=false;tip.textContent=n.name+" · "+n.typeName+" · "+(n.alive?"模型内存续":"模型内退出");
   tip.style.left=clamp(x+14,7,canvas.clientWidth-165)+"px";tip.style.top=clamp(y-36,4,canvas.clientHeight-52)+"px";
  }
  canvas.addEventListener("pointerdown",e=>{
   canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   start={x:e.clientX,y:e.clientY};dragged=false;
  });
  canvas.addEventListener("pointermove",e=>{
   if(pointers.has(e.pointerId)){
    const prev=pointers.get(e.pointerId);
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===1){
      const dx=e.clientX-prev.x,dy=e.clientY-prev.y;
      if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>4)dragged=true;
      if(dragged){cam.yaw+=dx*.008;cam.pitch=clamp(cam.pitch+dy*.008,-1.15,1.15);cameraChange();}
    }else if(pointers.size===2){
      const pts=[...pointers.values()],distance=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
      if(oldPinch>0){cam.distance=clamp(cam.distance*oldPinch/distance,3.4,11);cameraChange();}
      oldPinch=distance;dragged=true;
    }
   }else if(!dragged){
      const bounds=canvas.getBoundingClientRect();
      const hit=nearest(e.clientX-bounds.left,e.clientY-bounds.top);
      if(hit!==hover){hover=hit;canvas.style.cursor=hit?"pointer":"grab";}
      showTip(hit,e.clientX-bounds.left,e.clientY-bounds.top);
   }
  });
  function release(e){
   const wasClick=!dragged&&pointers.size===1&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<6;
   pointers.delete(e.pointerId);if(pointers.size<2)oldPinch=0;
   if(wasClick){
     const b=canvas.getBoundingClientRect(),node=nearest(e.clientX-b.left,e.clientY-b.top);
     if(node){selected=node.name;opts.onSelect&&opts.onSelect(node);schedule();}
   }
  }
  canvas.addEventListener("pointerup",release);
  canvas.addEventListener("pointercancel",e=>{pointers.delete(e.pointerId);oldPinch=0;});
  canvas.addEventListener("wheel",e=>{
   e.preventDefault();cam.distance=clamp(cam.distance*(e.deltaY>0?1.09:.91),3.4,11);cameraChange();
  },{passive:false});
  function orbit(dx,dy){cam.yaw+=dx;cam.pitch=clamp(cam.pitch+dy,-1.15,1.15);cameraChange();}
  function zoom(mult){cam.distance=clamp(cam.distance*mult,3.4,11);cameraChange();}
  function resetCamera(){cam={yaw:-.36,pitch:.18,distance:5.1};cameraChange();}
  function finishEntrance(){
   entrance=null;
   if(graph&&opts.onEntrance)opts.onEntrance({done:true,arrived:graph.nodes.length,linked:graph.edges.length,total:graph.nodes.length,edges:graph.edges.length,batches:entryCore?entryCore.plan(graph.nodes).batches:[]});
   schedule();
  }
  function replayEntrance(){
   if(!graph||!opts.entrance||!entryCore)return;
   if(reduced){finishEntrance();return;}
   entrance={plan:entryCore.plan(graph.nodes),started:performance.now()};schedule();
  }
  const ro=typeof ResizeObserver!=="undefined"?new ResizeObserver(schedule):null;if(ro)ro.observe(canvas);
  if(typeof IntersectionObserver!=="undefined"){
    const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)schedule();else if(raf){cancelAnimationFrame(raf);raf=0;}},{threshold:0});
    io.observe(canvas);
  }
  canvas.addEventListener("webglcontextlost",e=>{e.preventDefault();renderer=null;context2d=canvas.getContext("2d");if(status)status.textContent="图形上下文中断 · 请刷新或使用兼容浏览器";schedule();});
  return {
   get mode(){return mode;},get camera(){return {...cam};},get graph(){return graph;},
   setGraph(agents,edges,metaNext){
    graph=Core.build(agents,edges);changeGlow=null;storyFocus.clear();selected=null;meta=metaNext||{};
    if(opts.entrance)replayEntrance();schedule();return graph;
   },
   setFrame(agents,metaNext){
    if(!graph)return;
    const before=graph;
    graph=Core.update(graph,agents);
    updateGlow(before,graph);
    meta=metaNext||meta;
    const selectedNode=graph.nodes.find(n=>n.name===selected);
    if(selected&&!selectedNode)selected=null;
    schedule();
   },
   select(name){
    if(!graph)return null;const node=graph.nodes.find(n=>n.name===name);
    selected=node?name:null;schedule();return node||null;
   },
   setLabelMode(value){if(value!=="core"&&value!=="all")return false;labelMode=value;schedule();return true;},
   setStoryFocus(changes){storyFocus=new Map((changes||[]).filter(c=>graph?.nodes.some(n=>n.name===c.name)).map(c=>[c.name,c.exit?-1:c.returning?1:Math.sign(c.change)||0]));schedule();},
   setStoryScene(scene){
    storyScene=scene||null;sceneChanges=new Map((scene?.changes||[]).map(c=>[c.name,c]));neighbors=new Set();
    if(graph&&scene?.hero)for(const e of graph.edges){if(e.a===scene.hero)neighbors.add(e.b);if(e.b===scene.hero)neighbors.add(e.a);}
    schedule();
   },
   replayEntrance,finishEntrance,
   orbit,zoom,resetCamera,
   dispose(){disposed=true;if(raf)cancelAnimationFrame(raf);if(ro)ro.disconnect();}
  };
 }
 root.ZKHolo={mount};
})(window);
