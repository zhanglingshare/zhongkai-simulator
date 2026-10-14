/* Scientific measurement bridge UI; all computation remains client-side. */
(function(){
 "use strict";
 const M=window.ZKMeasurement,el=id=>document.getElementById(id);
 if(!M){el("measure-error").hidden=false;el("measure-error").textContent="测量内核未载入";return;}
 let data=null,archive=null,current=null;
 const make=(tag,klass,text)=>{const n=document.createElement(tag);if(klass)n.className=klass;
   if(text!==undefined)n.textContent=String(text);return n;};
 const NS="http://www.w3.org/2000/svg";
 const svg=(tag,attrs,text)=>{const n=document.createElementNS(NS,tag);
   Object.entries(attrs||{}).forEach(([k,v])=>n.setAttribute(k,String(v)));
   if(text!==undefined)n.textContent=String(text);return n;};
 const showError=err=>{el("measure-error").hidden=false;el("measure-error").textContent=String(err.message||err);};
 const format=n=>Number(n).toFixed(3);
 function reset(){
   current=null;el("btn-export-protocol").disabled=true;
   el("measure-chart-wrap").hidden=true;el("measure-detail").replaceChildren();
   const root=el("measure-results");root.replaceChildren();
   const empty=make("div","measure-unready");
   empty.append(make("strong","","尚未建立可检查的映射"),
     make("p","","请导入由原研究工作台导出的 JSON、选择测量假设并明确登记每一对年度与模型步。"));
   root.append(empty);
 }
 function showResult(result){
   const root=el("measure-results");root.replaceChildren();el("measure-detail").replaceChildren();
   if(!result.ok){
     const warn=make("div","measure-unready");
     warn.append(make("strong","","不能生成研究诊断"),make("p","",result.message));
     if(result.details&&result.details.length){
       const ul=make("ul");result.details.forEach(s=>ul.append(make("li","",s)));warn.append(ul);
     }
     root.append(warn);
     el("measure-chart-wrap").hidden=true;el("btn-export-protocol").disabled=true;
     return;
   }
   el("btn-export-protocol").disabled=false;
   const warning=make("div","measure-unready");
   warning.append(make("strong","","仅供事后研究 · 外部预测验证仍为未通过"),
     make("p","","公式只用拟合截止年及之前的原始年度数值估计。后段数据仅作历史回放；原模型编码了历史事件，不能称为独立测试。"));
   root.append(warning);
   const grid=make("div","measure-metric-grid");
   for(const [name,v] of [
     ["样本内测量 MAE",format(result.trainMae)+" 个百分点"],
     ["后段历史回放残差绝对值均值（非外样本检验）",format(result.laterReplayMae)+" 个百分点"],
     ["拟合年度数量",result.trainCount+" 年"],
     ["历史回放年度数量",result.laterCount+" 年"]
   ]){
     const cell=make("div","measure-metric");
     cell.append(make("span","",name),make("strong","",v));grid.append(cell);
   }
   root.append(grid);
   const p=result.protocol;
   root.append(make("div","measure-equation",p.measurementEquation+"; α="+format(p.estimate.intercept)+", β="+format(p.estimate.slope)));
   const notes=make("div","measure-detail"),ul=make("ul");
   result.issues.forEach(item=>ul.append(make("li","",item)));notes.append(ul);root.append(notes);
   const detail=el("measure-detail");
   detail.append(make("h3","measure-subtitle","每对配准的数据及观测来源"));
   const table=make("table"),thead=make("thead"),tr=make("tr");
   for(const head of ["年份","模型步","状态指数","实际增速 %","拟合映射值 %","资料来源"]){
     tr.append(make("th","",head));
   }
   thead.append(tr);table.append(thead);
   const body=make("tbody");
   for(const point of result.points){
     const r=make("tr",point.phase==="later_replay"?"later":"");
     for(const value of [point.year,point.tick,format(point.modelValue),format(point.observed),format(point.estimated)]){
       r.append(make("td","",value));
     }
     const prov=make("td");
     const refs=point.sources.map(s=>s.kind==="government_portal"?"政府门户":"第三方转载");
     prov.textContent=refs.join(" / ");r.append(prov);body.append(r);
   }
   table.append(body);detail.append(table);
   drawChart(result);
 }
 function drawChart(result){
   const board=el("measure-chart"),width=660,height=310,left=58,right=24,top=29,bottom=62;
   const xs=result.points,all=xs.flatMap(p=>[p.observed,p.estimated]);
   let low=Math.min(0,...all),high=Math.max(0,...all);
   if(!Number.isFinite(low)||!Number.isFinite(high))return;
   if(high-low<.01){high+=1;low-=1;}
   const pad=(high-low)*.12;low-=pad;high+=pad;
   const x=idx=>left+(idx/(xs.length-1||1))*(width-left-right);
   const y=value=>top+(high-value)/(high-low)*(height-top-bottom);
   board.replaceChildren();
   for(let i=0;i<5;i++){
     const num=low+(high-low)*i/4,yy=y(num);
     board.append(svg("line",{x1:left,x2:width-right,y1:yy,y2:yy,stroke:"#e7edf1"}));
     board.append(svg("text",{x:left-10,y:yy+4,fill:"#869aa8","font-size":10,"text-anchor":"end"},num.toFixed(1)));
   }
   xs.forEach((p,i)=>{
     const xx=x(i);
     board.append(svg("line",{x1:xx,x2:xx,y1:y(p.observed),y2:y(p.estimated),stroke:"#b7c8cf","stroke-width":1.5}));
     board.append(svg("circle",{cx:xx,cy:y(p.observed),r:5,fill:"#0b8595"}));
     board.append(svg("rect",{x:xx-4,y:y(p.estimated)-4,width:8,height:8,
       fill:p.phase==="training"?"#7b8794":"#bc8445"}));
     board.append(svg("text",{x:xx,y:height-bottom+25,fill:"#7d90a0","font-size":12,"text-anchor":"middle"},p.year));
     if(p.phase==="later_replay"){
       board.append(svg("text",{x:xx,y:height-bottom+43,fill:"#af7c49","font-size":9,"text-anchor":"middle"},"历史回放"));
     }
   });
   board.append(svg("circle",{cx:left+8,cy:12,r:4,fill:"#0b8595"}));
   board.append(svg("text",{x:left+18,y:16,fill:"#657f90","font-size":11},"公开观测"));
   board.append(svg("rect",{x:left+105,y:8,width:9,height:9,fill:"#7b8794"}));
   board.append(svg("text",{x:left+118,y:16,fill:"#657f90","font-size":11},"样本内拟合"));
   board.append(svg("rect",{x:left+207,y:8,width:9,height:9,fill:"#bc8445"}));
   board.append(svg("text",{x:left+220,y:16,fill:"#657f90","font-size":11},"后段历史回放"));
   el("measure-chart-wrap").hidden=false;
 }
 function download(name,value){
   const b=new Blob([JSON.stringify(value,null,2)],{type:"application/json;charset=utf-8"});
   const url=URL.createObjectURL(b),a=document.createElement("a");a.href=url;a.download=name;
   document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
 }
 function renderCoverage(){
   const report=M.coverage(data);if(!report.valid){showError(report.warning);return;}
   el("candidate-count").textContent=report.candidateSummary.length;
   const cards=el("coverage-cards");cards.replaceChildren();
   report.states.forEach(item=>{
     const card=make("article","coverage-card");
     const head=make("header");
     head.append(make("strong","",item.name),make("span","tag "+(item.type==="missing"?"missing":""),item.type==="missing"?"缺直接观测":"弱代理假设"));
     card.append(head,make("p","",item.description));
     item.proxies.forEach(p=>card.append(make("small","",p.label+" · "+p.years.length+" 个年份")));
     cards.append(card);
   });
   const options=el("measure-candidate");options.replaceChildren();
   report.candidateSummary.forEach(c=>{
     const opt=make("option","",c.stateName+" → "+c.observedName+"（"+c.strength+"）");opt.value=c.id;
     options.append(opt);
   });
   options.value="abundance:industry_growth";
   options.addEventListener("change",()=>{renderMap();reset();});
   const cutoff=el("measure-cutoff");cutoff.replaceChildren();
   for(let year=2021;year<=2024;year++){
     const opt=make("option","",year+" 年");opt.value=String(year);cutoff.append(opt);
   }
   cutoff.value="2022";cutoff.addEventListener("change",reset);
   renderMap();
 }
 function renderMap(){
   const choice=M.candidates[el("measure-candidate").value],body=el("map-rows");
   const existing=new Map([...body.querySelectorAll("input[data-year]")].map(input=>[Number(input.dataset.year),input.value]));
   body.replaceChildren();if(!choice)return;
   el("candidate-detail").textContent=choice.reason+"。预设方向："+(choice.expected==="positive"?"正向":"反向")+"；此方向待检验，不是先验概率。";
   const records=data.observations.filter(r=>r.metric===choice.observed).sort((a,b)=>a.year-b.year);
   for(const o of records){
     const tr=make("tr");
     tr.append(make("td","",o.year),make("td","",o.value+" "+o.unit));
     const status=make("td","",o.review_status==="official_page_checked"?"政府原文":o.review_status==="mirrored_plus_official_corroboration"?"政府佐证/转载":"转载待复核");
     tr.append(status);
     const td=make("td");
     const input=document.createElement("input");input.type="number";input.min="0";input.max="100";input.step="1";
     input.dataset.year=String(o.year);input.setAttribute("aria-label",o.year+"年对应的模型时间步");
     input.placeholder="不确定留空";
     if(existing.has(o.year))input.value=existing.get(o.year);
     input.addEventListener("input",reset);
     td.append(input);tr.append(td);body.append(tr);
   }
   reset();
 }
 function collectSpec(){
   const correspondence=[];
   for(const input of el("map-rows").querySelectorAll("input[data-year]")){
     if(input.value.trim()==="")continue;
     if(!/^\d+$/.test(input.value.trim()))throw Error(input.dataset.year+" 年模型步必须为非负整数");
     correspondence.push({year:Number(input.dataset.year),tick:Number(input.value)});
   }
   return {schema:M.SCHEMA,candidate:el("measure-candidate").value,
     trainThrough:Number(el("measure-cutoff").value),correspondence};
 }
 async function loadFile(){
   const file=el("measure-archive").files[0];if(!file)return;
   if(file.size>3*1024*1024){el("archive-state").textContent="导出文件超过 3 MB，拒绝读取";archive=null;reset();return;}
   try{
     const json=JSON.parse(await file.text()),checked=M.archiveHistory(json);
     if(!checked.ok)throw Error(checked.error);
     archive=json;
     el("archive-state").textContent="已载入原模型基线 A："+checked.records.length+" 个时间步，种子 "+checked.seed+"；原始模型未提供对应日历时间。";
   }catch(ex){archive=null;el("archive-state").textContent="导入失败："+ex.message;}
   reset();
 }
 async function boot(){
   try{
     const response=await fetch("observations/annual-2019-2025.json",{cache:"no-store"});
     if(!response.ok)throw Error("未能读取 V3.5 官方统计观测：HTTP "+response.status);
     data=await response.json();
     if(data.schema!=="zk-annual-observations-v1")throw Error("公开统计档案版本不兼容");
     renderCoverage();
   }catch(ex){showError(ex);}
 }
 el("measure-archive").addEventListener("change",loadFile);
 el("btn-measure-run").addEventListener("click",()=>{
   if(!data){el("run-feedback").textContent="公开统计数据尚未载入";return;}
   try{
     const protocol=collectSpec();
     current=M.evaluate(data,archive,protocol);
     showResult(current);
     el("run-feedback").textContent=current.ok?
       "已生成事后测量研究协议；独立验证仍为未通过。":
       "暂不能复算："+current.message;
   }catch(ex){current=null;reset();el("run-feedback").textContent="输入错误："+ex.message;}
 });
 el("btn-measure-reset").addEventListener("click",()=>{
   el("map-rows").querySelectorAll("input[data-year]").forEach(input=>input.value="");
   reset();el("run-feedback").textContent="已清空时间映射；无诊断结果。";
 });
 el("btn-export-protocol").addEventListener("click",()=>{
   if(!current||!current.ok)return;
   download("zhongkai-measurement-protocol.json",{
     ...current.protocol,actualObservations:current.points.map(p=>({
       year:p.year,tick:p.tick,observed:p.observed,observedUnit:p.observedUnit,
       sources:p.sources,modelValue:p.modelValue,phase:p.phase
     })),validationPassed:false,calibrated:false});
 });
 el("btn-future-template").addEventListener("click",()=>download("zhongkai-prospective-preregistration-template.json",M.futureProtocol()));
 boot();
})();
