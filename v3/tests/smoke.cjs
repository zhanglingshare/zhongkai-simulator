/* V3.3 browser smoke tests. Runs on GitHub Actions with Playwright + Chrome. */
const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"../..");
const shots=path.resolve(__dirname,"../screenshots");
fs.mkdirSync(shots,{recursive:true});
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"};
const server=http.createServer((req,res)=>{
  const uri=decodeURI(new URL(req.url,"http://localhost").pathname);
  const target=path.resolve(root,"."+uri);
  if(!target.startsWith(root+path.sep) && target!==root){res.writeHead(403);res.end();return;}
  let p=target;
  if(fs.existsSync(p) && fs.statSync(p).isDirectory())p=path.join(p,"index.html");
  fs.readFile(p,(err,data)=>{
    if(err){res.writeHead(404);res.end("Not found");return;}
    res.writeHead(200,{"content-type":mime[path.extname(p)]||"application/octet-stream"});
    res.end(data);
  });
});

async function inspectOverflow(page){
  const d=await page.evaluate(()=>({
    innerWidth:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,
    bodyWidth:document.body.scrollWidth
  }));
  assert.ok(d.scrollWidth<=d.innerWidth+4,"Page horizontal overflow: "+JSON.stringify(d));
}
async function testDesktop(browser,port){
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:"+port+"/v3/",{waitUntil:"load"});
  await page.waitForFunction(()=>document.querySelector("#netsvg .node") && document.querySelector("#k-ab").textContent!=="—");
  assert.ok(await page.locator("#netsvg .node").count()>=15,"Missing model nodes");
  await inspectOverflow(page);
  await page.locator("#btn-step").click();
  assert.equal((await page.locator("#tick-lbl").innerText()).trim(),"1");
  await page.locator('[data-view="trends"]').click();
  assert.equal(await page.locator("#trends-grid .trend-tile").count(),5);
  await page.locator('[data-view="network"]').click();
  await page.locator("#btn-compare").click();
  assert.equal(await page.locator("#compare-metrics .delta-row").count(),5);
  assert.equal(await page.locator("#compare-trends .compare-trend-tile").count(),5);
  assert.ok(await page.locator("#compare-agents .impact-row").count()>0,"Missing entity comparison");
  assert.ok(await page.locator("#graph-b circle").count()>=15);
  assert.equal((await page.locator("#tick-lbl").innerText()).trim(),"1","A/B computation must not modify the live session");
  await page.locator("#compare-tick").evaluate(x=>{x.value="0";x.dispatchEvent(new Event("input",{bubbles:true}));});
  assert.match(await page.locator("#compare-tick-value").innerText(),/t0/);
  const shockDeltas=await page.locator("#compare-metrics .delta-row strong").allInnerTexts();
  assert.ok(shockDeltas.some(x=>Math.abs(Number(x))>0.001),"Shock at t0 must produce a real difference");
  await page.locator("#compare-tick").evaluate(x=>{x.value="20";x.dispatchEvent(new Event("input",{bubbles:true}));});
  await page.locator("#compare-agents .impact-row").first().click();
  assert.equal(await page.locator('#compare-agents .impact-row[aria-pressed="true"]').count(),1,"Entity focus must persist in both graphs");
  const focusedCircles=await page.locator("#graph-a circle[stroke='#0491a2'],#graph-b circle[stroke='#0491a2']").count();
  assert.ok(focusedCircles>=2,"A/B network focus should update both canvases");
  await page.locator("#toggle-compare").click();
  assert.ok(await page.locator("#compare-section").evaluate(x=>x.classList.contains("fullscreen")));
  await page.keyboard.press("Escape");
  assert.ok(!(await page.locator("#compare-section").evaluate(x=>x.classList.contains("fullscreen"))));
  await page.locator("#shock-sel").selectOption("人才流失");
  assert.match(await page.locator("#status-b").innerText(),/旧结果/);
  await page.locator("#btn-compare").click();
  assert.match(await page.locator("#scenario-label").innerText(),/人才流失/);
  await page.locator("#robust-n").selectOption("24");
  await page.locator("#btn-robust").click();
  await page.locator("#robust-results .robust-tile").first().waitFor({timeout:60000});
  assert.equal(await page.locator("#robust-results .robust-tile").count(),5,"Five model-internal delta distributions");
  assert.match(await page.locator("#robust-status").innerText(),/完成 24 组种子/);
  assert.equal((await page.locator("#tick-lbl").innerText()).trim(),"1","Robustness must not modify the live session");
  const downloadable=page.waitForEvent("download");
  await page.locator("#btn-export").click();
  const download=await downloadable;
  assert.match(download.suggestedFilename(),/^zhongkai-v3-research-seed-7.json$/);
  const data=JSON.parse(fs.readFileSync(await download.path(),"utf8"));
  assert.equal(data.schema,"zhongkai-v3-research-1");
  assert.equal(data.A_B.shock,"人才流失");
  assert.equal(data.A_B.seed,7);
  assert.equal(data.multiseed.count,24);
  assert.equal(data.multiseed.metrics.length,5);
  assert.equal(data.multiseed.metrics[0].values.length,24);
  await page.screenshot({path:path.join(shots,"desktop-1440.png"),fullPage:true});
  await page.locator("#shock-sel").selectOption("芯片断供");
  assert.match(await page.locator("#robust-status").innerText(),/上一次研究/);
  assert.equal(await page.locator("#robust-results .robust-tile").count(),5,"Old result should remain visibly historical");
  await page.locator("#btn-compare").click();
  assert.equal(await page.locator("#robust-results .robust-tile").count(),0,"New A/B scenario invalidates old robustness");
  await page.goto("http://127.0.0.1:"+port+"/v3/verification.html",{waitUntil:"load"});
  await page.waitForFunction(()=>document.querySelector("#param-rows tr")?.children?.length===4 && document.querySelector("#data-gate").textContent!=="检查中");
  assert.equal(await page.locator("#param-rows tr").count(),11,"Parameter lineage must be read from model.js");
  assert.match(await page.locator("#model-fingerprint").innerText(),/[a-f0-9]{16}/);
  assert.match(await page.locator("#feed-overview").innerText(),/镇街/);
  await inspectOverflow(page);
  const templateEvent=page.waitForEvent("download");
  await page.locator("#download-template").click();
  const templateFile=await templateEvent;
  const template=JSON.parse(fs.readFileSync(await templateFile.path(),"utf8"));
  assert.equal(template.schema,"zk-backtest-v1");
  await page.locator("#holdout-json").fill(JSON.stringify(template));
  await page.locator("#score-holdout").click();
  assert.match(await page.locator("#holdout-result").innerText(),/不能认定为合格留出集/);
  assert.ok(await page.locator("#holdout-scores").isHidden(),"Invalid data must not produce a score");
  const fixture={
    schema:"zk-backtest-v1",scope:"model-index",metric:"abundance",
    mapping_id:"synthetic-test-fixed",mapping_spec_url:"https://example.org/mapping",
    model_commit:"a".repeat(40),calibration_cutoff:"2026-09-30",
    cases:Array.from({length:8},(_,i)=>({
      id:"browser-fixture-"+i,predicted_at:"2026-10-01",
      observed_at:["2026-10-04","2026-10-06","2026-10-08"][i%3],
      source_url:"https://example.org/observations/"+i,forecast_archive_url:"https://example.org/archives/"+i,
      predicted:.4+i*.01,observed:.5+i*.01,naive:.3+i*.01,used_in_calibration:false
    }))
  };
  await page.locator("#holdout-json").fill(JSON.stringify(fixture));
  await page.locator("#score-holdout").click();
  assert.match(await page.locator("#holdout-result").innerText(),/未独立认证/);
  assert.equal(await page.locator("#holdout-scores .score-cell").count(),4);
  await page.screenshot({path:path.join(shots,"verification-1440.png"),fullPage:true});

  assert.deepEqual(errors,[],"JavaScript errors: "+errors.join("; "));
  await page.close();
}
async function testMobile(browser,port,width){
  const page=await browser.newPage({viewport:{width,height:812},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:"+port+"/v3/",{waitUntil:"load"});
  await page.waitForFunction(()=>document.querySelector("#netsvg .node"));
  await inspectOverflow(page);
  await page.locator('[data-mobile-to="canvas"]').click();
  assert.ok(await page.locator("#netsvg").isVisible(),"Canvas tab hidden");
  await page.screenshot({path:path.join(shots,"mobile-"+width+"-canvas.png"),fullPage:true});
  await page.locator('[data-mobile-to="compare"]').click();
  assert.ok(await page.locator("#compare-section").isVisible(),"Compare tab hidden");
  await page.locator("#btn-compare").click();
  assert.equal(await page.locator("#compare-metrics .delta-row").count(),5);
  await page.locator('[data-mobile-to="input"]').click();
  await page.locator("#btn-design-compare").click();
  assert.ok(await page.locator("#compare-section").isVisible(),"Input shortcut should open comparison on mobile");
  await inspectOverflow(page);
  await page.screenshot({path:path.join(shots,"mobile-"+width+"-compare.png"),fullPage:true});
  await page.goto("http://127.0.0.1:"+port+"/v3/verification.html",{waitUntil:"load"});
  await page.waitForFunction(()=>document.querySelector("#data-gate").textContent!=="检查中");
  assert.equal(await page.locator("#param-rows tr").count(),11);
  await inspectOverflow(page);
  await page.screenshot({path:path.join(shots,"verification-"+width+".png"),fullPage:true});
  assert.deepEqual(errors,[],"Mobile JavaScript errors: "+errors.join("; "));
  await page.close();
}
(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const port=server.address().port;
  let browser;
  try{
    browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
    await testDesktop(browser,port);
    for(const width of [390,360])await testMobile(browser,port,width);
    console.log("PASS V3.3 Chromium desktop 1440 and mobile 390/360; screenshots in v3/screenshots");
  }finally{
    if(browser)await browser.close();
    server.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
