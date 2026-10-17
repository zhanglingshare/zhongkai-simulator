/* V3.20 evidence-trust core: actual public observations and genuine provenance,
   no synthetic accuracy or falsely certified Sim predictive metrics. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const T=require("../trust-core.js"),O=require("../observations-core.js"),B=require("../benchmark-core.js"),M=require("../measurement-core.js");
for(const file of ["trust-core.js","trust-ui.js"])
 new vm.Script(fs.readFileSync(path.join(root,file),"utf8"),{filename:file});
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const obs=read("observations/annual-2019-2025.json"),firms=read("data/enterprise-validation-20.json");
const r=T.auditResearch({observations:obs,companies:firms,observationCore:O,benchmarkCore:B,measurementCore:M});
assert.equal(r.ok,true,r.errors.join(" / "));
assert.equal(r.observation.records,58);
assert.equal(r.observation.metricCount,9);
assert.deepEqual(r.observation.years,[2019,2020,2021,2022,2023,2024,2025]);
assert.equal(r.observation.backed,58);
assert.equal(r.enterprise.total,20);
assert.equal(new Set(r.enterprise.companies.map(c=>c.name)).size,20);
assert.equal(r.enterprise.fieldCounts.nameMention.indexed,20);
assert.equal(r.enterprise.fieldCounts.legalIdentity.verified,0);
assert.equal(r.enterprise.fieldCounts.actualInvestment.verified,0);
assert.equal(r.enterprise.fieldCounts.investorNewToZhongkai.verified,0);
assert.equal(r.enterprise.legalIdentityVerified,0);
assert.equal(r.enterprise.investmentVerified,0);
assert.equal(r.enterprise.companies.filter(c=>c.district==="仲恺高新区").length,14);
assert.ok(r.enterprise.companies.every(c=>c.fields.length===5));
assert.ok(r.enterprise.companies.every(c=>c.verifiedLegalIdentity===false&&c.verifiedInvestment===false));
assert.ok(r.enterprise.companies.every(c=>c.fields.some(f=>f.key==="actualInvestment"&&f.status==="unverified")));
assert.ok(r.enterprise.companies.every(c=>T.safeHttps(c.source.url)));
assert.equal(r.mapping.states.length,5);
assert.equal(r.mapping.candidates.length,3);
assert.ok(r.mapping.states.find(x=>x.key==="order").type==="missing");
assert.ok(r.mapping.states.find(x=>x.key==="mood").type==="missing");
assert.equal(r.modelValidation.canScoreModel,false);
assert.equal(r.modelValidation.calibrated,false);
assert.equal(r.modelValidation.certified,false);
assert.ok(r.modelValidation.blocks.some(x=>x.includes("映射")));
assert.ok(r.modelValidation.blocks.some(x=>x.includes("事前")));
assert.equal(r.baseline.results.gdp_real_yoy.eligible,true);
assert.equal(r.baseline.results.gdp_real_yoy.scores.n,3);
assert.equal(r.baseline.results.industry_growth.scores.n,3);
assert.equal(r.baseline.results.industry_invest_growth.scores.n,4);
assert.equal(r.baseline.results.gdp_real_yoy.modelCalibrated,false);
assert.equal(r.baseline.results.gdp_real_yoy.certified,false);
assert.ok(r.baseline.results.gdp_real_yoy.caveat.includes("事后"));
assert.ok(r.observation.sourceTypes.government_portal>=1);
const reread=T.auditResearch({observations:obs,companies:firms,observationCore:O,benchmarkCore:B,measurementCore:M});
assert.deepEqual(r.baseline,reread.baseline,"Audit should reproduce exact baseline folds");
const broken=structuredClone(firms);broken.items[0].source.url="javascript:alert(1)";
assert.equal(T.auditCompanies(broken).ok,false);
const same=structuredClone(firms);same.items[1].name=same.items[0].name;
assert.equal(T.auditCompanies(same).ok,false);
const badObs=structuredClone(obs);
badObs.observations[0].source_ids=[];
assert.equal(T.auditResearch({observations:badObs,companies:firms,observationCore:O,benchmarkCore:B,measurementCore:M}).ok,false,
 "Observations without source must block audit as valid");
assert.equal(T.safeHttps("http://invalid.example"),false);
const draft=T.preregistration({metric:"gdp_real_yoy",targetPeriod:"2027",releaseDate:"2028-03-31",
 forecastValue:"3.5",modelCommit:"a".repeat(40),protocolVersion:"zk-measurement-protocol-v2",
 measurementRule:"Bind annual GDP comparable-price growth 2027 to model tick 20 only under frozen rules.",
 sources:"https://www.hzzk.gov.cn/"});
assert.equal(draft.ok,true,draft.errors.join(" "));
assert.equal(draft.archive.pointForecast,3.5);
assert.equal(draft.archive.certified,false);
assert.equal(draft.archive.independentScore,null);
assert.equal(draft.archive.kind,"local-unsealed-draft");
assert.ok(draft.archive.needs.some(x=>x.includes("时间戳")));
assert.equal(T.preregistration({...draft.archive,forecastValue:"",modelCommit:""}).ok,false);
assert.equal(T.preregistration({metric:"gdp_current",targetPeriod:"2027",releaseDate:"2028-03-31",
 forecastValue:"1",modelCommit:"a".repeat(40),protocolVersion:"test-1",measurementRule:"a".repeat(30)}).ok,false);
assert.equal(T.preregistration({metric:"gdp_real_yoy",targetPeriod:"2027",releaseDate:"2028-03-31",
 forecastValue:"fake",modelCommit:"a".repeat(40),protocolVersion:"test-1",measurementRule:"a".repeat(30)}).ok,false);
const h=fs.readFileSync(path.join(root,"trust.html"),"utf8");
for(const file of ["trust-core.js","trust-ui.js","benchmark-core.js","measurement-core.js","observations-core.js"]){
 assert.match(h,new RegExp(file.replaceAll(".","\\.")));
}
assert.match(fs.readFileSync(path.join(root,"index.html"),"utf8"),/href="trust.html"/);
assert.match(fs.readFileSync(path.join(root,"inflow.html"),"utf8"),/href="trust.html"/);
console.log("PASS V3.20 58 real observation records, 20 source-indexed company names, 0 fabricated verification, 3 honest retrospective baselines, no leakage or fake Sim accuracy");
