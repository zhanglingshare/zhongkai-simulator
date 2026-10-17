/* V3.20 trust workspace: read-only analysis of existing observations and public evidence. */
(function(){
"use strict";
const $=id=>document.getElementById(id),Trust=window.ZKTrustAudit;
const node=(tag,css,t)=>{const e=document.createElement(tag);if(css)e.className=css;if(t!==undefined)e.textContent=String(t);return e;};
let audit=null,registration=null,company=null,filtered=[];
const format=x=>x===null||!Number.isFinite(x)?"—":x.toLocaleString("zh-CN",{maximumFractionDigits:2});
function kpi(label,value,sub,kind=""){
 const c=node("div","trust-stat");if(kind)c.dataset.kind=kind;
 c.append(node("span","",label),node("strong","",value),node("small","",sub));return c;
}
function overview(){
 const root=$("trust-kpis");root.replaceChildren();
 root.append(kpi("公开年度统计",audit.observation.records+" 条",
   audit.observation.years[0]+"—"+audit.observation.years.at(-1)+"年 · "+audit.observation.metricCount+"个指标"),
  kpi("有来源标引的企业",audit.enterprise.total+" 家","仅名称及有限事件线索，不等于工商核验"),
  kpi("已证实投资兑现",audit.enterprise.investmentVerified+" 家","当前台账内没有足够可验证的投资兑现数据","missing"),
  kpi("Sim 独立预测验证","未通过","缺事前封存模型预测与后续独立观测","blocked"));
 $("model-status").textContent="尚不具备独立预测准确率";
 $("model-status-note").textContent="已经有公开统计观测和朴素基线重放，但原 Sim 没有冻结的预测—现实对应及结果公布前独立存证，不能给出模型准确率。";
}
function baseline(){
 const metric=$("trust-metric").value,datum=audit.baseline.results[metric];
 const score=$("trust-backtest-score"),graph=$("trust-folds"),table=$("trust-fold-table");
 score.replaceChildren();graph.replaceChildren();table.replaceChildren();
 if(!datum?.eligible){
  score.append(node("p","trust-alert",datum?.reason||"当前数据不能进行回放"));return;
 }
 score.append(kpi("沿用上年同比 MAE",format(datum.scores.naive.mae)+" 个百分点",
   "仅朴素统计基线的事后重建误差"),
  kpi("历年均值 MAE",format(datum.scores.expandingMean.mae)+" 个百分点",
   "从前3年起扩展训练 · 非 Sim 模型"),
  kpi("可重放年份",datum.scores.n+" 年",
   "不是外部事前冻结的预测样本"));
 const maxErr=Math.max(1,...datum.folds.map(r=>Math.abs(r.naive_error)));
 datum.folds.forEach(d=>{
  const row=node("article","fold-row");
  const header=node("div","fold-header");header.append(node("strong","",d.year+" 年"),
   node("span","","真实同比 "+format(d.actual)+"%"));
  const bar=node("div","fold-bar"),inside=node("span","fold-fill");
  inside.style.width=Math.max(0,Math.min(100,100*Math.abs(d.naive_error)/maxErr))+"%";bar.append(inside);
  row.append(header,bar,node("small","", "上年值误差 "+format(Math.abs(d.naive_error))+" 个百分点"));graph.append(row);
  const tr=node("tr");
  [d.year,format(d.actual)+"%",format(d.naive)+"%",format(d.mean)+"%",d.actual_source_ids?.join("、")||"来源待复核"]
   .forEach(v=>tr.append(node("td","",v)));table.append(tr);
 });
}
function bridge(){
 const host=$("trust-bridge");host.replaceChildren();
 for(const x of audit.mapping.states){
  const c=node("article","bridge-card");c.dataset.kind=x.type;
  const top=node("div","bridge-header");top.append(node("strong","",x.name),node("span","",
    x.type==="missing"?"缺少直接现实观测":"仅有间接代理假设"));
  c.append(top,node("p","",x.description));
  const proxies=node("div","bridge-proxies");
  if(x.proxies.length)x.proxies.forEach(p=>proxies.append(node("span","",p.label+" · "+p.years.length+"个记录年份")));
  else proxies.append(node("span","","未登记可用年度实证代理"));
  c.append(proxies);host.append(c);
 }
 const blockers=$("trust-block-reasons");blockers.replaceChildren();
 audit.modelValidation.blocks.forEach(v=>blockers.append(node("li","",v)));
}
function enterpriseKpis(){
 const host=$("trust-enterprise-kpis");host.replaceChildren();
 const counts=audit.enterprise.fieldCounts;
 host.append(kpi("原文名称标引",counts.nameMention.indexed+"/20",
   "来自现有来源台账，未逐家重新核对法律主体"),
   kpi("位置或属地线索",counts.districtAtRecord.indexed+"/20",
   "不是20家全部实际经营地点"),
   kpi("独立工商主体核验",counts.legalIdentity.verified+"/20",
   "统一社会信用代码与当前登记尚未完备"),
   kpi("实际投资核验",counts.actualInvestment.verified+"/20",
   "没有可据以评分的真实项目结果"));
}
function companyList(){
 const root=$("enterprise-items");root.replaceChildren();
 const value=$("enterprise-filter").value;
 filtered=audit.enterprise.companies.filter(c=>value==="all"||value==="other"?
    value==="all"||c.district!=="仲恺高新区":c.district===value);
 filtered.forEach(c=>{
  const b=node("button","enterprise-choice");b.type="button";b.dataset.id=c.id;
  if(company?.id===c.id)b.setAttribute("aria-pressed","true");else b.setAttribute("aria-pressed","false");
  b.append(node("strong","",c.name),node("small","",c.district+" · "+c.source.publisher));
  b.addEventListener("click",()=>{company=c;companyList();companyDetail();});
  root.append(b);
 });
 if(!filtered.length)root.append(node("p","","该范围未找到台账记录"));
 if(!filtered.some(c=>c.id===company?.id)){company=filtered[0]||null;}
 companyDetail();
}
function companyDetail(){
 const host=$("enterprise-detail");host.replaceChildren();
 if(!company){host.append(node("p","","当前没有企业可供查看"));return;}
 const head=node("div","enterprise-head");
 head.append(node("span","eyebrow","企业证据卡 · 不等于工商核验"),
  node("h3","",company.name),
  node("p","","公开来源所列范围："+company.district+" · "+company.source.publisher+
   (company.source.date?" · "+company.source.date:" · 发布日期未注明")));
 const link=node("a","","打开原始公开记录 ↗");link.href=company.source.url;
 link.target="_blank";link.rel="noopener noreferrer";head.append(link);
 head.append(node("p","",company.source.claim));host.append(head);
 const checks=node("div","enterprise-checks");
 company.fields.forEach(x=>{
  const cell=node("div","enterprise-check");
  cell.dataset.status=x.status;cell.append(node("strong","",x.label),
   node("span","",x.status==="indexed-not-reverified"?"公开来源台账有线索":"尚未核实"),
   node("p","",x.desc));checks.append(cell);
 });host.append(checks);
 host.append(node("div","enterprise-next","下一步：核对统一社会信用代码及独立的投资/就业/采购兑现证据，再区分存量、扩产和新引进。"));
}
function registrationInput(){
 return {metric:$("prereg-metric").value,targetPeriod:$("prereg-target").value,
  releaseDate:$("prereg-release").value,forecastValue:$("prereg-value").value,
  modelCommit:$("prereg-commit").value,protocolVersion:$("prereg-version").value,
  sources:$("prereg-source").value,measurementRule:$("prereg-rule").value,unit:"%"};
}
function invalidated(){
 registration=null;$("prereg-export").disabled=true;
 $("prereg-status").textContent="信息已修改，需重新检查并生成未封存草稿。";
}
$("prereg-form").addEventListener("input",invalidated);
$("prereg-form").addEventListener("submit",e=>{
 e.preventDefault();const r=Trust.preregistration(registrationInput());
 if(!r.ok){
  $("prereg-status").textContent="不能生成：" + r.errors.join("；");return;
 }
 registration=r.archive;$("prereg-export").disabled=false;
 $("prereg-status").textContent="可导出草稿。尚未获得外部时间戳、未封存模型输入；当前不能评分或认证预测准确率。";
});
$("prereg-export").addEventListener("click",()=>{
 if(!registration)return;
 const content=JSON.stringify(registration,null,2),blob=new Blob([content],{type:"application/json;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=node("a");a.href=url;
 a.download="zhongkai-v320-unsealed-preregistration.json";
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$("trust-metric").addEventListener("change",()=>{if(audit)baseline();});
$("enterprise-filter").addEventListener("change",()=>{if(audit)companyList();});
Promise.all([
 fetch("observations/annual-2019-2025.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("年度观测 HTTP "+r.status);return r.json();}),
 fetch("data/enterprise-validation-20.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("企业台账 HTTP "+r.status);return r.json();})
]).then(([observations,companies])=>{
 audit=Trust.auditResearch({observations,companies,observationCore:window.ZKObservations,
  benchmarkCore:window.ZKBenchmark,measurementCore:window.ZKMeasurement});
 if(!audit.ok)throw Error(audit.errors.join("；"));
 overview();baseline();bridge();enterpriseKpis();
 company=audit.enterprise.companies[0];companyList();
}).catch(e=>{
 $("trust-kpis").replaceChildren(node("p","trust-alert","无法完成真实资料审计："+e.message));
 $("model-status").textContent="无法验证 · 数据加载失败";
});
})();