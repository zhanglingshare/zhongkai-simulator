/* V3.19 exact threshold boundaries, missing-evidence behavior and 20 public-source audit */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,".."),Rev=require("../decision-reversal-core.js"),E=require("../economic-impact-core.js");
for(const file of ["decision-reversal-core.js","decision-reversal-ui.js"])
 new vm.Script(fs.readFileSync(path.join(root,file),"utf8"),{filename:file});
const R=(a,b)=>({low:String(a),high:String(b)});
const raw={kind:"proposed_new",company:"条件性招商测试企业",seed:23,source:"",
 inputs:{investment:R(8,12),procurement:R(2,4),localShare:R(30,40),
 supplierDisplacement:R(10,25),jobs:R(100,150),jobDisplacement:R(0,10),
 land:R(100,110),power:R(2500,3500),water:R(50,80)},
 capacities:{land:"90",power:"3000",water:"100"}};
const x=E.clean(raw);
const gates={minInvestment:"8",minNetPurchasing:"0.9",minNetJobs:"140",
 maxLand:"90",maxPower:"4000",maxWater:""};
const out=Rev.analyze(x,gates);
assert.equal(out.ok,true);assert.equal(out.protocol,Rev.VERSION);
assert.equal(out.rows.length,5);
const find=k=>out.rows.find(r=>r.key===k);
assert.deepEqual(find("minInvestment").interval,{low:8,high:12});
assert.equal(find("minInvestment").status,"robust-pass");
assert.deepEqual(find("minNetPurchasing").interval,{low:0.45,high:1.44});
assert.equal(find("minNetPurchasing").status,"reversible");
assert.deepEqual(find("minNetJobs").interval,{low:90,high:150});
assert.equal(find("minNetJobs").status,"reversible");
assert.equal(find("maxLand").status,"robust-fail");
assert.equal(find("maxPower").status,"robust-pass");
assert.equal(out.overall,"fails-specified-thresholds","Guaranteed failed gate dominates");
assert.deepEqual(out.questions.map(q=>q.key),["minNetJobs","minNetPurchasing","maxLand"],
 "Three most decision-relevant questions precede already-satisfied gates");
const pivot=find("minNetPurchasing").anchors.find(a=>a.name==="本地采购比例");
assert.ok(pivot.threshold>36&&pivot.threshold<37,"Conditional localShare cutover at fixed midpoints");
assert.ok(out.questions[0].requiredDocument.includes("岗位"));
const same=Rev.analyze(x,gates);assert.deepEqual(same,out);
const partial=E.clean({...raw,inputs:{...raw.inputs,jobs:{low:"",high:""},jobDisplacement:{low:"",high:""}}});
const missing=Rev.analyze(partial,{minNetJobs:"80",minNetPurchasing:"0.1"});
assert.equal(missing.ok,true);assert.equal(missing.overall,"insufficient-input");
assert.equal(missing.rows[0].status,"robust-pass");assert.equal(missing.rows[1].status,"unknown");
assert.equal(missing.questions[0].key,"minNetJobs","missing data must become a concrete investigative question");
const reversible=Rev.analyze(x,{minNetPurchasing:"0.9",minNetJobs:"140"});
assert.equal(reversible.overall,"depends-on-assumptions");
const allpass=Rev.analyze(x,{minInvestment:"4",maxLand:"200",minNetJobs:"80"});
assert.equal(allpass.overall,"meets-all-specified-thresholds");
const allfail=Rev.analyze(x,{minInvestment:"30"});
assert.equal(allfail.overall,"fails-specified-thresholds");
const backfill=Rev.analyze(E.clean({kind:"backfill",company:"既有企业补入",seed:23,inputs:{},capacities:{}}),
 {minInvestment:"0.01",maxLand:"0"});
assert.equal(backfill.overall,"fails-specified-thresholds");
assert.deepEqual(backfill.rows[0].interval,{low:0,high:0});
assert.equal(backfill.rows[1].status,"robust-pass");
for(const value of ["-1","Infinity","NaN","10000000000000"]){
 assert.equal(Rev.analyze(x,{minNetJobs:value}).ok,false);
}
assert.equal(Rev.analyze(x,{}).ok,false,"No invented official standard");
assert.equal(Rev.analyze(x,{minInvestment:""}).ok,false);
assert.equal(Rev.analyze(x,{maxPower:"0",minInvestment:"12"}).rows.find(r=>r.key==="minInvestment").status,"reversible");
assert.equal(Rev.analyze(x,{maxLand:"100"}).rows[0].status,"reversible","Equality at low bound can be a conditional pass");
assert.equal(Rev.analyze(x,{maxLand:"110"}).rows[0].status,"robust-pass");
const rawLedger=JSON.parse(fs.readFileSync(path.join(root,"data/enterprise-validation-20.json"),"utf8"));
const ledger=Rev.auditRoster(rawLedger);
assert.equal(ledger.ok,true);assert.equal(ledger.count,20);
assert.equal(ledger.summary.nameSourceIndexed,20);
assert.equal(ledger.summary.registryVerified,0);
assert.equal(ledger.summary.investmentVerified,0);
assert.ok(ledger.items.some(x=>x.category==="award"&&x.district==="惠城区"));
assert.ok(ledger.items.some(x=>x.category==="exp"));
assert.ok(ledger.items.every(x=>x.fields.some(f=>f.field.includes("工商")&&f.status==="not-verified")));
assert.ok(ledger.items.every(x=>x.fields.some(f=>f.field.includes("投资")&&f.status==="not-verified")));
assert.ok(ledger.items.every(x=>x.source.url.startsWith("https://")));
assert.ok(ledger.items.every(x=>x.notEvidenceOfNewInvestment===true&&x.reviewedAgainstLiveSite===false));
assert.equal(Rev.auditRoster({schema:"bad",items:[]}).ok,false);
const markup=fs.readFileSync(path.join(root,"inflow.html"),"utf8");
assert.match(markup,/decision-reversal-core\.js/);
assert.match(markup,/decision-reversal-ui\.js/);
assert.match(markup,/id="rev-minNetPurchasing"/);
assert.match(markup,/id="rev-audit-load"/);
assert.equal((markup.match(/src="decision-reversal-ui.js"/g)||[]).length,1);
console.log("PASS V3.19 exact input-interval reversal, user-only gates, three prioritized questions, missing evidence, 20-company auditable scope");
