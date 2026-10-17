/* Real Chrome acceptance for the new hypothetical inflow lab. */
const assert=require("node:assert/strict"),fs=require("node:fs"),http=require("node:http"),path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"../.."),shots=path.join(root,"v3/screenshots");
fs.mkdirSync(shots,{recursive:true});
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"};
const server=http.createServer((req,res)=>{
 let uri;try{uri=decodeURI(new URL(req.url,"http://localhost").pathname);}catch{res.writeHead(400);res.end();return;}
 let target=path.resolve(root,"."+uri);
 if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(target,(error,data)=>{
  if(error){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":mime[path.extname(target)]||"application/octet-stream"});res.end(data);
 });
});
async function test(browser,port,width,reduce=false){
 const mobile=width<700;
 const page=await browser.newPage({viewport:{width,height:mobile?800:900},
  isMobile:mobile,hasTouch:mobile,reducedMotion:reduce?"reduce":"no-preference"});
 const errors=[];page.on("pageerror",err=>errors.push(err.message));
 await page.goto("http://127.0.0.1:"+port+"/v3/inflow.html",{waitUntil:"load"});
 await page.waitForFunction(()=>document.querySelectorAll("#link-one option").length>4,null,{timeout:7000}).catch(async err=>{
  const message=await page.locator("#form-message").innerText();
  throw new Error("Inflow selectors never loaded: "+message+"; page errors="+errors.join("|")+"; "+err.message);
 });
 assert.equal(await page.locator("#inflow-export").isDisabled(),true);
 await page.locator("#company-name").fill("独立研究测试新节点");
 await page.locator("#link-one").selectOption({index:1});
 await page.locator("#link-two").selectOption({index:2});
 await page.locator("#company-confirm").check();
 await page.locator("#inflow-run").click();
 await page.waitForFunction(()=>document.querySelectorAll("#inflow-metrics .metric").length===4,null,{timeout:6000}).catch(async err=>{
  const formMessage=await page.locator("#form-message").innerText();
  const counts=await page.evaluate(()=>({core:!!window.ZKInflow,sim:!!window.ZKSim,metrics:document.querySelectorAll("#inflow-metrics .metric").length,opts:[...document.querySelectorAll("#link-one,#link-two")].map(n=>n.value)}));
  throw new Error("Inflow UI result absent: "+formMessage+"; runtime="+JSON.stringify(counts)+"; errors="+errors.join("|")+"; "+err.message);
 });
 assert.equal(await page.locator("#count-a").innerText(),"24");
 assert.equal(await page.locator("#count-b").innerText(),"25");
 assert.equal(await page.locator("#inflow-network .assumed-edge").count(),2);
 assert.ok(await page.locator("#inflow-export").isEnabled());
 if(reduce){
  assert.equal(await page.locator("#inflow-tick").inputValue(),"20","Reduced-motion must not autoplay");
  assert.equal(await page.locator("#inflow-play").isDisabled(),true);
 }else{
  await page.waitForFunction(()=>Number(document.querySelector("#inflow-tick").value)>=1,null,{timeout:10000});
  await page.locator("#inflow-play").click();
 }
 await page.locator("#inflow-tick").fill("7");
 assert.equal(await page.locator("#tick-label").innerText(),"T 07 / 20");
 const lengths=await page.locator("#inflow-chart path[data-points]").evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.points)));
 assert.equal(lengths.length,4);
 assert.ok(lengths.every(n=>n===8),"Cannot render future snapshots prematurely: "+lengths);
 assert.ok(await page.locator("#inflow-uq .uq-row").count()===4);
 const shown=await page.evaluate(()=>{
  const m=[...document.querySelectorAll("#inflow-metrics strong[data-model-value]")];
  return m.map(x=>({str:x.textContent,value:Number(x.dataset.modelValue)}));
 });
 assert.equal(shown.length,4);
 assert.ok(shown.every(x=>Number.isFinite(x.value)));
 assert.equal(await page.locator("#inflow-network [data-subject='独立研究测试新节点']").count(),1);
 const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(bounds.scroll<=bounds.width+4,"Mobile horizontal overflow "+JSON.stringify(bounds));
 if(width===390&&!reduce){
  await page.screenshot({path:path.join(shots,"v313-inflow-390.png"),fullPage:true});
 }
 if(width===1440){
  await page.screenshot({path:path.join(shots,"v313-inflow-1440.png"),fullPage:true});
 }
 await page.locator("#company-name").fill("另一个未计算企业");
 assert.equal(await page.locator("#inflow-export").isDisabled(),true);
 assert.equal(await page.locator("#inflow-metrics .metric").count(),0);
 assert.equal(await page.locator("#inflow-network .assumed-edge").count(),0);
 assert.deepEqual(errors,[],"Browser page errors: "+errors.join("|"));
 await page.close();
}
(async()=>{
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 let browser;
 try{
  browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
  for(const width of [1440,390,360])await test(browser,server.address().port,width,false);
  await test(browser,server.address().port,390,true);
  console.log("PASS V3.13 Chrome 1440/390/360 inflow, real model A/B, assumption links, no-future time series, stale and reduced motion");
 }finally{if(browser)await browser.close();server.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
