/* V3.16 source-bound auto-fill, conflict prompts and pre-run scenario guard.
   Only same-origin curated source index is fetched. No undisclosed external requests. */
(function(){
 "use strict";
 const $=id=>document.getElementById(id),D=window.ZKCompanyDossier,CN=window.ZKChinaResearch;
 if(!D||!CN)return;
 const form=$("inflow-form"),company=$("company-name"),scenario=$("company-scenario"),
   hits=$("company-dossier-hits"),status=$("company-dossier-status"),sources=$("company-source-evidence"),
   reality=$("company-reality"),gate=$("company-scenario-gate"),ack=$("company-confirm");
 let index=null,selected=null,request=0;
 const el=(tag,cls,content)=>{const n=document.createElement(tag);if(cls)n.className=cls;
   if(content!==undefined)n.textContent=String(content);return n;};
 const send=(node,value)=>{node.value=value;node.dispatchEvent(new Event("input",{bubbles:true}));};
 function selection(){return selected?{id:selected.id,name:selected.name,area:selected.area,
  presence:selected.presence,sources:selected.sources.map(s=>({...s})),indexDate:index?.refreshed_at}:null;}
 function facts(){
  sources.replaceChildren();
  if(!selected){sources.textContent="尚未命中经过来源整理的公开资料。不能据此认定企业不存在。";return;}
  sources.append(el("p","",("来源索引整理日期："+index.refreshed_at+" · 已整理公开资料，非实时工商查询")));
  selected.sources.forEach(s=>{
   const item=el("div","source-item"),head=el("strong","",s.publisher+" · "+({location:"地点",business:"业务",name:"名称"}[s.field]||"资料"));
   const a=el("a","","核对原文 ↗");a.href=s.url;a.target="_blank";a.rel="noopener noreferrer";
   item.append(head,el("p","",s.assertion),a);sources.append(item);
  });
 }
 function state(){
  const j=D.prejudge(selected);
  reality.replaceChildren(el("strong","",j.label),el("p","",j.explanation));
  if(j.flags.length)reality.append(el("p","reality-flags",j.flags.join("；")));
  const verdict=D.evaluate(selected,scenario.value,fields());
  gate.replaceChildren(el("strong","",verdict.ok?"可进行条件性模型研究":"该情景不能按“新增主体”运行"),
   el("p","",verdict.reason));
  if(verdict.warning.length)gate.append(el("p","gate-warnings",verdict.warning.join("；")));
  gate.dataset.allowed=verdict.ok?"yes":"no";
  if(!verdict.ok)gate.dataset.kind="warning";else gate.dataset.kind="normal";
  return verdict;
 }
 function fields(){return {name:company.value.trim(),location:$("company-location").value.trim(),
   website:$("company-website").value.trim(),projectEvidence:$("project-proof").value.trim()};}
 async function load(){
  if(index)return index;
  const result=await D.fetchIndex((url,opt)=>fetch(url,opt));
  index=result;return result;
 }
 function pick(record,fill=true){
  if(fill){
   // Explicit user choice allows replacing a form. Existing V3.15 change listeners
   // invalidate old simulation and previous, possibly unrelated search results.
   send(company,record.name);
   send($("company-business"),record.business);
   send($("company-location"),record.location);
   send($("company-website"),record.website||"");
   send($("source"),record.sources[0].url);
   send($("evidence"),"unverified");
   if(record.role_hint)send($("company-type"),record.role_hint);
  }
  selected=record;
  scenario.value=D.prejudge(record).recommended;
  scenario.dispatchEvent(new Event("input",{bubbles:true}));
  facts();state();ack.checked=false;
  hits.replaceChildren(el("p","source-success","已载入已整理的国内公开资料。检查每条出处，并确认研究情景。"));
  status.textContent="匹配到名称为「"+record.name+"」的国内公开资料记录（索引："+index.refreshed_at+"）。信息有时效限制，仍可修改。";
  status.dataset.kind="success";
 }
 async function search(){
  const term=company.value.trim();const marker=++request;
  selected=null;facts();ack.checked=false;hits.replaceChildren();
  status.textContent="正在自动查询本站已核对的中国公开资料索引……";status.dataset.kind="pending";
  try{
   const idx=await load();if(marker!==request)return;
   const found=D.lookup(idx,term);
   if(!found.ok){status.textContent=found.message;status.dataset.kind="warning";state();return;}
   if(!found.matches.length){
    status.textContent="索引中未发现「"+term+"」。当前仅覆盖 "+idx.records.length+" 家整理过的企业，不能自动查询全国工商库；请用下面的中国平台入口核对。";
    status.dataset.kind="warning";state();return;
   }
   status.textContent="找到 "+found.matches.length+" 条名称匹配的国内资料，请确认是哪一家。";status.dataset.kind="success";
   found.matches.forEach(record=>{
    const card=el("article","candidate-card"),
      summary=el("p","",record.business+" · "+record.location),
      choose=el("button","select-dossier","确认这家企业并填入资料");
    choose.type="button";choose.addEventListener("click",()=>pick(record));
    card.append(el("strong","",record.name),summary,
      el("p","",record.sources.map(s=>s.publisher).join(" / ")),choose);hits.append(card);
   });
   state();
  }catch(e){if(marker!==request)return;status.textContent="公开资料索引读取失败："+e.message+"。仍可使用下面的中国平台链接手工核实。";
   status.dataset.kind="warning";state();}
 }
 $("company-auto-dossier").addEventListener("click",search);
 $("load-zhongkai-case").addEventListener("click",async()=>{
  const marker=++request;
  try{
   const data=await load();if(marker!==request)return;
   const found=D.lookup(data,"惠州市博实结科技有限公司").matches[0];
   if(found)pick(found,false);
  }catch(e){status.textContent="案例已填入，但资料索引不能加载："+e.message;state();}
 });
 company.addEventListener("input",()=>{
  ++request;selected=null;facts();state();
  if(company.value.trim())status.textContent="名称已改动；点击“自动查找并预判断”可重新匹配国内来源。";
 });
 scenario.addEventListener("change",()=>{ack.checked=false;state();});
 $("project-proof").addEventListener("input",()=>{ack.checked=false;state();});
 ["company-location","company-website"].forEach(id=>$(id).addEventListener("input",state));
 $("company-business").addEventListener("input",state);
 form.addEventListener("submit",e=>{
  const verdict=state();
  if(verdict.ok)return;
  e.preventDefault();e.stopImmediatePropagation();
  $("form-message").textContent=verdict.reason+"。请核对情景后再运行。";
  $("form-message").className="form-message error";
 },true);
 const prev=window.ZKCompanyResearchUI?.snapshot;
 if(typeof prev==="function"){
  window.ZKCompanyResearchUI.snapshot=()=>{
   const original=prev();
   const check=D.evaluate(selected,scenario.value,fields());
   return {...original,sourceDossier:selection(),scenarioDecision:{
    selected:scenario.value,title:D.SCENARIOS[scenario.value]?.name||"未知",
    systemJudgement:D.prejudge(selected),validation:check,projectEvidence:fields().projectEvidence,
    disclaimer:"Source-index match is not nationwide live enterprise lookup. Model backfill is not local investment growth."
   }};
  };
 }
 // Inform users at the output screen whether this is a model backfill or hypothetical new actor.
 const note=$("scenario-result-note");
 form.addEventListener("submit",()=>{
  const verdict=state();
  if(verdict.ok&&note)note.textContent=verdict.reason+" · 研究仅比较模拟节点网络，不能据此推算真实投资或就业收益。";
 });
 facts();state();
})();