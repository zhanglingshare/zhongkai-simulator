/* V3.15 · China-first source search, one sourced Zhongkai case, editable preassessment.
   No external scraping. No Wikidata network requests. No false registry verification. */
(function(){
"use strict";
const $=id=>document.getElementById(id),CN=window.ZKChinaResearch,Base=window.ZKCompanyResearch,Sim=window.ZKSim;
if(!CN||!Base||!Sim)return;
const form=$("inflow-form"),name=$("company-name"),business=$("company-business"),
  place=$("company-location"),website=$("company-website"),source=$("source"),
  type=$("company-type"),seed=$("seed"),links=$("company-links"),results=$("company-search-results"),
  btn=$("company-search"),ack=$("company-confirm"),summary=$("company-assessment"),
  status=$("company-search-status");
let selected=null,manualType=false,origin="manual-input",sourceProvenance="";
const make=(tag,klass,txt)=>{
 const el=document.createElement(tag);if(klass)el.className=klass;
 if(txt!==undefined)el.textContent=String(txt);return el;
};
const update=(field,text)=>{field.value=text;field.dispatchEvent(new Event("input",{bubbles:true}));};
function statusText(msg,kind=""){status.textContent=msg;status.dataset.kind=kind;}
function preJudge(){
 const hint=Base.classify(business.value),head=make("strong","",hint.type?
   "系统初判："+Base.TYPE_LABELS[hint.type]:"业务信息不够，暂不自动判断");
 summary.replaceChildren(head,make("p","",hint.reason+"。这是文字分类建议，不代表工商行业核验或企业规模。可以手动修改。"));
 if(hint.type&&!manualType&&type.value!==hint.type)update(type,hint.type);
 renderSuggestions();
}
function renderSuggestions(){
 links.replaceChildren();
 const hints=Base.hints(Sim,Number(seed.value),type.value);
 if(!hints.length){links.append(make("p","","本次无法产生建议，请核对实验编号"));return;}
 hints.forEach(item=>{
  const b=make("button","suggestion");b.type="button";
  b.append(make("strong","",item.name),make("span","","只是模型候选联系 · 未证明真实合作"));
  b.title=item.reason;
  b.addEventListener("click",()=>{
   const fields=[$("link-one"),$("link-two"),$("link-three")];
   if(fields.some(x=>x.value===item.name)){statusText("这个对象已经列入待核实联系");return;}
   const free=fields.find(x=>!x.value);if(!free){statusText("最多三个联系，请先删除一个");return;}
   update(free,item.name);statusText("已加入「"+item.name+"」，只是本轮模型假设；需要你确认。","warning");
  });
  links.append(b);
 });
}
function clearSelection(){selected=null;origin="manual-input";sourceProvenance="";results.replaceChildren();}
function renderExternalSearch(){
 results.replaceChildren();
 let options;
 try{options=CN.buildLinks(name.value);}catch(e){statusText(e.message,"warning");return;}
 results.append(make("p","search-preface","下面打开国内真实搜索页面。不会自动读取第三方网页；请核对后粘贴业务介绍，或直接修改表单。"));
 options.forEach(o=>{
  const row=make("div","china-search-link");
  const a=make("a","",o.label+" ↗");
  a.href=o.url;a.rel="noopener noreferrer";a.target="_blank";
  row.append(a,make("span","",o.directSearch?"点击直接搜索":"进入官网后搜索（企业名："+o.query+"）"));
  results.append(row);
 });
 statusText("已准备国内检索入口；选择链接打开第三方网站核实。本站没有调用需授权的企查查／天眼查接口。","success");
}
btn.addEventListener("click",()=>{ack.checked=false;clearSelection();renderExternalSearch();});
$("extract-company-excerpt").addEventListener("click",()=>{
 const r=CN.analyzeExcerpt($("company-excerpt").value);
 if(!r.ok){statusText(r.message,"warning");return;}
 update(business,r.business);if(r.location)update(place,r.location);
 selected=null;origin="user-pasted-excerpt";sourceProvenance="用户粘贴的公开资料（真实性未自动核验）";
 statusText("已提取文字。请核对并可修改业务介绍、所在地、官网和来源链接。","success");
 preJudge();
});
$("load-zhongkai-case").addEventListener("click",()=>{
 const c=CN.getCase();
 clearSelection();results.replaceChildren();
 // Sets real, sourced fields. Does NOT imply a new actual business registration.
 update(name,c.name);update(business,c.business);update(place,c.location);
 update(website,c.website);update(source,c.source);update($("notes"),c.note);
 update($("company-weight"),String(c.weight));
 update($("evidence"),"unverified");update(type,c.type);
 $("company-excerpt").value="";
 manualType=false;selected={
   id:c.candidateId,name:c.name,origin:"惠州市工信局公开材料与博实结官网",
   source:c.source,additionalSource:c.additionalSource,kind:c.kind,verifiedFacts:c.verifiedFacts,
   disclaimer:c.caveat
 };
 origin=c.kind;sourceProvenance="本地内置演示材料（来源链接供独立核查）";
 preJudge();
 const note=make("p","case-confirmation","这是真实、已在仲恺经营的企业。实验只演示把其作为「模型新增主体」加入已有简化网络，并不意味着它现实中新落地。");
 const gov=make("a","","惠州市工信局资料 ↗");gov.href=c.source;gov.target="_blank";gov.rel="noopener noreferrer";
 const home=make("a","","博实结官网 ↗");home.href=c.additionalSource;home.target="_blank";home.rel="noopener noreferrer";
 results.append(note,gov,home);
 const fields=[$("link-one"),$("link-two"),$("link-three")];
 fields.forEach(f=>{if(f.value)update(f,"");});
 ack.checked=false;
 statusText("已载入仲恺「博实结」真实企业案例。还需自己选一条假设联系并勾选确认，然后可以运行模型。","success");
});
name.addEventListener("input",()=>{
 clearSelection();
 if(name.value.trim())statusText("企业名称已修改：可查国内来源，或输入公开资料后进行判断。");
});
business.addEventListener("input",preJudge);
type.addEventListener("change",()=>{manualType=true;renderSuggestions();});
seed.addEventListener("change",renderSuggestions);
form.addEventListener("input",e=>{if(e.target!==ack)ack.checked=false;},true);
window.ZKCompanyResearchUI={
 snapshot:()=>({
  publicCandidate:selected?{...selected}:null,
  userEdited:{name:name.value.trim(),business:business.value.trim(),location:place.value.trim(),
   website:website.value.trim(),type:type.value,source:source.value.trim()},
  confirmedByUser:ack.checked,automaticRoleHint:Base.classify(business.value),
  sourceMode:origin,sourceProvenance,
  disclaimer:"China search links require manual source review; only licensed APIs can auto-fill live registration data. Existing Zhongkai case is a model-inflow example, not a newly entering local business."
 })
};
preJudge();
})();