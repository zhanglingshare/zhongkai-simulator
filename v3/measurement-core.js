/* V3.6 Evidence-to-state measurement bridge.
   Standalone read-only analysis. Explicit time correspondence and training-only fit.
   NEVER authenticates archives, estimates Sim parameters or claims out-of-sample skill. */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.ZKMeasurement=api;
})(typeof window!=="undefined"?window:(typeof globalThis!=="undefined"?globalThis:null),function(){
 "use strict";
 const SCHEMA="zk-measurement-bridge-v1";
 const finite=x=>typeof x==="number"&&Number.isFinite(x);
 const isObject=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
 const candidates=Object.freeze({
   "abundance:industry_growth":{state:"abundance",stateName:"景气",observed:"industry_growth",observedName:"规上工业增加值同比",expected:"positive",strength:"弱间接代理",reason:"产业增加值增长反映产出变动，但不能直接测量经济主体的模型内景气。"},
   "abundance:gdp_real_yoy":{state:"abundance",stateName:"景气",observed:"gdp_real_yoy",observedName:"GDP可比价同比",expected:"positive",strength:"弱间接代理",reason:"区域GDP同时包含产业、消费和服务业，不能当作景气状态的直接观测。"},
   "disaster:industry_invest_growth":{state:"disaster",stateName:"风险",observed:"industry_invest_growth",observedName:"工业投资同比",expected:"negative",strength:"高度间接代理",reason:"工业投资波动可能涉及项目周期和政策，不能单独识别网络灾害或真实风险。"}
 });
 const allStates=[
  {key:"abundance",name:"景气",type:"indirect",text:"可探索规上工业增加值同比/GDP实际增速的测量关系；尚无经过校准的转换公式。"},
  {key:"order",name:"协同",type:"missing",text:"缺本地采购率、合同网络或跨企业协作强度的独立年度测量。"},
  {key:"disaster",name:"风险",type:"indirect",text:"工业投资同比只是极弱的间接代理；还需停工、断链、违约等可核查事件数据。"},
  {key:"mood",name:"信心",type:"missing",text:"缺按固定方法采集的企业信心或预期调查序列。"},
  {key:"survivors",name:"存续率",type:"missing",text:"缺定义一致的企业出生队列、注销退出和样本随访数据。"}
 ];
 const blocked=(message,details=[])=>({ok:false,validationPassed:false,calibrated:false,status:"blocked",message,details});
 function coverage(data){
   if(!isObject(data)||!Array.isArray(data.observations)||!isObject(data.sources))
     return {valid:false,states:[],candidateSummary:[],warning:"历史数据不可读"};
   const seriesKey=(key)=>data.observations.filter(r=>r&&r.metric===key&&finite(r.value)&&
     Array.isArray(r.source_ids)&&r.source_ids.length>0);
   const stateCards=allStates.map(s=>{
     const attached=Object.values(candidates).filter(c=>c.state===s.key);
     return {key:s.key,name:s.name,type:s.type,description:s.text,proxies:attached.map(c=>({
       key:c.observed,label:c.observedName,years:seriesKey(c.observed).map(r=>r.year).sort((a,b)=>a-b)
     }))};
   });
   return {valid:true,states:stateCards,candidateSummary:Object.entries(candidates).map(([id,c])=>({
     id,...c,years:seriesKey(c.observed).map(r=>r.year).sort((a,b)=>a-b)
   })),warning:"代理假设只代表可被证伪的候选测量关系；与真实指标同向或相关不等于因果或已校准。"};
 }
 function archiveHistory(archive){
   if(!isObject(archive)||archive.schema!=="zhongkai-v3-research-1"||!isObject(archive.A_B))
     return {ok:false,error:"请导入 V3.2/V3.5 导出的 zhongkai-v3-research-1 实验 JSON"};
   const h=archive.A_B.baselineHistory;
   if(!Array.isArray(h)||h.length<4||h.length>101)
     return {ok:false,error:"缺少模型基线 A 的完整时间步序列"};
   let last=-1;
   const seen=new Set();
   for(const s of h){
     if(!isObject(s)||!Number.isInteger(s.tick)||s.tick<0||s.tick<=last||seen.has(s.tick)||!isObject(s.metrics))
       return {ok:false,error:"模型快照的时间步必须严格递增且不重复"};
     seen.add(s.tick);last=s.tick;
     for(const k of allStates)if(!finite(s.metrics[k.key]))return {ok:false,error:"缺少有限的模型状态指标 "+k.key};
   }
   return {ok:true,steps:h.map(s=>s.tick),records:h,seed:archive.A_B.seed,
     shock:archive.A_B.shock,modelVersion:archive.model||"未注明",stale:!!archive.A_B.stale};
 }
 function pairCheck(data,archive,spec){
   if(!isObject(spec)||spec.schema!==SCHEMA)return blocked("请先提供受支持的映射协议版本");
   const candidate=candidates[spec.candidate];
   if(!candidate)return blocked("未登记此测量假设；不允许任意将 GDP 总量与模型指数直接匹配");
   if(!Number.isInteger(spec.trainThrough)||spec.trainThrough<1900||spec.trainThrough>2100)
     return blocked("需要明确的样本内拟合截止年度");
   if(!Array.isArray(spec.correspondence)||spec.correspondence.length<4||spec.correspondence.length>40)
     return blocked("需要至少四对“现实年份 → 模型时间步”的显式映射，不能自动将一步视为一年");
   const hist=archiveHistory(archive);
   if(!hist.ok)return blocked(hist.error);
   const observations=data&&Array.isArray(data.observations)?data.observations:[];
   const sourceById=data&&isObject(data.sources)?data.sources:{};
   const obs=observations.filter(r=>r&&r.metric===candidate.observed);
   if(obs.length!==new Set(obs.map(r=>r.year)).size)return blocked("观测数据出现重复年份，拒绝拟合");
   const obsByYear=new Map(obs.map(r=>[r.year,r]));
   const snapshot=new Map(hist.records.map(r=>[r.tick,r]));
   const seenYears=new Set(),seenTicks=new Set(),points=[],errors=[];
   let lastYear=-Infinity,lastTick=-Infinity;
   for(const entry of spec.correspondence){
     if(!isObject(entry)||!Number.isInteger(entry.year)||!Number.isInteger(entry.tick)){
       errors.push("映射包含非法年份或时间步");continue;
     }
     if(seenYears.has(entry.year)||seenTicks.has(entry.tick))errors.push("年度和时间步必须一一对应，不可重复");
     if(entry.year<=lastYear||entry.tick<=lastTick)errors.push("年度与时间步必须严格同步递增");
     seenYears.add(entry.year);seenTicks.add(entry.tick);lastYear=entry.year;lastTick=entry.tick;
     const o=obsByYear.get(entry.year),h=snapshot.get(entry.tick);
     if(!o||!finite(o.value)){errors.push(entry.year+" 年没有原始官方指标数值；不能填充");continue;}
     if(!h||!finite(h.metrics[candidate.state])){errors.push("不存在有效的模型快照步 "+entry.tick);continue;}
     if(!Array.isArray(o.source_ids)||!o.source_ids.length||o.source_ids.some(id=>!sourceById[id])){
       errors.push(entry.year+" 年原始观测的来源记录不完整");continue;
     }
     points.push({year:entry.year,tick:entry.tick,
       modelValue:h.metrics[candidate.state],observed:o.value,observedUnit:o.unit,
       sources:o.source_ids.map(id=>({id,url:sourceById[id].url,
          publisher:sourceById[id].publisher,kind:sourceById[id].host_type})),
       reviewStatus:o.review_status});
   }
   if(errors.length)return blocked("映射无法复算",errors.slice(0,20));
   const training=points.filter(p=>p.year<=spec.trainThrough);
   const later=points.filter(p=>p.year>spec.trainThrough);
   if(training.length<3||later.length<1)
     return blocked("至少需要三个已配对的样本内年度，并保留一个截止年之后的展示年度");
   return {ok:true,candidate,points,training,later,hist};
 }
 function affineFit(points){
   if(points.length<3)return blocked("训练样本不足");
   const xbar=points.reduce((s,p)=>s+p.modelValue,0)/points.length;
   const ybar=points.reduce((s,p)=>s+p.observed,0)/points.length;
   let sxx=0,sxy=0;
   for(const p of points){
     const dx=p.modelValue-xbar;
     sxx+=dx*dx;sxy+=dx*(p.observed-ybar);
   }
   if(sxx<1e-10)return blocked("模型状态在样本内几乎没有变化，测量斜率无法辨识");
   const slope=sxy/sxx,intercept=ybar-slope*xbar;
   if(!finite(slope)||!finite(intercept))return blocked("样本内估计数值不稳定");
   return {ok:true,slope,intercept,predict:x=>intercept+slope*x};
 }
 function evaluate(data,archive,spec){
   const joined=pairCheck(data,archive,spec);
   if(!joined.ok)return joined;
   const fit=affineFit(joined.training);
   if(!fit.ok)return fit;
   const mapped=joined.points.map(p=>({...p,estimated:fit.predict(p.modelValue),
     residual:fit.predict(p.modelValue)-p.observed,
     phase:p.year<=spec.trainThrough?"training":"later_replay"}));
   const train=mapped.filter(p=>p.phase==="training"),after=mapped.filter(p=>p.phase==="later_replay");
   const mae=arr=>arr.reduce((s,p)=>s+Math.abs(p.residual),0)/arr.length;
   const sign=joined.candidate.expected==="positive"?1:-1;
   const sourceCount=mapped.filter(p=>p.reviewStatus==="mirror_needs_primary").length;
   const issues=[
     "Sim 模型编码了截至 2025 年的历史事件和默认指标；2019—2025 不构成其独立留出预测。",
     "模型20步不是日历年份。这里的每一条对照关系均由研究者声明，尚未证明时间尺度具有实际意义。",
     "只对截止年及之前的数据拟合直线；后段误差是已知历史下的事后回放，不能叫作历史预测成绩。",
     "公报发布时点、数值修订历史、模型当年版本均未认证。"
   ];
   if(sourceCount)issues.push(sourceCount+" 条观测只由转载稿支撑，必须另行核对原始公报。");
   if(fit.slope*sign<=0)issues.push("样本内测量斜率与最初登记的代理假设方向相反，属于需要反证解释的发现。");
   if(joined.hist.stale)issues.push("所导入 A/B 实验导出时标记 stale，设置已发生变更。");
   const protocol={
     schema:SCHEMA,candidate:spec.candidate,trainThrough:spec.trainThrough,
     correspondence:joined.points.map(p=>({year:p.year,tick:p.tick})),
     measurementEquation:"observed_percent = intercept + slope * model_state",
     fittedFromYears:train.map(p=>p.year),
     estimate:{intercept:fit.intercept,slope:fit.slope},
     modelSource:joined.hist.modelVersion,seed:joined.hist.seed,
     disclaimer:"事后样本内诊断：不构成外部验证、参数校准或对未来年份的真实预测。"
   };
   return {ok:true,status:"exploratory-only",validationPassed:false,calibrated:false,
     candidate:joined.candidate,protocol,
     trainMae:mae(train),laterReplayMae:mae(after),trainCount:train.length,
     laterCount:after.length,points:mapped,issues};
 }
 function emptyProtocol(){
   return {schema:SCHEMA,candidate:"abundance:industry_growth",trainThrough:2022,correspondence:[],
     note:"手动登记每个日历年对应的 Sim 快照 tick；不能默认一模型步=一年。"};
 }
 function futureProtocol(){
   return {schema:"zk-prospective-observation-protocol-v1",
     state:"abundance",observable:"industry_growth",measurement:"未冻结：需事先登记转换/时间对齐方法",
     modelCommit:"",predictionArchiveURL:"",issuedAt:"",
     trainingCutoffYear:null,targetObservationYear:2027,
     observationReleasePolicy:"以统计部门正式发布时间为准，保留数据初版和后续修订记录",
     requirements:["固定模型版本/参数/种子","定义模型步与实际日期映射",
       "锁定测量参数且不能再用测试年份重估","预测目标发布前获得不可篡改的预测归档",
       "发布后按锁定口径评分，与上年持平基线作同量纲比较"],
     certification:"未满足；仅为预注册工作模板。"};
 }
 return {SCHEMA,candidates,states:allStates,coverage,archiveHistory,pairCheck,affineFit,evaluate,emptyProtocol,futureProtocol};
});
