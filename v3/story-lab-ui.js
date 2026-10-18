(function(){'use strict';
const $=id=>document.getElementById(id),Sim=window.ZKSim,H=window.ZKHomeStory,C=window.ZKStoryLab,Stage=window.ZKStoryStage,R=window.ZKStoryReading;
Sim.storyShocks=window.ZKRegisteredShocks;
const words={less:'更少',same:'一样多',more:'更多'},reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let input={kind:'exit',target:'TCL华星',seed:7,pop:41,tick:20},experiment=null,guess=null,tick=20,peek=false,timer=null,running=false,repeatToken=0,selected=null,metric='disaster',showAllRoles=false,roleSignature='';
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const message=s=>$('story-message').textContent=s;
const view=window.ZKHolo.mount({canvas:$('story-canvas'),labels:$('story-labels'),tooltip:$('story-hover'),status:$('story-render-mode'),onSelect:n=>select(n.name)});
const contrast=Stage.contrast($('story-contrast')),scrubber=Stage.timeline($('story-time'),{stage:$('story-stage'),onStart:stop});
function focusStage(){document.body.classList.add('focus-mode');$('stage-settings').disabled=false;}
function stop(){if(timer!==null)clearTimeout(timer);timer=null;running=false;$('story-play').textContent='▶ 看过程';}
function targets(){const s=new Sim(Number($('story-seed').value)||7,{n_agents:Number($('story-size').value),ticks:20}),old=$('story-target').value||input.target;
 $('story-target').replaceChildren(...s.agents.filter(a=>a.type==='anchor'&&a.alive).map(a=>new Option(a.name,a.name)));
 if([...$('story-target').options].some(o=>o.value===old))$('story-target').value=old;
}
function read(){const kind=$('story-shock').value==='exit'?'exit':'shock';return {kind,seed:Number($('story-seed').value),pop:Number($('story-size').value),tick:input.tick,...(kind==='exit'?{target:$('story-target').value}:{shock:$('story-shock').value})};}
function context(){const s=read(),label=s.kind==='exit'?s.target+'退出':s.shock;
 $('story-continuity').textContent='当前实验：'+label+' · '+s.pop+' 个模型角色 · 起点 '+s.seed+'。';
 $('target-label').hidden=s.kind!=='exit';
 $('scenario-description').textContent=s.kind==='exit'?'让指定链主退出，其余按原模型规则演化。':'使用原模型的「'+s.shock+'」情景预设；不指定某一家退出。';
 document.querySelectorAll('[data-scenario]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scenario===(s.kind==='exit'?'exit':s.shock))));
}
function invalidate(){stop();document.body.classList.remove('focus-mode');contrast.update(null);scrubber.update(20,null,false);$('stage-settings').disabled=true;$('stage-balance').textContent='';$('stage-status').textContent='';$('stage-experiment').textContent='同一场实验';roleSignature='';repeatToken++;experiment=null;guess=null;peek=false;selected=null;showAllRoles=false;
 $('story-stage').dataset.state='waiting';$('story-stage').dataset.peek='false';$('stage-empty').hidden=false;$('story-canvas').hidden=true;$('story-labels').hidden=true;
 $('guess-result').hidden=true;$('stage-prediction').textContent='';$('repeat-results').hidden=true;$('metric-note').textContent='揭晓后查看原模型指数。';
 for(const id of ['story-hold','story-play','story-time','story-key','story-share','story-repeat'])$(id).disabled=true;
 $('story-hold').setAttribute('aria-pressed','false');$('story-reveal').disabled=true;$('story-reveal').textContent='先选你的判断';
 for(const id of ['story-alive','story-links','metric-a','metric-b'])$(id).textContent='—';
 for(const id of ['metric-a-fill','metric-b-fill'])$(id).style.width='0%';
 $('story-alive-ref').textContent='等待模型结果';$('story-links-ref').textContent='包含预设与推断关系';$('story-time-out').textContent='尚未揭晓';$('story-view').textContent='等待揭晓';
 $('stage-phase').textContent='先判断，再揭晓';$('stage-title').textContent='同一步，看看哪里不同';$('stage-caption').textContent='条件已准备好。揭晓后可拖动、长按对照。';
 $('roles-summary').textContent='揭晓后，把未改变与改变后的角色状态并排看。';$('field-question').textContent='先揭晓，再带着具体问题去查';$('field-context').textContent='问题会接续你选择的实验和当前时间步。';$('field-check').hidden=true;$('field-scope').hidden=true;$('story-evidence-link').href='story-evidence.html';$('story-evidence-link').textContent='先看看已有证据 →';$('story-role-list').replaceChildren();
 $('repeat-status').textContent='比较 24 个起点中，各组最后一步的运转角色数量。';$('story-repeat').textContent='检查 24 个起点';
 document.querySelectorAll('[data-guess]').forEach(b=>b.setAttribute('aria-pressed','false'));context();
 window.dispatchEvent(new CustomEvent('zk:story-clear'));
}
function select(name){if(!experiment)return;selected=name;const n=view.select(name);if(!n)return;
 const c=view.camera;view.orbit(Math.atan2(n.x,n.z)-c.yaw,Math.atan2(n.y,Math.hypot(n.x,n.z))-c.pitch);
 document.querySelectorAll('#story-role-list li').forEach(li=>li.dataset.selected=String(li.dataset.name===name));
 message(name+'：'+(n.alive?'当前路径仍在运转':'当前路径已退出')+'。');
}
function roles(info){const signature=JSON.stringify([tick,showAllRoles,info.changes]);if(signature===roleSignature)return;roleSignature=signature;const list=$('story-role-list');list.replaceChildren();
 const changes=info.changes.slice().sort((a,b)=>Number(b.name===experiment.target)-Number(a.name===experiment.target)||Number(b.exit)-Number(a.exit)||Math.abs(b.change)-Math.abs(a.change));
 $('roles-summary').textContent=R.explain(info,tick);
 if(!changes.length){list.append(node('li','','这一步未发现明显角色差异。'));return;}
 for(const c of (showAllRoles?changes:changes.slice(0,6))){const li=node('li'),button=node('button','',c.name+' · '+c.direction);button.type='button';li.dataset.name=c.name;li.dataset.selected=String(selected===c.name);li.dataset.direction=c.exit?'exit':c.returning||c.change>0?'stronger':'weaker';
 button.addEventListener('click',()=>{select(c.name);$('story-stage').scrollIntoView({block:'start',behavior:'auto'});});
 const pair=node('div','role-paths');for(const [key,label] of [['A','未改变'],['B','改变后']]){const agent=experiment[key][tick].agents.find(n=>n.name===c.name),cell=node('span');cell.dataset.path=key;cell.dataset.alive=String(agent.alive);cell.append(node('small','',label),node('b','',agent.alive?'仍运转':'已退出'));pair.append(cell);}li.append(button,pair);if(!c.exit&&!c.returning)li.append(node('p','','两边都仍运转，改变后的模型经营状态'+(c.change<0?'较弱。':'较强。')));list.append(li);}
 if(changes.length>6){const li=node('li'),b=node('button','',showAllRoles?'收起更多角色':'展开其余 '+(changes.length-6)+' 个角色');b.type='button';b.addEventListener('click',()=>{showAllRoles=!showAllRoles;roles(info);});li.append(b);list.append(li);}
}
function paint(t){if(!experiment)return;tick=Math.max(0,Math.min(20,Math.trunc(t)));input.tick=tick;
 const info=H.frameInfo(experiment,tick),snapshot=peek?experiment.A[tick]:experiment.B[tick],counts=peek?info.a:info.b;
 view.setFrame(snapshot.agents,{tick});view.setStoryFocus(peek?[]:info.changes);view.setStoryScene({hero:experiment.target,phase:tick===20?'final':'scrub',peek,changes:info.changes});
 const last=C.outcome(experiment);$('stage-prediction').textContent='你猜最后一步'+words[guess]+' · 最后一步实际'+words[last.choice]+'（'+last.a+' → '+last.b+'）';
 contrast.update(info,{tick,peek});scrubber.update(tick,experiment.keyTick,true);
 $('stage-balance').textContent='只在改变后退出 '+info.exits.length+' 个 · 只在改变后仍运转 '+info.returns.length+' 个';
 $('path-composition').textContent='第 '+tick+' 步，两条路径中：'+info.exits.map(c=>c.name).join('、')+(info.exits.length?'只在改变后退出。':'没有角色只在改变后退出。')+(info.returns.length?info.returns.map(c=>c.name).join('、')+'只在改变后仍运转。':'没有角色只在改变后仍运转。')+'数量净差为 '+(info.b.alive-info.a.alive)+' 个。';
 $('story-stage').dataset.peek=String(peek);$('story-stage').dataset.state='ready';$('story-hold').setAttribute('aria-pressed',String(peek));
 $('story-alive').textContent=counts.alive;$('story-links').textContent=counts.links;
 $('story-alive-ref').textContent='未改变 '+info.a.alive+' / 改变后 '+info.b.alive;
 $('story-links-ref').textContent='未改变 '+info.a.links+' / 改变后 '+info.b.links;
 $('story-view').textContent=(peek?'未改变':'改变后')+' · 第 '+tick+' 步';$('story-time').value=tick;$('story-time-out').textContent='第 '+tick+' / 20 步';
 $('stage-phase').textContent=peek?'正在长按对照':tick===experiment.keyTick&&!running?'关键变化 · 已暂停':running?'正在回放变化':'同一步对照';
 $('stage-title').textContent=peek?'如果没有这次改变':tick===0&&experiment.kind==='exit'?experiment.target+'退出了模型':'同一步，'+info.changes.length+' 个角色不同';
 $('stage-caption').textContent=peek?'松开回到改变后的路径。镜头与时间步保持一致。':'拖动查看过程；按住下方按钮对照未改变时。';
 $('story-hold').textContent=experiment.kind==='exit'?'按住看未退出时':'按住看未发生时';
 for(const path of ['a','b']){const n=(path==='a'?experiment.A:experiment.B)[tick].state[metric];$('metric-'+path).textContent=n.toFixed(3);$('metric-'+path+'-fill').style.width=(n*100)+'%';}
 const d=experiment.B[tick].state[metric]-experiment.A[tick].state[metric];
 $('metric-note').textContent=(metric==='disaster'?'压力风险，低一些较好':'产业活力，高一些较好')+'；改变后减未改变：'+(d>=0?'+':'')+d.toFixed(3)+'。均为 0—1 模型指数。';roles(info);
 const adjacent=new Set(experiment.edges.flatMap(e=>e.a===input.target?[e.b]:e.b===input.target?[e.a]:[])),preferred=info.changes.find(c=>c.name!==input.target&&adjacent.has(c.name))?.name,q=R.question(input,experiment.edges,preferred),url=new URL('story-evidence.html',location.href);url.searchParams.set('scenario',encodeURIComponent(JSON.stringify(C.payload({...input,tick}))));if(q.role)url.searchParams.set('role',q.role);url.hash='method';$('story-evidence-link').href=url.toString();$('story-evidence-link').textContent='带着这个问题查证据 →';$('field-question').textContent=q.title;$('field-context').textContent=(input.kind==='exit'?input.target+'退出':input.shock)+' · 第 '+tick+' 步 · 模型结果不等于现实事实';$('field-check').textContent=q.check;$('field-scope').textContent=q.scope;$('field-check').hidden=false;$('field-scope').hidden=false;
 window.dispatchEvent(new CustomEvent('zk:story-frame',{detail:{settings:{...input},tick,peek,a:experiment.A[tick],b:experiment.B[tick],displayed:snapshot,edges:experiment.edges,keyTick:experiment.keyTick,camera:view.camera}}));
}
function reveal(){const s=read();if(!guess)return;try{stop();experiment=C.run(Sim,s);input=s;repeatToken++;$('repeat-results').hidden=true;
 const out=C.outcome(experiment);$('guess-result').hidden=false;$('guess-result').textContent='你猜「'+words[guess]+'」；这次最后一步是「'+words[out.choice]+'」。未改变 '+out.a+' 个，改变后 '+out.b+' 个。'+(guess===out.choice?'这次与你的判断一致。':'这次与你的判断不同。');
 $('story-canvas').hidden=false;$('story-labels').hidden=false;$('stage-empty').hidden=true;
 focusStage();$('stage-experiment').textContent=(s.kind==='exit'?s.target+'退出':s.shock)+' · '+s.pop+' 角色 · 起点 '+s.seed;view.resetCamera();view.setGraph(experiment.B[s.tick].agents,experiment.edges,{tick:s.tick});
 for(const id of ['story-hold','story-play','story-time','story-key','story-share','story-repeat'])$(id).disabled=false;
 $('story-key').textContent='关键变化 · 第 '+experiment.keyTick+' 步';$('story-reveal').textContent='重新揭晓这场实验';peek=false;paint(s.tick);if(s.kind==='exit')select(s.target);
 $('story-stage').scrollIntoView({block:'start',behavior:'auto'});message('已揭晓同一场模型实验。直觉判断对照的是最后一步，画面可查看任意一步。');
 }catch(e){message(e.message);}}
function play(){if(!experiment)return;if(reduced){stop();peek=false;paint(tick===experiment.keyTick?20:experiment.keyTick);return;}if(running){stop();paint(tick);return;}peek=false;if(tick===20)tick=-1;running=true;$('story-play').textContent='Ⅱ 暂停';
 const advance=()=>{if(!experiment)return;const next=tick+1;if(next>20){stop();return;}if(next===20||next===experiment.keyTick&&next>0)stop();paint(next);if(running)timer=setTimeout(advance,350);};advance();}
function beginPeek(){if(!experiment)return;stop();peek=true;paint(tick);}
function endPeek(){if(!peek)return;peek=false;paint(tick);}
async function repeat(){if(!experiment)return;const s={...input,tick:20},token=++repeatToken,values=[];stop();peek=false;paint(tick);$('story-repeat').disabled=true;$('repeat-results').hidden=true;
 try{for(let i=0;i<24;i++){if(token!==repeatToken)return;const seed=C.seedAt(s.seed,i),r=C.run(Sim,{...s,seed});values.push(C.outcome(r).delta);
 if((i+1)%4===0){$('repeat-status').textContent='已检查 '+(i+1)+' / 24 个起点…';await new Promise(resolve=>setTimeout(resolve,0));}}
 if(token!==repeatToken)return;const summary=C.summarize(values);for(const k of ['less','same','more'])$('repeat-'+k).textContent=summary[k];
 $('repeat-results').hidden=false;$('repeat-status').textContent='完成 24 个起点；每组比较第 20 步，条件与当前实验相同。';
 const chart=$('repeat-chart');chart.replaceChildren();const NS='http://www.w3.org/2000/svg',svg=(tag,attrs,text)=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
 const W=Math.max(280,Math.min(800,chart.clientWidth||720));chart.setAttribute('viewBox','0 0 '+W+' 170');
 const scale=Math.max(1,...values.map(Math.abs)),x=i=>50+i/23*(W-75),y=v=>78-v/scale*52;
 chart.append(svg('line',{x1:50,y1:y(0),x2:W-25,y2:y(0),stroke:'#8dacae','stroke-dasharray':'4 4'}));
 for(const v of [-scale,0,scale])chart.append(svg('text',{x:35,y:y(v)+5,'text-anchor':'end',fill:'#a9c9cf','font-size':12},(v>0?'+':'')+v));
 chart.append(svg('text',{x:50,y:157,fill:'#a9c9cf','font-size':12},'第 1 组'),svg('text',{x:W-25,y:157,'text-anchor':'end',fill:'#a9c9cf','font-size':12},'第 24 组'));
 const inspect=i=>{const v=values[i];$('repeat-inspect').value=i+1;$('repeat-group-label').textContent='第 '+(i+1)+' 组';$('repeat-range').textContent='第 '+(i+1)+' 组，起点 '+C.seedAt(s.seed,i)+'：改变后比未改变'+(v<0?'少 '+(-v):v>0?'多 '+v:'一样多')+' 个角色。';chart.querySelectorAll('circle').forEach((c,j)=>c.setAttribute('stroke',i===j?'#fff0b9':'#143747'));};
 $('repeat-inspect').oninput=()=>inspect(Number($('repeat-inspect').value)-1);$('repeat-inspect').value=1;$('repeat-group-label').textContent='第 1 组';
 values.forEach((v,i)=>{const text='第 '+(i+1)+' 组，起点 '+C.seedAt(s.seed,i)+'，角色数量差 '+v;const circle=svg('circle',{cx:x(i),cy:y(v),r:Math.min(7,(W-75)/23*.35),fill:v<0?'#e5a082':v>0?'#89d8ad':'#95b8c7',stroke:'#143747','stroke-width':2,tabindex:0,role:'button','aria-label':text});circle.append(svg('title',{},text));for(const event of ['pointerenter','click','focus'])circle.addEventListener(event,()=>inspect(i));chart.append(circle);});
 $('repeat-range').textContent='这 24 组的角色数量差异范围：'+(summary.min>=0?'+':'')+summary.min+' 至 '+(summary.max>=0?'+':'')+summary.max+' 个。';
 window.dispatchEvent(new CustomEvent('zk:story-repeat',{detail:{settings:s,values,seeds:values.map((_,i)=>C.seedAt(s.seed,i)),summary}}));
 }catch(e){$('repeat-status').textContent='检查未完成：'+e.message;}finally{if(token===repeatToken)$('story-repeat').disabled=false;}}
for(const shock of Sim.storyShocks)$('story-shock').append(new Option(shock==='链主外迁'?'外迁压力（不指定主体）':shock,shock));
for(const b of document.querySelectorAll('[data-guess]'))b.addEventListener('click',()=>{guess=b.dataset.guess;document.querySelectorAll('[data-guess]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('story-reveal').disabled=false;$('story-reveal').textContent='揭晓：和我的判断一样吗？';});
for(const b of document.querySelectorAll('[data-scenario]'))b.addEventListener('click',()=>{$('story-shock').value=b.dataset.scenario;invalidate();});
for(const id of ['story-target','story-shock','story-size'])$(id).addEventListener('change',()=>{if(id==='story-size')targets();input.tick=20;invalidate();});
$('story-seed').addEventListener('input',()=>{input.tick=20;targets();invalidate();});
$('stage-settings').addEventListener('click',()=>{stop();if(peek)endPeek();document.body.classList.remove('focus-mode');document.querySelector('.experiment-console').scrollIntoView({block:'start',behavior:'auto'});$('story-reveal').focus({preventScroll:true});});
$('story-reveal').addEventListener('click',reveal);$('story-time').addEventListener('input',()=>{stop();peek=false;paint(Number($('story-time').value));});$('story-play').addEventListener('click',play);$('story-key').addEventListener('click',()=>{stop();peek=false;paint(experiment.keyTick);});$('story-repeat').addEventListener('click',repeat);
const hold=$('story-hold');hold.addEventListener('pointerdown',e=>{if(hold.disabled)return;e.preventDefault();hold.setPointerCapture(e.pointerId);beginPeek();});for(const type of ['pointerup','pointercancel','lostpointercapture'])hold.addEventListener(type,endPeek);
hold.addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();if(!e.repeat)beginPeek();}});hold.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();endPeek();}});hold.addEventListener('blur',endPeek);const pause=()=>{stop();if(peek)endPeek();else if(experiment)paint(tick);};window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
for(const b of document.querySelectorAll('[data-metric]'))b.addEventListener('click',()=>{metric=b.dataset.metric;document.querySelectorAll('[data-metric]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));paint(tick);});
$('story-share').addEventListener('click',async()=>{if(!experiment)return;const url=new URL(location.href);url.searchParams.set('scenario',encodeURIComponent(JSON.stringify(C.payload({...input,tick}))));url.hash='';try{await navigator.clipboard.writeText(url.toString());message('已复制同一场实验的条件与时间步；对方可先判断再揭晓。');$('story-share').textContent='已复制 ✓';setTimeout(()=>{$('story-share').textContent='复制这场实验';},1800);}catch{const f=node('textarea');f.value=url.toString();f.readOnly=true;f.setAttribute('aria-label','手动复制实验链接');$('story-message').replaceChildren(f);f.select();}});
const raw=new URLSearchParams(location.search).get('scenario'),received=raw?C.decode(Sim,raw):null;
if(received){input=received;$('story-size').value=input.pop;$('story-seed').value=input.seed;$('story-shock').value=input.kind==='exit'?'exit':input.shock;}
else if(raw)$('story-notice').textContent='链接条件无效，已恢复 41 个角色、起点 7 的默认实验。';
targets();if(input.kind==='exit')$('story-target').value=input.target;invalidate();
if(received)$('story-continuity').textContent='接续实验：'+(input.kind==='exit'?input.target+'退出':input.shock)+' · '+input.pop+' 个角色 · 起点 '+input.seed+' · 第 '+input.tick+' 步。';
})();
