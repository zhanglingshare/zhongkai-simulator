/* V3.21 five real-source cases, claim conflict rules and protected conditional economy. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const P=require("../pilot-closure-core.js"),E=require("../economic-impact-core.js");
const {save}=require("../scripts/append-pilot-snapshot.cjs");
const root=path.resolve(__dirname,".."),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const cases=read("data/pilot-cases-v321.json"),past=read("data/snapshots/2026-10-17-pilot-baseline.json");
assert.equal(P.validateRegistry(cases).ok,true);
assert.equal(cases.cases.length,5);
assert.deepEqual(cases.cases.map(x=>x.id),["e18","e11","e08","e19","e20"]);
assert.deepEqual(cases,past,"initial immutable snapshot must exactly reproduce initial pilot");
assert.ok(cases.cases.every(c=>c.source.every(s=>P.url(s.url)&&s.support&&s.excludes&&P.date(s.retrievedAt))));
assert.ok(cases.cases.every(c=>c.source.every(s=>s.retrievedAt==="2026-10-17")));
assert.equal(cases.cases.find(x=>x.id==="e18").source[0].publishedAt,"2025-10-29");
assert.equal(cases.cases.find(x=>x.id==="e08").recommendedStudyKind,"backfill");
assert.equal(cases.cases.find(x=>x.id==="e19").sourceQuality,"self-report-not-independent-registry");
assert.equal(cases.cases.find(x=>x.id==="e20").source[0].excludes.includes("实际投资"),true);
const original=P.reviewCase(cases.cases[0]);
assert.equal(original.conflicts.length,0);
assert.ok(original.missing.some(x=>x.field==="investment"));
assert.ok(original.missing.some(x=>x.field==="legalIdentity"));
assert.equal(original.officialRegistryVerified,false);
assert.equal(original.incrementalInvestmentVerified,false);
const candidate={field:"site",value:"另一个项目地址：惠环工业路",sourceUrl:"https://example.org/test-announcement",
 documentedAt:"2026-10-17",reviewer:"manual-analyst"};
const added=P.newClaim(candidate);
assert.equal(added.ok,true,added.errors.join(" / "));
assert.equal(added.record.state,"pending-review");
assert.equal(P.newClaim({...candidate,sourceUrl:"javascript:alert(1)"}).ok,false);
assert.equal(P.newClaim({...candidate,value:""}).ok,false);
assert.equal(P.newClaim({...candidate,reviewer:""}).ok,false);
assert.equal(P.newClaim({...candidate,documentedAt:"unparsed"}).ok,false);
const conflict=P.reviewCase(cases.cases[0],[added.record]);
assert.equal(conflict.conflicts.length,1,"Two different site statements prompt review, not forced false reconciliation");
assert.equal(conflict.conflicts[0].kind,"potential-contradiction");
assert.ok(conflict.questions[0].includes("不同"));
const reviewed=P.reviewCase(cases.cases[0],[{...added.record,state:"human-reviewed-unverified"}]);
assert.equal(reviewed.officialRegistryVerified,false);
assert.equal(reviewed.incrementalInvestmentVerified,false);
assert.equal(P.reviewCase(cases.cases[0],[{...added.record,state:"rejected"}]).conflicts.length,0);
const input={kind:"backfill",confirmed:true,reviewer:"研究员A",reviewNote:"这是旧公司补录，不代表新投资",inputs:{},capacities:{}};
const back=P.conditionalStudy(cases.cases.find(x=>x.id==="e19"),input,P.reviewCase(cases.cases[3]),E);
assert.equal(back.ok,true,back.errors.join(" / "));
assert.equal(back.report.economics.metrics.netJobs.p50,0);
assert.equal(back.report.economics.metrics.newInvestment.p50,0);
assert.equal(back.report.verifiedInvestment,false);
assert.equal(back.report.officialApproval,false);
const scope=P.conditionalStudy(cases.cases[0],{
  ...input,kind:"expansion",inputs:{investment:{low:1,high:4},jobs:{low:10,high:20},
   jobDisplacement:{low:5,high:10},procurement:{low:1,high:2},localShare:{low:25,high:45},
   supplierDisplacement:{low:10,high:20}}
},original,E);
assert.equal(scope.ok,true,scope.errors.join(" / "));
assert.ok(scope.report.economics.metrics.netJobs.provided);
assert.ok(scope.report.economics.metrics.netAdditionalPurchasing.provided);
assert.equal(scope.report.verifiedInvestment,false);
assert.equal(P.conditionalStudy(cases.cases[0],{...input,kind:"proposed_new",inputs:{investment:{low:1,high:2}}},original,E).ok,false);
assert.equal(P.conditionalStudy(cases.cases[0],{...input,kind:"proposed_new",projectProof:"https://example.org/separate-project",
 inputs:{investment:{low:1,high:2}}},original,E).ok,true);
assert.equal(P.conditionalStudy(cases.cases[3],{...input,kind:"expansion"},original,E).ok,false);
assert.equal(P.conditionalStudy(cases.cases[0],{...input,confirmed:false},original,E).ok,false);
assert.equal(P.conditionalStudy(cases.cases[0],{...input,reviewNote:""},original,E).ok,false);
const unchanged=P.compareDocuments(past,cases);
assert.equal(unchanged.ok,true);assert.equal(unchanged.changes.length,0);
const revised=structuredClone(cases);revised.snapshotId="pilot-update-2026-10-18";revised.capturedAt="2026-10-18";
revised.cases[0].source[0].support="增补范围说明（模拟数据，仅用来测试快照差分）";
const changes=P.compareDocuments(cases,revised);
assert.equal(changes.ok,true);assert.equal(changes.changedCases,1);
assert.ok(changes.changes.some(c=>c.kind==="source-changed"&&c.id==="e18"));
const bad=structuredClone(cases);bad.cases[2].source[0].url="http://example.org/";
assert.equal(P.validateRegistry(bad).ok,false);
const dupe=structuredClone(cases);dupe.cases[1].name=dupe.cases[0].name;
assert.equal(P.validateRegistry(dupe).ok,false);
const folder=fs.mkdtempSync(path.join(os.tmpdir(),"v321-snapshots-"));
try{
 const first=save(cases,folder),repeat=save(cases,folder),later=save(revised,folder);
 assert.equal(first.filename,repeat.filename,"Idempotent append of same evidence");
 assert.notEqual(first.filename,later.filename);
 assert.equal(fs.readdirSync(folder).length,2);
 assert.equal(fs.readFileSync(first.filename,"utf8"),JSON.stringify(cases,null,2)+"\n");
 assert.match(first.sha256,/^[a-f0-9]{64}$/);
 assert.throws(()=>save({...cases,capturedAt:"2026-10-34"},folder));
}finally{fs.rmSync(folder,{recursive:true,force:true});}
const html=fs.readFileSync(path.join(root,"trust.html"),"utf8");
for(const asset of ["pilot-closure-core.js","pilot-closure-ui.js","economic-impact-core.js","pilot-closure.css"])
 assert.ok(html.includes(asset),"Missing "+asset);
assert.ok(html.includes('id="pilot-lab"'));
for(const asset of ["pilot-closure-core.js","pilot-closure-ui.js"])
 new (require("node:vm").Script)(fs.readFileSync(path.join(root,asset),"utf8"),{filename:asset});
console.log("PASS V3.21 five authentic source-bounded cases, human evidence conflict, no false economic increment, append-only snapshots and 4-stage review core");
