/* V3.16 · Source-bound China company dossiers + conservative scenario gate.
   Does not scrape domestic services; only searches a reviewed same-origin source
   index. Optional licensed provider adapters must be server-side and audited. */
(function(root,factory){
 "use strict";const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.ZKCompanyDossier=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 "use strict";
 const SCENARIOS={
  backfill:{name:"补入模型：企业早已在仲恺",description:"只补上模型未表示的既有主体，不属于现实新增招商",simulatable:true},
  proposed_new:{name:"假设新引进：尚未确认落地",description:"假设新增主体，缺乏项目证据时不能称为真实签约",simulatable:true},
  expansion:{name:"既有企业扩产或新项目",description:"需要扩产专用模型，不能用“增加一家公司”代替",simulatable:false},
  unknown:{name:"不确定：只查看资料",description:"先核实是否在仲恺经营或有具体投资计划",simulatable:false}
 };
 function normalize(v){return String(v||"").trim().replace(/[（）()·\s]/g,"").toLowerCase();}
 function isHttps(raw){try{const u=new URL(String(raw));return u.protocol==="https:"&&!!u.hostname&&!u.username&&!u.password;}catch{return false;}}
 function safeText(raw,limit=800){return String(raw||"").trim().slice(0,limit);}
 function validSource(source){return source&&isHttps(source.url)&&safeText(source.publisher,120)&&safeText(source.assertion,600);}
 function validateIndex(payload){
  if(!payload||payload.schema_version!==1||!Array.isArray(payload.records)||payload.records.length>250)return {ok:false,reason:"公开资料索引格式不正确"};
  const records=payload.records.filter(x=>x&&safeText(x.id,90)&&safeText(x.name,90)&&["zhongkai","huicheng","other","unknown"].includes(x.area)
   &&["existing","existing_outside","unknown"].includes(x.presence)
   &&Array.isArray(x.sources)&&x.sources.length>0&&x.sources.every(validSource));
  return {ok:true,records,refreshed_at:payload.refreshed_at||"",rejected:payload.records.length-records.length};
 }
 function lookup(payload,query){
  const idx=validateIndex(payload);if(!idx.ok)return {ok:false,matches:[],message:idx.reason};
  const needle=normalize(query);
  if(needle.length<2)return {ok:false,matches:[],message:"请至少输入两个字"};
  const matches=idx.records.filter(r=>{
   const names=[r.name,...(r.aliases||[])];
   return names.some(x=>normalize(x)===needle);
  }).map(r=>({...r,sources:r.sources.map(s=>({...s}))}));
  return {ok:true,matches,refreshed_at:idx.refreshed_at,
    message:matches.length?("从已审核国内公开资料索引找到 "+matches.length+" 条名称匹配记录，仍需人工确认"):
     "当前公开资料索引没有这个名称；不代表企业不存在，也未执行全网自动检索"};
 }
 function prejudge(record){
  if(!record)return {recommended:"unknown",label:"未找到可核对的在地资料",
   explanation:"不能只凭名字认定是否已经在仲恺落地",flags:["缺少在地或投资证据"]};
  if(record.area==="zhongkai"&&record.presence==="existing")
   return {recommended:"backfill",label:"已有仲恺经营记录",
    explanation:"资料支持存在仲恺地址，建议仅作原模型补录，不计现实招商新增",
    flags:["存量企业不是新增落地","企业官网地址不代表已验证投资额或具体上下游合同"]};
  if(record.area!=="zhongkai")
   return {recommended:"unknown",label:"未证明已在仲恺经营",
    explanation:"公开资料位置在仲恺以外；既不证明将迁入，也不证明有仲恺新增投资计划",
    flags:["缺少拟在仲恺投资的可核对材料","仅凭外地总部地址不能推断不存在仲恺分支"]};
  return {recommended:"unknown",label:"暂无法判断",
   explanation:"需要验证是否在仲恺实际经营或有新项目",flags:["企业进入状态未核实"]};
 }
 function compareField(record,form){
  if(!record)return [];
  const flags=[];
  if(normalize(form.name)!==normalize(record.name))flags.push("名称与已选公开记录不同，可能是关联公司或同名主体");
  if(form.location&&normalize(form.location)!==normalize(record.location))flags.push("你修改了公开资料中的地址；请再次核实是否为不同分支或项目地址");
  if(form.website&&record.website&&form.website!==record.website)flags.push("官网链接与已选记录不同，请核对");
  return flags;
 }
 function evaluate(record,scenario,form={}){
  const judgement=prejudge(record),entry=SCENARIOS[scenario];
  if(!entry)return {ok:false,reason:"请先选择本次要研究的情景",warning:judgement.flags};
  const warning=[...judgement.flags,...compareField(record,form)];
  if(!entry.simulatable)return {ok:false,reason:entry.description,warning};
  if(scenario==="backfill"&&(!record||record.area!=="zhongkai"||record.presence!=="existing"))
   return {ok:false,reason:"“补入模型”需要已有仲恺经营线索；无法凭猜测把外地企业写成仲恺存量企业",warning};
  if(scenario==="proposed_new"&&record?.area==="zhongkai"&&record.presence==="existing")
   return {ok:false,reason:"资料已表明该企业在仲恺经营，不能整家公司再次算作新落地；如有扩产项目，请另用专门模型",warning};
  const hasPublicProject=!!form.projectEvidence&&isHttps(form.projectEvidence);
  if(scenario==="proposed_new"&&!hasPublicProject)warning.push("没有经核实的新项目证明：本次只能是纯假设研究，不能列为已签约、已落地或真实招商增量");
  return {ok:true,reason:scenario==="backfill"?"模型补录实验（不计现实招商增量）":"纯假设新增节点实验（未证实真实落地）",
   warning,scope:scenario==="backfill"?"model-only-backfill":"hypothetical-proposed-inflow",
   confirmedProject: false};
 }
 async function fetchIndex(fetcher,origin="data/company-evidence.json"){
  const r=await fetcher(origin,{cache:"no-store"});
  if(!r.ok)throw new Error("公开资料索引暂不可访问（"+r.status+"）");
  const p=await r.json(),v=validateIndex(p);
  if(!v.ok)throw new Error(v.reason);
  return p;
 }
 return {SCENARIOS,normalize,isHttps,validateIndex,lookup,prejudge,compareField,evaluate,fetchIndex};
});