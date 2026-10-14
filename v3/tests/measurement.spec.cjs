/* V3.6 observation-measurement bridge scientific regression.
   Synthetic model snapshots are used for algorithm tests ONLY; not actual predictions. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const M=require("../measurement-core.js");
const actual=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../observations/annual-2019-2025.json"),"utf8"));
const study=()=>{
 const values=[.2,.7,.3,.55,.6,.65];
 const ticks=new Map([0,4,8,12,16,20].map((t,i)=>[t,values[i]]));
 return {schema:"zhongkai-v3-research-1",model:"original model.js, synthetic unit-test fixture",
   A_B:{seed:7,shock:"芯片断供",ticks:20,stale:false,
     baselineHistory:Array.from({length:21},(_,tick)=>({
       tick,metrics:{abundance:ticks.has(tick)?ticks.get(tick):.45,order:.5,
         disaster:.2,mood:0,survivors:.9}
     }))}};
};
const map=()=>({schema:M.SCHEMA,candidate:"abundance:industry_growth",trainThrough:2022,
   correspondence:[2020,2021,2022,2023,2024,2025].map((year,i)=>({year,tick:i*4}))});
const coverage=M.coverage(actual);
assert.equal(coverage.valid,true);
assert.equal(coverage.states.length,5);
assert.equal(coverage.candidateSummary.length,3);
assert.ok(coverage.states.find(x=>x.key==="order").type==="missing");
assert.ok(coverage.states.find(x=>x.key==="mood").type==="missing");
assert.deepEqual(coverage.candidateSummary.find(x=>x.id==="abundance:industry_growth").years,[2020,2021,2022,2023,2024,2025]);
assert.equal(M.archiveHistory(study()).ok,true);
const base=M.evaluate(actual,study(),map());
assert.equal(base.ok,true,base.message);
assert.equal(base.validationPassed,false);
assert.equal(base.calibrated,false);
assert.equal(base.status,"exploratory-only");
assert.equal(base.trainCount,3);
assert.equal(base.laterCount,3);
assert.deepEqual(base.protocol.fittedFromYears,[2020,2021,2022]);
assert.equal(base.points.length,6);
assert.ok(Number.isFinite(base.trainMae));
assert.ok(Number.isFinite(base.laterReplayMae));
assert.ok(base.issues.some(x=>x.includes("不构成其独立留出")));
const trainingOriginal={...base.protocol.estimate};
const altered=structuredClone(actual);
altered.observations.find(r=>r.metric==="industry_growth"&&r.year===2025).value=-100;
const after=M.evaluate(altered,study(),map());
assert.equal(after.ok,true);
assert.deepEqual(after.protocol.estimate,trainingOriginal,"2025 actual MUST NOT change fitted parameters");
assert.equal(after.trainMae,base.trainMae,"2025 actual MUST NOT alter training error");
assert.notEqual(after.laterReplayMae,base.laterReplayMae);
const disallowed={...map(),candidate:"order:gdp_current"};
assert.equal(M.evaluate(actual,study(),disallowed).ok,false,"arbitrary GDP state mapping must be rejected");
assert.equal(M.evaluate(actual,null,map()).ok,false,"no historical snapshots must block");
assert.equal(M.evaluate(actual,study(),{...map(),correspondence:[]}).ok,false);
const duplicate={...map(),correspondence:[{year:2020,tick:0},{year:2021,tick:0},{year:2022,tick:8},{year:2023,tick:12}]};
assert.equal(M.evaluate(actual,study(),duplicate).ok,false);
const missing={...map(),correspondence:[{year:2019,tick:0},{year:2020,tick:4},{year:2021,tick:8},{year:2022,tick:12}]};
assert.equal(M.evaluate(actual,study(),missing).ok,false,"missing 2019 industrial growth must not be fabricated");
const crossing={...map(),correspondence:[{year:2020,tick:0},{year:2021,tick:4},{year:2022,tick:8},{year:2023,tick:6}]};
assert.equal(M.evaluate(actual,study(),crossing).ok,false,"crossing calendars invalidate mapping");
const small={...map(),trainThrough:2020};
assert.equal(M.evaluate(actual,study(),small).ok,false,"need >=3 earlier observations");
const future={...map(),trainThrough:2025};
assert.equal(M.evaluate(actual,study(),future).ok,false,"must show at least one postfit observation");
const same=study();same.A_B.baselineHistory.forEach(r=>r.metrics.abundance=.5);
assert.equal(M.evaluate(actual,same,map()).ok,false,"nonidentifiable flat indicator must block");
const noSrc=structuredClone(actual);
noSrc.observations.find(r=>r.metric==="industry_growth"&&r.year===2020).source_ids=[];
assert.equal(M.evaluate(noSrc,study(),map()).ok,false,"source provenance required");
const typo=study();typo.A_B.baselineHistory[3].metrics.abundance=Number.NaN;
assert.equal(M.evaluate(actual,typo,map()).ok,false,"nonfinite snapshots must block");
assert.equal(M.futureProtocol().certification.startsWith("未满足"),true);
assert.equal(M.futureProtocol().predictionArchiveURL,"");
console.log("PASS V3.6 bridge: 5-state observability, training-only affine mapping, no independent validation, zero data leakage from target year");
