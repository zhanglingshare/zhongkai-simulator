/* V3.17 Chromium end-to-end: provenance, editing, consent, model safety. */
const assert=require("node:assert/strict"),fs=require("node:fs"),http=require("node:http"),path=require("node:path");
const {chromium}=require("playwright"),root=path.resolve(__dirname,"../..");
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
 ".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"};
const server=http.createServer((req,res)=>{
 let target;try{target=path.resolve(root,"."+decodeURI(new URL(req.url,"http://localhost").pathname));}catch{res.writeHead(400).end();return;}
 if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(target,(err,data)=>{if(err){res.writeHead(404).end();return;}
  res.writeHead(200,{"content-type":mime[path.extname(target)]||"text/plain"});res.end(data);});
});
async function check(browser,port,width,licensed=false){
 const page=await browser.newPage({viewport:{width,height:860},reducedMotion:"reduce"});
 const errors=[],external=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",r=>{if(r.url().startsWith("https://licensed.example.test"))external.push(r.url());});
 if(licensed){
  await page.route("**/company-investigation-config.js",r=>r.fulfill({status:200,contentType:"application/javascript",
   body:'window.ZKInvestigationConfig={apiUrl:"https://licensed.example.test/api/company-investigate",providerLabel:"测试授权数据"};'}));
  await page.route("https://licensed.example.test/api/company-investigate",route=>{
   const cors={"access-control-allow-origin":"http://127.0.0.1:"+port,"access-control-allow-credentials":"true","access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"content-type"};
   if(route.request().method()==="OPTIONS"){route.fulfill({status:204,headers:cors,body:""});return;}
   const sent=route.request().postDataJSON();
   assert.equal(sent.consent,true);
   assert.equal(sent.name,"惠州市博实结科技有限公司");
   route.fulfill({status:200,contentType:"application/json",headers:cors,
    body:JSON.stringify({ok:true,name:sent.name,documents:[{
     companyName:sent.name,fields:{business:"工业机器人零部件供应",registrationStatus:"存续",
      registeredAddress:"惠州市仲恺高新区某地（测试数据）"},
     source:{publisher:"模拟授权数据",url:"https://open.tianyancha.com/open/365",
      type:"licensed_registry",licensed:true,independenceGroup:"vendor",
      checkedAt:"2026-10-17",assertion:"浏览器测试模拟；并非真实查询"}
    }]})});
  });
 }
 await page.goto("http://127.0.0.1:"+port+"/v3/inflow.html");
 await page.locator("#company-name").fill("惠州市博实结科技有限公司");
 await page.locator("#investigate-company").click();
 await page.waitForFunction(()=>document.querySelectorAll(".investigation-field").length===7,null,{timeout:8000});
 assert.equal(await page.locator("#investigation-online-consent").isChecked(),false);
 assert.equal(external.length,0,"No request to vendor without explicit consent");
 assert.equal(await page.locator("#investigation-edit-registrationStatus").inputValue(),"");
 assert.match(await page.locator("#investigation-edit-operationAddress").inputValue(),/仲恺/);
 assert.ok((await page.locator("#investigation-status").innerText()).includes("国内授权数据服务尚未启用")||
   (await page.locator("#investigation-status").innerText()).includes("未同意联网"));
 assert.equal(await page.locator("#investigation-apply").isDisabled(),false);
 const grouped=await page.locator(".investigation-claim-status").allTextContents();
 assert.ok(grouped.some(s=>s.includes("仅一独立来源")));
 assert.ok(grouped.some(s=>s.includes("缺少证据")));
 await page.locator("#investigation-edit-business").fill("人工核实后的车载物联网智能终端");
 assert.equal(await page.locator("#investigation-edit-business").inputValue(),"人工核实后的车载物联网智能终端");
 await page.locator("#investigation-apply").click();
 const audit=await page.evaluate(()=>{const v=window.ZKCompanyResearchUI.snapshot();return {keys:Object.keys(v),investigation:v.investigation,company:document.querySelector("#company-name").value,business:document.querySelector("#company-business").value,source:Function.prototype.toString.call(window.ZKCompanyResearchUI.snapshot).slice(0,500)};});
 console.log("V3.17 DEBUG REVIEW",JSON.stringify(audit));
 assert.ok((await page.locator("#investigation-status").innerText()).includes("调查结论已填入"));
 assert.ok(await page.locator(".investigation-field").count()===7,"Adoption must preserve editable report");
 assert.equal(await page.locator("#company-scenario").inputValue(),"backfill");
 assert.equal(await page.locator("#company-business").inputValue(),"人工核实后的车载物联网智能终端");
 let snapshot=await page.evaluate(()=>window.ZKCompanyResearchUI.snapshot());
 assert.ok(snapshot.investigation.userChanges.includes("business"));
 assert.equal(snapshot.investigation.fieldStatus.registrationStatus,"missing");
 await page.locator("#company-scenario").selectOption("proposed_new");
 assert.equal(await page.locator("#company-scenario-gate").getAttribute("data-allowed"),"no");
 await page.locator("#company-scenario").selectOption("backfill");
 await page.locator("#company-links .suggestion").first().click();
 await page.locator("#company-confirm").check();
 await page.locator("#inflow-run").click();
 await page.waitForFunction(()=>document.querySelectorAll("#inflow-metrics .metric").length===4,null,{timeout:15000});
 assert.equal(await page.locator("#count-b").innerText(),"25");
 snapshot=await page.evaluate(()=>window.ZKCompanyResearchUI.snapshot());
 assert.equal(snapshot.investigation.sourceCount>=2,true);
 assert.equal(snapshot.scenarioDecision.validation.scope,"model-only-backfill");
 if(licensed){
  await page.locator("#investigation-online-consent").check();
  await page.locator("#investigate-company").click();
  await page.waitForFunction(()=>document.querySelectorAll(".investigation-field").length===7 &&
   document.querySelector("#investigation-status").textContent.includes("授权企业数据接口"),null,{timeout:10000});
  assert.equal(external.length,1,"Exactly one explicit vendor request");
  assert.equal(await page.locator("#investigation-edit-business").inputValue(),"");
  assert.ok((await page.locator("#investigation-report").innerText()).includes("来源冲突"));
  assert.equal(await page.locator("#investigation-edit-registrationStatus").inputValue(),"存续");
  assert.equal(await page.locator("#investigation-edit-registeredAddress").inputValue(),"惠州市仲恺高新区某地（测试数据）");
  assert.ok((await page.locator("#investigation-edit-operationAddress").inputValue()).includes("仲恺"),
    "Registered address must not override actual operation address");
 }
 await page.locator("#company-name").fill("没有收录的示例企业");
 await page.locator("#investigate-company").click();
 await page.waitForFunction(()=>document.querySelector("#investigation-status").textContent.includes("未获得"),null,{timeout:9000});
 assert.equal(await page.locator("#investigation-apply").isDisabled(),true);
 assert.equal(await page.locator(".investigation-field").count(),7);
 assert.ok(await page.locator("#investigation-edit-business").inputValue()==="");
 assert.equal(await page.locator("#inflow-export").isDisabled(),true);
 const geo=await page.evaluate(()=>({w:innerWidth,doc:document.documentElement.scrollWidth}));
 assert.ok(geo.doc<=geo.w+4,"Horizontal overflow "+JSON.stringify(geo));
 assert.deepEqual(errors,[],"Browser errors: "+errors.join("|"));
 if(width===390&&!licensed){
  const dest=path.join(root,"v3/screenshots/v317-investigation-390.png");
  fs.mkdirSync(path.dirname(dest),{recursive:true});await page.screenshot({path:dest,fullPage:true});
 }
 await page.close();
}
(async()=>{
 await new Promise(done=>server.listen(0,"127.0.0.1",done));let browser;
 try{
  browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
  for(const width of [1440,390,360])await check(browser,server.address().port,width,false);
  await check(browser,server.address().port,390,true);
  console.log("PASS V3.17 evidence report 1440/390/360, consent gate, conflict, manual edit, Sim A/B, no old result reuse");
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});