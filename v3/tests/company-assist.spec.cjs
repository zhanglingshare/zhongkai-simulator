const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const dir=path.resolve(__dirname,".."),Core=require("../company-assist-core.js");
for(const script of ["company-assist-core.js","company-assist.js","inflow.js"]){
 new vm.Script(fs.readFileSync(path.join(dir,script),"utf8"),{filename:script});
}
assert.equal(Core.classify("半导体芯片和电子元器件").type,"supplier");
assert.equal(Core.classify("生产性物流与数据服务").type,"service");
assert.equal(Core.classify("机器人整机制造").type,"oem");
assert.equal(Core.classify("规模很大").type,null,"May not infer an anchor from vague size claim");
assert.equal(Core.classify("从事芯片和物流").type,null,"Conflict or mixed business must not automatically choose one");
assert.equal(Core.validUrl("https://wikidata.org/wiki/Q2"),true);
assert.equal(Core.validUrl("javascript:alert(1)"),false);
assert.equal(Core.wikidataUrl("Q42"),"https://www.wikidata.org/wiki/Q42");
assert.equal(Core.wikidataUrl("Q42?origin=bad"),"");
assert.deepEqual(Core.parseSearch({search:[{id:"Q42",label:"示例公司",description:"机器人整机制造"}]}).map(x=>x.id),["Q42"]);
async function mockFetch(url){
 const u=new URL(url);assert.equal(u.protocol,"https:");assert.equal(u.searchParams.get("origin"),"*");
 const action=u.searchParams.get("action");
 const body=action==="wbsearchentities"?{search:[{id:"Q42",label:"示例公司",description:"机器人整机制造"}]}:
   action==="wbgetentities"&&u.searchParams.get("props")==="labels"?{
     entities:{Q108:{id:"Q108",labels:{zh:{value:"机器人行业"}}},Q109:{id:"Q109",labels:{zh:{value:"惠州"}}}}}:
     {entities:{Q42:{id:"Q42",labels:{zh:{value:"示例公司"}},descriptions:{zh:{value:"机器人整机制造商"}},
     claims:{P856:[{rank:"normal",mainsnak:{snaktype:"value",datavalue:{value:"https://example.org"}}}],
     P452:[{rank:"normal",mainsnak:{snaktype:"value",datavalue:{value:{id:"Q108"}}}}],
     P159:[{rank:"normal",mainsnak:{snaktype:"value",datavalue:{value:{id:"Q109"}}}}]}}}};
 return {ok:true,json:async()=>body};
}
(async()=>{
 const list=await Core.search("示例公司",mockFetch);assert.equal(list.length,1);
 assert.equal(list[0].url,"https://www.wikidata.org/wiki/Q42");
 const info=await Core.details("Q42",mockFetch);
 assert.equal(info.name,"示例公司");
 assert.ok(info.business.includes("机器人"));
 assert.equal(info.location,"惠州");
 assert.equal(info.website,"https://example.org");
 assert.ok(info.provenance.includes("不是企业工商登记"));
 const ctx=vm.createContext({window:{}}),model=fs.readFileSync(path.resolve(dir,"portal-kernel.js"),"utf8");
 vm.runInContext(model,ctx);
 const sugg=Core.hints(ctx.window.ZKSim,23,"supplier");
 assert.equal(sugg.length,3);
 assert.ok(sugg.every(x=>typeof x.name==="string"&&x.reason.includes("尚不能证明")));
 await assert.rejects(()=>Core.search("a",mockFetch),/至少输入两个字/);
 await assert.rejects(()=>Core.details("Q42?hack",mockFetch),/无效/);
 assert.ok((await Core.search("示例公司",async()=>({ok:true,json:async()=>({search:[]})}))).length===0);
 await assert.rejects(()=>Core.search("示例公司",async()=>{throw new Error("offline");}),/offline/);
 console.log("PASS V3.14 public candidate search, provenance, cautious classification, editability and manual fallback");
})().catch(e=>{console.error(e);process.exitCode=1;});