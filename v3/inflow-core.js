/* V3.13 · Hypothetical new-enterprise inflow: runs the UNMODIFIED ZKSim engine.
   A and B use matching seeds; B adds exactly one model actor and only user-specified
   hypothetical links before T0. No new economic equation, real-world attribution,
   official enterprise matching, real probability, or external truth verification. */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.ZKInflow=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const VERSION="zk-inflow-research-1",TICKS=20,BASE_COUNT=24;
  const TYPES=["anchor","oem","supplier","service"];
  const METRICS=[
    {key:"abundance",label:"模型景气"},
    {key:"order",label:"模型协同"},
    {key:"disaster",label:"模型风险"},
    {key:"mood",label:"模型信心"}
  ];
  const own=(a,key)=>Object.prototype.hasOwnProperty.call(a,key);
  const round=(n)=>Math.round(n*1000000)/1000000;
  function quantile(values,q){
    const a=[...values].sort((x,y)=>x-y);
    if(!a.length)return null;
    const p=(a.length-1)*q,i=Math.floor(p),r=p-i;
    return round(a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*r);
  }
  function clean(raw){
    const v=raw||{};
    return {
      name:String(v.name||"").trim(),
      type:String(v.type||"supplier"),
      weight:Number(v.weight),
      seed:Number(v.seed),
      targets:[...new Set((Array.isArray(v.targets)?v.targets:[]).map(x=>String(x||"").trim()).filter(Boolean))],
      evidence:String(v.evidence||"unverified"),
      source:String(v.source||"").trim(),
      notes:String(v.notes||"").trim()
    };
  }
  function sample(Sim,seed){
    return new Sim(seed,{n_agents:BASE_COUNT,ticks:TICKS});
  }
  function validate(Sim,raw){
    const v=clean(raw),errors=[],warnings=[];
    if(typeof Sim!=="function")errors.push("模型内核未加载");
    if(!v.name||v.name.length>60||/[\u0000-\u001f<>]/.test(v.name))errors.push("请输入 1—60 字、不含控制字符或尖括号的企业假设名称");
    if(!TYPES.includes(v.type))errors.push("不支持的产业角色");
    if(![1,2].includes(v.weight))errors.push("主体权重只能是 1 或 2（不能享受核心节点保护）");
    if(!Number.isSafeInteger(v.seed)||v.seed<1||v.seed>999999)errors.push("随机种子必须是 1—999999 的整数");
    if(v.targets.length<1||v.targets.length>3)errors.push("请选择 1—3 个假设关系对象");
    if(v.source&&(!/^https:\/\/[^\s]+$/i.test(v.source)||v.source.length>500))errors.push("材料链接必须是 HTTPS，且不超过 500 字");
    if(v.notes.length>600)errors.push("说明文字不能超过 600 字");
    if(!["unverified","user_claim","public_document"].includes(v.evidence))errors.push("无效的证据标记");
    let baseline=null;
    if(typeof Sim==="function"&&Number.isSafeInteger(v.seed)&&v.seed>=1&&v.seed<=999999){
      baseline=sample(Sim,v.seed);
      const names=new Set(baseline.agents.map(a=>a.name));
      if(names.has(v.name))errors.push("新企业名称与当前模型中的已有主体重名");
      for(const target of v.targets)if(!names.has(target))errors.push("假设关系对象不在本局模型主体内："+target);
      if(v.targets.includes(v.name))errors.push("不能连接自身");
    }
    if(v.evidence!=="public_document"||!v.source)warnings.push("关系未经独立核验；所有新增关系只按用户假设进入模型");
    if(v.evidence==="public_document"&&v.source)warnings.push("填写网页链接不等于来源已认证，仍需人工核查主体与关系");
    if(v.weight===2)warnings.push("权重 2 是探索性模型假设，不代表经核定的企业规模");
    warnings.push("A/B 即使使用相同种子，新增主体可能改变随机消耗顺序；差值不构成因果效应");
    return {ok:errors.length===0,errors,warnings,input:v,baseline};
  }
  function inject(Sim,sim,v){
    const pool=new Sim(v.seed,{n_agents:41,ticks:TICKS});
    const sampleAgent=pool.agents.find(a=>a.type===v.type);
    if(!sampleAgent)throw new Error("模型候选主体缺少指定类型："+v.type);
    if(sim.agents.some(a=>a.name===v.name))throw new Error("新主体名称重复");
    const inserted={
      name:v.name,type:v.type,t:240,w:v.weight,power:sampleAgent.power,
      renown:sampleAgent.renown,energy:sampleAgent.energy,
      sentiment:0,alive:true,memory:["用户假设的新主体接入（非工商登记核验）"]
    };
    sim.agents.push(inserted);
    v.targets.forEach(name=>sim._addEdge(v.name,name,"hypothesis","用户假设关系·未核验"));
    sim._computeKcap();
    sim._log("hypothetical_inflow",{name:v.name,type:v.type,weight:v.weight,targets:v.targets,verified:false});
    sim.snapshots[0]=sim._snap(); // IMPORTANT: T0 includes user-specified inflow.
    return inserted;
  }
  function metrics(a,b){
    const result={};
    METRICS.forEach(m=>{
      const av=a.state[m.key],bv=b.state[m.key];
      result[m.key]={a:round(av),b:round(bv),delta:round(bv-av)};
    });
    const old=new Set(a.agents.map(x=>x.name));
    const aliveA=a.agents.filter(x=>x.alive).length;
    const aliveBOld=b.agents.filter(x=>old.has(x.name)&&x.alive).length;
    result.existingAlive={a:aliveA,b:aliveBOld,delta:aliveBOld-aliveA};
    return result;
  }
  function pair(Sim,v,seed){
    const p={n_agents:BASE_COUNT,ticks:TICKS};
    const a=new Sim(seed,p),b=new Sim(seed,p);
    inject(Sim,b,{...v,seed});
    for(let tick=1;tick<=TICKS;tick++){a.step();b.step();}
    return {a,b};
  }
  function run(Sim,raw,seedCount=24){
    const check=validate(Sim,raw);
    if(!check.ok)return {ok:false,errors:check.errors,warnings:check.warnings};
    const v=check.input;
    if(!Number.isSafeInteger(seedCount)||seedCount<1||seedCount>48)
      return {ok:false,errors:["稳健性运行数量必须在 1—48 之间"]};
    const main=pair(Sim,v,v.seed);
    const series=main.a.snapshots.map((a,i)=>({
      tick:i,metrics:metrics(a,main.b.snapshots[i])
    }));
    const samples=[];
    for(let i=0;i<seedCount;i++){
      const seed=v.seed+i;
      // A different baseline draw may lack the named target; this research module must
      // NEVER silently replace it with a different company. Pair validation is conditional.
      const probe=new Sim(seed,{n_agents:BASE_COUNT,ticks:TICKS});
      if(!v.targets.every(name=>probe.agents.some(a=>a.name===name))){
        samples.push({seed,excluded:true,reason:"该种子下指定的关系主体不在抽样模型中"});
        continue;
      }
      const p=pair(Sim,v,seed);
      const final=metrics(p.a.snapshots[TICKS],p.b.snapshots[TICKS]);
      samples.push({seed,excluded:false,deltas:Object.fromEntries(METRICS.map(m=>[m.key,final[m.key].delta])),
        existingAliveDelta:final.existingAlive.delta});
    }
    const eligible=samples.filter(x=>!x.excluded);
    const distribution={};
    METRICS.forEach(m=>{
      const xs=eligible.map(x=>x.deltas[m.key]);
      distribution[m.key]={n:xs.length,p10:quantile(xs,.1),p50:quantile(xs,.5),p90:quantile(xs,.9)};
    });
    const existingNames=new Set(main.a.agents.map(x=>x.name));
    const newAgent=main.b.agents.find(x=>x.name===v.name);
    const oldDifferences=main.a.agents.map(a=>{
      const b=main.b.agents.find(n=>n.name===a.name);
      return {name:a.name,type:a.type,aliveA:a.alive,aliveB:b.alive,
        energyDelta:round(b.energy-a.energy)};
    }).filter(x=>x.aliveA!==x.aliveB||Math.abs(x.energyDelta)>0.000001)
      .sort((a,b)=>Math.abs(b.energyDelta)-Math.abs(a.energyDelta));
    return {
      ok:true,protocol:VERSION,createdAt:new Date().toISOString(),
      input:{...v},warnings:check.warnings,
      baseCount:main.a.agents.length,addedCount:main.b.agents.length,
      // Only explicit, hypothesized, model-side adjacency links. No verified trading claims.
      edges:main.b.edges.map(e=>({...e})),
      agents0:main.b.snapshots[0].agents.map(a=>({name:a.name,type:a.type,w:a.w,energy:a.energy,alive:a.alive})),
      actorsByTick:main.b.snapshots.map(s=>s.agents.map(a=>({name:a.name,type:a.type,w:a.w,energy:round(a.energy),alive:a.alive}))),
      series,
      newAgentAtT20:{name:v.name,alive:!!newAgent.alive,energy:round(newAgent.energy)},
      existingChanges:oldDifferences,
      distribution,samples,
      limitations:[
        "模型新增主体和边均为用户假设；未验证真实企业准入或商业合同",
        "B 的主体数、承载力与随机流发生改变；模型内差值不能识别接入的真实因果效应",
        "P10/P50/P90 只描述有效抽样种子下的模拟分布；不是现实预测区间或政策成功概率",
        "模型时间步不是自然年；模型指标不是 GDP、经济增加值或真实失业/存续率",
        "新增主体通过既有原始 Sim 方程演化，没有独立验证过企业接入映射的科学有效性"
      ],
      researchStatus:"exploratory-not-calibrated",
      excludedSeeds:samples.filter(x=>x.excluded).length,
      includedSeeds:eligible.length,
      existingActors:existingNames.size
    };
  }
  function questions(raw){
    const v=clean(raw),q=[];
    if(!v.source)q.push("能否提供可公开核查的项目公告、签约文件或企业资料链接？");
    q.push("已选择的 "+v.targets.length+" 条协作关系分别有合同、订单或对接记录吗？");
    if(v.weight===2)q.push("有什么可核查材料支持把该企业视为较高权重的主体？");
    q.push("项目预计占用的用地、能源、人才与公共服务承载条件是什么？");
    q.push("若市场订单低于预期，是否存在本地存量企业被挤出的风险？");
    return q;
  }
  return {VERSION,TICKS,BASE_COUNT,TYPES,METRICS,validate,run,questions,quantile};
});
