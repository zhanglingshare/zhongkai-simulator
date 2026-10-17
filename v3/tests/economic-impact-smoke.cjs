/* V3.18 browser acceptance: new and expansion economics, real roster, no fabricated defaults. */
const assert=require("node:assert/strict"),http=require("node:http"),fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"../..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",
 ".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"};
const server=http.createServer((req,res)=>{
 let file;try{file=path.resolve(root,"."+decodeURI(new URL(req.url,"http://localhost").pathname));}
 catch{res.writeHead(400).end();return;}
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}
  res.writeHead(200,{"content-type":types[path.extname(file)]||"text/plain"});res.end(data);});
});
async function check(browser,port,width){
 const page=await browser.newPage({viewport:{width,height:890},reducedMotion:"reduce"});
 const errors=[],external=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",r=>{if(!r.url().startsWith("http://127.0.0.1:"))external.push(r.url());});
 await page.goto("http://127.0.0.1:"+port+"/v3/inflow.html");
 await page.waitForFunction(()=>!!window.ZKEconomicInflow&&!!window.ZKCompanyResearchUI,null,{timeout:8000});
 assert.equal(await page.locator("#econ-export").isDisabled(),true);
 assert.ok((await page.locator("#econ-metrics").innerText()).includes("尚未运行"));
 await page.locator("#company-name").fill("拟引进工业配套示范项目");
 await page.locator("#company-scenario").selectOption("expansion");
 assert.ok((await page.locator("#econ-context").innerText()).includes("扩产"));
 await page.locator("#econ-investment-low").fill("8");
 await page.locator("#econ-investment-high").fill("12");
 await page.locator("#econ-procurement-low").fill("2");
 await page.locator("#econ-procurement-high").fill("4");
 await page.locator("#econ-localShare-low").fill("30");
 await page.locator("#econ-localShare-high").fill("40");
 await page.locator("#econ-supplierDisplacement-low").fill("10");
 await page.locator("#econ-supplierDisplacement-high").fill("25");
 await page.locator("#econ-jobs-low").fill("100");
 await page.locator("#econ-jobs-high").fill("150");
 await page.locator("#econ-jobDisplacement-low").fill("0");
 await page.locator("#econ-jobDisplacement-high").fill("10");
 await page.locator("#econ-land-low").fill("100");
 await page.locator("#econ-land-high").fill("110");
 await page.locator("#econ-power-low").fill("2500");
 await page.locator("#econ-power-high").fill("3500");
 await page.locator("#econ-water-low").fill("50");
 await page.locator("#econ-water-high").fill("80");
 await page.locator("#econ-cap-land").fill("90");
 await page.locator("#econ-cap-power").fill("3000");
 await page.locator("#econ-cap-water").fill("100");
 await page.locator("#econ-run").click();
 assert.ok((await page.locator("#econ-message").innerText()).includes("勾选确认"));
 await page.locator("#econ-assumption-confirm").check();
 await page.locator("#econ-run").click();
 assert.equal(await page.locator(".econ-result").count(),4);
 assert.ok((await page.locator("#econ-resource-check").innerText()).includes("超过"));
 assert.ok((await page.locator("#econ-evidence-questions").innerText()).includes("新增量")||
  (await page.locator("#econ-evidence-questions").innerText()).includes("核实"));
 assert.ok(await page.locator("#econ-export").isEnabled());
 await page.locator("#econ-save").click();
 assert.equal(await page.locator(".econ-compare-card").count(),1);
 await page.locator("#company-scenario").selectOption("backfill");
 assert.equal(await page.locator("#econ-export").isDisabled(),true,"Scenario change invalidates old output");
 await page.locator("#econ-run").click();
 assert.equal(await page.locator(".econ-result").count(),4);
 assert.ok((await page.locator(".econ-result").first().innerText()).includes("0"));
 assert.ok((await page.locator("#econ-message").innerText()).includes("完成"));
 await page.locator("#econ-save").click();
 assert.equal(await page.locator(".econ-compare-card").count(),2);
 assert.ok((await page.locator("#econ-compare-cards").innerText()).includes("B 相对 A"));
 await page.locator("#econ-clear-comparison").click();
 assert.equal(await page.locator(".econ-compare-card").count(),0);
 await page.locator("#open-validation-roster").click();
 await page.waitForFunction(()=>document.querySelectorAll(".real-roster-entry").length===20,null,{timeout:8000});
 assert.equal(await page.locator(".real-roster-entry a").count(),20);
 assert.ok((await page.locator("#real-roster-results").innerText()).includes("广东利元亨智能装备股份有限公司"));
 assert.ok((await page.locator("#real-roster-results").innerText()).includes("惠州市华阳精机有限公司"));
 const link=await page.locator(".real-roster-entry a").first().getAttribute("href");
 assert.match(link,/^https:\/\/gxj.huizhou.gov.cn/);
 await page.locator("#open-validation-roster").click();
 assert.equal(await page.locator(".real-roster-entry").count(),0);
 await page.locator("#econ-investment-low").fill("-1");
 await page.locator("#econ-run").click();
 assert.ok((await page.locator("#econ-message").innerText()).includes("范围无效"));
 const geom=await page.evaluate(()=>({inner:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(geom.scroll<=geom.inner+4,"Horizontal overflow "+JSON.stringify(geom));
 assert.deepEqual(errors,[],"JS page errors: "+errors.join("|"));
 assert.deepEqual(external,[],"Do not automatically query external companies");
 if(width===390){
  const dir=path.join(root,"v3/screenshots");fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,"v318-impact-roster-390.png"),fullPage:true});
 }
 await page.close();
}
(async()=>{
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));let browser;
 try{browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
  for(const width of [1440,390,360])await check(browser,server.address().port,width);
  console.log("PASS V3.18 desktop/mobile resource stress, expansion vs backfill, 2-case comparison, 20 actual company source records");
 }finally{if(browser)await browser.close();server.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});