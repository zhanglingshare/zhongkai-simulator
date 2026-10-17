const assert=require("node:assert/strict"),http=require("node:http"),fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"../.."),shots=path.join(root,"v3/screenshots");fs.mkdirSync(shots,{recursive:true});
const types={".html":"text/html;charset=utf-8",".css":"text/css;charset=utf-8",".js":"text/javascript;charset=utf-8",".json":"application/json"};
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,"."+new URL(req.url,"http://localhost").pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{"content-type":types[path.extname(file)]||"text/plain"});res.end(data);});
});
async function geometry(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+4),"No mobile overflow");}
async function open(browser,port,file,width,reduced=true,fallback=false){
 const page=await browser.newPage({viewport:{width,height:width<700?844:1000},reducedMotion:reduced?"reduce":"no-preference"});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 if(fallback)await page.addInitScript(()=>{const old=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==="webgl"?null:old.call(this,type,...args);};});
 await page.addInitScript(()=>{window.addEventListener("zk:home-frame",e=>window.__home=e.detail);Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async value=>{window.__copied=value;}}});});
 await page.goto(`http://127.0.0.1:${port}/v3/${file}`);return {page,errors};
}
async function home(browser,port,width,reduced=true,fallback=false){
 const {page,errors}=await open(browser,port,"index.html",width,reduced,fallback);
 await page.waitForFunction(()=>document.getElementById("world-node-count").textContent==="41");
 assert.equal(await page.locator('.site-nav a[href="story-lab.html"]').count(),1);
 assert.equal(await page.locator(".company-phrase").evaluate(n=>n.getClientRects().length),1);
 await page.waitForFunction(()=>document.getElementById("world-build-status").textContent.includes("组网完成"),null,{timeout:9000});
 assert.equal(await page.locator("#build-batches li").count(),6);
 assert.equal(await page.locator(".story-absence").isVisible(),false);
 if(fallback)assert.match(await page.locator("#render-mode").innerText(),/2.5D/);
 if(width===1440&&reduced)await page.screenshot({path:path.join(shots,"v323-home-1440.png")});
 await page.locator("#hero-quickstart").click();
 if(!reduced){
  assert.equal(await page.locator("#world-stage").getAttribute("data-phase"),"intro");
  assert.equal(await page.locator("#world-node-count").innerText(),"41");
  await page.waitForFunction(()=>window.__home.phase==="event");
  assert.equal(await page.locator("#timeline-slider").inputValue(),"0");
  const actual=await page.evaluate(()=>{
   const s=new window.ZKSim(7,{n_agents:41,ticks:20});
   return {incident:s.edges.filter(e=>e.a==="TCL华星"||e.b==="TCL华星").length,edges:s.edges.length};
  });
  assert.equal(await page.locator("#world-node-count").innerText(),"40");
  assert.equal(await page.locator("#world-edge-count").innerText(),String(actual.edges-actual.incident));
  await page.locator(".story-absence").waitFor({state:"visible"});
  assert.ok(await page.locator(".story-absence").isVisible());
  await page.locator("#world-stage").screenshot({path:path.join(shots,`v323-exit-${width}.png`)});
  await page.waitForFunction(()=>window.__home.phase==="key",null,{timeout:12000});
  const key=await page.locator("#timeline-slider").inputValue();
  await page.waitForTimeout(550);
  assert.equal(await page.locator("#timeline-slider").inputValue(),key,"Key frame waits for the user");
  await page.locator("#world-stage").screenshot({path:path.join(shots,`v323-key-${width}.png`)});
  await page.locator("#home-next").click();
  await page.waitForFunction(()=>window.__home.tick===20,null,{timeout:10000});
 }else assert.equal(await page.locator("#timeline-slider").inputValue(),"20");
 await page.locator("#timeline-slider").fill("9");
 const expected=await page.evaluate(()=>{
  const A=new window.ZKSim(7,{n_agents:41,ticks:20}),B=new window.ZKSim(7,{n_agents:41,ticks:20});B.removeAgent("TCL华星");
  for(let t=0;t<9;t++){A.step();B.step();}
  const alive=new Set(B.agents.filter(n=>n.alive).map(n=>n.name));
  return {a:A._snap(),b:B._snap(),alive:alive.size,links:B.edges.filter(e=>alive.has(e.a)&&alive.has(e.b)).length};
 });
 const shown=await page.evaluate(()=>window.__home);
 assert.deepEqual(shown.scenario,expected.b,"Scenario is the original named removal at this exact tick");
 assert.deepEqual(shown.baseline,expected.a,"Comparison uses the same-time untouched Sim");
 assert.equal(await page.locator("#world-node-count").innerText(),String(expected.alive));
 assert.equal(await page.locator("#world-edge-count").innerText(),String(expected.links));
 assert.match(await page.locator("#home-story-title").innerText(),/退出/);
 const cards=await page.locator(".role-story-person").allTextContents();
 assert.ok(cards.some(t=>t.includes("TCL华星")&&t.includes("退出")));
 await page.locator(".story-absence").waitFor({state:"visible"});
 assert.ok(await page.locator(".story-absence").isVisible());
 const marker=await page.locator(".story-absence").boundingBox();
 const area=await page.locator(".story-network-area").boundingBox();
 assert.ok(marker.x>=area.x&&marker.x+marker.width<=area.x+area.width,"Exit marker fits in view");
 const control=await page.locator("#home-peek").boundingBox(),stage=await page.locator("#world-stage").boundingBox();
 assert.ok(control.y+control.height<=stage.y+stage.height,"Comparison is inside the stage");
 await geometry(page);
 await page.locator("#world-stage").screenshot({path:path.join(shots,`v323-network-${width}${fallback?"-2d":""}.png`)});
 await page.locator("#home-peek").focus();await page.keyboard.down("Space");
 assert.equal(await page.locator("#home-peek").getAttribute("aria-pressed"),"true");
 assert.deepEqual(await page.evaluate(()=>window.__home.displayed),expected.a);
 await page.locator(".story-absence").waitFor({state:"hidden"});
 assert.equal(await page.locator(".story-absence").isVisible(),false);
 assert.equal(await page.locator("#timeline-slider").inputValue(),"9");
 await page.locator("#world-stage").screenshot({path:path.join(shots,`v323-before-${width}.png`)});
 await page.keyboard.up("Space");
 assert.deepEqual(await page.evaluate(()=>window.__home.displayed),expected.b);
 const hold=await page.locator("#home-peek").boundingBox();
 await page.mouse.move(hold.x+hold.width/2,hold.y+hold.height/2);await page.mouse.down();
 assert.deepEqual(await page.evaluate(()=>window.__home.displayed),expected.a);
 await page.mouse.up();assert.deepEqual(await page.evaluate(()=>window.__home.displayed),expected.b);
 await page.locator("#story-research summary").click();await page.locator("#share-scene").click();
 const shared=await page.evaluate(()=>window.__copied),payload=JSON.parse(decodeURIComponent(new URL(shared).searchParams.get("scenario")));
 assert.deepEqual(payload,{v:3,kind:"exit",target:"TCL华星",seed:7,pop:41,tick:9});
 if(width===1440&&reduced){
  await page.goto(shared);await page.waitForFunction(()=>window.__home.kind==="exit");
  assert.deepEqual(await page.evaluate(()=>window.__home.displayed),expected.b,"Share restores the original named experiment");
  const invalid=new URL(shared);invalid.searchParams.set("scenario",encodeURIComponent(JSON.stringify({...payload,target:"不存在的厂"})));
  await page.goto(invalid.toString());await page.waitForFunction(()=>window.__home.kind==="baseline");
  assert.equal(await page.locator("#timeline-slider").isDisabled(),true);
  const legacy=new URL(shared);legacy.searchParams.set("scenario",encodeURIComponent(JSON.stringify({v:2,seed:7,pop:41,tick:3,shock:"技术突破"})));
  await page.goto(legacy.toString());await page.waitForFunction(()=>window.__home.kind==="shock");
  assert.equal(await page.locator("#timeline-slider").inputValue(),"3");
 }
 await page.locator("#world-build-replay").click();
 assert.equal(await page.locator("#world-node-count").innerText(),"41");
 assert.equal(await page.locator("#home-peek").isDisabled(),true);
 await page.locator(".story-absence").waitFor({state:"hidden"});
 assert.equal(await page.locator(".story-absence").isVisible(),false);
 assert.deepEqual(errors,[]);await page.close();
}
async function lab(browser,port,width){
 const {page,errors}=await open(browser,port,"story-lab.html",width);
 await page.evaluate(()=>window.addEventListener("zk:comparison",e=>window.__ab=e.detail));
 assert.equal(await page.locator("#lab-play-time").isDisabled(),true);
 assert.deepEqual(await page.locator(".lab-play-number").allTextContents(),Array(6).fill("—"));
 await page.locator("#lab-story-start").click();
 assert.equal(await page.locator("#lab-play-time").isEnabled(),true);
 for(const t of [0,7,20,3]){
  await page.locator("#lab-play-time").fill(String(t));
  assert.equal(await page.locator("#compare-tick").inputValue(),String(t));
  assert.equal(await page.locator("#v39-time").inputValue(),String(t));
  assert.equal(await page.locator("#v39-chart").getAttribute("data-tick"),String(t));
  const rows=await page.evaluate(()=>[...document.querySelectorAll(".lab-play-group")].map(g=>{
   const key=g.dataset.metric,m=window.ZKImpact.compare(window.__ab.a,window.__ab.b).find(m=>m.key===key);
   return {actual:[...g.querySelectorAll(".lab-play-fill")].map(b=>Number(b.dataset.value)),expected:[m.a,m.b]};
  }));
  for(const row of rows)assert.deepEqual(row.actual,row.expected,"Bar endpoints must equal original Sim A[t]/B[t] exactly");
 }
 await page.locator("#lab-play-final").click();assert.equal(await page.locator("#compare-tick").inputValue(),"20");
 await page.locator('[data-play-shock="技术突破"]').click();
 assert.equal(await page.locator("#lab-b-name").innerText(),"技术突破");
 assert.equal(await page.locator("#lab-all-shocks").inputValue(),"技术突破");
 await page.locator("#v39-time").fill("7");assert.equal(await page.locator("#lab-play-time").inputValue(),"7");
 await geometry(page);
 await page.locator("#lab-preview").screenshot({path:path.join(shots,`v322-lab-${width}.png`)});
 await page.locator("#lab-seed").fill("29");
 assert.equal(await page.locator("#lab-play-time").isDisabled(),true);
 assert.equal(await page.locator("#lab-play-stage").getAttribute("data-state"),"stale");
 assert.deepEqual(await page.locator(".lab-play-number").allTextContents(),Array(6).fill("—"));
 assert.deepEqual(errors,[]);await page.close();
}
(async()=>{
 await new Promise(r=>server.listen(0,"127.0.0.1",r));let browser;
 try{browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
  for(const width of [1440,390,360]){await home(browser,server.address().port,width);await lab(browser,server.address().port,width);}
  await home(browser,server.address().port,390,false);
  await home(browser,server.address().port,1440,false);
  await home(browser,server.address().port,390,true,true);
  console.log("PASS V3.23 Chrome 1440/390/360: real named exit, active links, paused key frame, keyboard/pointer same-time comparison, share, reset, WebGL+2D; second-page bars unchanged");
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
