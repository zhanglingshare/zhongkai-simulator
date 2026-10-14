/* V3.6 enterprise admission desk, isolated from model.js.
   Deterministic interval screening, NOT calibrated probabilities or causal estimates.
   Works in browser as window.ZKInflow and Node via module.exports. */
(function(root,factory){
 "use strict";const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.ZKInflow=api;
})(typeof window!=="undefined"?window:(typeof globalThis!=="undefined"?globalThis:null),function(){
 "use strict";
 const schema="zk-enterprise-inflow-v1";
 const definitions={
  tax:{name:"预计新增地方财政收入",unit:"万元/年",min:0,max:1e8,question:"核对税收测算的税种、归属地与测算依据"},
  support:{name:"年度财政扶持支出",unit:"万元/年",min:0,max:1e8,question:"查验扶持政策条款、支付期限与已审批金额"},
  infrastructure:{name:"年化基础设施公共成本",unit:"万元/年",min:0,max:1e8,question:"向基础设施主管单位核实新增建设、运维及折旧成本"},
  orders:{name:"企业预计年度采购总额",unit:"万元/年",min:0,max:1e9,question:"取得采购台账或经核实的年度订单明细"},
  localShare:{name:"承诺本地采购比例",unit:"%",min:0,max:100,question:"取得已认证的本地供应商清单与采购合同"},
  certification:{name:"供应商认证周期",unit:"月",min:0,max:120,question:"核对供应商认证时间表和真实通过情况"},
  powerDemand:{name:"新增高峰用电负荷",unit:"MW",min:0,max:1e5,question:"核实真实最大用电需量及分期投产曲线"},
  powerAvailable:{name:"可接入供电剩余容量",unit:"MW",min:0,max:1e5,question:"从供电部门取得可接入的剩余容量证明"},
  waterDemand:{name:"项目最大日用水量",unit:"m³/日",min:0,max:1e9,question:"核实工艺及产线设计的用水上限"},
  waterAvailable:{name:"当地可用供水冗余",unit:"m³/日",min:0,max:1e9,question:"向供水单位核实项目地块的可用供水冗余"}
 };
 const names=Object.keys(definitions);
 const statuses=["unknown","self_reported","documented"];
 const finite=n=>typeof n==="number"&&Number.isFinite(n);
 const safeString=s=>typeof s==="string"&&s.trim().length>0&&s.length<=500;
 const clone=x=>JSON.parse(JSON.stringify(x));
 function validate(data){
  const errors=[],notices=[];
  if(!data||data.schema!==schema)return {valid:false,errors:["未知企业评估格式"],notices};
  if(!data.project||!safeString(data.project.name))errors.push("需要项目名称");
  if(!data.fields||typeof data.fields!=="object")return {valid:false,errors:["缺少企业字段"],notices};
  for(const key of names){
   const f=data.fields[key];
   if(!f||typeof f!=="object"){errors.push("缺少字段 "+key);continue;}
   if(!statuses.includes(f.status))errors.push(key+" 证据状态不合法");
   const low=f.low,high=f.high;
   const empty=(low===null||low===undefined)&&(high===null||high===undefined);
   if(empty){
    if(f.status==="documented")errors.push(key+" 有文件记录却缺少数值");
    continue;
   }
   if(!finite(low)||!finite(high)||low>high||low<definitions[key].min||high>definitions[key].max){
     errors.push(key+" 上下界必须是有效且按从小到大排列的数值，范围 "+definitions[key].min+"–"+definitions[key].max);
   }
   if(f.status==="documented"&&!safeString(f.source))errors.push(key+" 标为文件记录时必须写明原始凭据");
   if(f.source!=null&&typeof f.source!=="string")errors.push(key+" 来源说明必须是文本");
  }
  if(!["unknown","pending","issued","denied"].includes(data.permit))errors.push("环保许可状态不合法");
  if(!Array.isArray(data.relations)||data.relations.length>20)errors.push("最多支持20条企业候选关系");
  (Array.isArray(data.relations)?data.relations:[]).forEach((e,i)=>{
    if(!e||!safeString(e.partner)||!["supply","customer","service"].includes(e.role)||!["assumed","candidate","documented"].includes(e.status))
      errors.push("关系 "+(i+1)+" 内容或证据级别不合法");
    if(e&&e.status==="documented"&&!safeString(e.source))errors.push("关系 "+(i+1)+" 标为有文件依据时必须写明来源");
  });
  if(!Array.isArray(data.history)||data.history.length>500)errors.push("核查历史格式不合法或超过500条");
  if(names.some(k=>data.fields[k]&&data.fields[k].status==="self_reported"))notices.push("企业自报内容仅为资料来源，不是已核查事实");
  return {valid:errors.length===0,errors,notices};
 }
 const known=f=>f&&finite(f.low)&&finite(f.high);
 const doc=f=>known(f)&&f.status==="documented"&&safeString(f.source);
 function pair(f){return known(f)?[f.low,f.high]:null;}
 function difference(a,b){return a&&b?[a[0]-b[1],a[1]-b[0]]:null;}
 function constraint(demand,available,label){
  const d=pair(demand),a=pair(available);
  if(!d||!a)return {label,status:"missing",gap:null,text:"需求或剩余容量缺失，必须取得对应单位的数据"};
  const gap=difference(a,d);
  const documented=doc(demand)&&doc(available);
  if(gap[1]<0)return {label,status:"over",gap,text:"即使采用最有利上下界，容量仍不足；需扩容或换址"};
  if(gap[0]>=0)return {label,status:documented?"supported":"assumption",gap,
    text:documented?"所填有文件依据的区间显示容量可覆盖；尚未独立认证":"区间显示容量可能足够，但至少一方仍未提供文件依据"};
  return {label,status:"uncertain",gap,text:"容量差区间跨越零，结论可能翻转"};
 }
 function intervalProduct(a,b,multiplier){
  if(!a||!b)return null;
  return [a[0]*b[0]*multiplier,a[1]*b[1]*multiplier];
 }
 function screening(data){
  const check=validate(data);
  if(!check.valid)return {ok:false,errors:check.errors};
  const f=data.fields;
  const fiscal=known(f.tax)&&known(f.support)&&known(f.infrastructure)?
   [f.tax.low-f.support.high-f.infrastructure.high,f.tax.high-f.support.low-f.infrastructure.low]:null;
  const plannedLocalOrders=intervalProduct(pair(f.orders),pair(f.localShare),.01);
  const power=constraint(f.powerDemand,f.powerAvailable,"电力接入");
  const water=constraint(f.waterDemand,f.waterAvailable,"供水接入");
  const permits=data.permit;
  const blockers=[power,water].filter(v=>v.status==="over").map(v=>v.label+"：明确显示容量不足");
  if(permits==="denied")blockers.push("环保许可：记录为不予许可");
  const missing=[power,water].filter(v=>["missing","uncertain","assumption"].includes(v.status)).map(v=>v.label);
  if(permits!=="issued"&&permits!=="denied")missing.push("环保许可");
  const fiscalLabel=!fiscal?"缺少财政边界数据":fiscal[0]>0?"区间全部为正":fiscal[1]<0?"区间全部为负":"区间跨零，财政判断可能翻转";
  const next=blockers.length?"存在硬性约束障碍：暂停按当前方案推进，核实扩容或许可处理":missing.length?
    "关键约束仍待核查：仅能进行条件式预研，不宜给出准入建议":
    !fiscal?"已录入资源条件，但财政评价数据不完整；继续核实":
    "当前字段未显示明确约束障碍，仍需正式审批、独立来源复核和尽职调查";
  const thresholds={
   support:known(f.tax)&&known(f.infrastructure)?[f.tax.low-f.infrastructure.high,f.tax.high-f.infrastructure.low]:null,
   power:pair(f.powerAvailable),water:pair(f.waterAvailable),
   certification:pair(f.certification)
  };
  const issues=[];
  const add=(id,importance,reason,ask,requirement)=>issues.push({id,importance,reason,ask,requirement});
  if(permits!=="issued")add("permit",permits==="denied"?130:110,"环保许可是独立硬约束，不能用其他收益抵消","查验项目环保审批和排污许可状态","正式办理状态、行政文书、适用范围");
  for(const [prefix,result,demand,available] of [
   ["power",power,"powerDemand","powerAvailable"],["water",water,"waterDemand","waterAvailable"]
  ]){
   if(result.status==="over")add(prefix,125,"已录入上下界显示容量不足，需复核并提出可行方案",definitions[available].question,"主管单位证明及分期需求");
   else if(result.status!=="supported")add(prefix,result.status==="uncertain"?105:95,
     result.status==="missing"?"缺少需求或容量证据":"现有区间或文件级别不足以排除约束翻转",
     definitions[available].question+"；"+definitions[demand].question,"项目设计最大负荷及主管部门容量确认");
  }
  if(!fiscal||fiscal[0]<=0&&fiscal[1]>=0)for(const k of ["tax","support","infrastructure"]){
   if(!doc(f[k]))add(k,k==="tax"?85:78,"财政边界尚未明确或跨零；字段缺少可追溯的文件证据",definitions[k].question,"政策文件、测算报告或财务记录");
  }
  if(!doc(f.localShare)||!doc(f.orders))add("supplier",76,"本地采购仍为条件性机会，不能当作已签约订单","向企业核实已认证供应商与本地采购台账","合格供应商名录、采购合同及金额");
  if(!doc(f.certification))add("certification",63,"认证周期决定本地采购落地时间，需区分承诺与完成","核实供应商认证时间表、资格审批阶段","认证计划与已签发的资质文件");
  if(data.relations.some(r=>r.status!=="documented"))add("topology",59,"候选关系只是拓扑假设，不是已签署的供货合同","逐条核对企业上下游伙伴的产品匹配及认证状态","采购或供货凭证");
  issues.sort((a,b)=>b.importance-a.importance||a.id.localeCompare(b.id));
  return {ok:true,project:data.project.name,version:data.schema,fiscal,fiscalLabel,
   plannedLocalOrders,capacity:[power,water],blockers,missing,permit:permits,next,thresholds,
   relations:data.relations.map(e=>({partner:e.partner,role:e.role,status:e.status,source:e.source||""})),
   questions:issues.slice(0,3),allQuestions:issues,
   evidenceNotes:check.notices,
   methodologicalLimit:"透明区间运算与规则核查排序，不是概率后验、现实净经济收益、第三方核验或实际准入决定。财政口径与采购额分别展示、不合并计分；有来源说明不代表已认证。"};
 }
 function emptyCase(){
  return {schema,project:{name:"未命名项目",sector:"未填写"},permit:"unknown",
   fields:Object.fromEntries(names.map(k=>[k,{low:null,high:null,status:"unknown",source:""}])),
   relations:[],history:[]};
 }
 function demoCase(){
  const d=emptyCase();d.project={name:"示例电子组件项目（虚构）",sector:"电子元器件"};
  const seed={
   tax:[550,850],support:[350,500],infrastructure:[150,280],
   orders:[1800,3000],localShare:[20,60],certification:[4,12],
   powerDemand:[7,11],powerAvailable:[8,10],waterDemand:[70,110],waterAvailable:[90,130]
  };
  Object.entries(seed).forEach(([k,[low,high]])=>d.fields[k]={low,high,status:"self_reported",source:"虚构案例假设，非真实招商数据"});
  d.permit="pending";
  d.relations=[
   {partner:"候选配套企业 A（虚构）",role:"supply",status:"candidate",source:"产品匹配假设"},
   {partner:"候选客户 B（虚构）",role:"customer",status:"assumed",source:"未核实"}
  ];
  return d;
 }
 return {schema,definitions,validate,screening,emptyCase,demoCase};
});
