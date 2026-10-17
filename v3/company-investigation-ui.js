/* V3.17: reviewed enterprise investigation, same-origin index + optional licensed provider.
   All external lookup needs user's explicit consent and operator API configuration. */
(function(){
"use strict";
const $=id=>document.getElementById(id),E=window.ZKInvestigation,D=window.ZKCompanyDossier;
if(!E||!D)return;
const company=$("company-name"),start=$("investigate-company"),reportHost=$("investigation-report"),
apply=$("investigation-apply"),status=$("investigation-status"),consent=$("investigation-online-consent");
const config=window.ZKInvestigationConfig||{apiUrl:"",providerLabel:"未配置"};
let result=null,edited={},chosenRecord=null,run=0,activeQuery="",acceptedSnapshot=null,lastAccepted=null,applying=false;
const diagnostics=[];const note=(tag,details)=>{diagnostics.push({tag,details,run,haveLast:!!lastAccepted});if(diagnostics.length>16)diagnostics.shift();};
const make=(tag,css,t)=>{const node=document.createElement(tag);if(css)node.className=css;
 if(t!==undefined)node.textContent=String(t);return node;};
const statusText=(s,kind="")=>{status.textContent=s;status.dataset.kind=kind;};
function configuredUrl(){
 try{const u=new URL(String(config.apiUrl||""));if(u.protocol!=="https:"||
    !u.pathname.endsWith("/api/company-investigate")||u.username||u.password)return "";
  return u.href;}catch{return "";}
}
function sourceLink(s){
 const a=make("a","","查看原始来源 ↗");a.href=s.url;a.target="_blank";a.rel="noopener noreferrer";return a;
}
function render(){
 reportHost.replaceChildren();apply.disabled=!result?.ok||!result.documents;
 if(!result?.ok){reportHost.append(make("p","",result?.reason||"请输入企业名称，调查后会显示有出处的企业资料。"));return;}
 const overview=make("div","investigation-overview");
 overview.append(make("strong","",result.documents+" 条适用来源记录 · "+
   (result.conflicts.length?"有 "+result.conflicts.length+" 项资料冲突":"未发现明确相互冲突字段")),
   make("p","",result.registrationCoverage),make("p","",result.coverage));
 reportHost.append(overview);
 for(const key of E.KEYS){
  const entry=result.fields[key],section=make("div","investigation-field");
  const head=make("div","investigation-field-head");
  const label=make("strong","",entry.label);
  const stat=make("span","investigation-claim-status",{
   missing:"缺少证据",conflict:"来源冲突",single_source:"仅一独立来源",corroborated:"多个独立来源一致"}[entry.status]);
  stat.dataset.kind=entry.status;head.append(label,stat);
  const input=document.createElement(key==="business"?"textarea":"input");
  input.className="investigation-edit";
  input.id="investigation-edit-"+key;
  if(key==="business"){input.rows=2;input.maxLength=600;}else{input.type="text";input.maxLength=180;}
  input.value=Object.hasOwn(edited,key)?edited[key]:entry.recommended;
  input.placeholder="尚无可信结果，可根据公开资料核对并填写";
  input.setAttribute("aria-label",entry.label+"，用户可修改");
  input.addEventListener("input",()=>{edited[key]=input.value;acceptedSnapshot=null;});
  section.append(head,input);
  if(entry.status==="conflict")section.append(make("p","investigation-warning",
    "以下信息不一致，系统未替你选择。核实后可以手动填写。"));
  if(entry.alternatives.length){
   const claims=make("div","investigation-sources");
   entry.alternatives.forEach(group=>{
    const line=make("div","investigation-claim");
    line.append(make("p","",group.value));
    const badges=make("div","investigation-claim-badges");
    badges.append(make("span","",group.independentSources+" 组独立来源"));
    group.sources.forEach(s=>{
     const source=make("div","investigation-proof");
     source.append(make("span","",s.publisher+" · "+(s.checkedAt||"日期未知")),
       sourceLink(s));badges.append(source);
    });
    line.append(badges);claims.append(line);
   });
   section.append(claims);
  }
  reportHost.append(section);
 }
 const questions=make("div","investigation-next");
 questions.append(make("strong","","还需要核实哪些问题？"));
 const ul=make("ul");
 result.questions.forEach(q=>ul.append(make("li","",q)));
 questions.append(ul);reportHost.append(questions);
}
async function investigate(){
 const q=company.value.trim();activeQuery=q;const marker=++run;note("investigate-start",q);apply.disabled=true;edited={};acceptedSnapshot=null;lastAccepted=null;
 if(q.length<2){result={ok:false,reason:"请至少输入两个字的企业名称"};render();statusText(result.reason,"warning");return;}
 start.disabled=true;statusText("正在检查国内公开证据及授权接口状态……","pending");
 let docs=[],providerState="";
 try{
  const idx=await window.ZKCompanyDossierUI.getIndex();
  if(marker!==run)return;
  const match=D.lookup(idx,q);
  // Only exact full name or a curated alias; never guess company identity by partial substring.
  chosenRecord=match.matches.length===1?match.matches[0]:null;
  if(chosenRecord)docs=E.fromIndex({...chosenRecord,refreshed_at:idx.refreshed_at});
  if(match.matches.length>1)providerState="同名候选超过一家：需先核对主体，未自动选择。";
 }catch(e){providerState="本站公开样本索引不可用："+e.message+"。";}
 const endpoint=configuredUrl();
 if(consent.checked&&endpoint&&marker===run){
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),11000);
  try{
   const response=await fetch(endpoint,{method:"POST",mode:"cors",credentials:"include",
    headers:{"content-type":"application/json"},body:JSON.stringify({name:q,consent:true}),
    signal:abort.signal,cache:"no-store"});
   if(!response.ok)throw new Error("授权接口暂不可用（HTTP "+response.status+"）");
   const obj=await response.json();
   if(obj?.ok&&Array.isArray(obj.documents)){
    docs=docs.concat(obj.documents.slice(0,6));providerState+=(providerState?" ":"")+
      (obj.documents.length?"收到授权企业数据接口的候选线索，待交叉核实。":"服务商没有返回精确同名主体。");
   }else providerState+=" 授权接口没有返回有效记录。";
  }catch(e){providerState+=(providerState?" ":"")+"授权查询失败："+e.message+"。已保留本地来源，不虚构数据。";}
  finally{clearTimeout(timer);}
 }else if(consent.checked&&!endpoint){providerState+=" 尚未配置授权国内数据接口，本次仅检查已整理的国内公开资料。";}
 else if(endpoint&&!consent.checked){providerState+=" 未同意联网查询，本次不会向第三方提交企业名称。";}
 else{providerState+=" 国内授权数据服务尚未启用，当前只能查询已整理的公开资料。";}
 if(marker!==run)return;
 result=E.analyze(q,docs,{coverage:"公开资料样本 + 本次经授权查询（如有）；不代表全国所有企业已覆盖"});
 render();
 const level=result.documents?"已形成可修改调查记录":"未获得与名称匹配的公开记录";
 statusText(level+"。"+providerState+" "+
  (result.conflicts.length?"发现来源不一致，请核实冲突。":"无匹配证据的字段均保持空白。"),result.documents?"success":"warning");
 start.disabled=false;
}
start.addEventListener("click",()=>{investigate().catch(err=>{
 statusText("调查未完成："+err.message+"。可改用下方国内搜索入口手工核查。","warning");start.disabled=false;});});
