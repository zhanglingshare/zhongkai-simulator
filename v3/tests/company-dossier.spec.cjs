/* V3.16 proof-vs-hypothesis gate, source matching and scoped simulations */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const base=path.resolve(__dirname,".."),Core=require("../company-dossier-core.js");
const index=JSON.parse(fs.readFileSync(path.join(base,"data/company-evidence.json"),"utf8"));
for(const file of ["company-dossier-core.js","company-dossier-ui.js","company-china.js","inflow.js"])
 new vm.Script(fs.readFileSync(path.join(base,file),"utf8"),{filename:file});
assert.equal(Core.validateIndex(index).ok,true);
assert.equal(Core.validateIndex({schema_version:1,records:[]}).ok,true);
assert.equal(Core.validateIndex({schema_version:1,records:[{id:"fake",name:"Demo",area:"zhongkai",presence:"existing",
 sources:[{url:"javascript:alert(1)",publisher:"evil",assertion:"fake"}]}]}).rejected,1);
const local=Core.lookup(index,"博实结"),outside=Core.lookup(index,"广东利元亨智能装备股份有限公司");
assert.equal(local.matches.length,1);
assert.equal(local.matches[0].name,"惠州市博实结科技有限公司");
assert.equal(Core.prejudge(local.matches[0]).recommended,"backfill");
assert.equal(outside.matches.length,1);
assert.equal(outside.matches[0].area,"huicheng");
assert.equal(Core.prejudge(outside.matches[0]).recommended,"unknown");
assert.ok(Core.prejudge(outside.matches[0]).explanation.includes("仲恺以外"));
assert.equal(Core.lookup(index,"从未登记的机器人公司").matches.length,0);
assert.ok(Core.lookup(index,"从未登记的机器人公司").message.includes("不代表企业不存在"));
assert.equal(Core.lookup(index,"博实结其他公司").matches.length,0,"No substring guessed identity");
const localRec=local.matches[0],outsideRec=outside.matches[0];
assert.equal(Core.evaluate(localRec,"backfill",{name:localRec.name,location:localRec.location,website:localRec.website}).ok,true);
assert.equal(Core.evaluate(localRec,"backfill",{name:localRec.name}).scope,"model-only-backfill");
assert.equal(Core.evaluate(localRec,"proposed_new",{name:localRec.name}).ok,false,"Never count existing company as entirely new");
assert.equal(Core.evaluate(localRec,"expansion",{}).ok,false,"Original new-agent Sim must not fake expansion");
assert.equal(Core.evaluate(outsideRec,"backfill",{name:outsideRec.name}).ok,false,"Nonlocal company is not existing Zhongkai actor");
assert.equal(Core.evaluate(outsideRec,"unknown",{}).ok,false);
const hypothetical=Core.evaluate(outsideRec,"proposed_new",{name:outsideRec.name,projectEvidence:""});
assert.equal(hypothetical.ok,true);
assert.equal(hypothetical.scope,"hypothetical-proposed-inflow");
assert.equal(hypothetical.confirmedProject,false);
assert.ok(hypothetical.warning.some(x=>x.includes("纯假设")));
assert.equal(Core.evaluate(null,"proposed_new",{name:"纯假设研究"}).ok,true);
assert.equal(Core.evaluate(null,"backfill",{name:"无资料"}).ok,false);
const changes=Core.compareField(localRec,{name:"同名其他科技有限公司",location:"深圳龙华",website:"https://different.cn"});
assert.equal(changes.length,3);
assert.equal(Core.isHttps("https://foo.cn/facts"),true);
assert.equal(Core.isHttps("http://foo.cn"),false);
let fetched=0;
(async()=>{
 const source=await Core.fetchIndex(async(url,opts)=>{
  fetched++;assert.equal(url,"data/company-evidence.json");assert.equal(opts.cache,"no-store");
  return {ok:true,json:async()=>index};
 });
 assert.equal(fetched,1);
 assert.equal(Core.lookup(source,"利元亨").matches.length,1);
 const html=fs.readFileSync(path.join(base,"inflow.html"),"utf8");
 assert.ok(html.includes("company-dossier-core.js"));
 assert.ok(html.includes("company-dossier-ui.js"));
 assert.ok(html.includes("company-scenario"));
 assert.ok(html.includes("company-auto-dossier"));
 console.log("PASS V3.16 2-source-index China records, exact-name matching, 4 scenario gates, source conflict audit, JSON and JS syntax");
})().catch(e=>{console.error(e);process.exitCode=1;});