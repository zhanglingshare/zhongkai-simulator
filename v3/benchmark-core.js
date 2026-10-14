/* V3.5 retrospective baseline benchmark. No Sim parameters, no future input.
   This is NOT independently archived forecasting: annual vintages are not frozen. */
(function(root,factory){
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.ZKBenchmark=api;
})(typeof window!=="undefined"?window:typeof globalThis!=="undefined"?globalThis:null,function(){
 "use strict";
 const accepted=new Set(["gdp_real_yoy","industry_growth","industry_invest_growth"]);
 const isFiniteNum=x=>typeof x==="number"&&Number.isFinite(x);
 function evaluate(data,metric){
   const blocked=(text)=>({eligible:false,reason:text,folds:[],scores:null,
      certified:false,notIndependent:true,modelCalibrated:false});
   if(!data || !Array.isArray(data.observations))return blocked("缺少年度观测数据");
   if(!accepted.has(metric))return blocked("本模块只比较公开的年度同比增长率；现价总量和零售口径断点不得混入");
   const series=data.observations.filter(r=>r.metric===metric&&isFiniteNum(r.value))
     .sort((a,b)=>a.year-b.year);
   const distinct=new Set(series.map(r=>r.year));
   if(series.length!==distinct.size)return blocked("同一指标同一年存在重复观测");
   if(series.length<5)return blocked("至少需要5个连续年度的公开同比观测");
   if(series.some((r,i)=>i>0 && r.year!==series[i-1].year+1))
      return blocked("序列存在缺失年份，禁止跨缺口计算误差");
   if(series.some(r=>!Array.isArray(r.source_ids)||!r.source_ids.length))
      return blocked("观测缺少来源，不能评分");
   const folds=[];
   // Earliest possible comparison after 3 complete prior years. Target year y never used for prediction.
   for(let i=3;i<series.length;i++){
     const past=series.slice(0,i);
     const target=series[i];
     const naive=past[past.length-1].value;
     const mean=past.reduce((sum,p)=>sum+p.value,0)/past.length;
     folds.push({
       year:target.year,actual:target.value,naive,mean,naive_error:naive-target.value,mean_error:mean-target.value,
       training_start:past[0].year,training_end:past[past.length-1].year,train_count:past.length,
       actual_source_ids:target.source_ids
     });
   }
   const mae=(key)=>folds.reduce((x,p)=>x+Math.abs(p[key]),0)/folds.length;
   const rmse=(key)=>Math.sqrt(folds.reduce((x,p)=>x+p[key]*p[key],0)/folds.length);
   const scores={n:folds.length,naive:{mae:mae("naive_error"),rmse:rmse("naive_error")},
     expandingMean:{mae:mae("mean_error"),rmse:rmse("mean_error")}};
   return {eligible:true,metric,folds,scores,certified:false,notIndependent:true,modelCalibrated:false,
     caveat:"仅作事后回溯重建的朴素基线诊断：预测使用历年已公布观测，但未重建当年实际可获得的数据版本、发布时间与修订链；不代表当时已归档预测，不是 Sim 模型历史验证，更不是模型参数校准。"};
 }
 return {evaluate,acceptedMetrics:[...accepted]};
});
