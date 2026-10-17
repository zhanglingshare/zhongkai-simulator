/* V3.18 independent incremental flow and evidence ledger acceptance. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,".."),Engine=require("../economic-impact-core.js");
for(const name of ["economic-impact-core.js","economic-impact-ui.js","inflow.js","company-investigation-ui.js"])
 new vm.Script(fs.readFileSync(path.join(root,name),"utf8"),{filename:name});
const fill=(low,high)=>({low:String(low),high:String(high)});
const blank=()=>({low:"",high:""});
const good={kind:"proposed_new",company:"纯假设新能源配套项目",seed:23,source:"",
 inputs:{investment:fill(8,12),procurement:fill(2,4),localShare:fill(30,40),
  supplierDisplacement:fill(10,25),jobs:fill(100,150),jobDisplacement:fill(0,10),
  land:fill(100,110),power:fill(2500,3500),water:fill(50,80)},
 capacities:{land:"90",power:"3000",water:"100"}};
const first=Engine.run(good);assert.equal(first.ok,true);
assert.equal(first.kind,"proposed_new");
assert.equal(first.metrics.newInvestment.provided,true);
assert.ok(first.metrics.netAdditionalPurchasing.p10<first.metrics.netAdditionalPurchasing.p50);
assert.ok(first.metrics.netAdditionalPurchasing.p50<=first.metrics.netAdditionalPurchasing.p90);
assert.ok(first.metrics.netJobs.p10<=first.metrics.netJobs.p90);
assert.equal(first.resources.status,"over-capacity");
assert.equal(first.resources.checks.find(x=>x.key==="land").status,"exceeded");
assert.equal(first.resources.checks.find(x=>x.key==="water").status,"within");
assert.equal(first.highStress.status,"over-capacity");
assert.ok(first.warnings.some(x=>x.includes("容量")));
assert.ok(first.sensitivity.includes("不是现实统计概率"));
assert.ok(first.boundaries.some(x=>x.includes("GDP")));
const again=Engine.run(good);
assert.deepEqual(again.metrics,first.metrics,"Seed plus identical assumptions must reproduce 256 samples");
assert.deepEqual(again.resources,first.resources);
const expand=Engine.run({...good,kind:"expansion"});
assert.equal(expand.ok,true);
assert.equal(expand.metrics.netJobs.p50,first.metrics.netJobs.p50);
assert.ok(expand.warnings.some(x=>x.includes("扩产")));
const zero=Engine.run({kind:"backfill",seed:23,company:"惠州市博实结科技有限公司",
 inputs:{investment:fill(9,10),jobs:fill(20,30)},capacities:{}});
assert.equal(zero.ok,true);assert.equal(zero.metrics.newInvestment.p50,0);
assert.equal(zero.metrics.localPurchasing.p50,0);assert.equal(zero.metrics.netJobs.p50,0);
assert.equal(zero.resources.status,"incomplete");
assert.ok(zero.warnings.some(x=>x.includes("强制归零")));
const zeroBlank=Engine.run({kind:"backfill",company:"既有企业"});
assert.equal(zeroBlank.ok,true);assert.equal(zeroBlank.metrics.newInvestment.p10,0);
assert.equal(Engine.run({kind:"proposed_new",company:"无数字",inputs:{}}).ok,false);
assert.equal(Engine.run({kind:"unknown",inputs:{investment:fill(1,2)}}).ok,false);
assert.equal(Engine.run({...good,inputs:{...good.inputs,investment:fill(-1,3)}}).ok,false);
assert.equal(Engine.run({...good,inputs:{...good.inputs,jobs:fill(20,10)}}).ok,false);
assert.equal(Engine.run({...good,inputs:{...good.inputs,localShare:fill(90,101)}}).ok,false);
assert.equal(Engine.run({...good,inputs:{...good.inputs,water:{low:"7",high:""}}}).ok,false);
assert.equal(Engine.run({...good,capacities:{...good.capacities,land:"-1"}}).ok,false);
assert.equal(Engine.run({...good,source:"http://danger.example"}).ok,false);
const partial=Engine.run({...good,inputs:{...good.inputs,supplierDisplacement:blank()},
 capacities:{land:"",power:"",water:""}});
assert.equal(partial.ok,true);
assert.equal(partial.metrics.localPurchasing.provided,true);
assert.equal(partial.metrics.netAdditionalPurchasing.provided,false);
assert.equal(partial.metrics.netAdditionalPurchasing.p50,null);
assert.equal(partial.resources.status,"incomplete");
assert.ok(partial.questions.some(x=>x.includes("替代")));
const legal=JSON.parse(fs.readFileSync(path.join(root,"data/enterprise-validation-20.json"),"utf8"));
assert.equal(legal.schema,"zk-enterprise-public-evidence-v1");
assert.equal(legal.items.length,20,"Exactly 20 source-supported real enterprises");
assert.equal(new Set(legal.items.map(x=>x.name)).size,20,"Not 20 duplications");
assert.equal(legal.items.filter(x=>x.officialDistrict==="仲恺高新区").length,14);
assert.equal(legal.items.filter(x=>x.officialDistrict!=="仲恺高新区").length,6);
for(const record of legal.items){
 assert.ok(record.name.length>4);
 assert.match(record.source.url,/^https:\/\//);
 assert.ok(record.source.publisher&&record.source.fact);
 assert.equal(record.check.legalIdentity,"not-verified");
 assert.equal(record.check.actualInvestment,"not-verified");
 assert.equal(record.check.investorNewToZhongkai,"not-verified");
 assert.ok(record.note);
}
assert.ok(legal.notVerified.includes("incremental jobs"));
const markup=fs.readFileSync(path.join(root,"inflow.html"),"utf8");
assert.match(markup,/economic-impact-core\.js/);
assert.match(markup,/economic-impact-ui\.js/);
assert.match(markup,/id="econ-run"/);
assert.match(markup,/id="open-validation-roster"/);
assert.equal((markup.match(/src="company-investigation-ui.js"/g)||[]).length,1,"No double initialization of investigation UI");
console.log("PASS V3.18 verified-missing inputs, resource constraints, expansion/backfill accounting, seeded sensitivity, 20 real evidence names and source boundaries");
