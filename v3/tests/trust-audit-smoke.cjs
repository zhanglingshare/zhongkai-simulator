/* V3.20 true-browser smoke: empirical trust dashboard, baseline replay,
 * entity provenance, preregistration and responsive design. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {chromium}=require("playwright"),root=path.resolve(__dirname,"../..");
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
 ".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"};
const server=http.createServer((req,res)=>{
 let target;try{target=path.resolve(root,"."+decodeURI(new URL(req.url,"http://localhost").pathname));}
 catch{res.writeHead(400).end();return;}
 if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(target,(err,data)=>{if(err){res.writeHead(404).end();return;}
  res.writeHead(200,{"content-type":mime[path.extname(target)]||"text/plain"});res.end(data);});
});
async function test(browser,port,width){
 const page=await browser.newPage({viewport:{width,height:850},reducedMotion:"reduce"});
 const errors=[],thirdParty=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",r=>{if(!r.url().startsWith("http://127.0.0.1:"))thirdParty.push(r.url());});
 await page.goto("http://127.0.0.1:"+port+"/v3/trust.html");
 await page.waitForFunction(()=>document.querySelectorAll(".enterprise-choice").length===20,null,{timeout:10000});
 assert.equal(await page.locator(".trust-kpis .trust-stat").count(),4);
 assert.match(await page.locator("#trust-kpis").innerText(),/58 条/);
 assert.match(await page.locator("#model-status").innerText(),/尚不具备/);
 assert.match(await page.locator("#trust-kpis").innerText(),/未通过/);
 assert.equal(await page.locator(".bridge-card").count(),5);
 assert.equal(await page.locator("#trust-fold-table tr").count(),3);
 assert.match(await page.locator("#trust-backtest-score").innerText(),/朴素/);
 await page.locator("#trust-metric").selectOption("industry_invest_growth");
 assert.equal(await page.locator("#trust-fold-table tr").count(),4);
 assert.match(await page.locator(".trust-footnote").innerText(),/不涉及.*Sim/);
 assert.match(await page.locator("#enterprise-detail").innerText(),/尚未核实/);
 await page.locator("#enterprise-filter").selectOption("仲恺高新区");
 assert.equal(await page.locator(".enterprise-choice").count(),14);
 await page.locator("#enterprise-filter").selectOption("other");
 assert.equal(await page.locator(".enterprise-choice").count(),6);
 await page.locator("#enterprise-filter").selectOption("all");
 await page.locator(".enterprise-choice").nth(17).click();
 assert.match(await page.locator("#enterprise-detail").innerText(),/惠州市华阳精机有限公司/);
 assert.match(await page.locator("#enterprise-detail").innerText(),/新增投资/);
 assert.ok((await page.locator("#enterprise-detail a").getAttribute("href")).startsWith("https://"));
 assert.equal(await page.locator("#prereg-export").isDisabled(),true);
 await page.locator("#prereg-form button[type=submit]").click();
 assert.match(await page.locator("#prereg-status").innerText(),/不能生成/);
 await page.locator("#prereg-target").fill("2027");
 await page.locator("#prereg-release").fill("2028-03-31");
 await page.locator("#prereg-value").fill("3.5");
 await page.locator("#prereg-commit").fill("a".repeat(40));
 await page.locator("#prereg-version").fill("study-protocol-1");
 await page.locator("#prereg-rule").fill("Predict 2027 growth after independent annual-to-simulation-time-step alignment.");
 await page.locator("#prereg-source").fill("https://www.hzzk.gov.cn/");
 await page.locator("#prereg-form button[type=submit]").click();
 assert.equal(await page.locator("#prereg-export").isEnabled(),true);
 assert.match(await page.locator("#prereg-status").innerText(),/未获得外部时间戳/);
 const [download]=await Promise.all([
  page.waitForEvent("download"),
  page.locator("#prereg-export").click()
 ]);
 assert.match(download.suggestedFilename(),/unsealed-preregistration/);
 await page.locator("#prereg-value").fill("4");
 assert.equal(await page.locator("#prereg-export").isDisabled(),true);
 const geom=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(geom.scroll<=geom.width+4,"Desktop/mobile width overflow "+JSON.stringify(geom));
 assert.deepEqual(errors,[],"Runtime errors: "+errors.join(" || "));
 assert.deepEqual(thirdParty,[],"Trust dashboard must not automatically call paid/vendor websites");
 if(width===390){
  const folder=path.join(root,"v3/screenshots");fs.mkdirSync(folder,{recursive:true});
  await page.screenshot({path:path.join(folder,"v320-trust-390.png"),fullPage:true});
 }
 await page.close();
}
(async()=>{
 await new Promise(done=>server.listen(0,"127.0.0.1",done));let browser;
 try{browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
  for(const width of [1440,390,360])await test(browser,server.address().port,width);
  console.log("PASS V3.20 actual 58 records, 20 firms, 3 baseline series, mobile/desktop, no fake forecast and unsealed prereg export");
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});