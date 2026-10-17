/* V3.14 · Plain-language public lookup. Never claims that Wikidata equals business registry.
   The user explicitly chooses a public candidate and confirms a model hypothesis. */
(function(){
 "use strict";
 const $=id=>document.getElementById(id),Core=window.ZKCompanyResearch,Sim=window.ZKSim;
 if(!Core||!Sim)return;
 const name=$("company-name"),business=$("company-business"),place=$("company-location"),
  website=$("company-website"),type=$("company-type"),seed=$("seed"),results=$("company-search-results"),
  status=$("company-search-status"),summary=$("company-assessment"),links=$("company-links"),
  btn=$("company-search"),ack=$("company-confirm"),form=$("inflow-form");
 let selected=null,searchGeneration=0,manualType=false;
 const make=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=String(text);return el;};
 const update=(el,value)=>{el.value=value;el.dispatchEvent(new Event("input",{bubbles:true}));};
 function setStatus(text,kind=""){status.textContent=text;status.dataset.kind=kind;}
 function explain(){
  const input=business.value.trim(),res=Core.classify(input);
  summary.replaceChildren();
  const h=make("strong","",res.type?"初步判断："+Core.TYPE_LABELS[res.type]:"暂时无法自动判断行业");
  const p=make("p","",res.reason+"。你可以直接修改“产业链里更像哪种企业”。");
  summary.append(h,p);
  if(res.type&&!manualType&&type.value!==res.type){
   update(type,res.type); // only a hint, user may override immediately
  }
  drawLinks();
 }
 function drawLinks(){
  links.replaceChildren();
  const n=Number(seed.value),hints=Core.hints(Sim,n,type.value);
  if(!hints.length){links.append(make("p","","当前无法生成可核实的候选对象，请检查实验编号。"));return;}
  hints.forEach(x=>{
   const button=make("button","suggestion","");
   button.type="button";
   button.append(make("strong","",x.name),make("span","","仅模型可能相关 · 点选后仍须确认"));
   button.title=x.reason;
   button.addEventListener("click",()=>{
    const fields=[$("link-one"),$("link-two"),$("link-three")];
    const already=fields.find(f=>f.value===x.name);
    if(already){setStatus("已在下方选中「"+x.name+"」。这只是需要核实的联系假设。");return;}
    const free=fields.find(f=>!f.value);
    if(!free){setStatus("最多选择三个联系对象，可先在下方下拉框中删除一个。");return;}
    update(free,x.name);
    setStatus("已将「"+x.name+"」加入待确认的模型联系，不代表真实合作。");
   });
   links.append(button);
  });
 }
 function picked(entry){
  const el=make("article","candidate-card");
  const head=make("div","candidate-head");
  head.append(make("strong","",entry.name||"未命名条目"),make("span","",entry.id));
  el.append(head,make("p","",entry.description||"暂无业务描述"));
  const actions=make("div","candidate-actions");
  const choose=make("button","select-candidate","用这一条填写");
  choose.type="button";
  choose.addEventListener("click",()=>select(entry));
  const ref=make("a","", "查看知识库原文 ↗");
  ref.href=entry.url;ref.target="_blank";ref.rel="noopener noreferrer";
  actions.append(choose,ref);el.append(actions);
  return el;
 }
 async function select(entry){
  const generation=++searchGeneration;
  results.replaceChildren();setStatus("正在读取选中条目的公开资料……","pending");
  try{
   const d=await Core.details(entry.id);
   if(generation!==searchGeneration)return;
   update(name,d.name||entry.name);
   update(business,d.business||entry.description);
   if(d.location)update(place,d.location);
   if(d.website)update(website,d.website);
   update($("source"),d.source);
   // A public knowledge-base item is NOT proof of a supply contract.
   update($("evidence"),"unverified");
   selected={id:d.id,source:d.source,origin:d.origin,provenance:d.provenance,
     originallyReturnedName:d.name,originallyReturnedDescription:d.business};
   manualType=false;
   explain();
   setStatus("已填入公开知识库条目 "+d.id+"；请核对名称、业务、地点和网站，必要时修改。", "success");
   const sourceRow=make("p","source-line","资料来自 Wikidata · 非工商认证 · ");
   const a=make("a","","查看来源及可能的错误 ↗");
   a.href=d.source;a.target="_blank";a.rel="noopener noreferrer";sourceRow.append(a);
   results.replaceChildren(sourceRow);
  }catch(e){if(generation===searchGeneration){
   setStatus("读取公开详情失败："+(e?.name==="AbortError"?"网络超时":e.message)+"。可直接手工填写。","warning");
   results.replaceChildren();
  }}
 }
 btn.addEventListener("click",async()=>{
  const q=name.value.trim();
  if(q.length<2){setStatus("请先输入至少两个字的企业名称。","warning");return;}
  const generation=++searchGeneration;
  ack.checked=false;selected=null;
  btn.disabled=true;results.replaceChildren();
  setStatus("正在公开知识库中寻找候选企业……","pending");
  try{
   const items=await Core.search(q);
   if(generation!==searchGeneration)return;
   if(!items.length){
    setStatus("Wikidata 暂未找到候选；不代表企业不存在。请直接填写业务信息，或人工查阅官方资料。","warning");
    return;
   }
   const p=make("p","search-preface","找到 "+items.length+" 条候选，请选正确的一条。名称相似不等于同一家企业。");
   results.append(p,...items.map(picked));
   setStatus("请选择准确的企业条目，系统不会自动把同名对象当作真实企业。","success");
  }catch(e){if(generation===searchGeneration){
   setStatus("在线查找暂不可用："+(e?.name==="AbortError"?"连接超时":e.message)+"。你仍可手工填写。","warning");
  }}finally{if(generation===searchGeneration)btn.disabled=false;}
 });
 name.addEventListener("input",()=>{
  searchGeneration++;selected=null;btn.disabled=false;results.replaceChildren();
  setStatus("名称已改变，之前的查询不再适用。可重新查找或直接输入。");
 });
 business.addEventListener("input",explain);
 type.addEventListener("change",()=>{manualType=true;drawLinks();});
 seed.addEventListener("change",drawLinks);
 form.addEventListener("input",e=>{if(e.target!==ack)ack.checked=false;},true);
 // Capture the selected source and user's edited fields as separate facts in the export.
 window.ZKCompanyResearchUI={
  snapshot:()=>({
   publicCandidate:selected?{...selected}:null,
   userEdited:{name:name.value.trim(),business:business.value.trim(),
    location:place.value.trim(),website:website.value.trim(),type:type.value,
    source: $("source").value.trim()},
   confirmedByUser:!!ack.checked,
   automaticRoleHint:Core.classify(business.value),
   disclaimer:"Wikidata is open public information, not a government registry; model links are hypotheses"
  })
 };
 explain();drawLinks();
})();