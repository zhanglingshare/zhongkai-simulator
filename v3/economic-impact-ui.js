/* V3.18 isolated user-assumption economic sensitivity UI. */
(function(){
"use strict";
const $=id=>document.getElementById(id),E=window.ZKEconomicInflow;
if(!E||!$("economic-lab"))return;
const keys=Object.keys(E.RANGES),capKeys=Object.keys(E.CAPACITIES);
const mapping=[
 ["newInvestment","一次性新增投资","亿元"],
 ["netAdditionalPurchasing","替代后本地采购留存","亿元/年"],
 ["netJobs","扣除替代后的岗位","人"],
 ["localPurchasing","本地采购毛额","亿元/年"]
];
let latest=null,stored=[],rosterOpen=false;
const make=(tag,css,value)=>{const x=document.createElement(tag);if(css)x.className=css;if(value!==undefined)x.textContent=String(value);return x;};
const msg=(v,kind="")=>{$("econ-message").textContent=v;$("econ-message").dataset.kind=kind;};
const fmt=(v,unit)=>v===null||v===undefined||!Number.isFinite(v)?"未知":v.toLocaleString("zh-CN",{maximumFractionDigits:unit==="人"?0:3});
function raw(){
 const inputs={},capacities={};
 for(const k of keys)inputs[k]={low:$("econ-"+k+"-low").value,high:$("econ-"+k+"-high").value};
 for(const k of capKeys)capacities[k]=$("econ-cap-"+k).value;
 return {kind:$("company-scenario").value,company:$("company-name").value.trim(),
  seed:Number($("seed").value),source:$("project-proof").value.trim()||$("source").value.trim(),
  inputs,capacities};
}
function context(){
 const type=$("company-scenario").value;
 $("econ-context").textContent=type==="backfill"?"现有企业补入模型：现实新增投资、就业和本地采购净增量一律为零；历史存量不能重复计入。":
 type==="expansion"?"扩产：填写相对现有项目产能的新增部分，不使用原模型的新增公司节点算法。":
 type==="proposed_new"?"拟引进：仅对用户输入的假设项目进行敏感性分析，不代表现实已经签约或落地。":
 "请先在上方确定研究类型：拟引进、扩产或存量补录。";
}
function stale(){
 if(!latest)return;
 latest=null;$("econ-save").disabled=true;$("econ-export").disabled=true;
 $("econ-metrics").replaceChildren(make("p","empty-wide","输入已发生变化，旧测算已作废。"));
 $("econ-resource-check").textContent="需要重新运行资源检查。";
 $("econ-evidence-questions").textContent="修改后需要重新生成核实问题。";
 msg("条件已变化，请重新测算。","warning");
}
function show(out){
 const host=$("econ-metrics");host.replaceChildren();
 for(const [key,label,unit] of mapping){
  const x=out.metrics[key],card=make("article","econ-result");
  card.append(make("span","",label));
  card.append(make("strong","",x.provided?fmt(x.p50,unit)+" "+unit:"待填"));
  card.append(make("small","",x.provided?"区间抽样 P10 "+fmt(x.p10,unit)+" · P90 "+fmt(x.p90,unit):
   "缺少必要的上下界，未计算"));
  host.append(card);
 }
 const r=$("econ-resource-check");r.replaceChildren();
 r.append(make("h3","",out.resources.status==="over-capacity"?"部分需求超过给定容量":
  out.resources.status==="within-provided-capacity"?"输入的中位条件未超容量":"承载条件不足以判断"));
 for(const x of out.resources.checks){
  const line=make("div","econ-resource-line");line.dataset.status=x.status;
  line.append(make("strong","",x.label),make("span","",x.need===null?"需求未提供":"需求："+fmt(x.need,x.unit)+" "+x.unit),
   make("span","",x.capacity===null?"容量未提供":"容量："+fmt(x.capacity,x.unit)),
   make("span","",x.status==="exceeded"?"超过容量":x.status==="within"?"未超输入容量":"待核实"));r.append(line);
 }
 if(out.highStress.status==="over-capacity")r.append(make("p","econ-flag","在上界假设下存在容量压力。该比较不代表许可或实际供给结论。"));
 const questions=$("econ-evidence-questions");questions.replaceChildren();
 questions.append(make("h3","","最值得继续核实的问题"));
 const ul=make("ul");(out.questions.length?out.questions:["资料不完整不代表已经核验。"]).forEach(q=>ul.append(make("li","",q)));questions.append(ul);
 out.warnings.slice(0,6).forEach(w=>questions.append(make("p","econ-warning",w)));
 msg("完成假设敏感性测算。"+(out.missing.length?"有 "+out.missing.length+" 项指标未提供，不会虚构对应数字。":"输入完整，但并非现实预测。"),"success");
}
function run(){
 if(!$("econ-assumption-confirm").checked){msg("请先勾选确认：这是条件性假设，不是企业真实承诺。","warning");return;}
 if(!$("company-name").value.trim()){msg("请先输入企业名称，确定研究对象。","warning");return;}
 const x=E.run(raw());if(!x.ok){msg(x.errors.join("；"),"warning");return;}
 latest=x;$("econ-save").disabled=false;$("econ-export").disabled=false;show(x);
}
function compare(){
 const h=$("econ-compare-cards");h.replaceChildren();
 if(!stored.length){h.append(make("p","","请运行后点击保存，最多对比两个输入方案。"));return;}
 const table=make("div","econ-compare-grid");
 stored.forEach((item,i)=>{
  const c=make("article","econ-compare-card");
  c.append(make("span","",i===0?"方案 A":"方案 B"),make("strong","",item.assumptions.company+" · "+item.kindLabel));
  for(const [key,label,unit]of mapping.slice(0,3)){
   const m=item.metrics[key];c.append(make("p","",label+"："+(m.provided?fmt(m.p50,unit)+" "+unit:"输入缺失，不能比较")));
  }
  c.append(make("p","",item.resources.status==="over-capacity"?"资源压力：超过假设容量":item.resources.status==="incomplete"?"资源容量待核查":"未超过假设容量"));
  table.append(c);
 });h.append(table);
 if(stored.length===2){
  const a=stored[0].metrics.netAdditionalPurchasing,b=stored[1].metrics.netAdditionalPurchasing;
  h.append(make("p","econ-compare-note",a.provided&&b.provided?
   "B 相对 A 的本地采购净增量中位数差："+fmt(b.p50-a.p50,"亿元")+" 亿元/年。仅为同口径假设比较，不是招商排名。":
   "缺少可比的本地采购数据，不进行优劣排序。"));
 }
}
$("econ-run").addEventListener("click",run);
$("econ-save").addEventListener("click",()=>{
 if(!latest)return;if(stored.length===2)stored.shift();
 stored.push(JSON.parse(JSON.stringify(latest)));compare();msg("已保存当前条件性方案用于本页对比，不上传服务器。","success");
});
$("econ-clear-comparison").addEventListener("click",()=>{stored=[];compare();});
$("econ-export").addEventListener("click",()=>{
 if(!latest)return;
 const payload={schema:"zk-v318-research-v1",createdAt:new Date().toISOString(),result:latest,comparisons:stored,
  companyEvidence:window.ZKCompanyResearchUI?.snapshot?.()||null,
  warning:"Assumption-based accounting, not verified GDP, employment, investment or policy impact."};
 const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;a.download="zhongkai-economic-v318-"+Date.now()+".json";
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$("economic-lab").addEventListener("input",e=>{if(e.target.matches("input"))stale();});
for(const id of ["company-name","company-scenario","source","project-proof","seed"]){
 $(id).addEventListener("input",()=>{stale();context();});
 $(id).addEventListener("change",()=>{stale();context();});
}
$("open-validation-roster").addEventListener("click",async()=>{
 const host=$("real-roster-results"),button=$("open-validation-roster");
 if(rosterOpen){rosterOpen=false;button.textContent="展开证据台账";host.replaceChildren();return;}
 button.disabled=true;host.textContent="读取资料来源……";
 try{
  const res=await fetch("data/enterprise-validation-20.json",{cache:"no-store"});
  if(!res.ok)throw Error("HTTP "+res.status);
  const data=await res.json();
  if(data.schema!=="zk-enterprise-public-evidence-v1"||data.items?.length!==20)throw Error("台账格式无效");
  host.replaceChildren(make("p","real-roster-summary","20家企业有公开名称线索；工商状态、项目投资兑现、实际供应链均尚未全面核实。"));
  const list=make("div","real-roster-list");
  data.items.forEach((v,i)=>{
   const card=make("article","real-roster-entry"),a=make("a","","查阅公开来源 ↗");
   a.href=v.source.url;a.target="_blank";a.rel="noopener noreferrer";
   card.append(make("span","",String(i+1).padStart(2,"0")),make("strong","",v.name),
    make("span","",v.officialDistrict),make("p","",v.source.fact+" · "+v.source.publisher),a,
    make("small","",v.note));
   list.append(card);
  });host.append(list);button.textContent="收起证据台账";rosterOpen=true;
 }catch(e){host.replaceChildren(make("p","","暂时不能读取台账："+e.message));}
 finally{button.disabled=false;}
});
context();compare();
})();