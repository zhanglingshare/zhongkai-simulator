/* UI-only cross-product family navigation. Input handoffs are explicitly non-equivalent across engines. */
(function(){
'use strict';
const loader=document.currentScript;if(!loader)return;
const root=new URL('../',loader.src);
const path=location.pathname;
const family=window.ZKFamily;
const pages={
 hub:'family/index.html',see:'v3/index.html',test:'v3/story-lab.html',research:'v3/lab.html',
 lilin:'lilin/index.html',inflow:'v3/inflow.html',trust:'v3/trust.html',
 observations:'v3/observations.html',measurement:'v3/measurement.html',
 verification:'v3/verification.html',classic:'v3/portal-classic.html',
 old:'zhongkai_simulator.html',v2:'v2/index.html',today:'today.html'
};
const here=(function(){const r=decodeURIComponent(path.slice(root.pathname.length));if(!r||r==='index.html')return 'old';return Object.entries(pages).find(([k,v])=>v===r)?.[0]||'';})();
if(here==='hub')return;
const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('family/nav.css',root).href;document.head.append(style);
const nav=document.createElement('nav');nav.id='zk-family-nav';nav.setAttribute('aria-label','仲恺产品家族');
function make(tag,cls,value){const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=value;return el;}
function baseCtx(){const from=family?.parseSearch(location.search);return from||null;}
function storyInput(){
 const shock=document.getElementById('story-shock')?.value||'exit';
 const seed=Number(document.getElementById('story-seed')?.value||7);
 const pop=Number(document.getElementById('story-size')?.value||41);
 const tick=Number(document.getElementById('story-time')?.value||20);
 return shock==='exit'?{v:1,kind:'exit',seed,pop,tick,target:document.getElementById('story-target')?.value,source:'test'}:{v:1,kind:'shock',seed,pop,tick,shock,source:'test'};
}
function homepageCtx(){
 const share=document.querySelector('a[href^="story-lab.html?scenario="]');
 if(share){
  try{const x=new URL(share.getAttribute('href'),location.href).searchParams.get('scenario');const d=JSON.parse(decodeURIComponent(x));return d.kind==='exit'?
   {v:1,kind:'exit',seed:d.seed,pop:d.pop,tick:d.tick,target:d.target,entity:d.target,source:'see'}:
   {v:1,kind:'shock',seed:d.seed,pop:d.pop,tick:d.tick,shock:d.shock,source:'see'};}catch{}
 }
 const chosen=document.getElementById('subject-name')?.textContent?.trim()||'';
 if(family?.SAFE_TARGETS?.includes(chosen))
  return {v:1,kind:'exit',target:chosen,entity:chosen,seed:7,pop:41,tick:0,source:'see'};
 return {v:1,kind:'explore',entity:chosen&&chosen!=='点击网络节点'?chosen:undefined,seed:7,pop:41,tick:0,source:'see'};
}
function labCtx(){
 const seed=Number(document.getElementById('seed-input')?.value||7);
 const shock=document.getElementById('shock-sel')?.value;
 if(family?.SCENE_SHOCKS?.includes(shock))return {v:1,kind:'shock',seed,pop:41,tick:0,shock,source:'research'};
 return {v:1,kind:'research',seed,pop:41,tick:0,source:'research'};
}
function currentCtx(){
 if(here==='test')return family?.validate(storyInput())||baseCtx();
 if(here==='see')return family?.validate(homepageCtx())||baseCtx();
 if(here==='research')return family?.validate(labCtx())||baseCtx();
 if(here==='lilin')return {v:1,kind:'town',town:'沥林',source:'lilin',seed:7,pop:41,tick:0};
 return baseCtx()||{v:1,kind:'explore',seed:7,pop:41,tick:0,source:'hub'};
}
function link(k,label){
 const el=make('a',k==='hub'?'zkf-home':'',label),target=new URL(pages[k],root);
 el.href=target.href;el.dataset.dest=k;el.dataset.active=String(k===here);
 el.addEventListener('click',()=>{
  if(k==='hub')return;
  const ctx=currentCtx();const url=target.href;
  if(!ctx)return;
  const href=k==='test'?family?.toStory(url,ctx):family?.withContext(url,ctx);
  if(href)el.href=href;
 });
 return el;
}
nav.append(link('hub','Z · 仲恺全景'));
const strip=make('div','zkf-links');
for(const [k,label] of [['see','◈ 看见'],['test','◇ 对撞'],['research','▦ 研究'],['lilin','⌖ 沥林镇域']])strip.append(link(k,label));
const d=make('details');const summary=make('summary',null,'更多工具 ▾'),menu=make('div','zkf-menu');
for(const [k,label] of [['inflow','主体接入实验'],['trust','证据可信度'],['observations','历史观测'],['measurement','模型—现实映射'],['verification','科学验证'],['classic','经典全息入口'],['v2','V2兼容工作台'],['old','单文件历史原版'],['today','今日仲恺']])menu.append(link(k,label));
d.append(summary,menu);strip.append(d);nav.append(strip);
const context=baseCtx();
if(context){
 const label=context.kind==='town'?'来自沥林镇域：全区与镇域使用不同模型，不继承数值结果':
  context.kind==='exit'?'接续：'+context.target+'（模型情景输入，进入新工具后需要重新运行）':
  context.kind==='shock'?'接续情景：'+context.shock+'（请核对新工具的参数口径）':
  context.entity?'已携带主体名称：'+context.entity:'已带入探索背景；不同模型不自动换算结果';
 const p=make('span','zkf-note',label);p.title=label;p.setAttribute('role','status');nav.append(p);
}
document.body.prepend(nav);
// State is a proposed input only. Research and town engines are not mathematically interchangeable.
if(context && here==='research'){
 const seedField=document.getElementById('seed-input');
 const shockField=document.getElementById('shock-sel');
 if(seedField&&context.seed)seedField.value=String(context.seed);
 if(context.kind==='shock'&&shockField&&[...shockField.options].some(o=>o.value===context.shock)){
  shockField.value=context.shock;shockField.dispatchEvent(new Event('change',{bubbles:true}));
 }
 const hint=make('p','zkf-note',
  context.kind==='exit'?'你带来的是指定主体退出实验；专业台的预设冲击可能不同，不能自动换算。请重新核对后运行。':
  '已接收情景输入，请核对专业模型参数后手动运行；旧结果不会自动沿用。');
 hint.style.maxWidth='350px';hint.style.margin='0 4px';hint.style.whiteSpace='normal';nav.append(hint);
}
if(context && here==='inflow' && context.entity){
 // Never auto-request network investigation; the user must review and choose to submit.
 const input=document.getElementById('company-name');
 if(input && !input.value)input.value=context.entity;
}

})();
