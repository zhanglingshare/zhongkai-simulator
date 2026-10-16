/* V3.11 second-page scenario lab: actual Chrome, no fabricated UI values. */
const assert=require("node:assert/strict");
const http=require("node:http"),fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"../.."),shots=path.resolve(__dirname,"../screenshots");
fs.mkdirSync(shots,{recursive:true});
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"};
const server=http.createServer((req,res)=>{
 let uri;try{uri=decodeURI(new URL(req.url,"http://localhost").pathname);}catch{res.writeHead(400).end();return;}
 let target=path.resolve(root,"."+uri);
 if(!target.startsWith(root+path.sep)&&target!==root){res.writeHead(403);res.end();return;}
 if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,"index.html");
 fs.readFile(target,(err,data)=>{
  if(err){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":mime[path.extname(target)]||"application/octet-stream"});res.end(data);
 });
});
async function overflow(page){
 const v=await page.evaluate(()=>({window:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
 assert.ok(v.doc<=v.window+4,"Page overflows horizontally: "+JSON.stringify(v));
}
async function visit(browser,port,width){
 const mobile=width<760;
 const page=await browser.newPage({viewport:{width,height:mobile?812:900},deviceScaleFactor:1,
    isMobile:mobile,hasTouch:mobile});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:"+port+"/v3/lab.html",{waitUntil:"load"});
 await page.waitForFunction(()=>document.querySelectorAll("#wind-risk button").length===6);
 await page.waitForFunction(()=>Number(document.querySelector("#atlas-total")?.textContent)>=20);
 assert.equal(await page.locator("#holo-hero").count(),0,"Second page must not duplicate hologram");
 assert.equal(await page.locator("#wind-opportunity button").count(),3);
 assert.equal(await page.locator("#lab-all-shocks option").count(),14);
 assert.equal(await page.locator("#lab-preview .lab-quick-row").count(),0,"No made-up result before computation");
 assert.equal(await page.locator("#v39-deltas .v39-delta").count(),0);
 assert.equal(await page.locator("#lab-evidence").evaluate(x=>x.open),false,"Expert tools should start collapsed");
 assert.ok(await page.locator("#lab-stage").isVisible());
 assert.ok(await page.locator("#lab-preview").isVisible());
 assert.ok(await page.locator("#v39-lens").isVisible());
 await overflow(page);
 await page.locator("#lab-stage").screenshot({path:path.join(shots,"v311-stage-"+width+".png")});
 await page.locator("#lab-all-shocks").selectOption("技术突破");
 assert.equal(await page.locator("#shock-sel").inputValue(),"技术突破");
 await page.locator("#wind-run").click();
 await page.waitForFunction(()=>document.querySelectorAll(".lab-quick-row").length===5);
 assert.equal(await page.locator("#v39-deltas .v39-delta").count(),5);
 assert.equal(await page.locator("#lab-preview-status").getAttribute("data-state"),"ready");
 assert.equal(await page.locator("#lab-b-name").innerText(),"技术突破");
 assert.ok(await page.locator("#v39-time").isEnabled());
 await page.locator("#v39-time").fill("7");
 assert.equal(await page.locator("#compare-tick").inputValue(),"7");
 assert.match(await page.locator("#lab-preview-status").innerText(),/T 07/);
 await page.locator("#lab-results").screenshot({path:path.join(shots,"v311-impact-"+width+".png")});
 await page.locator("#lab-seed").fill("19");
 assert.equal(await page.locator("#seed-input").inputValue(),"19");
 assert.equal(await page.locator(".lab-quick-row").count(),0,"Changing seed invalidates result");
 assert.equal(await page.locator("#v39-deltas .v39-delta").count(),0);
 await page.locator("#lab-all-shocks").selectOption("供应链中断");
 await page.locator("#wind-run").click();
 assert.equal(await page.locator(".lab-quick-row").count(),5);
 assert.match(await page.locator("#lab-b-name").innerText(),/供应链中断/);
 await page.locator("#v39-detail-button").click();
 assert.equal(await page.locator("#lab-evidence").evaluate(x=>x.open),true);
 assert.ok(await page.locator("#compare-section").isVisible());
 assert.ok(await page.locator("#atlas-section").isVisible());
 assert.ok(await page.locator("#lab-workstation").count()===1);
 const name=await page.locator("#atlas-list .atlas-item").first().getAttribute("data-atlas-name");
 assert.ok(name);
 await page.locator("#atlas-list .atlas-item").first().click();
 assert.equal((await page.locator("#atlas-inspector-title").innerText()).trim(),name);
 await page.locator("#atlas-focus").click();
 assert.equal(await page.locator("#iv-sel").inputValue(),name,"Subject focus must route to real lab inspector");
 await overflow(page);
 await page.locator("#lab-preview").screenshot({path:path.join(shots,"v311-preview-final-"+width+".png")});
 assert.deepEqual(errors,[],"Browser JavaScript errors: "+errors.join(" | "));
 await page.close();
}
(async()=>{
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 let browser;
 try{
  browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
  for(const width of [1440,390,360])await visit(browser,server.address().port,width);
  console.log("PASS V3.11 scenario lab: 14 real shocks, A/B impact, invalidation, mobile and professional inspector");
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
