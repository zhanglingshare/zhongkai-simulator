/* V3.3 evidence UI; read-only audit / client-side holdout scoring. */
(function(){
  "use strict";
  const V=window.ZKVerify, el=id=>document.getElementById(id);
  if(!V){el("audit-error").hidden=false;el("audit-error").textContent="验证算法模块加载失败";return;}
  const node=(tag,klass,value)=>{
    const n=document.createElement(tag);if(klass)n.className=klass;
    if(value!==undefined)n.textContent=String(value);return n;
  };
  const displayDate=x=>typeof x==="string"?x:"—";
  const fmt=x=>Number(x).toFixed(4);
  const safeLink=(dest,title)=>{
    const a=node("a","",title);
    a.href=dest;a.target="_blank";a.rel="noopener noreferrer nofollow";
    return a;
  };
  function error(message){
    el("audit-error").hidden=false;
    el("audit-error").textContent=message;
  }
  function downloadJSON(name,value){
    const blob=new Blob([JSON.stringify(value,null,2)],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function renderFeed(data,hot){
    const overview=el("feed-overview");
    overview.replaceChildren();
    const h=data.info.hot,l=data.info.life;
    const cards=[
      ["资讯条目",h?h.count:"—",h?"自标核验 "+h.selfVerified+" / "+h.count:"未加载"],
      ["采集更新时间",h?displayDate(h.updated):"—","信息时效不等于模型参数校准"],
      ["镇街记录",l?l.towns:"—",l?"其中 "+l.pending+" 项待核查":"未加载"],
      ["镇街原始链接",l?l.sourceReady:"—",l?"具备独立 source_url 的条数":"未加载"]
    ];
    cards.forEach(([name,value,desc])=>{
      const wrap=node("div","feed-stat");
      wrap.append(node("span","",name),node("strong","",value),node("p","",desc));
      overview.append(wrap);
    });
    const warnings=el("feed-warnings");
    warnings.replaceChildren();
    if(!data.issues.length)warnings.append(node("p","feed-warning ok","基础 JSON 结构未发现异常；这不代表来源真实性或模型校准已验证。"));
    data.issues.forEach(issue=>warnings.append(node("div","feed-warning "+(issue.level==="error"?"error":""),issue.text)));
    el("data-gate").textContent=data.errors?"数据结构异常":data.warnings?"需人工复核":"结构检查完成";
    el("data-gate").className=data.errors?"audit-warn":data.warnings?"audit-warn":"audit-good";
    el("data-gate-note").textContent="结构错误 "+data.errors+" · 提示 "+data.warnings+"（不等于来源核验）";
    const list=el("feed-source-list");
    list.replaceChildren();
    const items=hot&&Array.isArray(hot.items)?hot.items:[];
    items.slice(0,9).forEach(item=>{
      const row=node("div","source-row");
      const label=item&&item.title?item.title:"无标题";
      if(item&&typeof item.url==="string"&&/^https:\/\//.test(item.url)){
        // URL syntax already examined by auditFeeds. Cross-origin links are navigation only.
        try{
          const u=new URL(item.url);
          if(u.username||u.password)throw Error("credentials in URL");
          row.append(safeLink(u.href,label));
        }catch{row.append(node("span","",label));}
      }else row.append(node("span","",label));
      row.append(node("span","",item&&item.verified_status==="已核验"?"采集自标已核验":"待核查"));
      list.append(row);
    });
    if(!items.length)list.append(node("p","no-result","当前没有可显示的新闻数据。"));
  }
  function renderParams(source){
    const rows=V.parseParams(source),tbody=el("param-rows");
    tbody.replaceChildren();
    if(!rows.length){
      const tr=node("tr");
      const td=node("td","", "无法解析 PARAM_LINEAGE，需人工核对模型版本。");
      td.colSpan=4;tr.append(td);tbody.append(tr);
      el("param-findings").textContent="模型参数血统缺失或格式改变，不能自动认定参数有效。";
      return;
    }
    const count={A:0,B:0,C:0,D:0};
    rows.forEach(p=>{
      count[p.grade]++;
      const tr=node("tr");
      tr.append(node("td","",p.name),node("td","",p.value));
      const grade=node("td");grade.append(node("span","param-grade "+(p.grade==="C"?"c":""),p.grade));tr.append(grade);
      tr.append(node("td","",p.note+(p.needsReview?" · 需补独立观测":"")));
      tbody.append(tr);
    });
    el("param-findings").textContent="共识别 "+rows.length+" 项项目自声明参数血统：A "+count.A+"、B "+count.B+"、C "+count.C+"、D "+count.D+"。其中 n_agents、ticks 等结构常量并非公开统计观测。“A”不能当作数理验证等级；目前没有发现该文件提供的独立样本误差、校准拟合记录或留出集验证成绩。";
  }
  async function refresh(){
    el("btn-refresh").disabled=true;
    el("audit-error").hidden=true;
    el("feed-overview").replaceChildren(node("p","no-result","读取数据中…"));
    const endpoints=["../hot.json","../life.json","../model.js"];
    const results=await Promise.allSettled(endpoints.map(async endpoint=>{
      const response=await fetch(endpoint,{cache:"no-store"});
      if(!response.ok)throw Error(endpoint+" HTTP "+response.status);
      return endpoint.endsWith(".js")?response.text():response.json();
    }));
    const hot=results[0].status==="fulfilled"?results[0].value:null;
    const life=results[1].status==="fulfilled"?results[1].value:null;
    const source=results[2].status==="fulfilled"?results[2].value:null;
    const data=V.auditFeeds(hot,life,Date.now());
    renderFeed(data,hot);
    renderParams(source);
    if(typeof source==="string" && window.crypto&&crypto.subtle&&window.TextEncoder){
      try{
        const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(source));
        const hex=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
        el("model-fingerprint").textContent=hex.slice(0,16)+"…";
        el("model-fingerprint").title=hex;
      }catch{el("model-fingerprint").textContent="无法计算指纹";}
    }else el("model-fingerprint").textContent="不可用";
    const failures=results.map((r,i)=>r.status==="rejected"?endpoints[i]+": "+r.reason.message:null).filter(Boolean);
    if(failures.length)error("部分数据获取失败，审查结论不完整："+failures.join("；"));
    el("btn-refresh").disabled=false;
  }
  function invalid(message){
    const output=el("holdout-result");
    output.className="holdout-result";
    output.replaceChildren(node("strong","","本轮不能认定为合格留出集"));
    const ul=node("ul");
    const items=Array.isArray(message)?message:[message];
    items.slice(0,35).forEach(m=>ul.append(node("li","",m)));
    if(items.length>35)ul.append(node("li","","另有 "+(items.length-35)+" 项未展示。"));
    output.append(ul);
    el("holdout-scores").hidden=true;
    el("holdout-scores").replaceChildren();
    el("backtest-gate").textContent="尚未验证";
    el("backtest-gate").className="audit-hold";
  }
  function score(){
    let obj;
    try{obj=JSON.parse(el("holdout-json").value);}catch(ex){invalid("JSON 解析失败："+ex.message);return;}
    const result=V.assessHoldout(obj);
    if(!result.eligible){invalid(result.errors);return;}
    const output=el("holdout-result");
    output.className="holdout-result ok";
    output.replaceChildren(node("strong","",result.status));
    output.append(node("p","",result.stats.metricName+" · "+result.stats.count+" 条材料 · "+result.stats.periods+" 个独立观测日期。评分仅计算“上传材料”里的同量纲误差，真实性和事前归档未由系统确认。"));
    const scorebox=el("holdout-scores");
    scorebox.hidden=false;scorebox.replaceChildren();
    const stats=result.stats;
    [
      ["模型 MAE",fmt(stats.mae)],
      ["朴素基线 MAE",fmt(stats.naiveMae)],
      ["模型 RMSE",fmt(stats.rmse)],
      ["MAE 相对基线变化",stats.improvement===null?"不可比（基线 MAE=0）":(stats.improvement*100).toFixed(1)+"%"]
    ].forEach(pair=>{
      const cell=node("div","score-cell");
      cell.append(node("small","",pair[0]),node("strong","",pair[1]));scorebox.append(cell);
    });
    const caveat=node("p","","重要：朴素基线由导入者提供，未独立验证其计算规则。以下分数不构成参数校准通过、第三方认证或现实预测有效的声明。");
    output.append(caveat);
    el("backtest-gate").textContent="材料评分完成 · 未认证";
    el("backtest-gate").className="audit-warn";
  }
  el("score-holdout").addEventListener("click",score);
  el("download-template").addEventListener("click",()=>downloadJSON("zhongkai-heldout-template.json",V.template()));
  el("clear-holdout").addEventListener("click",()=>{
    el("holdout-file").value="";
    el("holdout-json").value="";
    invalid("请导入事前归档、来源可追溯的历史留出集。");
  });
  el("holdout-file").addEventListener("change",async event=>{
    const file=event.target.files&&event.target.files[0];
    if(!file)return;
    if(file.size>2*1024*1024){invalid("文件大于 2MB，请使用小规模的规范历史留出集。");return;}
    try{el("holdout-json").value=await file.text();}catch(ex){invalid("读取文件失败："+ex.message);}
  });
  el("btn-refresh").addEventListener("click",refresh);
  refresh().catch(ex=>error("审查失败："+ex.message));
})();