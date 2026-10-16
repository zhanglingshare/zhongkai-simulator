/* V3.12 real-browser motion acceptance: true snapshot changes, no phantom data. */
const assert=require("node:assert/strict");
const http=require("node:http"),fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"../.."),shots=path.resolve(__dirname,"../screenshots");
fs.mkdirSync(shots,{recursive:true});
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"};
const server=http.createServer((req,res)=>{
 let uri;try{uri=decodeURI(new URL(req.url,"http://localhost").pathname);}catch{res.writeHead(400);res.end();return;}
 let target=path.resolve(root,"."+uri);
 if(!target.startsWith(root+path.sep)&&target!==root){res.writeHead(403);res.end();return;}
 if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,"index.html");
 fs.readFile(target,(err,data)=>{
  if(err){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":mime[path.extname(target)]||"application/octet-stream"});res.end(data);
 });
});
const url=(port,file)=>"http://127.0.0.1:"+port+"/v3/"+file;
async function overflow(page){
 const d=await page.evaluate(()=>({window:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(d.scroll<=d.window+4,"Horizontal overflow: "+JSON.stringify(d));
}
async function load(browser,width,reduce=false){
 const mobile=width<760;
 const page=await browser.newPage({viewport:{width,height:mobile?812:900},deviceScaleFactor:1,
  isMobile:mobile,hasTouch:mobile,reducedMotion:reduce?"reduce":"no-preference"});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 return {page,errors};
}
async function portal(browser,port,width,reduce=false){
 const {page,errors}=await load(browser,width,reduce);
 await page.goto(url(port,"index.html"),{waitUntil:"load"});
 await page.waitForFunction(()=>document.querySelector("#world-node-count").textContent==="41",null,{timeout:12000});
 assert.equal(await page.locator("#holo-canvas").count(),1);
 assert.equal(await page.locator("#world-variation").count(),1);
 assert.match(await page.locator("#render-mode").innerText(),/WEBGL|2.5D/);
 await page.locator("#portal-population").selectOption("24");
 assert.equal(await page.locator("#world-node-count").innerText(),"24");
 await page.locator("#portal-population").selectOption("41");
 assert.equal(await page.locator("#world-node-count").innerText(),"41");
 await page.locator("#portal-shock").selectOption("技术突破");
 await page.locator("#portal-run").click();
 assert.equal(await page.locator("#timeline-slider").isEnabled(),true);
 if(reduce){
  assert.equal(await page.locator("#timeline-slider").inputValue(),"0","Reduced-motion must not autoplay");
  await page.waitForTimeout(600);
  assert.equal(await page.locator("#timeline-slider").inputValue(),"0");
 }else{
  await page.waitForFunction(()=>Number(document.querySelector("#timeline-slider").value)>=2,null,{timeout:10000});
  assert.match(await page.locator("#world-variation").innerText(),/模型观察/);
  await page.locator("#timeline-play").click();
 }
 await page.locator("#timeline-slider").fill("9");
 assert.equal(await page.locator("#timeline-output").innerText(),"T 09 / 20");
 assert.match(await page.locator("#world-variation").innerText(),/T09/);
 const metric=Number(await page.locator("#metric-disaster").innerText());
 assert.ok(Number.isFinite(metric)&&metric>=0&&metric<=1);
 assert.match(await page.locator("#delta-disaster").innerText(),/B−A/);
 await overflow(page);
 if(!reduce)await page.screenshot({path:path.join(shots,"v312-portal-"+width+".png"),fullPage:false});
 assert.deepEqual(errors,[],"Portal JavaScript: "+errors.join(" | "));
 await page.close();
}
async function laboratory(browser,port,width,reduce=false){
 const {page,errors}=await load(browser,width,reduce);
 await page.goto(url(port,"lab.html"),{waitUntil:"load"});
 await page.waitForFunction(()=>document.querySelectorAll("#wind-risk button").length===6);
 assert.equal(await page.locator("#holo-hero").count(),0);
 assert.ok(await page.locator("#v312-replay").isDisabled());
 await page.evaluate(()=>{window.__lastAB=null;window.addEventListener("zk:comparison",e=>{window.__lastAB=e.detail;});});
 await page.locator("#lab-all-shocks").selectOption("技术突破");
 await page.locator("#wind-run").click();
 await page.waitForFunction(()=>document.querySelectorAll("#v39-deltas .v39-delta").length===5);
 assert.equal(await page.locator("#v312-replay").isEnabled(),true);
 if(reduce){
  assert.equal(await page.locator("#compare-tick").inputValue(),"20","Reduced motion retains computed final snapshots");
  await page.waitForTimeout(500);
  assert.equal(await page.locator("#compare-tick").inputValue(),"20");
 }else{
  await page.waitForFunction(()=>Number(document.querySelector("#compare-tick").value)>=2,null,{timeout:8000});
  await page.locator("#v312-replay").click(); // Stop without scrambling the true current tick.
  assert.match(await page.locator("#v312-replay-status").innerText(),/暂停/);
 }
 await page.locator("#v39-time").fill("7");
 assert.equal(await page.locator("#compare-tick").inputValue(),"7");
 assert.equal(await page.locator("#v39-chart").getAttribute("data-tick"),"7");
 const pathCounts=await page.locator('#v39-chart polyline[data-upto="7"]').evaluateAll(xs=>
  xs.map(x=>x.getAttribute("points").split(" ").length));
 assert.equal(pathCounts.length,4);
 assert.ok(pathCounts.every(n=>n>0&&n<=8),"Curve cannot reveal future states: "+pathCounts);
 const valid=await page.evaluate(()=>{
  const d=window.__lastAB,ms=window.ZKImpact.compare(d.a,d.b);
  const shown=[...document.querySelectorAll("#v39-deltas .v39-delta-value strong")]
    .map(x=>Number(x.dataset.modelValue));
  return {expected:ms.map(x=>x.delta),shown};
 });
 assert.equal(valid.expected.length,5);
 assert.ok(valid.expected.every((x,i)=>Math.abs(x-valid.shown[i])<1e-12),
  "Animated score endpoint must be exactly the model result");
 if(!reduce){
  await page.locator("#v312-replay").click();
  await page.waitForFunction(()=>Number(document.querySelector("#v39-time").value)>=2,null,{timeout:9000});
  await page.locator("#v312-replay").click();
 }
 await page.locator("#lab-seed").fill("31");
 assert.equal(await page.locator("#v312-replay").isDisabled(),true);
 assert.equal(await page.locator("#v39-deltas .v39-delta").count(),0);
 assert.equal(await page.locator("#lab-preview-metrics .lab-quick-row").count(),0);
 await overflow(page);
 if(!reduce)await page.screenshot({path:path.join(shots,"v312-lab-"+width+".png"),fullPage:false});
 assert.deepEqual(errors,[],"Lab JavaScript: "+errors.join(" | "));
 await page.close();
}
(async()=>{
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 let browser;
 try{
  browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
  const port=server.address().port;
  for(const width of [1440,390,360]){await portal(browser,port,width);await laboratory(browser,port,width);}
  await portal(browser,port,390,true);
  await laboratory(browser,port,390,true);
  console.log("PASS V3.12 real model-driven 3D and A/B evolution, tablet/mobile, manual replay, reduced motion");
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
