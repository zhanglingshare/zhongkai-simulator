/* 三幕视觉叙事：只运行原版 Sim + ZKHomeStory 的链主退出 A/B。
 * 01 真实公开指标同比条形；02 原模型同一步 A/B 可视化；
 * 03 证据维度选择进度，绝非已核实事实或真实企业得分。
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const n=x=>Number.isFinite(x)?x:0;
const insight=$('data-insight');
$('data-interpret').addEventListener('click',()=>{
 document.body.classList.remove('data-revealed');
 void document.body.offsetWidth; // replay chart CSS by explicit user action
 document.body.classList.add('data-revealed');
 insight.textContent='两条同比指标方向相反。先核实投产节奏、项目周期和统计口径；背离本身不是未来预测。';
 $('data-interpret').textContent='↻ 重新播放信号';
});
const selected=new Set();
const evidenceCards=Array.from(document.querySelectorAll('[data-evidence]'));
function paintEvidence(){
 const count=selected.size;
 $('gate-number').firstChild.nodeValue=String(count);
 $('gate-progress-bar').style.width=(count*20)+'%';
 $('gate-stage').classList.toggle('completed',count===5);
 $('gate-state').textContent=count===5?'5项核查维度已列出 · 待现实核实':'已选择 '+count+' 项核查维度';
 $('evidence-warning').textContent=count===5?'关卡点亮只代表你列出了核查清单。请在企业接入模块输入真实证据，不代表任何企业已通过审核。':'点亮是“选择要核查的维度”，并不代表现实资料已经审核通过。';
}
evidenceCards.forEach(button=>button.addEventListener('click',()=>{
 const id=button.dataset.evidence;
 if(selected.has(id))selected.delete(id);else selected.add(id);
 const active=selected.has(id);
 button.setAttribute('aria-pressed',String(active));
 const mark=button.querySelector('i');if(mark)mark.textContent=active?'✓':'＋';
 paintEvidence();
}));
paintEvidence();

const Sim=window.ZKSim,H=window.ZKHomeStory,Z=window.ZKHolo;
const caption=$('experiment-caption'),notice=$('network-selected'),targetSelect=$('target');
if(!Sim||!H||!Z){
 $('run-exit').disabled=true;
 caption.textContent='模型依赖未能加载。请使用完整模型实验室，避免展示错误的动画结果。';
 return;
}
let view=null,experiment=null,tick=0,timer=null,playing=false,peek=false;
let orbitTimer=null,visible=false,interacting=false,interactionRelease=null;
try{
 const setup=new Sim(7,{n_agents:41,ticks:20});
 const anchors=setup.agents.filter(agent=>agent.type==='anchor'&&agent.alive);
 if(anchors.length===0)throw Error('模型没有可退出的链主角色');
 const hero=H.hero(setup.agents)||anchors[0];
 for(const a of anchors){const option=document.createElement('option');option.value=a.name;option.textContent=a.name;targetSelect.append(option);}
 targetSelect.value=hero.name;
 view=Z.mount({canvas:$('impact-canvas'),labels:$('impact-labels'),tooltip:$('impact-tip'),status:$('render-mode'),
   onSelect:node=>{notice.textContent=node.name+' · '+node.typeName+' · '+(node.alive?'当前模型路径仍运转':'当前模型路径已退出');}});
 view.setGraph(setup.agents,setup.edges,{tick:0});
 view.setStoryScene({phase:'idle'});
 $('count-after').textContent=setup.agents.filter(a=>a.alive).length;
 $('count-changed').textContent='0';
 $('count-diff').textContent='初始模型网络';
 $('network-phase').textContent='初始产业网络 · 点击可探索';
 caption.textContent='41个角色及连线来自当前模型构造。点击触发退出后，颜色与数量将改为同一步 A/B 实验的实际输出。';
 if(!reduced){
   const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(e=>{visible=e.some(x=>x.isIntersecting);},{threshold:.1}):null;
   if(observer)observer.observe($('network-theater'));else visible=true;
   const canvas=$('impact-canvas');
   canvas.addEventListener('pointerdown',()=>{interacting=true;clearTimeout(interactionRelease);});
   const resume=()=>{clearTimeout(interactionRelease);interactionRelease=setTimeout(()=>{interacting=false;},9000);};
   canvas.addEventListener('pointerup',resume);canvas.addEventListener('pointercancel',resume);
   orbitTimer=setInterval(()=>{if(visible&&!document.hidden&&!interacting)view.orbit(.005,0);},100);
   window.addEventListener('pagehide',()=>{if(orbitTimer)clearInterval(orbitTimer);if(observer)observer.disconnect();if(view)view.dispose();},{once:true});
 }
}catch(error){
 $('run-exit').disabled=true;
 caption.textContent='模型初始化失败：'+error.message+'。这里不展示伪造的实验结果。';
 return;
}
const hold=$('compare-hold'),play=$('toggle-play'),slider=$('sim-time');
function stop(){if(timer!==null)clearTimeout(timer);timer=null;playing=false;play.textContent='▶ 播放';}
function paint(next){
 if(!experiment||!view)return;
 tick=Math.max(0,Math.min(20,Math.round(n(next))));
 const info=H.frameInfo(experiment,tick),snapshot=peek?experiment.A[tick]:experiment.B[tick];
 view.setFrame(snapshot.agents,{tick});
 view.setStoryFocus(peek?[]:info.changes);
 view.setStoryScene({hero:experiment.target,phase:tick===0?'intro':tick===20?'final':'scrub',peek,changes:info.changes});
 $('count-after').textContent=peek?info.a.alive:info.b.alive;
 $('count-changed').textContent=peek?'—':info.changes.length;
 const diff=info.b.alive-info.a.alive;
 $('count-diff').textContent=peek?'未改变路径（A）':'相对基线 '+(diff>0?'+':'')+diff+' 个';
 $('network-phase').textContent=peek?'未退出 · 同一步对照':'已退出 · 模型情景 B';
 $('network-tick').textContent='T '+String(tick).padStart(2,'0')+' / 20';
 $('time-readout').textContent='T '+String(tick).padStart(2,'0');
 slider.value=String(tick);hold.setAttribute('aria-pressed',String(peek));
 caption.textContent=peek?'正在显示没有退出的同一步基线。松开按钮，返回退出后的网络。':'T'+tick+'：'+info.changes.length+'个模型角色与基线状态不同；其中仅在改变后退出 '+info.exits.length+' 个、仅在改变后仍运转 '+info.returns.length+' 个。这不是现实预测。';
 const link=$('lab-next');
 if(link){
   const payload={v:3,kind:'exit',target:experiment.target,seed:7,pop:41,tick};
   const url=new URL('story-lab.html',location.href);
   url.searchParams.set('scenario',encodeURIComponent(JSON.stringify(payload)));
   link.href=url.toString();
 }
}
function advance(){
 if(!experiment||!playing)return;
 if(tick>=20){stop();return;}
 paint(tick+1);
 if(tick>=20){stop();return;}
 timer=setTimeout(advance,370);
}
$('run-exit').addEventListener('click',()=>{
 stop();peek=false;
 try{
  const target=targetSelect.value;
  experiment=H.exitRun(Sim,7,41,target,20);
  view.setGraph(experiment.A[0].agents,experiment.edges,{tick:0});
  slider.disabled=false;hold.disabled=false;play.disabled=false;
  notice.textContent=target+' 已从改变后的模型网络退出 · 观察相邻角色与后续变化';
  paint(0);
  if(reduced){paint(experiment.keyTick||20);}
  else{playing=true;play.textContent='Ⅱ 暂停';timer=setTimeout(advance,520);}
 }catch(error){
  experiment=null;slider.disabled=true;hold.disabled=true;play.disabled=true;
  caption.textContent='无法运行模型实验：'+error.message;
 }
});
targetSelect.addEventListener('change',()=>{stop();experiment=null;slider.disabled=true;hold.disabled=true;play.disabled=true;
 $('network-phase').textContent='等待新实验';notice.textContent='选择了'+targetSelect.value+'；点击「触发退出」以开始新的模型实验。';});
slider.addEventListener('input',()=>{if(!experiment)return;stop();peek=false;paint(Number(slider.value));});
play.addEventListener('click',()=>{
 if(!experiment)return;
 if(playing){stop();return;}
 if(reduced){paint(tick===20?experiment.keyTick:20);return;}
 if(tick>=20)paint(0);
 playing=true;peek=false;play.textContent='Ⅱ 暂停';timer=setTimeout(advance,200);
});
function beginPeek(){
 if(!experiment)return;stop();peek=true;paint(tick);
}
function endPeek(){if(!experiment||!peek)return;peek=false;paint(tick);}
hold.addEventListener('pointerdown',e=>{if(hold.disabled)return;e.preventDefault();hold.setPointerCapture(e.pointerId);beginPeek();});
for(const key of ['pointerup','pointercancel','lostpointercapture'])hold.addEventListener(key,endPeek);
hold.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();beginPeek();}});
hold.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();endPeek();}});
hold.addEventListener('blur',endPeek);
window.addEventListener('blur',()=>{stop();endPeek();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();endPeek();}});
})();
