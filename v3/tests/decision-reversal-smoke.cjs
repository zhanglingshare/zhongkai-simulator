/* V3.19 Chrome E2E: user thresholds, live flip, ranked questions and 20 sources */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {chromium}=require("playwright"),root=path.resolve(__dirname,"../..");
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
 const page=await browser.newPage({viewport:{width,height:880},reducedMotion:"reduce"});
 const errors=[],external=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",r=>{if(!r.url().startsWith("http://127.0.0.1:"))external.push(r.url());});
 await page.goto("http://127.0.0.1:"+port+"/v3/inflow.html");
 await page.waitForFunction(()=>!!window.ZKDecisionReversal&&!!window.ZKEconomicInflow,null,{timeout:8000});
 assert.equal(await page.locator("#rev-export").isDisabled(),true);
 assert.ok((await page.locator("#rev-status").innerText()).includes("尚未确认"));
 await page.locator("#company-name").fill("纯假设的制造业企业");
 await page.locator("#company-scenario").selectOption("proposed_new");
 await page.locator("#econ-assumption-confirm").check();
 assert.ok((await page.locator("#rev-status").innerText()).includes("至少设置"));
 await page.locator("#rev-minNetPurchasing").fill("0.9");
 assert.ok((await page.locator("#rev-status").innerText()).includes("已按你设置的 1 个门槛"));
 assert.equal(await page.locator(".rev-criterion").count(),1);
 assert.equal(await page.locator(".rev-question").count(),1);
 assert.ok((await page.locator(".rev-criterion").innerText()).includes("资料缺失"));
 assert.ok(await page.locator("#rev-export").isEnabled());
 const fields={procurement:[2,4],localShare:[30,40],supplierDisplacement:[10,25],
  jobs:[100,150],jobDisplacement:[0,10],investment:[8,12],land:[100,110],power:[2500,3500],water:[50,80]};
 for(const [key,[low,high]]of Object.entries(fields)){
  await page.locator("#econ-"+key+"-low").fill(String(low));
  await page.locator("#econ-"+key+"-high").fill(String(high));
 }
 await page.locator("#rev-minNetJobs").fill("140");
 await page.locator("#rev-maxLand").fill("90");
 await page.locator("#rev-minInvestment").fill("8");
 assert.equal(await page.locator(".rev-criterion").count(),4);
 assert.equal(await page.locator(".rev-question").count(),3);
 const states=await page.locator(".rev-criterion").evaluateAll(nodes=>nodes.map(n=>n.dataset.status));
 assert.ok(states.includes("robust-pass"));
 assert.ok(states.includes("robust-fail"));
 assert.ok(states.includes("reversible"));
 assert.ok((await page.locator("#rev-overview").innerText()).includes("不满足"));
 assert.ok((await page.locator("#rev-gates-output").innerText()).includes("本地采购比例"));
 assert.ok((await page.locator(".rev-question").first().innerText()).includes("岗位"));
 await page.locator("#rev-maxLand").fill("120");
 assert.ok((await page.locator("#rev-overview").innerText()).includes("取决于尚未核实的参数"));
 await page.locator("#rev-minNetPurchasing").fill("0.2");
 await page.locator("#rev-minNetJobs").fill("80");
 assert.ok((await page.locator("#rev-overview").innerText()).includes("全部输入区间内满足"));
 await page.locator("#company-scenario").selectOption("backfill");
 assert.ok((await page.locator("#rev-overview").innerText()).includes("不满足"));
 const zero=await page.locator(".rev-criterion").first().innerText();
 assert.ok(zero.includes("0"),"Backfill never invents incremental investment");
 await page.locator("#rev-minInvestment").fill("-1");
 assert.equal(await page.locator("#rev-export").isDisabled(),true);
 assert.ok((await page.locator("#rev-status").innerText()).includes("有效的非负数字"));
 await page.locator("#rev-minInvestment").fill("8");
 assert.ok(await page.locator("#rev-export").isEnabled());
 await page.locator("#rev-audit-load").click();
 await page.waitForFunction(()=>document.querySelectorAll("#rev-audit-select option").length===20,null,{timeout:8000});
 assert.equal(await page.locator("#rev-audit-select option").count(),20);
 assert.ok((await page.locator("#rev-audit-results").innerText()).includes("尚未核验"));
 const firstHref=await page.locator(".rev-audit-summary a").getAttribute("href");
 assert.match(firstHref,/^https:\/\/gxj.huizhou.gov.cn\//);
 const opts=await page.locator("#rev-audit-select option").allTextContents();
 const index=opts.indexOf("惠州市华阳精机有限公司");assert.ok(index>=0);
 await page.locator("#rev-audit-select").selectOption(String(index));
 assert.ok((await page.locator("#rev-audit-results").innerText()).includes("环境影响评价受理"));
 assert.ok((await page.locator("#rev-audit-results").innerText()).includes("不能"));
 await page.locator("#rev-audit-load").click();
 assert.equal(await page.locator("#rev-audit-select").count(),0);
 await page.locator("#company-name").fill("另一个项目");
 assert.ok(await page.locator("#rev-export").isEnabled(),"Changed name causes fresh reactive study, not stale output");
 const geom=await page.evaluate(()=>({inner:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(geom.scroll<=geom.inner+4,"Horizontal overflow: "+JSON.stringify(geom));
 assert.deepEqual(errors,[],"Browser runtime errors: "+errors.join(" | "));
 assert.deepEqual(external,[],"No hidden third-party enterprise lookup");
 if(width===390){
  const folder=path.join(root,"v3/screenshots");fs.mkdirSync(folder,{recursive:true});
  await page.screenshot({path:path.join(folder,"v319-decision-mobile-390.png"),fullPage:true});
 }
 await page.close();
}
(async()=>{
 await new Promise(done=>server.listen(0,"127.0.0.1",done));let browser;
 try{
  browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
  for(const width of [1440,390,360])await check(browser,server.address().port,width);
  console.log("PASS V3.19 desktop/390/360 decisions, reverse thresholds, top-three questions, 20-company evidence audit, no external requests");
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
