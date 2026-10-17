(function(){'use strict';
const $=id=>document.getElementById(id),node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
let dataset,audit,pilots;
const tabs=[...document.querySelectorAll('[data-panel]')];
function switchPanel(name){for(const tab of tabs){const yes=tab.dataset.panel===name;tab.setAttribute('aria-selected',String(yes));tab.setAttribute('aria-pressed',String(yes));tab.tabIndex=yes?0:-1;$('panel-'+tab.dataset.panel).hidden=!yes;}history.replaceState(null,'','#'+name);if(name==='facts'&&audit?.ok)chart();}
for(const [i,tab]of tabs.entries()){tab.addEventListener('click',()=>switchPanel(tab.dataset.panel));tab.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(i+1)%tabs.length;else if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();switchPanel(tabs[next].dataset.panel);tabs[next].focus();});}
if(tabs.some(t=>t.dataset.panel===location.hash.slice(1)))switchPanel(location.hash.slice(1));
const safeLink=(url,title)=>{try{const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw Error();const a=node('a','',title+' ↗');a.href=u.toString();a.target='_blank';a.rel='noopener noreferrer';return a;}catch{return node('span','','来源链接格式有待复核');}};
const format=n=>Number(n).toLocaleString('zh-CN',{maximumFractionDigits:3});
function source(){const metric=$('evidence-metric').value,year=Number($('evidence-year').value),def=dataset.metric_definitions[metric],r=(audit.byMetric[metric]||[]).find(x=>x.year===year),host=$('evidence-source');host.replaceChildren();
 if(!r){host.append(node('p','notice',year+' 年没有这项原始观测；这里留空，不补值。'));return;}
 const box=node('article','source-card');box.append(node('strong','',year+' 年 · '+format(r.value)+' '+r.unit));
 box.append(node('span','evidence-status',r.review_status==='official_page_checked'?'台账标记：政府原文已查看':r.review_status==='mirrored_plus_official_corroboration'?'台账标记：转载及政府佐证':'台账标记：转载待复核'));
 for(const id of r.source_ids){const s=dataset.sources[id];box.append(safeLink(s.url,s.title),node('p','',s.publisher+' · '+(s.release_date||'台账未记录发布日期')+' · '+(s.host_type==='government_portal'?'政府门户原文':'第三方转载')));}
 box.append(node('p','','记录版本：'+r.vintage+'。'+(r.note||'')),node('p','',def.description));host.append(box);
 document.querySelectorAll('#evidence-chart [data-year]').forEach(p=>p.setAttribute('stroke-width',Number(p.dataset.year)===year?'4':'2'));
 window.dispatchEvent(new CustomEvent('zk:story-evidence',{detail:{metric,year,row:r,sources:r.source_ids.map(id=>dataset.sources[id])}}));
}
function chart(){const key=$('evidence-metric').value,def=dataset.metric_definitions[key],series=audit.byMetric[key]||[],years=audit.years;
 $('evidence-definition').textContent=def.label+' · '+def.unit+'。'+def.description;
 const chart=$('evidence-chart');chart.replaceChildren();const NS='http://www.w3.org/2000/svg',svg=(tag,a,text)=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(a))n.setAttribute(k,v);if(text!==undefined)n.textContent=String(text);return n;};
 const W=Math.max(300,Math.min(850,chart.clientWidth||850));chart.setAttribute('viewBox','0 0 '+W+' 280');
 const values=series.map(r=>r.value),lo=Math.min(0,...values),hi=Math.max(0,...values),range=hi-lo||1,min=lo-range*.08,max=hi+range*.12,x=year=>55+(year-years[0])/(years.at(-1)-years[0]||1)*(W-75),y=v=>22+(max-v)/(max-min)*197;
 for(let i=0;i<4;i++){const v=min+(max-min)*i/3,yy=y(v);chart.append(svg('line',{x1:55,y1:yy,x2:W-20,y2:yy,stroke:'#315665'}),svg('text',{x:45,y:yy+5,'text-anchor':'end',fill:'#8bb0bc','font-size':11},v.toFixed(Math.abs(v)>=10?0:1)));}
 for(let i=1;i<series.length;i++){const a=series[i-1],b=series[i];if(b.year-a.year!==1||key==='retail_current'&&a.year===2019&&b.year===2020)continue;chart.append(svg('line',{x1:x(a.year),y1:y(a.value),x2:x(b.year),y2:y(b.value),stroke:'#7ed8d1','stroke-width':3}));}
 for(const year of years){const row=series.find(r=>r.year===year),label=year+' 年：'+(row?format(row.value)+' '+row.unit:'无原始观测');const g=svg('g',{tabindex:0,role:'button','aria-label':label,'data-year':year});g.append(svg('text',{x:x(year),y:253,'text-anchor':'middle',fill:'#b0cbd0','font-size':11},year));
 g.append(svg('circle',{cx:x(year),cy:row?y(row.value):218,r:7,fill:row?'#8ee2d5':'#183644',stroke:row?'#c7fff0':'#6b919f','stroke-width':2}));g.append(svg('title',{},label));if(!row)g.append(svg('text',{x:x(year),y:200,'text-anchor':'middle',fill:'#7699a7','font-size':11},'无记录'));
 const choose=()=>{$('evidence-year').value=year;source();};g.addEventListener('click',choose);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});chart.append(g);}
 source();
}
function company(){const c=pilots.cases.find(c=>c.id===$('evidence-company').value);if(!c)return;
 for(const [id,key]of [['claim-support','support'],['claim-excludes','excludes']]){const host=$(id);host.replaceChildren();for(const s of c.source)host.append(node('p','',s[key]||'台账未明确记录，仍需核实。'));}
 const host=$('claim-sources');host.replaceChildren();for(const s of c.source){const box=node('div','source-card');box.append(safeLink(s.url,s.publisher+' · '+s.publishedAt),node('p','',s.evidenceText),node('p','','台账查看日期：'+s.retrievedAt));host.append(box);}
 $('claim-watch').textContent='接下来核实：'+c.watch;
}
async function load(){try{const paths=['observations/annual-2019-2025.json','data/pilot-cases-v321.json'],data=await Promise.all(paths.map(p=>fetch(p,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('资料读取失败：'+p);return r.json();})));
 [dataset,pilots]=data;audit=window.ZKObservations.validate(dataset);if(!audit.ok)throw Error('年度台账结构未通过检查；请到完整台账核对。');if(pilots.schema!=='zk-enterprise-pilot-v321'||!Array.isArray(pilots.cases)||!pilots.cases.every(c=>Array.isArray(c.source)))throw Error('企业台账结构不受支持。');
 $('evidence-date').textContent='年度台账建立：'+dataset.created_on+'；企业资料快照：'+pilots.capturedAt+'。展示归档材料，不代表今天重新核实。';
 $('evidence-metric').replaceChildren(...Object.entries(dataset.metric_definitions).map(([key,d])=>new Option(d.label+'（'+d.unit+'）',key)));$('evidence-metric').value='gdp_current';
 $('evidence-year').replaceChildren(...audit.years.map(y=>new Option(y+' 年',y)));$('evidence-year').value=audit.years.at(-1);
 $('evidence-company').replaceChildren(...pilots.cases.map(c=>new Option(c.name,c.id)));
 for(const id of ['evidence-metric','evidence-year','evidence-company'])$(id).disabled=false;
 $('evidence-caveats').replaceChildren(...[...new Set([...dataset.known_caveats,...audit.warnings])].map(s=>node('li','',s)));
 const statuses=[['年度统计材料',audit.rows.length+' 条记录可追来源'],['固定现实映射',dataset.model_mapping?'台账有映射记录，需专业复核':'台账未提供固定映射'],['独立留出检验',dataset.independent_holdout===true?'台账声明有独立留出，需核对档案':'本台账不是独立留出集']];
 $('evidence-method-status').replaceChildren(...statuses.map(([label,text])=>{const d=node('div');d.append(node('strong','',label),node('span','',text));return d;}));chart();company();
 }catch(e){$('evidence-error').hidden=false;$('evidence-error').textContent=e.message+' 已停止展示数据摘要；可打开原始专业台账继续核对。';$('evidence-date').textContent='本次资料未能完整载入。';}}
let resizeFrame;window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(audit?.ok&&!$('panel-facts').hidden)chart();});});
$('evidence-metric').addEventListener('change',chart);$('evidence-year').addEventListener('change',source);$('evidence-company').addEventListener('change',company);load();
})();
