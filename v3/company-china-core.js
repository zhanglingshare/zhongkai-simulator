/* Chinese-first, keyless search handoff + one sourced Zhongkai local case.
   Search links open provider websites; this module NEVER scrapes results or
   claims to call restricted company-registry APIs from static GitHub Pages. */
(function(root,factory){
  "use strict";const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.ZKChinaResearch=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const SOURCES={
    government:"https://gxj.huizhou.gov.cn/zwgk/ssjygk/content/post_3920441.html",
    company:"https://www.bsjkj.com/aboutus/",
    site:"https://www.bsjkj.com/solution/"
  };
  const CASE={
    id:"zhongkai-bsj-2026",
    name:"惠州市博实结科技有限公司",
    business:"物联网智能终端设备制造、车载定位终端及智能硬件生产",
    location:"惠州市仲恺高新区惠风西三路1号",
    website:"https://www.bsjkj.com/aboutus/",
    source:SOURCES.government,
    additionalSource:SOURCES.company,
    type:"oem",
    weight:1,
    note:"真实案例：该公司已在仲恺经营，并非新签约或首次入驻。这里只是假设把该既有企业作为模型此前未覆盖的主体加入简化产业网络，用于操作演示。所选模型联系仅为待核查假设，不代表真实客户或供应商。",
    verifiedFacts:["名称和仲恺地址有惠州市工信局公开资料","母公司官网介绍物联网智能终端和车联网硬件等业务"],
    caveat:"已经在仲恺的现有企业案例。添加模型节点≠现实新增落地企业，不能累计为实际招商新增企业。",
    kind:"existing-enterprise-as-model-inflow",
    candidateId:"public-example-zhongkai-bsj",
    links:[SOURCES.government,SOURCES.company]
  };
  const vendors={
    baidu:"https://www.baidu.com/s?wd=",
    so:"https://www.so.com/s?q=",
    qcc:"https://www.qcc.com/",
    tianyancha:"https://www.tianyancha.com/",
    gsxt:"https://www.gsxt.gov.cn/index.html"
  };
  function clean(text,max=60){return String(text??"").trim().slice(0,max);}
  function getCase(){return {...CASE,verifiedFacts:[...CASE.verifiedFacts],links:[...CASE.links]};}
  function buildLinks(company){
    const q=clean(company,60);
    if(q.length<2)throw new Error("请先输入至少两个字的企业名称");
    const query=encodeURIComponent(q+" 企业 主营业务 官网");
    const gov=encodeURIComponent(q+" site:huizhou.gov.cn");
    return [
      {id:"baidu",label:"百度 · 查企业简介",url:vendors.baidu+query,query:q+" 企业 主营业务 官网",directSearch:true},
      {id:"so",label:"360 搜索 · 交叉检查",url:vendors.so+query,query:q+" 企业 主营业务 官网",directSearch:true},
      {id:"government",label:"惠州政府公开资料",url:vendors.baidu+gov,query:q+" site:huizhou.gov.cn",directSearch:true},
      {id:"qcc",label:"企查查 · 核实工商",url:vendors.qcc,query:q,directSearch:false},
      {id:"tianyancha",label:"天眼查 · 核实工商",url:vendors.tianyancha,query:q,directSearch:false},
      {id:"gsxt",label:"国家企业信用信息公示系统",url:vendors.gsxt,query:q,directSearch:false}
    ];
  }
  function safeLink(raw){
    try{
      const u=new URL(String(raw));return u.protocol==="https:"&&!u.username&&!u.password?u.href:"";
    }catch{return "";}
  }
  function analyzeExcerpt(raw){
    const text=clean(raw,1100).replace(/\s+/g," ");
    if(text.length<8)return {ok:false,message:"请至少粘贴 8 个字的公开企业介绍"};
    if(text.length>1000)return {ok:false,message:"简介过长，请只粘贴关键业务句子（不超过1000字）"};
    const mention=text.match(/(惠州市?仲恺高新区[^，。；\n]{0,24})/);
    return {
      ok:true,business:clean(text,360),location:mention?clean(mention[1],80):"",
      message:"识别的是你粘贴的文字，并未核验网页真实性。请修改不准确的业务或位置描述。",
      kind:"user-pasted-public-excerpt"
    };
  }
  return {getCase,buildLinks,analyzeExcerpt,safeLink,vendors,SOURCES};
});