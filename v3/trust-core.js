/* V3.20 read-only research trust auditor.
 * Aggregates existing V3.4 observations, V3.5 baseline replay and V3.6
 * measurement candidates. No alteration to Sim or historical data. */
(function(root,factory){
"use strict";const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.ZKTrustAudit=api;
})(typeof window!=="undefined"?window:(typeof globalThis!=="undefined"?globalThis:null),function(){
"use strict";
const VERSION="zk-trust-audit-v1";
const METRICS={
 gdp_real_yoy:"GDP 可比价增速",
 industry_growth:"规上工业增加值增速",
 industry_invest_growth:"工业投资增速"
};
const MODEL_STATES=["abundance","order","disaster","mood","survivors"];
const EVIDENCE_FIELDS=[
 {key:"nameMention",label:"公开来源列名",desc:"来源台账声称原文列名；未逐一验公司工商主体"},
 {key:"districtAtRecord",label:"属地或项目位置线索",desc:"可能是评奖名单县区、工程位置或企业自述地址"},
 {key:"legalIdentity",label:"工商主体身份与存续",desc:"需统一社会信用代码、官方工商记录和查询日期"},
 {key:"actualInvestment",label:"新增投资与兑现",desc:"需实际增量合同、验收或投资支付凭证"},
 {key:"investorNewToZhongkai",label:"是否真正新增落地仲恺",desc:"需区分存量补录、扩产和首次新引进"}
];
const safeHttps=v=>{try{const u=new URL(v);return u.protocol==="https:"&&!!u.hostname&&!u.username&&!u.password;}catch{return false;}};
const clean=s=>String(s||"").trim().slice(0,160);
function auditCompanies(data){
 const errors=[],companies=[];
 if(data?.schema!=="zk-enterprise-public-evidence-v1"||!Array.isArray(data.items))errors.push("20 家企业台账格式缺失");
 const seen=new Set();
 for(const row of data?.items||[]){
  if(!row?.id||!row.name||!row.source?.publisher||!safeHttps(row.source.url)||seen.has(row.name)){
   errors.push("存在企业名称重复或证据来源不完整");continue;
  }
  seen.add(row.name);
  const fields=EVIDENCE_FIELDS.map(f=>{
   const original=row.check?.[f.key];
   const found=(f.key==="nameMention"&&original==="public-record-supported")||
    (f.key==="districtAtRecord"&&typeof original==="string"&&original!=="unknown");
   return {...f,status:found?"indexed-not-reverified":"unverified",value:original||"unknown"};
  });
  companies.push({id:clean(row.id),name:clean(row.name),
   district:clean(row.officialDistrict),category:clean(row.sourceCategory),
   source:{publisher:clean(row.source.publisher),date:clean(row.source.documentDate),url:row.source.url,claim:clean(row.source.fact)},
   fields,verifiedLegalIdentity:false,verifiedInvestment:false,
   notes:clean(row.note),nextQuestions:[
    "能否通过统一社会信用代码核对主体、经营状态和登记历史？",
    "公开记录对应的是历史存量、扩产计划还是实际新增项目？",
    "投资和新增就业有无独立、分期且可核验的实际兑现凭据？"
   ]});
 }
 if(companies.length!==20)errors.push("公开企业台账不是 20 个不重复、带来源的企业名称");
 const fieldCounts=Object.fromEntries(EVIDENCE_FIELDS.map(f=>[f.key,{
  indexed:companies.filter(c=>c.fields.find(x=>x.key===f.key)?.status==="indexed-not-reverified").length,
  verified:0,unverified:companies.filter(c=>c.fields.find(x=>x.key===f.key)?.status==="unverified").length
 }]));
 return {ok:!errors.length,errors,companies,fieldCounts,total:companies.length,
  legalIdentityVerified:0,investmentVerified:0,
  label:"已收录公开来源 ≠ 完成现实主体核验",
  caution:"来源仅为台账标引，当前审计未逐家在线重新验证工商及项目兑现信息"};
}
function auditResearch({observations,companies,observationCore,benchmarkCore,measurementCore}={}){
 const error=[];
 if(!observationCore?.validate||!observationCore?.readiness||!benchmarkCore?.evaluate||!measurementCore?.coverage)
  return {ok:false,errors:["科学审计依赖模块未加载"],version:VERSION};
 const o=observationCore.validate(observations);
 if(!o.ok)error.push(...o.errors);
 const enterprise=auditCompanies(companies);
 if(!enterprise.ok)error.push(...enterprise.errors);
 const mapping=measurementCore.coverage(observations);
 const readiness=observationCore.readiness(o,observations);
 const baseline=Object.fromEntries(Object.keys(METRICS).map(k=>[k,
   benchmarkCore.evaluate(observations,k)]));
 const total=Array.isArray(observations?.observations)?observations.observations.length:0;
 const backed=Array.isArray(observations?.observations)?
  observations.observations.filter(x=>Array.isArray(x.source_ids)&&x.source_ids.length).length:0;
 const knownSourceIds=Object.keys(observations?.sources||{}),types={};
 knownSourceIds.forEach(k=>{const kind=observations.sources[k].host_type||"unclassified";
  types[kind]=(types[kind]||0)+1;});
 const canScoreModel=false;
 return {version:VERSION,ok:!error.length,errors:error,
  observation:{valid:o.ok,sourceEntries:knownSourceIds.length,sourceTypes:types,records:total,backed,
   years:o.years,warnings:o.warnings,metricCount:Object.keys(o.byMetric).length},
  enterprise,
  baseline:{metrics:METRICS,results:baseline,description:"朴素年度同比基线的回溯重建；不是 Sim 预测历史准确率"},
  mapping:{states:mapping.states,candidates:mapping.candidateSummary,issues:mapping.warning},
  modelValidation:{certified:false,canScoreModel,calibrated:false,
   blocks:[...readiness.reasons,
    "原 Sim 的历史事件可能包含后验信息，历史时间段不能直接充当事前模型留出验证",
    "缺少结果发布前不可更改的 Sim 参数、映射、时间步、预测值、数据版本与外部时间戳记录"],
   status:"blocked-awaiting-pre-outcome-archives"},
  conclusions:[
   "公开资料确实存在，但不同指标和年份的官方原件/转载来源强度不同",
   "20家企业现有资料仅支持台账中的名称与有限事件线索，不能计算企业层面经营预测准确率",
   "可比较朴素增长基线的回溯残差，无法据此评定原多智能体 Sim 的外样本预测能力"
  ]};
}
function preregistration(raw){
 const errors=[];
 const textField=(name,max=200)=>clean(raw?.[name]).slice(0,max);
 const metric=textField("metric"),protocol=textField("protocolVersion"),model=textField("modelCommit");
 const target=textField("targetPeriod"),expected=textField("releaseDate"),method=textField("measurementRule");
 const forecast=textField("forecastValue"),unit=textField("unit"),sources=textField("sources");
 if(!Object.prototype.hasOwnProperty.call(METRICS,metric))errors.push("仅允许已登记的三个增长率观察指标");
 if(!/^[a-f0-9]{40}$/i.test(model))errors.push("请提供40位冻结模型Git提交SHA");
 if(!protocol||protocol.length<3)errors.push("请明确版本化的事前测量协议");
 if(!/^\d{4}$/.test(target))errors.push("目标期请输入4位自然年");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(expected)||!Number.isFinite(Date.parse(expected)))
  errors.push("请登记目标结果预计公布日期");
 if(method.length<12)errors.push("测量规则须明确真实指标口径及Sim时间步对应");
 if(forecast===""||!Number.isFinite(Number(forecast)))errors.push("需输入有限数值的事前预测");
 if(unit!=="%")errors.push("当前限定官方同比增长率，单位必须为%");
 if(sources&&!safeHttps(sources))errors.push("预注册观测来源须为HTTPS地址");
 // Forming a draft does NOT make a timestamp or a prediction independent.
 const archive={schema:"zk-prospective-preregistration-draft-v1",
  kind:"local-unsealed-draft",metric,targetPeriod:target,expectedObservationRelease:expected,
  modelCommit:model,protocolVersion:protocol,measurementRule:method,
  pointForecast:forecast!==""?Number(forecast):null,unit,observationSource:sources,
  needs:["在目标结果公布之前取得公开、不可回写的外部时间戳存证",
   "冻结Sim版本、参数、运行种子、来源版本、时间步对应和模型输出",
   "结局发布后独立抓取对应口径观测及来源发布日期",
   "核对资料未提前泄漏、未按结果修改模型或排除失败的预测样本"],
  resultAvailable:false,independentScore:null,certified:false};
 return {ok:!errors.length,errors,archive};
}
return {VERSION,METRICS,MODEL_STATES,EVIDENCE_FIELDS,safeHttps,auditCompanies,auditResearch,preregistration};
});