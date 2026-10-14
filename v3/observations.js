/* V3.4 display of archived statistical observations, never a model fit. */
(function(){
 "use strict";
 const core=window.ZKObservations;
 const el=id=>document.getElementById(id);
 const node=(tag,klass,text)=>{const n=document.createElement(tag);if(klass)n.className=klass;if(text!==undefined)n.textContent=String(text);return n;};
 const NS="http://www.w3.org/2000/svg";
 const svg=(tag,attrs,content)=>{const v=document.createElementNS(NS,tag);Object.entries(attrs||{}).forEach(([k,val])=>v.setAttribute(k,String(val)));if(content!==undefined)v.textContent=String(content);return v;};
 let dataset=null,audit=null;
 const showErr=error=>{el("obs-error").hidden=false;el("obs-error").textContent=String(error.message||error);};
 const printable=n=>Number(n).toLocaleString("zh-CN",{maximumFractionDigits:2,minimumFractionDigits:0});
 function sourceStatus(row){
   if(row.review_status==="official_page_checked")return "政府原文";
   if(row.review_status==="mirrored_plus_official_corroboration")return "政府佐证/转载";
   return "第三方转载待复核";
 }
 function plot(metric){
   const def=dataset.metric_definitions[metric], points=core.lineSeries(audit,metric);
   el("obs-metric-title").textContent=def.label;
   el("obs-measure").textContent="单位："+def.unit+" · "+def.measurement;
   el("obs-chart-caption").textContent=def.description+"。每一点是公开资料的年度观测，不是模型计算结果。";
   const view=el("obs-chart");
   view.replaceChildren();
   const rows=points.filter(x=>x.row);
   if(!rows.length){view.append(svg("text",{x:340,y:150,"text-anchor":"middle",fill:"#98a8b4","font-size":14},"暂无观测"));return;}
   const W=680,H=295,L=68,R=24,T=24,B=52;
   const values=rows.map(x=>x.row.value);
   const positive=values.some(v=>v>0),negative=values.some(v=>v<0);
   let max=Math.max(0,...values),min=Math.min(0,...values);
   const range=Math.max(.0001,max-min);
   if(positive)max+=range*.12;
   if(negative)min-=range*.12;
   if(!positive&&!negative){max=1;min=-1;}
   const x=year=>L+(year-points[0].year)/(points.length-1||1)*(W-L-R);
   const y=v=>T+(max-v)/(max-min)*(H-T-B);
   for(let i=0;i<=4;i++){
     const tick=min+(max-min)*i/4, yy=y(tick);
     view.append(svg("line",{x1:L,y1:yy,x2:W-R,y2:yy,stroke:"#e6eef3","stroke-width":1}));
     view.append(svg("text",{x:L-12,y:yy+4,"text-anchor":"end","font-size":11,fill:"#899dac"},tick.toFixed(Math.abs(tick)<10?1:0)));
   }
   view.append(svg("line",{x1:L,y1:y(0),x2:W-R,y2:y(0),stroke:"#a3b7c3","stroke-width":1}));
   points.forEach(p=>view.append(svg("text",{x:x(p.year),y:H-20,"text-anchor":"middle","font-size":12,fill:"#6f8293"},p.year)));
   if(rows.length>=2){
     const parts=rows.map(row=>[x(row.year),y(row.row.value)]);
     view.append(svg("polyline",{points:parts.map(v=>v.join(",")).join(" "),fill:"none",stroke:"#0e8391","stroke-width":3.2,"stroke-linecap":"round","stroke-linejoin":"round"}));
   }
   rows.forEach(p=>{
     const xx=x(p.year),yy=y(p.row.value);
     view.append(svg("circle",{cx:xx,cy:yy,r:5.5,fill:"#0e8391",stroke:"#fff","stroke-width":2.5}));
     const offset=yy<45?25:-13;
     view.append(svg("text",{x:xx,y:yy+offset,"text-anchor":"middle","font-size":13,"font-weight":700,fill:"#2d556c"},printable(p.row.value)));
   });
   const ledger=el("obs-provenance");ledger.replaceChildren();
   for(const p of points){
     if(!p.row){
       ledger.append(node("p","no-result",p.year+" 年无原始观测；不填补。"));
       continue;
     }
     const box=node("div","obs-source");
     const head=node("div","obs-source-top");
     head.append(node("strong","",p.year+" 年 · "+printable(p.row.value)+" "+p.row.unit),
                 node("span","",sourceStatus(p.row)));
     box.append(head);
     p.row.source_ids.forEach(id=>{
       const entry=dataset.sources[id];if(!entry)return;
       const a=node("a","",entry.title+" ↗");a.href=entry.url;a.target="_blank";a.rel="noopener noreferrer";
       box.append(a);
       box.append(node("p","",entry.host_type==="government_portal"?"政府门户网站 · "+entry.publisher:"第三方转录 · 需要与官方原件交叉核对"));
     });
     if(p.row.note)box.append(node("p","",p.row.note));
     ledger.append(box);
   }
   el("obs-boundary").textContent=def.description+"。原始记录已分开保存版本信息、来源类型及核验状态；如出现统计口径变化需重新核对，不自动修订。";
 }
 function renderMatrix(){
   const tbody=el("obs-table-body");tbody.replaceChildren();
   const current=el("metric-choice").value;
   for(const [key,def] of Object.entries(dataset.metric_definitions)){
     const tr=node("tr",key===current?"obs-selected":"");
     tr.tabIndex=0;tr.setAttribute("role","button");tr.setAttribute("aria-label","选择"+def.label);
     const name=node("td");name.append(node("span","",def.label),node("small","",def.unit+" · "+def.measurement));tr.append(name);
     const series=core.lineSeries(audit,key);
     series.forEach(p=>tr.append(node("td","",p.row?printable(p.row.value):"—")));
     const grades=series.filter(x=>x.row).map(x=>sourceStatus(x.row));
     const label=grades.every(x=>x==="政府原文")?"政府原文":grades.includes("第三方转载待复核")?"部分转载待核":"政府与转载";
     tr.append(node("td","source-status "+(label==="政府原文"?"government":""),label));
     const activate=()=>{el("metric-choice").value=key;plot(key);renderMatrix();};
     tr.addEventListener("click",activate);
     tr.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();activate();}});
     tbody.append(tr);
   }
 }
 function render(){
   el("obs-release").textContent="资料登记：截至 "+dataset.created_on+" · 非实时模拟数据";
   const count=audit.rows.length,years=audit.years.length,metricCount=Object.keys(dataset.metric_definitions).length;
   const stats=[["年度覆盖",years+" 年",audit.years.join("–")],["观测条目",count+" 条","逐项可追溯来源"],["观测指标",metricCount+" 类","现价/增速严格分离"],["模型校准状态","尚未校准","历史预测未通过验证"]];
   const container=el("obs-stats");container.replaceChildren();
   stats.forEach(([name,value,hint],i)=>{
     const card=node("div","obs-stat");card.append(node("span","",name),node("strong",i===3?"obs-gated":"",value),node("small","",hint));container.append(card);
   });
   const options=el("metric-choice");options.replaceChildren();
   Object.entries(dataset.metric_definitions).forEach(([key,d])=>{
     const opt=node("option","",d.label);opt.value=key;options.append(opt);
   });
   options.value="gdp_current";
   options.addEventListener("change",()=>{plot(options.value);renderMatrix();});
   plot("gdp_current");renderMatrix();
   const issues=el("obs-issues");issues.replaceChildren();
   if(!audit.errors.length)issues.append(node("div","obs-issue ok","JSON 结构、来源引用、数据单位和唯一性检查通过。此项不证明所有转载数值都已独立核实。"));
   [...audit.errors,...audit.warnings,...(dataset.known_caveats||[])].forEach(w=>issues.append(node("div","obs-issue",w)));
   const readiness=core.readiness(audit,dataset);
   const block=el("obs-calibration-status");
   block.replaceChildren(node("strong","",readiness.canCalibrate?"仍需人工确认":"未满足校准前置条件"),node("p","","4 年观测不足以完成当前多智能体模型的可靠参数拟合及独立留出检验。"));
   const reasons=el("obs-calibration-reasons");reasons.replaceChildren();
   readiness.reasons.forEach(reason=>reasons.append(node("div","obs-reason",reason)));
 }
 async function boot(){
   try{
     if(!core)throw Error("缺少年度数据校验内核");
     const response=await fetch("observations/annual-2022-2025.json",{cache:"no-store"});
     if(!response.ok)throw Error("年度数据 HTTP "+response.status);
     dataset=await response.json();
     audit=core.validate(dataset);
     if(!audit.ok)throw Error(audit.errors.join("；"));
     render();
   }catch(e){showErr(e);}
 }
 boot();
})();