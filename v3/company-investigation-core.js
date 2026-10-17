/* V3.17 enterprise investigation: source-by-source claim auditing.
   This engine never treats a data-vendor response as state verification. */
(function(root,factory){
"use strict";const api=factory();
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.ZKInvestigation=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const FIELD_LABEL={name:"企业全称",registrationStatus:"登记状态",registeredAddress:"登记地址",business:"主营业务/经营范围",website:"官方网站",unifiedCreditCode:"统一社会信用代码",operationAddress:"实际经营地址"};
const KEYS=Object.keys(FIELD_LABEL),MAX_DOCS=16;
function clean(v,limit=360){return String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,limit);}
function normal(v){return clean(v,180).replace(/[\s（）()·.,，。]/g,"").toLowerCase();}
function safeHttps(raw){try{const u=new URL(String(raw));return u.protocol==="https:"&&!u.username&&!u.password&&u.hostname?u.href:"";}catch{return "";}}
function creditCode(v){return /^[0-9A-HJ-NPQRTUWXY]{18}$/.test(String(v||"").toUpperCase())?String(v).toUpperCase():"";}
function document(raw,requested){
 if(!raw||typeof raw!=="object"||!raw.source)return null;
 const source=raw.source;
 if(!clean(raw.companyName,120)||!clean(source.publisher,100)||!safeHttps(source.url))return null;
 if(normal(raw.companyName)!==normal(requested))return null;
 const fields={};for(const k of KEYS){
  if(raw.fields&&typeof raw.fields[k]==="string"){
   const v=clean(raw.fields[k],k==="business"?600:180);
   if(v)fields[k]=k==="unifiedCreditCode"?creditCode(v):v;
  }
 }
 if(!Object.values(fields).some(Boolean))return null;
 const allowedTypes=["licensed_registry","government","enterprise","association","institution","user_provided"];
 const type=allowedTypes.includes(source.type)?source.type:"user_provided";
 const group=clean(source.independenceGroup||source.publisher,100).toLowerCase();
 if(!group)return null;
 return {companyName:clean(raw.companyName,120),fields,source:{
  publisher:clean(source.publisher,100),url:safeHttps(source.url),type,
  independenceGroup:group,checkedAt:clean(source.checkedAt,40),
  assertion:clean(source.assertion,500),licensed:type==="licensed_registry"&&source.licensed===true
 }};
}
function fromIndex(record){
 if(!record)return [];
 const byField={name:"name",business:"business",location:"operationAddress"};
 const docs=[];
 for(const s of record.sources||[]){
  const k=byField[s.field];if(!k)continue;
  const value=k==="operationAddress"?record.location:record[k];
  if(!value)continue;
  docs.push({companyName:record.name,fields:{[k]:value},source:{
   publisher:s.publisher,url:s.url,type:s.type==="enterprise"?"enterprise":
    s.type==="association"?"association":"institution",
   assertion:s.assertion,independenceGroup:s.publisher,checkedAt:record.refreshed_at||""}});
 }
 if(record.website){const s=(record.sources||[]).find(x=>x.publisher.includes("官网"));
  if(s)docs.push({companyName:record.name,fields:{website:record.website},source:{
   publisher:s.publisher,url:s.url,type:"enterprise",independenceGroup:s.publisher,
   assertion:"公开企业网站主页参考链接"}});}
 return docs;
}
function analyze(query,rawDocs=[],opts={}){
 const q=clean(query,120);
 if(normal(q).length<2)return {ok:false,reason:"企业名称至少需要两个字"};
 if(!Array.isArray(rawDocs))return {ok:false,reason:"调查资料格式错误"};
 const docs=rawDocs.slice(0,MAX_DOCS).map(d=>document(d,q)).filter(Boolean);
 const rejectCount=Math.min(rawDocs.length,MAX_DOCS)-docs.length;
 const fields={},missing=[],conflicts=[],questions=[];
 for(const key of KEYS){
  const claims=docs.filter(d=>d.fields[key]).map(d=>({value:d.fields[key],source:d.source}));
  const groups=new Map();
  claims.forEach(c=>{const id=normal(c.value);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(c);});
  const alternatives=[...groups.values()].sort((a,b)=>b.length-a.length);
  const independent=group=>new Set(group.map(c=>c.source.independenceGroup)).size;
  let status="missing",recommended="",basis=0;
  if(alternatives.length){
   if(alternatives.length>1){status="conflict";conflicts.push(key);}
   else{basis=independent(alternatives[0]);status=basis>=2?"corroborated":"single_source";recommended=alternatives[0][0].value;}
  }else missing.push(key);
  fields[key]={key,label:FIELD_LABEL[key],status,recommended,independentSources:basis,
   alternatives:alternatives.map(g=>({value:g[0].value,count:g.length,independentSources:independent(g),
     sources:g.map(c=>({...c.source}))})),edited:false};
 }
 if(conflicts.length)questions.push("不同来源对「"+conflicts.map(x=>FIELD_LABEL[x]).join("、")+"」说法不一，应先核实是否混淆分公司或历史信息");
 if(fields.operationAddress.status==="missing")questions.push("是否有可靠的实际经营地址或项目地址，而不仅是登记地址？");
 if(fields.unifiedCreditCode.status==="missing")questions.push("企业统一社会信用代码是什么？能否核对工商登记主体？");
 if(fields.business.status==="missing")questions.push("该企业具体生产什么产品、拥有何种产能？");
 questions.push("是否有明确的仲恺新落地或扩产项目？合同、时间、投资规模有何公开依据？");
 questions.push("有哪些证据证明拟建立的供货与采购关系，还是仅属于模型假设？");
 const linked=docs.some(d=>d.source.type==="licensed_registry"&&d.source.licensed===true);
 const domicile=fields.operationAddress;
 const existingLocal=domicile.status!=="missing"&&domicile.status!=="conflict"&&/仲恺/.test(domicile.recommended)
  &&docs.some(d=>d.fields.operationAddress&&/仲恺/.test(d.fields.operationAddress)
    &&["government","enterprise","institution","association"].includes(d.source.type));
 const inZhongkai=existingLocal?{area:"zhongkai",presence:"existing",reason:"至少一条可查的经营地址线索在仲恺；不证明投资规模或新增落地"}:
   {area:"unknown",presence:"unknown",reason:"暂无法核实在仲恺实际经营；登记地址不等于经营或投资项目地址"};
 return {ok:true,query:q,documents:docs.length,rejected:rejectCount+(rawDocs.length-Math.min(rawDocs.length,MAX_DOCS)),
  fields,missing,conflicts,questions,identityStatus:inZhongkai,
  registrationCoverage:linked?"授权数据接口返回过登记线索，仍须核验":"未取得授权登记数据；不能称为工商核验",
  coverage:opts.coverage||"仅限已提供/获得授权的来源，不代表全面互联网检索",
  checkedAt:opts.checkedAt||""};
}
function accepted(report,overrides={}){
 if(!report?.ok)return null;
 const result={},userChanges=[];
 for(const k of KEYS){
  const f=report.fields[k],raw=Object.hasOwn(overrides,k)?overrides[k]:f.recommended;
  const v=clean(raw,k==="business"?600:180);
  if(v){result[k]=v;if(v!==f.recommended)userChanges.push(k);}
 }
 const sources=[];
 for(const doc of report.fields.operationAddress.alternatives)for(const s of doc.sources){
  if(!sources.some(x=>x.url===s.url))sources.push({url:s.url,publisher:s.publisher,
   field:"location",assertion:s.assertion||"实际经营地点公开线索"});
 }
 for(const doc of report.fields.business.alternatives)for(const s of doc.sources){
  if(!sources.some(x=>x.url===s.url))sources.push({url:s.url,publisher:s.publisher,
   field:"business",assertion:s.assertion||"业务描述公开线索"});
 }
 const changedName=result.name&&normal(result.name)!==normal(report.query);
 const locationEdited=userChanges.includes("operationAddress"),companyDifferent=!!changedName;
 // Any material identity edit removes the original local-company classification.
 const identityChanged=locationEdited||companyDifferent;
 return {record:{
   id:"licensed-investigation-"+normal(report.query).slice(0,48),name:result.name||report.query,
   aliases:[],business:result.business||"",location:result.operationAddress||"",
   website:result.website||"",area:identityChanged?"unknown":report.identityStatus.area,
   presence:identityChanged?"unknown":report.identityStatus.presence,
   role_hint:null,sources,
   checked_at:report.checkedAt
  },values:result,userChanges,identityChanged,
  warnings:[
   ...(report.conflicts.length?["存在未解决的资料冲突，不得自动判定为真实登记数据"]:[]),
   ...(identityChanged?["关键身份或地址已修改，原在地判断自动失效"]:[]),
   ...(report.registrationCoverage.includes("未取得")?["不包含已授权工商登记核验"]:[])
  ]};
}
return {FIELD_LABEL,KEYS,document,fromIndex,analyze,accepted,safeHttps,normal,creditCode};
});