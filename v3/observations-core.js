/* V3.4 annual-statistics evidence layer. Does not reference or alter the Sim model.
   Browser global: ZKObservations; Node module.exports: same interface. */
(function(scope,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(scope)scope.ZKObservations=api;
})(typeof window!=="undefined"?window:typeof globalThis!=="undefined"?globalThis:null,function(){
  "use strict";
  const safeUrl=value=>{
    try{const u=new URL(value);return u.protocol==="https:"&&!!u.hostname&&!u.username&&!u.password;}catch{return false;}
  };
  const validNum=x=>typeof x==="number"&&Number.isFinite(x);
  function validate(data){
    const errors=[],warnings=[];
    if(!data||data.schema!=="zk-annual-observations-v1"){
      return {ok:false,errors:["年度观测数据版本不受支持"],warnings,rows:[],byMetric:{},years:[]};
    }
    if(data.region!=="zhongkai")errors.push("行政区应为 zhongkai");
    const metrics=data.metric_definitions||{},sources=data.sources||{};
    if(!Array.isArray(data.observations))errors.push("缺少 observations");
    const rows=Array.isArray(data.observations)?data.observations:[];
    const used=new Set(),years=new Set(),byMetric={};
    Object.entries(sources).forEach(([id,s])=>{
      if(!s||!safeUrl(s.url))errors.push("来源 "+id+" 缺少合法的 HTTPS 链接");
    });
    rows.forEach((r,i)=>{
      if(!r||!Number.isInteger(r.year)||r.year<1990||r.year>2035)errors.push("行 "+(i+1)+" 年份不合法");
      if(!r||!Object.hasOwn(metrics,r.metric))errors.push("行 "+(i+1)+" 缺少指标定义");
      if(!r||!validNum(r.value))errors.push("行 "+(i+1)+" 数值非有限数值");
      if(!r||!Array.isArray(r.source_ids)||!r.source_ids.length||r.source_ids.some(id=>!Object.hasOwn(sources,id)))
        errors.push("行 "+(i+1)+" 来源缺失");
      const id=r&&r.year+"|"+r.metric;
      if(used.has(id))errors.push("重复观测 "+id);used.add(id);
      if(r&&metrics[r.metric]&&r.unit!==metrics[r.metric].unit)errors.push("指标 "+id+" 单位不符");
      if(r&&Number.isInteger(r.year))years.add(r.year);
      if(r&&metrics[r.metric]){if(!byMetric[r.metric])byMetric[r.metric]=[];byMetric[r.metric].push(r);}
    });
    Object.values(byMetric).forEach(series=>series.sort((a,b)=>a.year-b.year));
    if(years.size<8)warnings.push("独立年度观察不足 8 个；无法提供合格的历史留出期回测");
    if(data.model_mapping===null || !data.model_mapping)warnings.push("尚未冻结“现实观测 → 模型指数”映射规则，禁止直接调参");
    if(data.independent_holdout!==true)warnings.push("本数据集属于回溯摘录，不是先预测再观测的独立留出集");
    if(data.calibration_status!=="verified")warnings.push("参数校准未认证；这些数字仅可用于描述性统计");
    const gdp=Object.fromEntries((byMetric.gdp_current||[]).map(r=>[r.year,r.value]));
    const components={primary_current:"第一产业",secondary_current:"第二产业",tertiary_current:"第三产业"};
    for(const year of years){
      const parts=Object.keys(components).map(k=>(byMetric[k]||[]).find(x=>x.year===year)?.value);
      if(parts.every(validNum)&&validNum(gdp[year])){
        const difference=parts.reduce((a,b)=>a+b,0)-gdp[year];
        if(Math.abs(difference)>.03)warnings.push(year+" GDP 三次产业分项与总量差异大于 0.03 亿元");
      }
    }
    const budgets=byMetric.budget_current||[];
    const b24=budgets.find(x=>x.year===2024),b25=budgets.find(x=>x.year===2025);
    if(b24&&b25&&validNum(b24.value)&&validNum(b25.value)&&b24.value>0){
      const mechanical=(b25.value/b24.value-1)*100;
      if(Math.abs(mechanical-3.7)>5)
        warnings.push("财政预算收入待复核：2025 总量与 2024 总量机械计算约 "+mechanical.toFixed(1)+"%，但 2025 公报另写同比 3.7%；可能存在历史修订或口径调整，不能直接采作校准输入");
    }
    const retail=byMetric.retail_current||[];
    const r19=retail.find(x=>x.year===2019),r20=retail.find(x=>x.year===2020);
    if(r19&&r20&&r19.value>0){
      const mechanical=(r20.value/r19.value-1)*100;
      if(Math.abs(mechanical-(-8.3))>5)
        warnings.push("零售统计口径断点待复核：2019至2020公布总量机械变化约 "+mechanical.toFixed(1)+"%，2020公报公布同比-8.3%；不可直接连接或拟合这两年现价零售额。");
    }
    for(const metric of Object.keys(metrics)){
      for(const year of years)if(!(byMetric[metric]||[]).some(x=>x.year===year))
        warnings.push(metric+" "+year+" 年缺值；不得内插代填");
    }
    return {ok:!errors.length,errors,warnings,rows,byMetric,years:[...years].sort()};
  }
  function lineSeries(audit,metric){
    const series=audit.byMetric[metric]||[];
    const dict=new Map(series.map(x=>[x.year,x]));
    return audit.years.map(year=>({year,row:dict.get(year)||null}));
  }
  function readiness(audit,data){
    const reasons=[];
    if(!audit.ok)reasons.push("源数据结构校验未通过");
    if(audit.years.length<8)reasons.push("连续年度样本不足 8 个，不能支持训练及真正留出期的拆分");
    if(!data.model_mapping)reasons.push("尚无事前冻结的模型指数观测映射");
    if(data.independent_holdout!==true)reasons.push("缺少事前归档预测与独立留出结果");
    if(!data.calendar_tick_mapping)reasons.push("缺少已冻结的“模型时间步 → 日历日期”映射");
    return {canCalibrate:reasons.length===0,reasons};
  }
  return {validate,lineSeries,readiness};
});
