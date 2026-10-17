/* V3.14: public-source company lookup, conservative role hints, NO real-world verification.
   This module never sends data without an explicit user's Search button click. */
(function(root,make){
  "use strict";const api=make();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.ZKCompanyResearch=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const HOST="https://www.wikidata.org/w/api.php",TIMEOUT=9000;
  const TYPE_LABELS={supplier:"配套／零部件",oem:"整机／设备制造",service:"生产性服务",anchor:"链主（需单独核验规模）"};
  function sanitizeText(x,max=160){return String(x||"").trim().slice(0,max);}
  function validUrl(url){try{const u=new URL(String(url));return u.protocol==="https:"&&u.hostname&&!u.username&&!u.password;}catch{return false;}}
  function wikidataUrl(id){return /^Q[1-9]\d{0,12}$/.test(id)?"https://www.wikidata.org/wiki/"+id:"";}
  function classify(hint){
    const s=sanitizeText(hint,600);
    const rules=[
      {type:"service",terms:["物流","仓储","软件","云计算","检测","咨询","金融服务","技术服务","研发服务","信息服务","logistics","software","consulting","cloud services","data services"]},
      {type:"oem",terms:["整机","整车","整机制造","设备制造","机器人制造","汽车制造","手机制造","终端设备","automaker","automobile manufacturer","vehicle manufacturer","robot manufacturer","original equipment manufacturer"]},
      {type:"supplier",terms:["零部件","配套","元器件","半导体","芯片","电池","传感器","新材料","模具","电子制造","components","semiconductor","battery","microelectronics","parts manufacturer"]}
    ];
    const matches=rules.map(r=>({...r,hits:r.terms.filter(w=>s.toLowerCase().includes(w.toLowerCase()))})).filter(r=>r.hits.length);
    if(matches.length!==1)return {type:null,reason:matches.length?"业务跨多类，不能自动定性":"公开描述不足，暂不能判断业务类型"};
    return {type:matches[0].type,reason:"在业务描述中找到「"+matches[0].hits.slice(0,2).join("、")+"」；只供初步分类，不证明企业规模"};
  }
  function parseSearch(json){
    const entries=Array.isArray(json?.search)?json.search:[];
    return entries.filter(x=>wikidataUrl(String(x.id||""))).slice(0,6).map(x=>({
      id:x.id,name:sanitizeText(x.label,80),description:sanitizeText(x.description,200),url:wikidataUrl(x.id),
      source:"Wikidata（开放知识库，非工商登记）"
    }));
  }
  function statement(entity,property){
    const claims=entity?.claims?.[property];
    if(!Array.isArray(claims))return null;
    const good=claims.find(x=>x.rank!=="deprecated"&&x.mainsnak?.snaktype==="value");
    return good?.mainsnak?.datavalue?.value??null;
  }
  function toId(value){return /^Q[1-9]\d{0,12}$/.test(value?.id||"")?value.id:null;}
  function propertyText(entity,language){
    return entity?.labels?.[language]?.value||entity?.labels?.zh?.value||entity?.labels?.en?.value||"";
  }
  async function apiGet(params,fetcher=fetch){
    const u=new URL(HOST);u.searchParams.set("format","json");u.searchParams.set("origin","*");
    u.searchParams.set("formatversion","2");
    Object.entries(params).forEach(([key,val])=>u.searchParams.set(key,String(val)));
    const c=new AbortController(),clock=setTimeout(()=>c.abort(),TIMEOUT);
    try{
      const resp=await fetcher(u.href,{signal:c.signal,headers:{Accept:"application/json"}});
      if(!resp.ok)throw new Error("公开资料接口暂不可用（HTTP "+resp.status+"）");
      const result=await resp.json();
      if(result?.error)throw new Error("公开资料接口返回错误");
      return result;
    }finally{clearTimeout(clock);}
  }
  async function search(name,fetcher=fetch){
    const q=sanitizeText(name,60);
    if(q.length<2)throw new Error("请至少输入两个字再搜索");
    const response=await apiGet({action:"wbsearchentities",search:q,language:"zh",uselang:"zh",type:"item",limit:6},fetcher);
    const items=parseSearch(response);
    if(items.length)return items;
    if(/[a-zA-Z]/.test(q)){
      const en=await apiGet({action:"wbsearchentities",search:q,language:"en",uselang:"zh",type:"item",limit:6},fetcher);
      return parseSearch(en);
    }
    return [];
  }
  async function details(id,fetcher=fetch){
    const url=wikidataUrl(id);if(!url)throw new Error("无效的公开知识库条目");
    const res=await apiGet({action:"wbgetentities",ids:id,props:"labels|descriptions|claims",languages:"zh|en"},fetcher);
    const entity=res?.entities?.[id];
    if(!entity||entity.missing)throw new Error("没有找到这条资料");
    const webpage=statement(entity,"P856");
    const website=typeof webpage==="string"&&validUrl(webpage)?webpage:"";
    const rawIndustry=toId(statement(entity,"P452")),rawHQ=toId(statement(entity,"P159"));
    const labels={};
    const refs=[...new Set([rawIndustry,rawHQ].filter(Boolean))];
    if(refs.length){
      try{
        const r=await apiGet({action:"wbgetentities",ids:refs.join("|"),props:"labels",languages:"zh|en"},fetcher);
        refs.forEach(k=>labels[k]=propertyText(r?.entities?.[k],"zh"));
      }catch{/* optional metadata may not be retrievable */}
    }
    const descriptions=[entity.descriptions?.zh?.value,entity.descriptions?.en?.value].filter(Boolean).join(" / ");
    return {
      id,source:url,origin:"Wikidata",
      name:sanitizeText(propertyText(entity,"zh"),80),
      business:sanitizeText([descriptions,labels[rawIndustry]].filter(Boolean).join("；"),360),
      location:sanitizeText(labels[rawHQ]||"",80),website,
      provenance:"用户选定的 Wikidata 候选条目；不是企业工商登记、合同或政府核验结果"
    };
  }
  function hints(Sim,seed,type){
    if(typeof Sim!=="function"||!Number.isSafeInteger(seed)||seed<1||seed>999999)return [];
    const s=new Sim(seed,{n_agents:24,ticks:20});
    const byType={supplier:["anchor","oem"],oem:["supplier","service"],service:["oem","anchor"],anchor:["supplier","service"]};
    const wanted=byType[type]||byType.supplier;
    return [...s.agents].filter(a=>a.w>=3||wanted.includes(a.type))
      .sort((a,b)=>{const aa=wanted.indexOf(a.type),bb=wanted.indexOf(b.type);
        return (aa===-1?99:aa)-(bb===-1?99:bb)||b.w-a.w||a.name.localeCompare(b.name,"zh-CN");})
      .slice(0,3).map(a=>({name:a.name,type:a.type,
        reason:"在当前模拟世界里存在这一主体；尚不能证明它与新企业有业务关系"}));
  }
  return {HOST,TYPE_LABELS,search,details,classify,hints,parseSearch,wikidataUrl,validUrl};
});