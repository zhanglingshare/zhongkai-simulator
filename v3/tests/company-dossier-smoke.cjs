/* V3.16 real Chrome: source-index auto-fill, inside/outside classification, explicit scenario gates. */
const assert=require("node:assert/strict"),fs=require("node:fs"),http=require("node:http"),path=require("node:path");
const {chromium}=require("playwright"),root=path.resolve(__dirname,"../..");
const mime={".html":"text/html;charset=utf-8",".css":"text/css;charset=utf-8",".js":"application/javascript;charset=utf-8",".json":"application/json;charset=utf-8"};
const server=http.createServer((req,res)=>{
 let p;try{p=path.resolve(root,"."+decodeURI(new URL(req.url,"http://localhost").pathname));}catch{res.writeHead(400).end();return;}
 if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(p,(e,data)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{"content-type":mime[path.extname(p)]||"text/plain"});res.end(data);});
});
async function check(browser,port,width){
 const page=await browser.newPage({viewport:{width,height:890},reducedMotion:"reduce"});
 const failures=[],external=[];
 page.on("pageerror",e=>failures.push(e.message));
 page.on("request",r=>{if(!r.url().startsWith("http://127.0.0.1:"))external.push(r.url());});
 await page.goto("http://127.0.0.1:"+port+"/v3/inflow.html");
 await page.locator("#company-name").fill("利元亨");
 await page.locator("#company-auto-dossier").click();
 await page.waitForFunction(()=>document.querySelectorAll(".select-dossier").length===1,null,{timeout:9000});
 assert.ok((await page.locator("#company-dossier-status").innerText()).includes("找到 1 条"));
 await page.locator(".select-dossier").click();
 assert.equal(await page.locator("#company-name").inputValue(),"广东利元亨智能装备股份有限公司");
 assert.match(await page.locator("#company-location").inputValue(),/惠城区马安镇/);
 assert.equal(await page.locator("#company-scenario").inputValue(),"unknown");
 assert.ok((await page.locator("#company-reality").innerText()).includes("未证明已在仲恺"));
 assert.equal(await page.locator(".source-item").count(),2);
 await page.locator("#company-scenario").selectOption("backfill");
 assert.equal(await page.locator("#company-scenario-gate").getAttribute("data-allowed"),"no");
 await page.locator("#company-scenario").selectOption("proposed_new");
 assert.equal(await page.locator("#company-scenario-gate").getAttribute("data-allowed"),"yes");
 assert.ok((await page.locator("#company-scenario-gate").innerText()).includes("纯假设"));
 await page.locator("#company-links .suggestion").first().click();
 await page.locator("#company-confirm").check();
 await page.locator("#inflow-run").click();
 await page.waitForFunction(()=>document.querySelectorAll("#inflow-metrics .metric").length===4,null,{timeout:16000});
 const record=await page.evaluate(()=>window.ZKCompanyResearchUI.snapshot());
 assert.equal(record.scenarioDecision.selected,"proposed_new");
 assert.equal(record.scenarioDecision.validation.scope,"hypothetical-proposed-inflow");
 assert.equal(record.sourceDossier.id,"gd-lyh");
 assert.ok(await page.locator("#inflow-export").isEnabled());
 await page.locator("#company-location").fill("深圳其他地址");
 assert.equal(await page.locator("#company-confirm").isChecked(),false);
 assert.ok((await page.locator("#company-scenario-gate").innerText()).includes("地址"));
 assert.ok(await page.locator("#inflow-export").isDisabled());
 await page.locator("#load-zhongkai-case").click();
 await page.waitForFunction(()=>document.querySelector("#company-scenario").value==="backfill",null,{timeout:9000});
 assert.equal(await page.locator("#company-name").inputValue(),"惠州市博实结科技有限公司");
 assert.equal(await page.locator(".source-item").count(),3);
 assert.ok((await page.locator("#company-reality").innerText()).includes("已有仲恺"));
 await page.locator("#company-scenario").selectOption("proposed_new");
 assert.equal(await page.locator("#company-scenario-gate").getAttribute("data-allowed"),"no");
 await page.locator("#company-scenario").selectOption("expansion");
 assert.equal(await page.locator("#company-scenario-gate").getAttribute("data-allowed"),"no");
 await page.locator("#company-scenario").selectOption("backfill");
 await page.locator("#company-links .suggestion").first().click();
 await page.locator("#company-confirm").check();
 await page.locator("#inflow-run").click();
 await page.waitForFunction(()=>document.querySelectorAll("#inflow-metrics .metric").length===4,null,{timeout:16000});
 const snap=await page.evaluate(()=>window.ZKCompanyResearchUI.snapshot());
 assert.equal(snap.scenarioDecision.selected,"backfill");
 assert.equal(snap.sourceDossier.id,"hz-bsj");
 assert.equal(snap.scenarioDecision.validation.scope,"model-only-backfill");
 assert.ok((await page.locator("#scenario-result-note").innerText()).includes("不计现实招商增量"));
 await page.locator("#company-name").fill("暂未收录的虚构企业");
 await page.locator("#company-auto-dossier").click();
 await page.waitForFunction(()=>document.querySelector("#company-dossier-status").textContent.includes("索引中未发现"),null,{timeout:9000});
 assert.equal(await page.locator(".select-dossier").count(),0);
 await page.locator("#company-search").click();
 assert.equal(await page.locator(".china-search-link").count(),6);
 assert.equal(await page.locator("#company-scenario").inputValue(),"backfill"); // user intent preserved but gate correctly blocks
 assert.equal(await page.locator("#company-scenario-gate").getAttribute("data-allowed"),"no");
 const geom=await page.evaluate(()=>({w:innerWidth,doc:document.documentElement.scrollWidth}));
 assert.ok(geom.doc<=geom.w+4,"horizontal overflow "+JSON.stringify(geom));
 assert.deepEqual(failures,[],"JS errors: "+failures.join("|"));
 assert.deepEqual(external,[],"Only same-origin curated index auto-requested; external links need explicit click");
 if(width===390){
  const shot=path.join(root,"v3/screenshots/v316-evidence-390.png");fs.mkdirSync(path.dirname(shot),{recursive:true});
  await page.screenshot({path:shot,fullPage:true});
 }
 await page.close();
}
(async()=>{
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));let browser;
 try{
  browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
  for(const width of [1440,390,360])await check(browser,server.address().port,width);
  console.log("PASS V3.16 Chrome 1440/390/360 in/out Zhongkai evidence, 4 scenarios, no fake-new, A/B real Sim, stale, fallback");
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});