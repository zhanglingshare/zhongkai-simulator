/* V3.3 validation-core regression tests — test-only synthetic observations. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const V=require("../validation-core.js");
const root=path.join(__dirname,"../..");
const model=fs.readFileSync(path.join(root,"model.js"),"utf8");
const hot=JSON.parse(fs.readFileSync(path.join(root,"hot.json"),"utf8"));
const life=JSON.parse(fs.readFileSync(path.join(root,"life.json"),"utf8"));
function fixture(){
 const dates=["2026-10-04","2026-10-06","2026-10-08"];
 return {
  schema:V.schema,scope:"model-index",metric:"abundance",
  mapping_id:"test-fixture-v1-fixed",mapping_spec_url:"https://example.org/mapping-v1",
  model_commit:"a".repeat(40),calibration_cutoff:"2026-09-30",
  cases:Array.from({length:8},(_,i)=>({
   id:"synthetic-test-"+i,predicted_at:"2026-10-01",observed_at:dates[i%3],
   source_url:"https://example.org/observations/"+i,forecast_archive_url:"https://example.org/archives/"+i,
   predicted:.4+i*.01,observed:.5+i*.01,naive:.3+i*.01,used_in_calibration:false
  }))
 };
}
const params=V.parseParams(model);
assert.equal(params.length,11,"Model must expose 11 documented parameter lineage rows");
assert.ok(params.some(p=>p.name==="spread_rate"&&p.needsReview&&p.grade==="C"));
assert.ok(params.some(p=>p.name==="n_agents"&&p.structural));
const d=V.auditFeeds(hot,life,Date.now());
assert.equal(d.info.hot.count,hot.items.length);
assert.equal(d.info.life.towns,life.towns.length);
assert.equal(d.info.life.sourceReady,life.towns.filter(x=>typeof x.source_url==="string"&&x.source_url.startsWith("https://")).length);
assert.ok(d.issues.some(x=>x.text.includes("镇街资料")));
const valid=V.assessHoldout(fixture());
assert.equal(valid.eligible,true,valid.errors.join("; "));
assert.equal(valid.stats.count,8);
assert.equal(valid.stats.periods,3);
assert.ok(Math.abs(valid.stats.mae-.1)<1e-9);
assert.ok(Math.abs(valid.stats.naiveMae-.2)<1e-9);
assert.ok(Math.abs(valid.stats.improvement-.5)<1e-9);
assert.match(valid.status,/未独立认证/);
function reject(mutator,reason){
 const input=fixture();mutator(input);
 const out=V.assessHoldout(input);
 assert.equal(out.eligible,false,reason+" should fail");
 assert.equal(out.stats,null);
 return out;
}
assert.ok(reject(x=>{x.cases[0].predicted_at="2026-10-09"},"future outcome").errors.some(x=>x.includes("之前归档")));
assert.ok(reject(x=>{x.cases[0].used_in_calibration=true},"leakage").errors.some(x=>x.includes("used_in_calibration")));
assert.ok(reject(x=>{x.cases[0].source_url="javascript:alert(1)"},"unsafe link").errors.some(x=>x.includes("HTTPS")));
assert.ok(reject(x=>{x.cases[0].observed=500},"invalid scale").errors.some(x=>x.includes("指定模型指标")));
assert.ok(reject(x=>{x.metric="GDP"},"direct GDP mapping").errors.some(x=>x.includes("metric")));
assert.ok(reject(x=>{x.cases.length=3},"too few cases").errors.some(x=>x.includes("至少需要")));
assert.ok(reject(x=>{x.cases[3].id=x.cases[1].id},"duplicate").errors.some(x=>x.includes("id 重复")));
assert.ok(reject(x=>{x.mapping_spec_url=""},"missing mapped spec").errors.some(x=>x.includes("mapping_spec_url")));
assert.ok(reject(x=>{x.cases[0].observed_at="2026-09-01"},"pre calibration period").errors.some(x=>x.includes("校准时间窗")));
assert.ok(reject(x=>{x.cases[0].observed_at="2030-01-01"},"future observation").errors.some(x=>x.includes("晚于当前")));
assert.ok(reject(x=>{x.cases.forEach(c=>c.observed_at="2026-10-08")},"only one period").errors.some(x=>x.includes("3 个不同")));
assert.ok(reject(x=>{x.cases[0].predicted=.0/0},"NaN").errors.some(x=>x.includes("有限数值")));
const template=V.template();assert.equal(V.assessHoldout(template).eligible,false,"Template must never produce a fake score");
console.log("PASS V3.3 validation-core: parameter lineage, news metadata, 8 held-out records, leakage / range / source / date gates");
