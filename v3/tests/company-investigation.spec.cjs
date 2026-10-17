const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const Core=require("../company-investigation-core.js"),base=path.resolve(__dirname,"..");
for(const file of ["company-investigation-core.js","company-investigation-ui.js","company-dossier-ui.js"])
 new vm.Script(fs.readFileSync(path.join(base,file),"utf8"),{filename:file});
const d=(companyName,field,value,publisher,group,type="enterprise")=>({
 companyName,fields:{[field]:value},source:{publisher,independenceGroup:group||publisher,
   url:"https://example.com/"+encodeURIComponent(publisher),type}
});
const name="惠州市示例科技有限公司";
const docs=[
 d(name,"business","机器人整机制造","某公司官网","company"),
 d(name,"business","机器人整机制造","官方部门","government","government"),
 d(name,"operationAddress","惠州市仲恺高新区","某公司官网","company"),
 d(name,"registrationStatus","存续","某数据商","licensed","licensed_registry"),
 d(name,"registeredAddress","深圳龙华街道","某数据商","licensed","licensed_registry")
];
const report=Core.analyze(name,docs);
assert.equal(report.ok,true);
assert.equal(report.fields.business.status,"corroborated");
assert.equal(report.fields.business.independentSources,2);
assert.equal(report.fields.operationAddress.status,"single_source");
assert.equal(report.fields.registeredAddress.status,"single_source");
assert.equal(report.fields.operationAddress.recommended,"惠州市仲恺高新区");
assert.equal(report.fields.registeredAddress.recommended,"深圳龙华街道");
assert.equal(report.fields.unifiedCreditCode.status,"missing");
assert.equal(report.identityStatus.area,"zhongkai","Only operation-address evidence, not registered address");
assert.ok(report.questions.some(x=>x.includes("统一社会信用代码")));
const copies=[d(name,"business","车载智能终端","同一个供应商","same"),
 d(name,"business","车载智能终端","镜像副本","same")];
assert.equal(Core.analyze(name,copies).fields.business.status,"single_source","Mirrors are not independent corroboration");
const conflict=Core.analyze(name,[...copies,d(name,"business","新能源电池销售","另一来源","another")]);
assert.equal(conflict.fields.business.status,"conflict");
assert.equal(conflict.fields.business.recommended,"","Conflicts must never auto-select value");
assert.ok(conflict.questions[0].includes("说法不一"));
const approved=Core.accepted(report,{business:"人工核实后的机器人装备",operationAddress:"惠城区马安镇"});
assert.equal(approved.record.area,"unknown","Edited operation address invalidates prior in-Zhongkai conclusion");
assert.equal(approved.identityChanged,true);
assert.ok(approved.userChanges.includes("business"));
assert.ok(approved.record.sources.length>=2);
assert.equal(Core.analyze(name,[d(name,"registeredAddress","惠州市仲恺高新区","某数据商","reg")]).identityStatus.area,"unknown",
 "Registered address alone must NOT establish local operation");
assert.equal(Core.analyze(name,[d("其他公司","business","设备研发","来源","other")]).documents,0,"Exact identity gate");
assert.equal(Core.safeHttps("javascript:alert(1)"),"");
assert.equal(Core.creditCode("not-a-credit-code"),"");
assert.equal(Core.creditCode("91320594MA1MG0JH1C"),"91320594MA1MG0JH1C");
const idx=JSON.parse(fs.readFileSync(path.join(base,"data/company-evidence.json"),"utf8"));
const local=idx.records.find(x=>x.id==="hz-bsj"),prior=Core.fromIndex({...local,refreshed_at:idx.refreshed_at});
assert.ok(prior.length>=2);
const publicCheck=Core.analyze(local.name,prior);
assert.equal(publicCheck.ok,true);
assert.equal(publicCheck.identityStatus.area,"zhongkai");
assert.notEqual(publicCheck.fields.business.status,"corroborated","One vendor's multiple fields must not count as independent validation");
assert.equal(Core.analyze("无文档的公司",[]).fields.name.status,"missing");
assert.equal(Core.analyze("a",[]).ok,false);
for(let i=0;i<20;i++){
 const n="合成测试企业"+String(i).padStart(2,"0")+"有限公司";
 const output=Core.analyze(n,[d(n,"business","芯片制造","仅一份测试来源","synthetic")]);
 assert.equal(output.ok,true);assert.equal(output.fields.business.status,"single_source");
 assert.equal(output.fields.registeredAddress.status,"missing");
}
console.log("PASS V3.17 evidence conflicts, independent-source threshold, no registration-to-operation leap, 20 synthetic cases and syntax");
