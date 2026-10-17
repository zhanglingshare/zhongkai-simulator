/* V3.21 in-place trust lab. Sources are only public-document claims.
   All user evidence and scenario parameters remain local until explicit JSON download. */
(function(){"use strict";
const $=id=>document.getElementById(id),P=window.ZKPilotClosure,E=window.ZKEconomicInflow;
if(!P||!E||!$("pilot-lab"))return;
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
// Friendly on-screen labels for the five existing source classifications.
const categoryName=Object.freeze({
 "expansion-project-application":"产能扩建 · 环评受理",
 "partial-construction-completion-filing":"厂房设施 · 部分竣工备案",
 "government-award-allocation":"工业设计中心 · 奖励安排",
 "company-site-self-report":"企业官网 · 地址线索",
 "government-soe-profile":"国有平台 · 官方介绍"
});
const categoryLabel=k=>categoryName[k]||"公开资料类别待核对";
const fmt=(v,unit)=>v===null||v===undefined||!Number.isFinite(v)?"未知":v.toLocaleString("zh-CN",{maximumFractionDigits:unit==="人"?0:3});
const economicKeys=Object.keys(E.RANGES),capacityKeys=Object.keys(E.CAPACITIES);
let registry=null,base=null,item=null,latest=null,diff=null;
const sessions=new Map();
function session(){if(!sessions.has(item.id))sessions.set(item.id,{manual:[],events:[]});return sessions.get(item.id);}
function stamp(){return new Date().toISOString();}
function journal(action,subject,note){session().events.push({when:stamp(),action,subject,note});}
function note(message,kind=""){$("pilot-status").textContent=message;$("pilot-status").dataset.kind=kind;}
function appendLink(container,txt,href){
 if(!P.url(href))return;
 const a=el("a","",txt);a.href=href;a.target="_blank";a.rel="noopener noreferrer";container.append(a);
}
function sourcePanel(){
 const host=$("pilot-source");host.replaceChildren();
 host.append(el("h3","",item.name),el("p","pilot-category",item.district+" · "+categoryLabel(item.category)),
  el("p","pilot-alert","本案例来自公开来源，但不是完整工商尽调："+item.watch));
 item.source.forEach(s=>{
  const div=el("article","pilot-source-card");
  div.append(el("strong","",s.publisher),
   el("small","","原始材料日期："+(s.publishedAt||"未在页面标注")+" · 资料访问复核："+s.retrievedAt),
   el("p","",s.evidenceText));appendLink(div,"查看来源原文 ↗",s.url);
  div.append(el("small","pilot-supported","仅支持："+s.support),
    el("small","pilot-not-supported","不能证明："+s.excludes));
  host.append(div);
 });
}
function fieldPanel(){
 const r=P.reviewCase(item,session().manual),root=$("pilot-fields");root.replaceChildren();
 for(const [key,desc]of Object.entries(P.FIELDS)){
  if(["recognition","soebasis"].includes(key)&&!(item.claims||[]).some(c=>c.field===key))continue;
  const claims=r.claims.filter(c=>c.field===key&&c.status!=="rejected"),
        card=el("div","pilot-field");card.dataset.status=claims.length?"indexed":"missing";
  card.append(el("strong","",desc.label),
   el("span","",claims.length?"有材料声称 · 非认证":"待核实"),
   el("small","",claims.length?claims.map(c=>c.value).join("；"):desc.proof));
  root.append(card);
 }
}
function questions(){
 const r=P.reviewCase(item,session().manual),host=$("pilot-issues");host.replaceChildren();
 host.append(el("p","pilot-mini-kpi","原始文件所列事实 "+r.indexed+" 项 · 新增待复核记录 "+r.userAdded+" 项 · 可能存在口径差异 "+r.conflicts.length+" 组 · 仍缺 "+r.missing.length+" 个必要字段"));
 if(r.conflicts.length)r.conflicts.forEach(c=>{
  const node=el("article","pilot-conflict");
  node.append(el("strong","","可能存在来源差异："+c.label),el("p","",c.note));
  c.claims.forEach(x=>node.append(el("small","",x.value+"（"+x.status+"）")));
  host.append(node);
 });
 const ol=el("ol","pilot-question-list");
 r.questions.forEach(q=>ol.append(el("li","",q)));host.append(ol);
 host.append(el("small","pilot-not-supported",r.warning));
 const manual=$("pilot-manual");manual.replaceChildren();
 session().manual.forEach((rec,i)=>{
  const card=el("article","pilot-added");
  card.append(el("strong","",P.FIELDS[rec.field]?.label||rec.field),el("p","",rec.value),
   el("small","","人工输入："+rec.reviewer+" · 当前状态："+rec.state+"（不等于第三方已证实）"));
  appendLink(card,"查看提交材料 ↗",rec.sourceUrl);
  if(rec.state!=="rejected"){
   const btn=el("button","","标记为人工已查看"),rej=el("button","","判定资料不适用");
   btn.type="button";rej.type="button";
   btn.disabled=rec.state==="human-reviewed-unverified";
   btn.addEventListener("click",()=>{rec.state="human-reviewed-unverified";journal("review-user-claim",rec.field,"人工已查看，不能由此推断真实工商状态");invalidate();renderCase();});
   rej.addEventListener("click",()=>{rec.state="rejected";journal("reject-user-claim",rec.field,"资料不适用，保留在审计日志中");invalidate();renderCase();});
   const controls=el("div","pilot-review-buttons");controls.append(btn,rej);card.append(controls);
  }
  manual.append(card);
 });
}
function renderCase(){
 if(!item)return;
 sourcePanel();fieldPanel();questions();
}
function buildFields(){
 const host=$("pilot-assumption-fields");host.replaceChildren();
 for(const [key,info]of Object.entries(E.RANGES)){
  const cell=el("div","pilot-assumption");
  cell.append(el("strong","",info.label),el("small","",info.unit));
  const bounds=el("div","pilot-pair");
  for(const side of ["low","high"]){
   const i=el("input","pilot-control");i.type="number";i.min="0";i.step="any";
   i.id="pilot-"+key+"-"+side;i.placeholder=side==="low"?"假设下界":"假设上界";
   i.setAttribute("aria-label",info.label+(side==="low"?"下界":"上界"));bounds.append(i);
  }
  cell.append(bounds);host.append(cell);
 }
 for(const key of capacityKeys){
  const cell=el("label","pilot-assumption");
  cell.append(el("strong","",E.CAPACITIES[key]),el("small","","可用容量 · "+E.RANGES[key].unit));
  const i=el("input","pilot-control");i.type="number";i.min="0";i.step="any";i.id="pilot-cap-"+key;
  i.placeholder="未核实则留空";cell.append(i);host.append(cell);
 }
}
function rawAssumptions(){
 const inputs={},capacities={};
 for(const key of economicKeys)inputs[key]={low:$("pilot-"+key+"-low").value,high:$("pilot-"+key+"-high").value};
 for(const key of capacityKeys)capacities[key]=$("pilot-cap-"+key).value;
 return {confirmed:$("pilot-confirm").checked,reviewer:$("pilot-reviewer").value,reviewNote:$("pilot-review-note").value,
  kind:$("pilot-kind").value,projectProof:$("pilot-proof").value,inputs,capacities};
}
function showStudy(out){
 const host=$("pilot-results");host.replaceChildren();
 const r=out.report,values=[
  ["一次性新增投资",r.economics.metrics.newInvestment,"亿元"],
  ["净本地采购（年）",r.economics.metrics.netAdditionalPurchasing,"亿元/年"],
  ["净新增岗位",r.economics.metrics.netJobs,"人"]
 ];
 const grid=el("div","pilot-measures");
 values.forEach(([name,m,unit])=>{
  const card=el("article","pilot-measure");
  card.append(el("span","",name),
   el("strong","",m.provided?fmt(m.p50,unit)+" "+unit:"未知"),
   el("small","",m.provided?"用户区间敏感性 P10 "+fmt(m.p10,unit)+" ～ P90 "+fmt(m.p90,unit):"缺少必要的用户上下界"));
  grid.append(card);
 });
 host.append(grid,el("p","pilot-alert",r.economics.sensitivity));
 const src=el("div","pilot-study-notes");
 src.append(el("strong","","未解决证据缺口："+r.missingFields.length+" 项；潜在矛盾："+r.potentialConflicts.length+" 组"));
 r.economics.questions.slice(0,4).forEach(q=>src.append(el("p","",q)));
 host.append(src);
}
function invalidate(){
 if(!latest)return;
 latest=null;$("pilot-export").disabled=true;
 $("pilot-results").replaceChildren(el("p","","审核或数值已经改变，原测算作废。请重新运行。"));
 note("输入或审核状态已变化，必须重新测算。","warning");
}
function selectCase(id){
 item=registry.cases.find(c=>c.id===id);if(!item)return;
 latest=null;$("pilot-export").disabled=true;
 $("pilot-kind").value=item.recommendedStudyKind;
 $("pilot-proof").value="";$("pilot-reviewer").value="";$("pilot-review-note").value="";$("pilot-confirm").checked=false;
 for(const i of $("pilot-assumption-fields").querySelectorAll("input"))i.value="";
 $("pilot-results").replaceChildren(el("p","","未进行假设经济测算，不会自动把资料中的注册资本或奖补金额当成投资。"));
 note("请先逐条核对来源、记录人工判断，并明确条件性研究假设。");
 renderCase();
}
function sessionReport(){
 if(!item)return null;
 const r=P.reviewCase(item,session().manual);
 return {schema:"zk-v321-pilot-session-v1",exportedAt:stamp(),caseId:item.id,caseName:item.name,
  pilotSourceSnapshotId:registry.snapshotId,sourceSnapshotDate:registry.capturedAt,
  sourceDocumentLinks:item.source.map(s=>({id:s.id,url:s.url,issuer:s.publisher,claimedDate:s.publishedAt,accessedAt:s.retrievedAt})),
  evidence:r,manualEvidence:session().manual.map(x=>({...x})),eventJournal:session().events.map(x=>({...x})),
  selectedStudyKind:$("pilot-kind").value,reviewer:$("pilot-reviewer").value,
  reviewNote:$("pilot-review-note").value,conditionalStudy:latest?.report||null,sourceDiff:diff,
  independentVerification:false,cryptographicallySealed:false,
  warnings:["仅为本地导出未签名工作记录，不能证明实际采集时间或独立审查","来源材料的表述范围与企业实际工商、投资、就业和合同事实不同","完整原始Sim产业网络实验须使用企业接入工作台，当前只调用V3.18独立经济会计模块"]};
}
function download(value,name){
 const blob=new Blob([JSON.stringify(value,null,2)],{type:"application/json;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=el("a");a.href=url;a.download=name;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function showVersion(){
 const host=$("pilot-version");host.replaceChildren();
 host.append(el("strong","","当前来源版："+registry.snapshotId+" · 记录日期 "+registry.capturedAt));
 appendLink(host,"查看 Git 快照 ↗","https://github.com/zhanglingshare/zhongkai-simulator/blob/main/v3/data/snapshots/2026-10-17-pilot-baseline.json");
 if(!base){host.append(el("p","","历史快照无法读取：无法计算版本差异。"));return;}
 diff=P.compareDocuments(base,registry);
 host.append(el("p","",diff.ok?"与初始记录比较："+diff.changedCases+" 家企业来源发生变更":"版本不可比较："+diff.errors.join("；")));
}
function showDiff(){
 const host=$("pilot-changes");host.replaceChildren();
 if(!diff?.ok)return;
 if(!diff.changes.length){host.append(el("p","","与对照版本的来源字段相同。未新增核验事实。"));return;}
 for(const change of diff.changes)host.append(el("p","pilot-diff-row",change.id+" · "+change.text));
 host.append(el("small","pilot-fine",diff.caveat));
}
$("pilot-evidence-form").addEventListener("submit",e=>{
 e.preventDefault();if(!item)return;
 const r=P.newClaim({field:$("pilot-evidence-field").value,value:$("pilot-evidence-value").value,
  sourceUrl:$("pilot-evidence-url").value,documentedAt:$("pilot-evidence-date").value,reviewer:$("pilot-evidence-reviewer").value});
 if(!r.ok){note(r.errors.join("；"),"warning");return;}
 session().manual.push(r.record);journal("add-user-evidence",r.record.field,"来源待复核");
 $("pilot-evidence-value").value="";$("pilot-evidence-url").value="";invalidate();renderCase();
 note("新增材料已记录为待复核；自动检索潜在差异，但不会自动认证其真实性。","success");
});
$("pilot-run").addEventListener("click",()=>{
 if(!item)return;
 const out=P.conditionalStudy(item,rawAssumptions(),P.reviewCase(item,session().manual),E);
 if(!out.ok){note(out.errors.join("；"),"warning");return;}
 latest=out;journal("conditional-economics-run",rawAssumptions().kind,"用户确认假设后的独立增量测算，非真实预测");
 $("pilot-export").disabled=false;showStudy(out);
 note("已运行条件性假设研究，所有未核实信息仍保持未知。","success");
});
$("pilot-export").addEventListener("click",()=>{if(latest)download(sessionReport(),"zhongkai-v321-conditional-research-"+item.id+".json");});
$("pilot-export-review").addEventListener("click",()=>{if(item)download(sessionReport(),"zhongkai-v321-unsealed-evidence-"+item.id+".json");});
$("pilot-case").addEventListener("change",()=>selectCase($("pilot-case").value));
$("pilot-simulation").addEventListener("input",e=>{if(e.target.matches("input,textarea,select"))invalidate();});
$("pilot-simulation").addEventListener("change",()=>invalidate());
$("pilot-compare-file").addEventListener("change",async e=>{
 const file=e.target.files?.[0];if(!file)return;
 $("pilot-changes").replaceChildren(el("p","","正在读取并对照新来源快照…"));
 try{if(file.size>300000)throw Error("超过安全的版本资料大小限制");
  const next=JSON.parse(await file.text());
  diff=P.compareDocuments(registry,next);
  if(!diff.ok)throw Error(diff.errors.join("；"));
  showDiff();
 }catch(err){$("pilot-changes").replaceChildren(el("p","pilot-alert","无法比较来源版本："+err.message));}
 e.target.value="";
});
$("pilot-import-session").addEventListener("change",async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>300000)throw Error("超过工作记录安全大小");
  const doc=JSON.parse(await file.text());
  if(doc.schema!=="zk-v321-pilot-session-v1"||!registry.cases.some(c=>c.id===doc.caseId)||
    !Array.isArray(doc.manualEvidence)||doc.manualEvidence.length>100)throw Error("不是受支持的试点工作记录");
  const manual=doc.manualEvidence.map(x=>{
   const checked=P.newClaim(x);
   if(!checked.ok)throw Error("包含无效证据："+checked.errors.join("；"));
   return {...checked.record,state:["pending-review","human-reviewed-unverified","rejected"].includes(x.state)?x.state:"pending-review"};
  });
  sessions.set(doc.caseId,{manual,events:Array.isArray(doc.eventJournal)?doc.eventJournal.slice(0,300).map(x=>({
   when:String(x.when||"").slice(0,40),action:String(x.action||"").slice(0,100),
   subject:String(x.subject||"").slice(0,100),note:String(x.note||"").slice(0,300)})):[]});
  $("pilot-case").value=doc.caseId;selectCase(doc.caseId);
  journal("import-local-session",doc.caseId,"用户本地导入，未获得外部公证或时间戳");
  note("已恢复本地工作记录；之前的测算不自动恢复，需要重新输入假设再运行。","success");
 }catch(err){note("工作记录导入失败："+err.message,"warning");}
 e.target.value="";
});
async function init(){
 try{
  const paths=["data/pilot-cases-v321.json","data/snapshots/2026-10-17-pilot-baseline.json"];
  const [cur,history]=await Promise.all(paths.map(p=>fetch(p,{cache:"no-store"}).then(r=>{if(!r.ok)throw Error(p+" HTTP "+r.status);return r.json();})));
  const checked=P.validateRegistry(cur);if(!checked.ok)throw Error(checked.errors.join("；"));
  registry=cur;base=P.validateRegistry(history).ok?history:null;
  buildFields();
  const fields=$("pilot-evidence-field");fields.replaceChildren();
  for(const [key,desc]of Object.entries(P.FIELDS)){const o=el("option","",desc.label);o.value=key;fields.append(o);}
  const picker=$("pilot-case");picker.replaceChildren();
  cur.cases.forEach(c=>{const o=el("option","",c.name+" · "+categoryLabel(c.category));o.value=c.id;picker.append(o);});
  selectCase(cur.cases[0].id);showVersion();showDiff();
 }catch(err){
  $("pilot-source").replaceChildren(el("p","pilot-alert","试点证据资料加载失败："+err.message));
  note("不能读取已核实结构的公开来源台账，因此禁止出具研究报告。","warning");
 }
}
init();
})();