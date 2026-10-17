/* V3.21 presentation-only polish E2E: no new models, computed narration only,
   accessible mobile entry path, existing enterprise demos and research intact. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {chromium}=require("playwright"),root=path.resolve(__dirname,"../..");
const types={".html":"text/html;charset=utf-8",".js":"application/javascript;charset=utf-8",
 ".css":"text/css;charset=utf-8",".json":"application/json;charset=utf-8"};
const server=http.createServer((req,res)=>{
 let file;try{file=path.resolve(root,"."+decodeURI(new URL(req.url,"http://localhost").pathname));}
 catch{res.writeHead(400).end();return;}
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}
 res.writeHead(200,{"content-type":types[path.extname(file)]||"text/plain"});res.end(data);});
});
async function open(browser,port,file,width){
 const page=await browser.newPage({viewport:{width,height:800},reducedMotion:"reduce"});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:"+port+"/v3/"+file,{waitUntil:"load"});
 await page.waitForTimeout(150);
 return {page,errors};
}
async function check(browser,port,width){
 // 1 — Hologram remains real Sim, easier first 3 seconds.
 let {page,errors}=await open(browser,port,"index.html",width);
 assert.equal(await page.locator("#portal-labels").inputValue(),"core","Default labels should not clutter network");
 assert.ok(await page.locator("#hero-quickstart").isVisible());
 assert.match(await page.locator(".hero-deck").innerText(),/假设/);
 assert.equal(await page.locator("#story-settings").evaluate(x=>x.open),false);
 assert.equal(await page.locator("#story-research").evaluate(x=>x.open),false);
 assert.equal(await page.locator("#timeline-slider").isDisabled(),true);
 if(width<=960){
  const p=await page.evaluate(()=>{
   const a=document.querySelector("#world-stage").getBoundingClientRect(),
    b=document.querySelector("#story-settings").getBoundingClientRect();
   return {stage:a.top,controls:b.top};
  });
  assert.ok(p.stage<p.controls,"Immersive model must appear before optional settings: "+JSON.stringify(p));
  assert.equal(await page.locator("#portal-population").isVisible(),false);
 }
 await page.locator("#hero-quickstart").click();
 assert.equal(await page.locator("#timeline-slider").isEnabled(),true);
 await page.locator("#timeline-slider").fill("6");
 const narrative=await page.locator("#portal-story-result").innerText();
 assert.ok(narrative.length>=10,"Narrative must name a specific subject or accurately report no meaningful differences");
 assert.match(await page.locator("#story-explanation").innerText(),/模拟路线|尚未出现/);
 assert.match(await page.locator(".story-result").innerText(),/不能证明因果关系/);
 const total=await page.locator("#world-node-count").innerText();
 assert.equal(total,"41");
 await page.locator("#story-settings summary").click();
 await page.locator("#portal-population").selectOption("24");
 assert.equal(await page.locator("#world-node-count").innerText(),"24");
 assert.match(await page.locator("#portal-story-result").innerText(),/点上面的播放按钮/);
 await checkGeometry(page,width);
 if(width===390)await shot(page,"v321-ux-portal-mobile.png");
 assert.deepEqual(errors,[],"Portal runtime: "+errors.join(" | "));
 await page.close();
 // 2 — Only computed deltas can produce narrative.
 ({page,errors}=await open(browser,port,"lab.html",width));
 if(width<=760)assert.equal(await page.locator(".rail").isVisible(),false,"Mobile must not duplicate expert icon rail");
 assert.match(await page.locator("#lab-plain-result").innerText(),/还没有进行实验/);
 assert.equal(await page.locator("#lab-preview .lab-quick-row").count(),0);
 await page.locator("#lab-all-shocks").selectOption("技术突破");
 await page.locator("#wind-run").click();
 await page.waitForFunction(()=>document.querySelectorAll(".lab-quick-row").length===5,null,{timeout:10000});
 assert.match(await page.locator("#lab-plain-result").innerText(),/模型对照|几乎没有变化/);
 assert.match(await page.locator("#lab-plain-result").innerText(),/不是现实的经济损失/);
 assert.equal(await page.locator("#lab-preview .lab-quick-row").count(),5);
 await page.locator("#lab-seed").fill("31");
 assert.match(await page.locator("#lab-plain-result").innerText(),/需要重算/);
 assert.equal(await page.locator("#lab-preview .lab-quick-row").count(),0);
 await checkGeometry(page,width);
 if(width===390)await shot(page,"v321-ux-lab-mobile.png");
 assert.deepEqual(errors,[],"Lab runtime: "+errors.join(" | "));
 await page.close();
 // 3 — Case demonstration is easy to find and doesn't claim new signing.
 ({page,errors}=await open(browser,port,"inflow.html",width));
 assert.match(await page.locator(".inflow-first-steps").innerText(),/先试一个已有企业案例/);
 assert.ok(await page.locator("#load-zhongkai-case").isVisible());
 await page.locator("#load-zhongkai-case").click();
 assert.match(await page.locator("#company-name").inputValue(),/博实结/);
 assert.match(await page.locator("#zhongkai-demo").innerText(),/并非“新签约落地”/);
 assert.equal(await page.locator("#inflow-export").isDisabled(),true);
 await checkGeometry(page,width);
 assert.deepEqual(errors,[],"Inflow runtime: "+errors.join(" | "));
 await page.close();
 // 4 — Existing five source pilots appear before expert baseline data.
 ({page,errors}=await open(browser,port,"trust.html",width));
 await page.waitForFunction(()=>document.querySelectorAll("#pilot-case option").length===5,null,{timeout:10000});
 const positions=await page.evaluate(()=>({
  pilots:document.getElementById("pilot-lab").getBoundingClientRect().top+window.scrollY,
  baseline:document.querySelector('[aria-labelledby="backtest-title"]').getBoundingClientRect().top+window.scrollY
 }));
 assert.ok(positions.pilots<positions.baseline,"Pilot source review should lead statistical baseline");
 assert.match(await page.locator(".trust-first-action").innerText(),/先查一家企业的证据/);
 assert.equal(await page.locator("#pilot-case option").count(),5);
 assert.match(await page.locator("#pilot-case option").first().textContent(),/产能扩建/);
 assert.doesNotMatch(await page.locator("#pilot-case").innerText(),/expansion-project-application|government-award-allocation/,
  "Raw engineering source type must be explained in Chinese");
 assert.match(await page.locator("#pilot-source").innerText(),/不证明/);
 assert.ok(await page.locator("#pilot-export").isDisabled());
 await checkGeometry(page,width);
 if(width===390)await shot(page,"v321-ux-trust-mobile.png");
 assert.deepEqual(errors,[],"Trust runtime: "+errors.join(" | "));
 await page.close();
}
async function checkGeometry(page,width){
 const rect=await page.evaluate(()=>({width:window.innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(rect.scroll<=rect.width+4,"Page should not overflow horizontally: "+JSON.stringify(rect));
 if(width<=390){
  const buttons=await page.locator("button:visible").evaluateAll(nodes=>
   nodes.filter(n=>!n.disabled&&n.getBoundingClientRect().width>0)
    .map(n=>({id:n.id,h:n.getBoundingClientRect().height})));
  assert.ok(buttons.some(b=>b.h>=42),"Page needs accessible primary touch controls");
 }
}
async function shot(page,name){
 const dir=path.join(root,"v3/screenshots");fs.mkdirSync(dir,{recursive:true});
 await page.screenshot({path:path.join(dir,name),fullPage:true});
}
(async()=>{
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));let browser;
 try{browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
 for(const width of [1440,390,360])await check(browser,server.address().port,width);
 console.log("PASS V3.21 four original pages: guided hologram, actual-data narrative, source-first examples, 1440/390/360 accessibility and no overflow");
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});