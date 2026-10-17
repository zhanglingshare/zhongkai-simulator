/* V3.19 decisions based exclusively on explicit V3.18 ranges and user gates.
   Makes no live enterprise requests. Original Sim and V3.18 accounting untouched. */
(function(){
"use strict";
const $=id=>document.getElementById(id),Core=window.ZKDecisionReversal,E=window.ZKEconomicInflow;
if(!Core||!E||!$("decision-lab"))return;
const keys=Object.keys(Core.RULES);
const statusLabels={"robust-pass":"整个假设区间均满足","robust-fail":"整个假设区间均不满足",
  reversible:"假设范围跨过门槛","unknown":"资料缺失，无法判断"};
const overallLabels={
 "meets-all-specified-thresholds":"所设门槛在全部输入区间内满足",
 "fails-specified-thresholds":"至少一个所设门槛在全部输入区间内不满足",
 "depends-on-assumptions":"判断取决于尚未核实的参数",
 "insufficient-input":"缺少必要参数，不能判断是否满足所有门槛"
};
let latest=null,auditData=null,auditSelected=null,loadInProgress=false;
const el=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;
 if(value!==undefined)n.textContent=String(value);return n;};
const f=(n)=>Number.isFinite(n)?n.toLocaleString("zh-CN",{maximumFractionDigits:3}):"未知";
function assumptions(){
 const inputs={},capacities={};
 for(const k of Object.keys(E.RANGES))inputs[k]={
  low:$("econ-"+k+"-low").value,high:$("econ-"+k+"-high").value};
 for(const k of Object.keys(E.CAPACITIES))capacities[k]=$("econ-cap-"+k).value;
 return {kind:$("company-scenario").value,company:$("company-name").value.trim(),
  seed:Number($("seed").value),
  source:$("project-proof").value.trim()||$("source").value.trim(),
  inputs,capacities};
}
function gates(){return Object.fromEntries(keys.map(k=>[k,$("rev-"+k).value]));}
function setMessage(s,kind=""){$("rev-status").textContent=s;$("rev-status").dataset.kind=kind;}
function render(){
 const overview=$("rev-overview"),grid=$("rev-gates-output"),qs=$("rev-questions");
 overview.replaceChildren();grid.replaceChildren();qs.replaceChildren();
 if(!$("econ-assumption-confirm").checked){
  latest=null;$("rev-export").disabled=true;
  overview.append(el("p","","请先确认上方经济数据是条件性假设，而非企业真实承诺。"));
  setMessage("尚未确认经济假设，暂不分析招商门槛。","warning");return;
 }
 if(!$("company-name").value.trim()){
  latest=null;$("rev-export").disabled=true;
  overview.append(el("p","","请先填写企业名称，保证研究对象明确。"));
  setMessage("尚无企业研究对象。","warning");return;
 }
 let input;try{input=E.clean(assumptions());}catch(e){
  latest=null;$("rev-export").disabled=true;overview.append(el("p","",e.message));
  setMessage("请先修正上方经济假设："+e.message,"warning");return;
 }
 const result=Core.analyze(input,gates());
 if(!result.ok){
  latest=null;$("rev-export").disabled=true;
  overview.append(el("p","",result.errors.join("；")));
  setMessage(result.errors.join("；"),"warning");return;
 }
 latest=result;$("rev-export").disabled=false;
 const card=el("div","rev-summary");
 card.dataset.kind=result.overall;
 card.append(el("strong","",overallLabels[result.overall]));
 card.append(el("p","","比较仅基于你提供的项目假设和门槛。模型不会替代招商主管部门作审批决定。"));
 overview.append(card);
 for(const row of result.rows){
  const c=el("article","rev-criterion");c.dataset.status=row.status;
  const header=el("div","rev-criterion-head");header.append(el("strong","",row.label),
    el("span","",statusLabels[row.status]));c.append(header);
  c.append(el("p","rev-range",row.interval?
    "假设范围 "+f(row.interval.low)+" — "+f(row.interval.high)+" "+row.unit+"；用户门槛 "+f(row.threshold)+" "+row.unit:
    "计算该指标所需的参数尚未填齐；用户门槛 "+f(row.threshold)+" "+row.unit));
  if(row.interval){
   const low=row.interval.low,high=row.interval.high,t=row.threshold;
   const ceiling=Math.max(1,high,t),floor=Math.min(0,low,t),den=ceiling-floor;
   const pLow=100*(low-floor)/den,pHigh=100*(high-floor)/den,pCut=100*(t-floor)/den;
   const rail=el("div","rev-track");rail.setAttribute("role","img");
   rail.setAttribute("aria-label","假设区间 "+f(low)+" 到 "+f(high)+"；判断门槛 "+f(t));
   const span=el("span","rev-span"),cut=el("span","rev-cut");
   span.style.left=Math.max(0,pLow)+"%";span.style.width=Math.max(0,pHigh-pLow)+"%";
   cut.style.left=Math.max(0,Math.min(100,pCut))+"%";rail.append(span,cut);c.append(rail);
  }
  if(row.anchors?.length){
   const desc=el("p","rev-anchors","改变判断的条件点："+row.anchors.map(a=>
    a.name+"约 "+f(a.threshold)+" "+a.unit).join("；")+"。其他输入按各自中点固定的局部反推，不是企业承诺。");
   c.append(desc);
  }
  grid.append(c);
 }
 const priority=el("p","rev-priority-note","下列问题依“区间可能跨门槛 → 缺失重要参数 → 已不满足门槛”的顺序排列，最多三项；不是统计信息价值评分。");
 qs.append(priority);
 result.questions.forEach((q,i)=>{
  const card=el("article","rev-question");
  card.append(el("span","",String(i+1).padStart(2,"0")+" / 优先核实"),
   el("strong","",q.prompt),
   el("p","",q.why),
   el("small","","建议材料："+q.requiredDocument));
  if(q.anchors.length)card.append(el("small","","反转点（局部条件假设）："+
   q.anchors.map(a=>a.name+" ≈ "+f(a.threshold)+" "+a.unit).join("；")));
  qs.append(card);
 });
 setMessage("已按你设置的 "+result.rows.length+" 个门槛即时计算。结论不含真实签约证明、财政收益或政策成功率。","success");
}
function record(){
 if(!latest)return null;
 return {schema:"zk-v319-decision-reversal-v1",createdAt:new Date().toISOString(),analysis:latest,
  rosterAudit:auditSelected,investigation:window.ZKCompanyResearchUI?.snapshot?.()||null,
  caveat:"Only user-set gates and assumed input ranges; not official due diligence, probabilities or policy recommendations."};
}
$("rev-export").addEventListener("click",()=>{
 const payload=record();if(!payload)return;
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=el("a");a.href=url;
 a.download="zhongkai-v319-decision-"+Date.now()+".json";
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$("decision-lab").addEventListener("input",e=>{
 if(e.target.closest(".decision-gates"))render();
});
$("economic-lab").addEventListener("input",render);
$("economic-lab").addEventListener("change",render);
for(const id of ["company-scenario","company-name","seed","source","project-proof"]){
 $(id).addEventListener("input",render);$(id).addEventListener("change",render);
}
function renderAudit(item){
 const host=$("rev-audit-results");host.replaceChildren();
 if(!item){host.append(el("p","","请选择一家企业，查看它的具体证据边界。"));return;}
 auditSelected=item;
 const head=el("div","rev-audit-summary");head.append(el("strong","",item.name),
  el("p","","来源类别："+item.categoryLabel+" · 公开文件所列县区："+item.district));
 const a=el("a","","打开公开记录原文 ↗");a.href=item.source.url;a.target="_blank";a.rel="noopener noreferrer";head.append(a);
 head.append(el("p","","文件日期："+(item.source.documentDate||"原文未标日期")+" · 文件所述："+item.source.fact));
 host.append(head);
 const checks=el("div","rev-audit-checks");
 item.fields.forEach(c=>{
  const row=el("div","rev-audit-row");
  row.append(el("strong","",c.field),el("span","",c.status==="source-indexed"?"来源台账有线索":"尚未核验"),
   el("p","",c.note));row.dataset.status=c.status;checks.append(row);
 });host.append(checks);
 host.append(el("p","rev-audit-note","下一步："+item.nextStep+
  "。原始网页未通过当前版本逐家实时复验，不能将台账标引视为已完成法律主体尽调。"));
}
$("rev-audit-load").addEventListener("click",async()=>{
 const button=$("rev-audit-load"),ctrl=$("rev-audit-controls"),host=$("rev-audit-results");
 if(auditData){auditData=null;auditSelected=null;ctrl.replaceChildren();host.replaceChildren();
  button.textContent="打开逐企业证据核对";return;}
 if(loadInProgress)return;
 loadInProgress=true;button.disabled=true;host.textContent="正在读取已有公开来源台账……";
 try{
  const response=await fetch("data/enterprise-validation-20.json",{cache:"no-store"});
  if(!response.ok)throw Error("HTTP "+response.status);
  const data=Core.auditRoster(await response.json());
  if(!data.ok||data.count!==20)throw Error(data.error||"台账缺少20条真实来源记录");
  auditData=data;ctrl.replaceChildren();
  const label=el("label","","查看企业来源："),select=el("select");
  select.id="rev-audit-select";
  data.items.forEach((entry,i)=>{const opt=el("option","",entry.name);opt.value=String(i);select.append(opt);});
  select.addEventListener("change",()=>renderAudit(data.items[Number(select.value)]));
  label.append(select);ctrl.append(label);
  renderAudit(data.items[0]);button.textContent="收起逐企业证据核对";
 }catch(e){host.replaceChildren(el("p","","台账暂时无法加载："+e.message));}
 finally{button.disabled=false;loadInProgress=false;}
});
render();
})();