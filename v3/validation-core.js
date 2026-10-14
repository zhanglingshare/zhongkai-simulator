/* Evidence and held-out scoring — no simulation engine changes.
   Browser: window.ZKVerify; Node: require('./validation-core.js').
   The validator cannot authenticate URLs or independently certify archive timestamps. */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object" && module.exports)module.exports=api;
  if(root)root.ZKVerify=api;
})(typeof window!=="undefined"?window:(typeof globalThis!=="undefined"?globalThis:null),function(){
  "use strict";
  const schema="zk-backtest-v1";
  const metrics={abundance:[0,1],order:[0,1],disaster:[0,1],mood:[-1,1],survivors:[0,1]};
  const names={abundance:"景气",order:"协同",disaster:"风险",mood:"信心",survivors:"存续率"};
  const isObj=o=>o!==null&&typeof o==="object"&&!Array.isArray(o);
  const url=(v)=>{try{const u=new URL(v);return u.protocol==="https:"&&!!u.hostname&&u.username===""&&u.password==="";}catch{return false;}};
  const day=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
  const num=x=>typeof x==="number"&&Number.isFinite(x);
  function ageDays(time,now){
    if(typeof time!=="string")return null;
    const m=time.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if(!m||!day(m[1]))return null;
    const hh=Number(m[2]||0),mm=Number(m[3]||0);
    if(hh>23||mm>59)return null;
    const d=Date.parse(m[1]+"T"+String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0")+":00+08:00");
    return (now-d)/86400000;
  }
  function auditFeeds(hot,life,now=Date.now()){
    const issues=[],info={};
    if(!isObj(hot))issues.push({level:"error",area:"hot",text:"新闻数据缺失或格式不是 JSON 对象。"});
    else{
      if(hot.region!=="zhongkai")issues.push({level:"error",area:"hot",text:"新闻数据 region 不是 zhongkai。"});
      if(!Array.isArray(hot.items))issues.push({level:"error",area:"hot",text:"新闻 items 不存在。"});
      const items=Array.isArray(hot.items)?hot.items:[];
      const metaCount=Number(hot.count);
      if(!Number.isInteger(metaCount)||metaCount!==items.length)issues.push({level:"warn",area:"hot",text:"新闻 count 与实际 items 数量不一致。"});
      let selfVerified=0,missing=0;
      items.forEach((it,i)=>{
        if(!isObj(it) || !it.title || !it.source || !url(it.url) || !day(it.published_at)){
          missing++;issues.push({level:"warn",area:"hot",text:"第 "+(i+1)+" 条新闻缺少标题、HTTPS 来源链接或有效发布日期。"});
        }
        if(it&&it.verified_status==="已核验")selfVerified++;
      });
      const age=ageDays(hot.fetched_at||hot.updated,now);
      if(age===null)issues.push({level:"warn",area:"hot",text:"新闻数据抓取时间缺失或无法解释。"});
      else if(age>2)issues.push({level:"warn",area:"hot",text:"新闻抓取距检查时刻已超过 48 小时（以北京时间解释无时区时间戳）。"});
      if(age!==null&&age<-.1)issues.push({level:"warn",area:"hot",text:"新闻抓取时间晚于当前时刻，请检查时区或时钟。"});
      info.hot={count:items.length,selfVerified,missing,ageDays:age,updated:hot.fetched_at||hot.updated||"—"};
    }
    if(!isObj(life))issues.push({level:"error",area:"life",text:"镇街数据缺失或格式不是 JSON 对象。"});
    else{
      const towns=Array.isArray(life.towns)?life.towns:[];
      if(life.region!=="zhongkai")issues.push({level:"error",area:"life",text:"镇街数据 region 不是 zhongkai。"});
      if(!Array.isArray(life.towns))issues.push({level:"error",area:"life",text:"镇街 towns 不存在。"});
      const namesSeen=new Set();let pending=0,sourceReady=0;
      towns.forEach((t,i)=>{
        if(!isObj(t)||!t.n){issues.push({level:"warn",area:"life",text:"第 "+(i+1)+" 条镇街记录缺少名称。"});return;}
        if(namesSeen.has(t.n))issues.push({level:"warn",area:"life",text:"重复镇街记录："+t.n});
        namesSeen.add(t.n);
        if(t.verified_status==="pending"||!t.verified_status)pending++;
        if(url(t.source_url))sourceReady++;
      });
      const age=ageDays(life.fetched_at||life.updated,now);
      if(age!==null&&age>2)issues.push({level:"warn",area:"life",text:"镇街数据抓取距检查时刻已超过 48 小时。"});
      info.life={towns:towns.length,pending,sourceReady,ageDays:age,updated:life.fetched_at||life.updated||"—"};
    }
    return {info,issues,errors:issues.filter(x=>x.level==="error").length,warnings:issues.filter(x=>x.level==="warn").length,
      note:"“已核验”仅反映源文件自带的采集流程标记；本审查未独立访问新闻源页面核验事实。每日抓取并不代表模型参数实时重估或经过历史回测。"};
  }
  function parseParams(source){
    if(typeof source!=="string")return [];
    const segment=source.match(/const PARAM_LINEAGE\s*=\s*\[([\s\S]*?)\]\s*;/);
    if(!segment)return [];
    const regex=/\[\s*"([^"]+)"\s*,\s*(-?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*"([ABCD])"\s*,\s*"([^"]*)"\s*,\s*(true|false)\s*\]/g;
    return [...segment[1].matchAll(regex)].map(m=>({name:m[1],value:Number(m[2]),grade:m[3],note:m[4],needsReview:m[5]==="true",structural:["n_agents","ticks"].includes(m[1])}));
  }
  function assessHoldout(input){
    const fatal=[],cautions=[];
    if(!isObj(input))return {eligible:false,errors:["文件必须是 JSON 对象。"],cautions:[],stats:null};
    if(input.schema!==schema)fatal.push("schema 必须为 "+schema+"。");
    if(input.scope!=="model-index")fatal.push("scope 必须是 model-index。GDP 等现实指标不可直接当作模型内部指数。");
    const metric=input.metric;
    if(!Object.hasOwn(metrics,metric))fatal.push("不支持该 metric。");
    if(typeof input.mapping_id!=="string"||input.mapping_id.trim().length<8)fatal.push("需要至少 8 字的、固定版本的现实观测→模型指数映射标识 mapping_id。");
    if(!url(input.mapping_spec_url))fatal.push("需要可检查的 HTTPS 映射说明文档 mapping_spec_url。");
    if(!/^[a-fA-F0-9]{40}$/.test(input.model_commit||""))fatal.push("model_commit 必须为归档模型的 40 位 Git SHA。");
    if(!day(input.calibration_cutoff))fatal.push("需要有效 YYYY-MM-DD 校准截止日。");
    if(!Array.isArray(input.cases)){fatal.push("cases 必须为数组。");return {eligible:false,errors:fatal,cautions,stats:null};}
    if(input.cases.length<8)fatal.push("至少需要 8 个独立保留的观测记录。");
    if(input.cases.length>500)fatal.push("最多导入 500 个观测记录。");
    const unique=new Set(),obsDates=new Set();
    const limits=metrics[metric];
    input.cases.forEach((c,i)=>{
      const prefix="第 "+(i+1)+" 条：";
      if(!isObj(c)){fatal.push(prefix+"记录不是对象。");return;}
      const ident=c.id;
      if(typeof ident!=="string"||!ident.trim()){fatal.push(prefix+"缺少 id。");}
      else if(unique.has(ident)){fatal.push(prefix+"id 重复。");}else unique.add(ident);
      if(!day(c.predicted_at)||!day(c.observed_at)){
        fatal.push(prefix+"预测与观测日期必须为 YYYY-MM-DD。");
      }else{
        obsDates.add(c.observed_at);
        if(c.predicted_at>=c.observed_at)fatal.push(prefix+"必须在观测结果出现之前归档预测。");
        if(day(input.calibration_cutoff)&&c.predicted_at<=input.calibration_cutoff)fatal.push(prefix+"预测日期应晚于校准截止日。");
        if(day(input.calibration_cutoff)&&c.observed_at<=input.calibration_cutoff)fatal.push(prefix+"观测结果落入校准时间窗，存在数据泄漏风险。");
      }
      if(!url(c.source_url))fatal.push(prefix+"需要观测结果的 HTTPS 来源 source_url。");
      if(!url(c.forecast_archive_url))fatal.push(prefix+"需要事前预测归档 HTTPS 链接 forecast_archive_url。");
      if(c.used_in_calibration!==false)fatal.push(prefix+"used_in_calibration 必须明确为 false。");
      for(const f of ["predicted","observed","naive"]){
        if(!num(c[f])||!limits||c[f]<limits[0]||c[f]>limits[1])
          fatal.push(prefix+f+" 必须为指定模型指标有效范围内的有限数值。");
      }
    });
    if(obsDates.size<3)fatal.push("观测至少覆盖 3 个不同的结束日期，避免单个日期重复计数。");
    cautions.push("档案时间、来源真实性、样本独立性、映射口径和是否进入训练集均为文件提供者声明，系统无法仅凭 URL 自行认证。");
    cautions.push("归档的预测值不一定由指定模型版本生成；仍需人工或第三方复现与核验。");
    cautions.push("同一日期或主体可能存在相关性；误差描述不包含独立同分布假设或置信区间。");
    if(fatal.length)return {eligible:false,errors:fatal,cautions,stats:null};
    const cases=input.cases;
    let abs=0,sq=0,naiveAbs=0,naiveSq=0;
    const rows=cases.map(c=>{
      const e=c.predicted-c.observed,n=c.naive-c.observed;
      abs+=Math.abs(e);sq+=e*e;naiveAbs+=Math.abs(n);naiveSq+=n*n;
      return {id:c.id,observed_at:c.observed_at,predicted:c.predicted,observed:c.observed,
        naive:c.naive,error:e,absolute_error:Math.abs(e)};
    });
    const mean=x=>x/cases.length;
    const mae=mean(abs),naiveMae=mean(naiveAbs);
    const stats={
      metric,metricName:names[metric],count:cases.length,periods:obsDates.size,
      mae,rmse:Math.sqrt(mean(sq)),naiveMae,naiveRmse:Math.sqrt(mean(naiveSq)),
      improvement:naiveMae>0?(naiveMae-mae)/naiveMae:null,
      baselineIsDeclared:true,rows
    };
    return {eligible:true,errors:[],cautions,stats,status:"结构校验通过（来源及事前归档未独立认证）"};
  }
  function template(){
    return {
      schema,scope:"model-index",metric:"abundance",
      mapping_id:"请填写已冻结的映射规则版本 v1",
      mapping_spec_url:"https://example.org/your-frozen-mapping",
      model_commit:"0000000000000000000000000000000000000000",
      calibration_cutoff:"2024-12-31",
      cases:[
        {id:"REPLACE_ME_01",predicted_at:"2025-01-01",observed_at:"2025-04-01",
          predicted:null,observed:null,naive:null,source_url:"",forecast_archive_url:"",
          used_in_calibration:false}
      ],
      guidance:"这是填写格式，不是演示回测数据；需要至少 8 个有效独立记录、3 个不同观测日期，且所有观测口径与模型指标相容。不得填入想象的历史数字。"
    };
  }
  return {schema,metrics,names,auditFeeds,parseParams,assessHoldout,template};
});
