/* V3.19 · conditional decision-threshold reversal and evidence-first due diligence.
   Exact interval arithmetic for monotone accounting expressions; no learned model,
   no probabilities, no causal inference, no automatic investment approvals. */
(function(root,factory){
"use strict";const api=factory();
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.ZKDecisionReversal=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const VERSION="zk-decision-reversal-1";
const RULES={
 minInvestment:{label:"一次性新增投资门槛",unit:"亿元",metric:"investment",sense:"min",max:100000},
 minNetPurchasing:{label:"年度净本地采购门槛",unit:"亿元/年",metric:"netPurchasing",sense:"min",max:100000},
 minNetJobs:{label:"净新增岗位门槛",unit:"人",metric:"netJobs",sense:"min",max:10000000},
 maxLand:{label:"项目用地上限",unit:"亩",metric:"land",sense:"max",max:10000000},
 maxPower:{label:"年用电上限",unit:"万千瓦时/年",metric:"power",sense:"max",max:100000000},
 maxWater:{label:"年用水上限",unit:"万吨/年",metric:"water",sense:"max",max:100000000}
};
const FIELD_SUPPORT={
 award:{label:"市级工业设计中心奖励安排",supported:["公开材料列名","奖励名单中的县区"],notSupported:["工商在营状态","具体招商新增项目","已兑现投资","就业及采购合同"]},
 build:{label:"工程竣工验收备案公示",supported:["公开材料列名","相关项目的备案申请主体"],notSupported:["企业工商在营状态","全部项目实际投产","新增投资兑现"]},
 water:{label:"排水监管抽查公示",supported:["公开材料列名","监管公示关联"],notSupported:["企业经营绩效","信用评分","招商意向或投资收益"]},
 exp:{label:"环境影响评价受理公示",supported:["公开材料列名","受理阶段的项目关联"],notSupported:["已获全部审批","已经建成投产","扩产投资已兑现"]},
 bsj:{label:"企业官网地址信息",supported:["企业自述的联系地址"],notSupported:["官方工商登记核验","新增投资协议","公开财务与合同"]},
 invest:{label:"国有企业公开简介",supported:["政府公开的企业简介及地址"],notSupported:["新增投资兑现","当前工商状态及全部项目"]},
 unknown:{label:"来源类别未知",supported:[],notSupported:["来源真实性和主体身份未能确认"]}
};
const required=["legalIdentity","actualInvestment","investorNewToZhongkai"];
function finite(raw,max,label){
 if(raw===null||raw===undefined||raw==="")return null;
 if(typeof raw==="boolean")throw Error(label+"应为非负数字");
 const x=Number(raw);if(!Number.isFinite(x)||x<0||x>max)throw Error(label+"必须是有效的非负数字");
 return x;
}
function midpoint(range){return range?0.5*(range.low+range.high):null;}
function rounded(n){return Number.isFinite(n)?+n.toFixed(6):null;}
function clampPct(x){return Math.max(0,Math.min(100,x));}
function validateThresholds(raw){
 const out={};let count=0;
 for(const [key,s] of Object.entries(RULES)){
  out[key]=finite(raw?.[key],s.max,s.label);
  if(out[key]!==null)count++;
 }
 if(!count)throw Error("至少设置一个明确的判断门槛，系统不会替你决定招商标准");
 return out;
}
function interval(input,metric){
 const i=input.inputs;
 if(input.kind==="backfill")return {low:0,high:0};
 const val=key=>i[key]||null;
 if(["investment","land","power","water"].includes(metric))return val(metric);
 if(metric==="netPurchasing"){
  if(!val("procurement")||!val("localShare")||!val("supplierDisplacement"))return null;
  return {low:val("procurement").low*val("localShare").low/100*(1-val("supplierDisplacement").high/100),
   high:val("procurement").high*val("localShare").high/100*(1-val("supplierDisplacement").low/100)};
 }
 if(metric==="netJobs"){
  if(!val("jobs")||!val("jobDisplacement"))return null;
  return {low:val("jobs").low*(1-val("jobDisplacement").high/100),
   high:val("jobs").high*(1-val("jobDisplacement").low/100)};
 }
 return null;
}
function status(span,threshold,sense){
 if(!span)return "unknown";
 if(sense==="min"){
  if(span.low>=threshold)return "robust-pass";
  if(span.high<threshold)return "robust-fail";
 }else{
  if(span.high<=threshold)return "robust-pass";
  if(span.low>threshold)return "robust-fail";
 }
 return "reversible";
}
function reversalAnchor(row,input){
 const x=input.inputs,t=row.threshold,mid=key=>midpoint(x[key]);
 const anchor=[];
 if(row.key==="minNetPurchasing"){
  const p=mid("procurement"),l=mid("localShare"),d=mid("supplierDisplacement");
  if(p!==null&&d!==null&&p*(1-d/100)>0){
   const pivot=100*t/(p*(1-d/100));
   if(pivot>=0&&pivot<=100)anchor.push({name:"本地采购比例",threshold:rounded(pivot),unit:"%",note:"其它输入保持在所填区间中点"});
  }
  if(p!==null&&l!==null&&p*l>0){
   const pivot=100*(1-t/(p*l/100));
   if(pivot>=0&&pivot<=100)anchor.push({name:"供应商订单替代率",threshold:rounded(pivot),unit:"%",note:"其它输入保持在所填区间中点"});
  }
 }else if(row.key==="minNetJobs"){
  const jobs=mid("jobs"),disp=mid("jobDisplacement");
  if(disp!==null&&disp<100){
   anchor.push({name:"所需直接新增岗位",threshold:rounded(t/(1-disp/100)),unit:"人",note:"岗位替代率固定在所填区间中点"});
  }
  if(jobs!==null&&jobs>0){
   const p=100*(1-t/jobs);if(p>=0&&p<=100)
    anchor.push({name:"可承受岗位替代比例",threshold:rounded(p),unit:"%",note:"直接岗位固定在所填区间中点"});
  }
 }else{
  anchor.push({name:row.label,threshold:rounded(t),unit:row.unit,note:"达到这一用户设置的门槛就是条件性切换点"});
 }
 return anchor.slice(0,2);
}
const KEY_QUESTIONS={
 minInvestment:{why:"若投资承诺缩水，是否仍满足你设置的新增投资门槛？",proof:"正式分期投资计划、资金来源与合同进度"},
 minNetPurchasing:{why:"本地采购份额及对旧供应商的替代，可能改变净本地采购判断。",proof:"本地供应商清单、订单、采购台账及替代分析"},
 minNetJobs:{why:"项目新增岗位可能不等于净新增岗位。",proof:"岗位配置与招聘计划、存量岗位变化、实际社保就业资料"},
 maxLand:{why:"项目用地峰值可能触及可供给工业用地上限。",proof:"用地红线、亩数及相同时点可用工业用地证明"},
 maxPower:{why:"新增用电需求可能超过同期可用供电能力。",proof:"供电接入条件、分年度负荷预测和电网答复"},
 maxWater:{why:"新增用水需求可能超过可用供水能力。",proof:"供水接入意见、分年度取用水方案"}
};
function questionFor(row){
 const docs=KEY_QUESTIONS[row.key],reason=row.status==="unknown"?"缺少能计算该门槛的必要字段":
 row.status==="reversible"?"现有假设区间跨越用户设置的判断门槛":
 row.status==="robust-fail"?"当前假设范围无法满足用户门槛":"仍需要实际证据确认假设";
 return {key:row.key,status:row.status,label:row.label,
  prompt:docs.why,why:reason,requiredDocument:docs.proof,
  threshold:row.threshold,anchors:row.anchors};
}
function analyze(econ,thresholdsRaw){
 let input,thresholds;
 try{
  if(!econ||typeof econ!=="object")throw Error("请输入经济研究情景");
  // Accept only validated, normalized V3.18 input, not the computed statistical
  // output; callers should pass ZKEconomicInflow.clean(userInput).
  if(!Object.prototype.hasOwnProperty.call({proposed_new:1,expansion:1,backfill:1},econ.kind)||
     !econ.inputs||!econ.capacities||!Number.isSafeInteger(econ.seed))
   throw Error("先校验 V3.18 增量经济参数，再执行阈值反转");
  input=econ;thresholds=validateThresholds(thresholdsRaw);
 }catch(e){return {ok:false,errors:[e.message]};}
 const rows=[];
 for(const [key,rule]of Object.entries(RULES)){
  const t=thresholds[key];if(t===null)continue;
  const span=interval(input,rule.metric),s=status(span,t,rule.sense);
  const row={key,label:rule.label,unit:rule.unit,sense:rule.sense,threshold:t,
   interval:span?{low:rounded(span.low),high:rounded(span.high)}:null,status:s};
  row.anchors=reversalAnchor(row,input);rows.push(row);
 }
 const fail=rows.some(r=>r.status==="robust-fail"),
       unknown=rows.some(r=>r.status==="unknown"),
       flip=rows.some(r=>r.status==="reversible");
 const overall=fail?"fails-specified-thresholds":
  unknown?"insufficient-input":
  flip?"depends-on-assumptions":"meets-all-specified-thresholds";
 const order={"reversible":0,unknown:1,"robust-fail":2,"robust-pass":3};
 const questions=rows.slice().sort((a,b)=>order[a.status]-order[b.status]||
  a.key.localeCompare(b.key)).slice(0,3).map(questionFor);
 return {ok:true,protocol:VERSION,kind:input.kind,company:input.company,thresholds,
  rows,overall,questions,
  warnings:[
   "判断门槛由用户设定；不是政府招商审批标准或政策建议",
   "范围计算属于单调公式的条件边界，不是蒙特卡洛概率或真实效果预测",
   "同一假设的经济增加值、税收、就业归属与资源时空匹配仍需单独验证",
   ...(input.kind==="backfill"?["模型存量补录的现实增量固定为零，不应据此声称新增招商或扩产"]:[])
  ]};
}
function audit(item){
 if(!item||typeof item!=="object"||!item.source||!item.name)return null;
 const group=FIELD_SUPPORT[item.sourceCategory]||FIELD_SUPPORT.unknown;
 const chk=item.check||{};
 const check=[
  {field:"公开材料提及主体名称",status:chk.nameMention==="public-record-supported"?"source-indexed":"not-verified",
   note:"来源台账标记为支持，需打开原文及对照统一社会信用代码核验同名主体"},
  {field:"所列县区/地点",status:chk.districtAtRecord&&chk.districtAtRecord!=="unknown"?"source-indexed":"not-verified",
   note:"名单县区、工程位置或企业官网地址，不等于工商注册地及所有生产基地"},
  {field:"工商身份及存续状态",status:"not-verified",note:"需要官方工商登记或合法授权接口逐主体核查"},
  {field:"项目真实新增投资",status:"not-verified",note:"需要合同、项目批复或投资兑现台账"},
  {field:"净新增就业和本地采购",status:"not-verified",note:"需要招聘/社保与采购订单证据"},
  {field:"具体项目进度",status:item.sourceCategory==="exp"?"source-indexed":"not-verified",
   note:item.sourceCategory==="exp"?"仅可确认材料中的环评受理阶段，不证明建成投产":"目前台账未逐项核实签约、动工、投产阶段"}
 ];
 return {id:item.id,name:item.name,district:item.officialDistrict,category:item.sourceCategory,
  source:{publisher:item.source.publisher,url:item.source.url,documentDate:item.source.documentDate||"",
   fact:item.source.fact},categoryLabel:group.label,sourceSupport:group.supported,
  cannotConclude:group.notSupported,fields:check,
  nextStep:"逐项核对原始公告及企业统一社会信用代码，再索取可验证的投资、采购、岗位与产能增量材料",
  reviewedAgainstLiveSite:false,notEvidenceOfNewInvestment:true};
}
function auditRoster(payload){
 if(!payload||payload.schema!=="zk-enterprise-public-evidence-v1"||!Array.isArray(payload.items))
  return {ok:false,error:"公开证据台账格式不正确"};
 const items=payload.items.map(audit).filter(Boolean);
 if(items.length!==payload.items.length)return {ok:false,error:"发现证据台账不完整"};
 return {ok:true,count:items.length,items,
  summary:{nameSourceIndexed:items.filter(x=>x.fields[0].status==="source-indexed").length,
   investmentVerified:0,registryVerified:0},
  limitations:["原始来源由 V3.18 整理，本次不是逐企业实时工商核验",
    "来源中的企业名称可能有主体同名、旧版本和日期差异，须再次核实",
    "不得将20家企业合并报告为20个已签约的仲恺新增投资项目"]};
}
return {VERSION,RULES,FIELD_SUPPORT,validateThresholds,interval,status,reversalAnchor,analyze,audit,auditRoster};
});