apply.addEventListener("click",()=>{
 note("apply-start",result?.query);
 if(!result?.ok||!window.ZKCompanyDossierUI)return;
 // Take values from the live editable controls at approval time. Other legacy
 // form listeners may have invalidated the cached edits while focus changed.
 const submitted=Object.fromEntries(E.KEYS.map(k=>[k,$("investigation-edit-"+k)?.value??""]));
 const approved=E.accepted(result,submitted);
 if(!approved){statusText("尚无可采纳的调查结果","warning");return;}
 // Evidence-rich result is reviewed by the user, never marked as government-certified.
 if(!approved.record.sources.length){
  statusText("没有可核对的业务或实际经营地点来源，无法当作已审核的企业档案；可使用下方手工表单。","warning");return;
 }
 const reviewedReport=result,reviewedEdits={...submitted};
 applying=true;
 let done=false;try{done=window.ZKCompanyDossierUI.applyReviewed(approved.record);}finally{applying=false;}
 // Older form handlers may invalidate UI after field dispatch. Preserve the
 // review document independently of the form state so provenance stays visible.
 result=reviewedReport;edited=reviewedEdits;render();
 // Guard against an older autofill handler restoring an original business
 // description after the reviewer explicitly corrected the investigation.
 if(done&&approved.values.business&&$("company-business").value!==approved.values.business){
  $("company-business").value=approved.values.business;
  $("company-business").dispatchEvent(new Event("input",{bubbles:true}));
 }
 if(!done){statusText("未能应用调查结果；请检查来源链接","warning");return;}
 acceptedSnapshot={name:result.query,fieldStatus:Object.fromEntries(E.KEYS.map(k=>[k,result.fields[k].status])),
  originalSources:result.fields,approved:approved.values,userChanges:approved.userChanges,
  warning:approved.warnings,identityChanged:approved.identityChanged,
  clientConsent:consent.checked,sourceCount:result.documents,
  scope:"Independent public or licensed data vendor claims, not proof of investment"};
 lastAccepted=JSON.parse(JSON.stringify(acceptedSnapshot));note("apply-stored",lastAccepted.name);
 statusText("调查结论已填入可编辑表单；修改身份资料会使之前的在地判断失效。仍需确认研究情景与业务联系。","success");
 $("company-confirm").checked=false;
});
company.addEventListener("input",event=>{note("company-input",{value:company.value,isTrusted:event.isTrusted,applying});if(applying)return;
 // Old lookup components sometimes dispatch a synthetic input event that
 // repeats the identical company value. That must not cancel an in-flight
 // lookup or silently discard the human-reviewed dossier.
 if(!event.isTrusted&&activeQuery&&E.normal(company.value)===E.normal(activeQuery))return;
 if(lastAccepted&&E.normal(company.value)===E.normal(lastAccepted.name))return;
 run++;activeQuery="";result=null;edited={};acceptedSnapshot=null;
 // Legacy auto-fill events are synthetic. Only a genuine human identity edit
 // may revoke an approved dossier; snapshot still checks the current name.
 if(event.isTrusted)lastAccepted=null;
 apply.disabled=true;reportHost.replaceChildren();
 statusText("名称已修改，之前调查结果不适用。","warning");start.disabled=false;});
const previous=window.ZKCompanyResearchUI?.snapshot;
if(typeof previous==="function"){
 window.ZKCompanyResearchUI.snapshot=()=>{
  const r=previous();
  const approved=lastAccepted&&E.normal(company.value)===E.normal(lastAccepted.name)?lastAccepted:null;
  return {...r,investigation:approved?JSON.parse(JSON.stringify(approved)):null};
 };
}
window.__V317Diagnostics=()=>({events:diagnostics,name:company.value,approvedName:acceptedSnapshot?.name,lastName:lastAccepted?.name,lastExists:!!lastAccepted,resultQuery:result?.query,applying,run,normalizedName:E.normal(company.value),normalizedLast:E.normal(lastAccepted?.name)});
if(!configuredUrl()){statusText("未连接授权数据服务。可先使用已整理公开资料样本调查；国家级实时工商数据查询未启用。");}
render();
})();