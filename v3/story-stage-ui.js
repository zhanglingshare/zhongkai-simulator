/* Presentation helpers. Read existing snapshot counts; never run or alter a Sim. */
(function(root){'use strict';
const element=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function contrast(host,{metric='alive',onMetric=()=>{}}={}){
 let current=null,active=metric;const animations=new Map();
 host.classList.add('story-contrast');
 const controls=element('div','contrast-metrics');controls.setAttribute('aria-label','选择数量对比');
 const names={alive:'运转角色',links:'模型连线'},buttons={};
 for(const key of Object.keys(names)){const b=element('button','',names[key]);b.type='button';b.dataset.contrastMetric=key;b.setAttribute('aria-pressed',String(key===active));b.addEventListener('click',()=>{active=key;if(current)render(current.info,current.options);onMetric(key);});buttons[key]=b;controls.append(b);}
 const row=element('div','contrast-pair'),cards={},numbers={},fills={};
 for(const key of ['a','b']){const card=element('div','contrast-side');card.dataset.side=key;const title=element('span','contrast-label',key==='a'?'未改变':'改变后'),number=element('strong','contrast-number','—'),track=element('div','contrast-track'),fill=element('i');
 number.dataset.contrastValue=key;track.append(fill);card.append(title,number,track);cards[key]=card;numbers[key]=number;fills[key]=fill;row.append(card);}
 const diff=element('div','contrast-difference'),delta=element('strong','contrast-number','—'),unit=element('span','contrast-unit','个角色');delta.dataset.contrastValue='delta';diff.append(element('span','contrast-label','相差'),delta,unit);row.append(diff);
 const note=element('p','contrast-note','改变后 − 未改变 · 同一步、同一刻度');host.replaceChildren(controls,row,note);
 function number(node,value){const str=value>0&&node===delta?'+'+value:String(value);if(node.textContent===str)return;node.textContent=str;if(reduced||!node.animate)return;animations.get(node)?.cancel();animations.set(node,node.animate([{opacity:.55,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:140,easing:'ease-out'}));}
 function render(info,options={}){current={info,options};if(!info){host.hidden=true;return;}host.hidden=false;host.dataset.metric=active;host.dataset.peek=String(!!options.peek);host.dataset.tick=options.tick;
 for(const key of Object.keys(buttons))buttons[key].setAttribute('aria-pressed',String(key===active));
 const baseline=info.a[active],scenario=info.b[active],max=info.initial[active]||Math.max(1,baseline,scenario),difference=scenario-baseline;
 number(numbers.a,baseline);number(numbers.b,scenario);number(delta,difference);unit.textContent=active==='alive'?'个角色':'条连线';
 cards.a.dataset.active=String(!!options.peek);cards.b.dataset.active=String(!options.peek);
 fills.a.style.width=(baseline/max*100)+'%';fills.b.style.width=(scenario/max*100)+'%';host.dataset.direction=difference===0?'same':difference>0?'more':'less';
 note.textContent='第 '+options.tick+' 步 · 改变后 − 未改变 · 初始 '+max+(active==='alive'?' 个角色':' 条连线')+'为满格';
 host.setAttribute('aria-label',names[active]+'，第 '+options.tick+' 步，未改变 '+baseline+'，改变后 '+scenario+'，相差 '+difference);
 }
 return {update:render,get metric(){return active;}};
}
function timeline(range,{stage,onStart=()=>{}}={}){
 const wrap=element('div','story-scrubber');range.before(wrap);wrap.append(range);range.classList.add('story-tactile-range');
 const bubble=element('span','scrubber-bubble','0'),pin=element('span','scrubber-key');bubble.setAttribute('aria-hidden','true');pin.setAttribute('aria-hidden','true');wrap.append(bubble,pin);
 let currentKey=null,lastAtKey=false;
 function finish(){wrap.classList.remove('is-dragging');stage?.classList.remove('is-scrubbing');}
 range.addEventListener('pointerdown',()=>{if(range.disabled)return;onStart();wrap.classList.add('is-dragging');stage?.classList.add('is-scrubbing');});
 for(const type of ['pointerup','pointercancel','change','blur'])range.addEventListener(type,finish);window.addEventListener('pointerup',finish);window.addEventListener('blur',finish);
 function update(t,key,ready){currentKey=key;wrap.hidden=false;wrap.dataset.ready=String(ready);bubble.hidden=!ready;pin.hidden=!ready||!Number.isInteger(key);
 const p=Math.max(0,Math.min(1,t/20));wrap.style.setProperty('--position',p*100+'%');range.style.setProperty('--progress',p*100+'%');bubble.textContent='第 '+t+' 步';
 if(Number.isInteger(key)){pin.style.left=key/20*100+'%';pin.textContent='关键 '+key;}
 const atKey=ready&&t===key;wrap.dataset.atKey=String(atKey);if(atKey&&!lastAtKey&&!reduced&&pin.animate)pin.animate([{opacity:.4,transform:'translateX(-50%) scale(.85)'},{opacity:1,transform:'translateX(-50%) scale(1)'}],{duration:180});lastAtKey=atKey;
 range.setAttribute('aria-valuetext','第 '+t+' 步'+(atKey?'，关键变化':'')+'。这是回放时间步。');
 }
 return {update,finish,get key(){return currentKey;}};
}
root.ZKStoryStage={contrast,timeline};
})(window);
