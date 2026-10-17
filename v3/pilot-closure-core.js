/* V3.21 real-source pilot review; all source claims remain scoped to original text.
   Human assertions cannot become official facts without independent proof.
   Economic calculations call existing V3.18 kernel, not the original Sim engine. */
(function(root,factory){"use strict";const a=factory();if(typeof module!=="undefined"&&module.exports)module.exports=a;if(root)root.ZKPilotClosure=a;
})(typeof window!=="undefined"?window:typeof globalThis!=="undefined"?globalThis:null,function(){
"use strict";
const VERSION="zk-pilot-closure-v1",FIELDS={
 legalIdentity:{label:"统一社会信用代码与存续",proof:"市场监管公示原件与查询日期"},
 site:{label:"实际经营/项目地点",proof:"主体与项目地址的带日期资料"},
 projectStage:{label:"项目真实状态",proof:"环评批复、施工、验收、实际投产分别取证"},
 scenarioKind:{label:"存量 / 扩产 / 新引进",proof:"明确独立项目边界、原有产能及时间基准"},
 investment:{label:"新增投资兑现",proof:"投资凭证、建设进度、增量口径"},
 jobs:{label:"净新增就业",proof:"招聘、社保、岗位替代和用工增量"},
 procurement:{label:"本地采购及替代",proof:"本地订单、供应商台账及替代关系"},
 resources:{label:"土地、电、水容量",proof:"用地、供水、供电等容量证明"},
 recognition:{label:"奖补及荣誉",proof:"原公告/奖补安排，不等于拨款和项目投资"},
 soebasis:{label:"国有平台背景",proof:"官方介绍，不等于工商最新记录和实缴投资"}};
const isObj=x=>x&&typeof x==="object"&&!Array.isArray(x);
function url(s){try{const v=new URL(s);return v.protocol==="https:"&&!!v.hostname&&!v.username&&!v.password;}catch{return false;}}
const short=(s,max=500)=>String(s==null?"":s).trim().slice(0,max);
const date=s=>/^\d{4}-\d\d-\d\d$/.test(String(s))&&!Number.isNaN(Date.parse(String(s)));
function validateRegistry(registry){
 const errors=[];
 if(registry?.schema!=="zk-enterprise-pilot-v321"||!Array.isArray(registry.cases)||registry.cases.length<3||registry.cases.length>5)return {ok:false,errors:["应有3至5家独立试点企业"]};
 const ids=new Set(),names=new Set();
 for(const item of registry.cases){
  if(!item.id||!item.name||ids.has(item.id)||names.has(item.name))errors.push("企业试点名称或ID重复");
  ids.add(item.id);names.add(item.name);
  if(!["backfill","expansion","proposed_new"].includes(item.recommendedStudyKind))errors.push("研究类型错误 "+item.id);
  if(!Array.isArray(item.source)||!item.source.length)errors.push("缺少原始来源 "+item.id);
  const refs=new Set();
  for(const s of item.source||[]){
   if(!s.id||refs.has(s.id)||!url(s.url)||!date(s.retrievedAt)||!s.publisher||!s.support||!s.excludes)errors.push("来源记录字段不足 "+item.id);
   refs.add(s.id);
  }
  for(const c of item.claims||[]){
   if(!FIELDS[c.field]||!short(c.value)||!refs.has(c.sourceId))errors.push("来源声称与文档不匹配 "+item.id);
  }
 }
 return {ok:errors.length===0,errors,count:registry.cases.length};
}
function newClaim(raw){
 const field=short(raw?.field,40),value=short(raw?.value,280),sourceUrl=short(raw?.sourceUrl,1000),
  documentedAt=short(raw?.documentedAt,10),reviewer=short(raw?.reviewer,80);
 const errors=[];
 if(!FIELDS[field])errors.push("必须选择已有证据字段");
 if(value.length<2)errors.push("证据声称不能为空");
 if(!url(sourceUrl))errors.push("新增证据必须提供有效的HTTPS来源");
 if(!date(documentedAt))errors.push("需要来源发布或复核的明确日期");
 if(!reviewer)errors.push("请填写记录人员或标识");
 return {ok:!errors.length,errors,record:!errors.length?{
  type:"user-provided-unverified-evidence",field,value,sourceUrl,documentedAt,reviewer,
  state:"pending-review",warning:"仅为用户输入，不会因为点击复核就自动成为工商或投资事实"}:null};
}
function compareDocuments(a,b){
 const errors=[];
 if(!validateRegistry(a).ok||!validateRegistry(b).ok)return {ok:false,errors:["版本数据不满足试点来源规范"]};
 const old=new Map(a.cases.map(c=>[c.id,c])),now=new Map(b.cases.map(c=>[c.id,c]));
 const changes=[];
 for(const [id,c]of now){
  if(!old.has(id)){changes.push({id,kind:"added",text:c.name+" 新增进入来源清单"});continue;}
  const prev=old.get(id);
  if(prev.name!==c.name)changes.push({id,kind:"changed",text:"主体名称改变（须核查同名/更名）"});
  const refs=new Map(prev.source.map(s=>[s.id,s]));
  for(const s of c.source){
   const p=refs.get(s.id);
   if(!p)changes.push({id,kind:"source-added",text:"新增来源 "+s.publisher});
   else if(["url","publishedAt","evidenceText","support","excludes"].some(k=>p[k]!==s[k]))
    changes.push({id,kind:"source-changed",text:"原来源发生变化 "+s.id+"，需人工审查修订"});
  }
  for(const s of prev.source)if(!c.source.find(x=>x.id===s.id))
   changes.push({id,kind:"source-removed",text:"历史来源被移除 "+s.id+"，不应抹除旧快照"});
  if(JSON.stringify(prev.claims)!==JSON.stringify(c.claims))
   changes.push({id,kind:"claim-changed",text:"公开来源声称字段发生变化，须复核"});
 }
 for(const [id,c]of old)if(!now.has(id))changes.push({id,kind:"case-removed",text:c.name+" 不再位于当前清单，旧版应保留"});
 return {ok:true,from:a.snapshotId,to:b.snapshotId,changes,changedCases:new Set(changes.map(c=>c.id)).size,
  caveat:"仅比较两个版本的来源字段，不能据来源变更推断企业经营发生变化；快照本身须由Git提交保护"};
}
function reviewCase(item,manual=[]){
 const sourceClaims=(item.claims||[]).map((c,i)=>({
   id:"source-"+i,field:c.field,value:c.value,url:item.source.find(s=>s.id===c.sourceId)?.url||"",
   kind:"source-indexed-scope-limited",status:"original-record-indexed"}));
 const userClaims=manual.map((x,i)=>({...x,id:"manual-"+i,
  url:x.sourceUrl,kind:"user-provided-unverified-evidence",status:x.state||"pending-review"}))
  .filter(x=>FIELDS[x.field]);
 const claims=[...sourceClaims,...userClaims];
 const conflicts=[];
 for(const key of Object.keys(FIELDS)){
  const same=claims.filter(c=>c.field===key&&c.status!=="rejected"&&c.value),
   values=new Set(same.map(c=>String(c.value).replace(/\s+/g,"").toLowerCase()));
  if(values.size>1)conflicts.push({field:key,label:FIELDS[key].label,
   kind:"potential-contradiction",note:"不同文本不一定是事实冲突，可能是日期、项目或统计口径不同；需要人工核对",
   claims:same.map(x=>({value:x.value,url:x.url,status:x.status}))});
 }
 const present=new Set(claims.filter(c=>c.status!=="rejected").map(c=>c.field));
 const required=Object.keys(FIELDS).filter(k=>!["recognition","soebasis"].includes(k));
 const missing=required.filter(k=>!present.has(k)).map(k=>({field:k,label:FIELDS[k].label,document:FIELDS[k].proof}));
 const questions=[
  ...conflicts.map(c=>"核实【"+c.label+"】多个来源为何不同；是否涉及不同日期、同名主体或独立项目？"),
  ...missing.map(m=>"请取得【"+m.label+"】的材料："+m.document)
 ].slice(0,5);
 return {caseId:item.id,name:item.name,claims,conflicts,missing,questions,
  indexed:sourceClaims.length,userAdded:userClaims.length,
  officialRegistryVerified:false,incrementalInvestmentVerified:false,
  status:conflicts.length?"requires-conflict-review":"incomplete-evidence",
  warning:"标引、人工复核与企业现场尽调是不同层级；人工确认不等于自动证明工商、投资或经营事实"};
}
function conditionalStudy(item,raw,review,economic){
 const errors=[];
 if(!economic||typeof economic.run!=="function")errors.push("V3.18 经济核心未载入");
 if(!raw?.confirmed)errors.push("必须明确确认：所有数值仅为条件性假设，不是已核实投资或岗位");
 if(!short(raw?.reviewer,80))errors.push("必须有人工复核人员标识");
 if(!short(raw?.reviewNote,1000))errors.push("必须记录人工复核说明或剩余不确定性");
 if(!["backfill","expansion","proposed_new"].includes(raw?.kind))errors.push("研究类型必须明确区分存量、扩产和新引进");
 if(["expansion","proposed_new"].includes(raw?.kind)&&raw.kind!==item.recommendedStudyKind&&!url(raw.projectProof))
  errors.push("将已有企业认定为扩产/新引进须额外提供项目专属HTTPS证据，不得从奖补和地址推断新投资");
 if(raw?.kind==="proposed_new"&&item.recommendedStudyKind!=="proposed_new"&&!url(raw.projectProof))
  errors.push("旧企业不能仅凭名字直接算新引进");
 if(errors.length)return {ok:false,errors,report:null};
 const modelInput={kind:raw.kind,company:item.name,seed:23,
  source:url(raw.projectProof)?raw.projectProof:"",inputs:raw.inputs||{},capacities:raw.capacities||{}};
 const calc=economic.run(modelInput);
 if(!calc.ok)return {ok:false,errors:calc.errors,report:null};
 return {ok:true,errors:[],report:{schema:"zk-v321-conditional-study-v1",
  company:item.name,caseId:item.id,sourceCategory:item.category,sourceQuality:item.sourceQuality,
  observedFacts:review.claims.filter(x=>x.kind==="source-indexed-scope-limited"),
  manualClaims:review.claims.filter(x=>x.kind==="user-provided-unverified-evidence"),
  potentialConflicts:review.conflicts,missingFields:review.missing,
  reviewer:short(raw.reviewer,80),reviewNote:short(raw.reviewNote,1000),
  economics:calc,sourceIds:item.source.map(s=>s.id),
  officialApproval:false,verifiedInvestment:false,
  note:"条件性演算而非现实预测；老企业补录经济新增量归零，原ZKSim本体不被修改"}};
}
return {VERSION,FIELDS,url,date,validateRegistry,newClaim,compareDocuments,reviewCase,conditionalStudy};
});