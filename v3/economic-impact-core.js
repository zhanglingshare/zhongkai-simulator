/* V3.18 incremental economic accounting under EXPLICIT user assumptions.
   Independent from ZKSim: no GDP multiplier, no causal effect claim, no fake forecasts.
   All amounts and constraints originate from user-supplied hypothetical ranges. */
(function(root,factory){
 "use strict";const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.ZKEconomicInflow=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 "use strict";
 const VERSION="zk-economic-accounting-1",SAMPLES=256;
 const RANGES={
  investment:{label:"本项目新增投资",unit:"亿元",max:100000},
  procurement:{label:"年度采购额",unit:"亿元/年",max:100000},
  localShare:{label:"采购留在仲恺的比例",unit:"%",max:100},
  supplierDisplacement:{label:"对已有本地采购的替代比例",unit:"%",max:100},
  jobs:{label:"项目直接岗位",unit:"人",max:10000000},
  jobDisplacement:{label:"被本地现有岗位替代的比例",unit:"%",max:100},
  land:{label:"新增工业用地",unit:"亩",max:10000000},
  power:{label:"年新增用电",unit:"万千瓦时/年",max:100000000},
  water:{label:"年新增用水",unit:"万吨/年",max:100000000}
 };
 const CAPACITIES={land:"可用工业用地",power:"可用年度供电容量",water:"可用年度供水容量"};
 const TYPES={proposed_new:"假设新引进",expansion:"现有企业扩产增量",backfill:"既有企业补入模型"};
 function range(raw,key){
  if(!Object.prototype.hasOwnProperty.call(RANGES,key))throw Error("Unsupported range "+key);
  if(raw==null||raw===""||(raw.low===""&&raw.high===""))return null;
  if(typeof raw!=="object"||raw.low===""||raw.high==="")throw Error(RANGES[key].label+"必须填写上下界，不能只填一边");
  const low=Number(raw.low),high=Number(raw.high);
  if(!Number.isFinite(low)||!Number.isFinite(high)||low<0||high<low||high>RANGES[key].max)
   throw Error(RANGES[key].label+"范围无效：必须为有限、非负、下界不超过上界的数值");
  return {low,high};
 }
 function capacity(raw,key){
  if(!(key in CAPACITIES))throw Error("Unsupported capacity");
  if(raw===""||raw==null)return null;
  const n=Number(raw);if(!Number.isFinite(n)||n<0||n>RANGES[key].max)throw Error(CAPACITIES[key]+"必须为有效非负数");
  return n;
 }
 function clean(raw){
  const s=raw&&typeof raw==="object"?raw:{};
  if(!Object.prototype.hasOwnProperty.call(TYPES,s.kind))throw Error("请选择新引进、扩产或存量补入的研究情景");
  const inputs={};for(const key of Object.keys(RANGES))inputs[key]=range(s.inputs?.[key],key);
  const capacities={};for(const key of Object.keys(CAPACITIES))capacities[key]=capacity(s.capacities?.[key],key);
  const seed=Number(s.seed??23);
  if(!Number.isSafeInteger(seed)||seed<1||seed>999999)throw Error("实验编号必须在1至999999之间");
  const source=String(s.source||"").trim().slice(0,500);
  if(source&&!/^https:\/\/[^\s<>{}]+$/i.test(source))throw Error("资料链接必须使用HTTPS");
  return {kind:s.kind,inputs,capacities,seed,source,
   company:String(s.company||"").trim().slice(0,90)};
 }
 function rng(seed){let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
 function quantile(xs,p){
  if(!xs.length)return null;const a=[...xs].sort((x,y)=>x-y),pos=(a.length-1)*p,i=Math.floor(pos),f=pos-i;
  return +(a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*f).toFixed(4);
 }
 function value(r,random){return r===null?null:r.low+(r.high-r.low)*random();}
 function one(input,rand){
  const v={};for(const key of Object.keys(RANGES))v[key]=value(input.inputs[key],rand);
  if(input.kind==="backfill"){
   return {newInvestment:0,localPurchasing:0,netAdditionalPurchasing:0,grossJobs:0,netJobs:0,
    landUse:0,powerUse:0,waterUse:0};
  }
  const local=v.procurement===null||v.localShare===null?null:v.procurement*v.localShare/100;
  const netPurchasing=local===null||v.supplierDisplacement===null?null:local*(1-v.supplierDisplacement/100);
  const netJobs=v.jobs===null||v.jobDisplacement===null?null:v.jobs*(1-v.jobDisplacement/100);
  return {newInvestment:v.investment,localPurchasing:local,netAdditionalPurchasing:netPurchasing,
   grossJobs:v.jobs,netJobs,landUse:v.land,powerUse:v.power,waterUse:v.water};
 }
 function resource(input,result){
  const checks=Object.keys(CAPACITIES).map(key=>{
   const use=result[{land:"landUse",power:"powerUse",water:"waterUse"}[key]],available=input.capacities[key];
   return {key,label:CAPACITIES[key],unit:RANGES[key].unit,need:use,capacity:available,
    ratio:use!==null&&available!==null?(available===0?(use===0?0:Infinity):use/available):null,
    status:use===null||available===null?"unknown":use>available?"exceeded":"within"};
  });
  return {checks,status:checks.some(x=>x.status==="exceeded")?"over-capacity":
    checks.every(x=>x.status==="within")?"within-provided-capacity":"incomplete"};
 }
 function run(raw){
  let input;try{input=clean(raw);}catch(e){return {ok:false,errors:[e.message]};}
  const warning=[],missing=[];
  for(const [key,detail] of Object.entries(RANGES))if(input.inputs[key]===null)missing.push(detail.label);
  for(const [key,detail] of Object.entries(CAPACITIES))if(input.capacities[key]===null)warning.push("尚未输入"+detail+"，承载力结论不完整");
  if(!input.source)warning.push("未提供公开依据：所有数字仅是用户输入的假设，不能作为已经落实的项目数据");
  else warning.push("资料链接未经系统验证，数字仍属于待核实输入");
  if(input.kind==="backfill"){
   if(Object.values(input.inputs).some(v=>v!==null&&v.high>0))
    warning.push("存量企业补入原模型不创造现实新增投资和岗位，经济增量强制归零；不能用其历史总量代替新增量");
  }else if(Object.values(input.inputs).every(v=>v===null)){
   return {ok:false,errors:["至少输入一项项目增量假设；不能凭企业名称推算投资或就业"]};
  }
  if(input.kind==="expansion")warning.push("扩产仅指相对于企业已有产能的增量，不是整家企业的全部存量");
  if(input.kind==="proposed_new")warning.push("拟引进项目为条件性假设，不代表已签约、实际投资或确定就业");
  const random=rng(input.seed),first=one(input,()=>.5),sampled=[];
  for(let i=0;i<SAMPLES;i++)sampled.push(one(input,random));
  const result={};for(const key of Object.keys(first)){
   const xs=sampled.map(s=>s[key]).filter(Number.isFinite);
   result[key]={p10:quantile(xs,.1),p50:quantile(xs,.5),p90:quantile(xs,.9),
    provided:xs.length===SAMPLES};
  }
  const mid=resource(input,first),low=one(input,()=>0),high=one(input,()=>1);
  const pressure=resource(input,high);
  if(pressure.status==="over-capacity")warning.push("在假设上界下，有资源需求超过用户输入容量，须核实土地、供电或供水");
  if(first.netAdditionalPurchasing!==null)
   warning.push("净本地采购仅扣除用户假设的替代比例，不含供应链乘数、增加值率、跨区转移或一般均衡反馈");
  if(first.netJobs!==null)
   warning.push("净岗位仅为新增岗位减去假设替代岗位，不等于官方就业统计或净社会就业");
  const questions=[];
  if(input.kind!=="backfill"){
   if(input.inputs.investment===null)questions.push("具体的新增投资额及分年度兑现节点是什么？");
   if(input.inputs.jobs===null)questions.push("相对现状的新增岗位数及招用来源如何核实？");
   if(input.inputs.procurement===null||input.inputs.localShare===null)
    questions.push("年度采购额和真正向仲恺本地企业采购的比例有何订单依据？");
   if(input.inputs.supplierDisplacement===null||input.inputs.jobDisplacement===null)
    questions.push("新增订单或岗位可能替代多少既有企业业务和当地岗位？");
   for(const x of mid.checks)if(x.status==="unknown"||x.status==="exceeded")
    questions.push(x.label+"能否满足新增需求？请提供有时间与空间范围的正式容量证明。");
  }else questions.push("这家既有企业是否另外有可核对的扩产项目？若有应单独填报扩产增量。");
  return {ok:true,protocol:VERSION,kind:input.kind,kindLabel:TYPES[input.kind],
   assumptions:input,metrics:result,resources:mid,highStress:pressure,
   complete:Object.values(result).every(x=>x.provided)&&mid.status==="within-provided-capacity",
   missing,questions,warnings:warning,
   sensitivity:"输入范围内独立均匀抽样的压力测试；P10/P50/P90不是现实统计概率、置信区间或政策效果预测",
   boundaries:["不推断GDP、工业增加值、税收或政策净收益",
    "新增采购不等于新增本地增加值，供应商替代率是待核实假设",
    "不使用原Sim指标折算现实经济影响，也不修改原Sim算法",
    "容量检查只是给定需求和容量的机械比较，不代表已获项目许可",
    "未输入的指标保持空缺，不能从企业行业标签倒推数值"]};
 }
 return {VERSION,SAMPLES,RANGES,CAPACITIES,TYPES,clean,range,quantile,one,resource,run};
});