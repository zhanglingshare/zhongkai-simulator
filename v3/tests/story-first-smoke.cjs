/* V3.21 story-first UX acceptance: actual one-click Sim, no made-up result,
 * progressive disclosure, reduced-motion path and existing research retained. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {chromium}=require("playwright"),root=path.resolve(__dirname,"../..");
const mime={".html":"text/html;charset=utf-8",".js":"text/javascript;charset=utf-8",".css":"text/css;charset=utf-8",".json":"application/json;charset=utf-8"};
const server=http.createServer((req,res)=>{
 let file;try{file=path.resolve(root,"."+decodeURI(new URL(req.url,"http://localhost").pathname));}
 catch{res.writeHead(400).end();return;}
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}
 res.writeHead(200,{"content-type":mime[path.extname(file)]||"text/plain"});res.end(data);});
});
async function screen(page,name){
 const dir=path.join(root,"v3/screenshots");fs.mkdirSync(dir,{recursive:true});
 await page.screenshot({path:path.join(dir,name),fullPage:false});
}
async function dimensions(page,width){
 const x=await page.evaluate(()=>({vw:innerWidth,scroll:document.documentElement.scrollWidth,
  stage:document.querySelector("#world-stage")?.getBoundingClientRect().top}));
 assert.ok(x.scroll<=x.vw+4,"No horizontal overflow "+JSON.stringify(x));
 assert.equal(x.vw,width);
}
async function visit(browser,port,width,reduced){
 const page=await browser.newPage({viewport:{width,height:width<700?812:900},reducedMotion:reduced?"reduce":"no-preference"});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:"+port+"/v3/index.html",{waitUntil:"load"});
 await page.waitForFunction(()=>document.querySelector("#world-node-count")?.textContent==="41",null,{timeout:12000});
 assert.match(await page.locator("#portal-title").innerText(),/假如一家大厂突然搬走/);
 assert.ok(await page.locator("#hero-quickstart").isVisible());
 assert.equal(await page.locator("#story-settings").evaluate(x=>x.open),false);
 assert.equal(await page.locator("#story-research").evaluate(x=>x.open),false);
 assert.equal(await page.locator("#portal-population").isVisible(),false);
 assert.equal(await page.locator("#metric-disaster").isVisible(),false);
 const pos=await page.evaluate(()=>({
  story:document.querySelector(".hero-story").getBoundingClientRect().top,
  stage:document.querySelector("#world-stage").getBoundingClientRect().top,
  opt:document.querySelector("#story-settings").getBoundingClientRect().top
 }));
 assert.ok(pos.story<pos.stage&&pos.stage<pos.opt,"One story -> full network -> optional research "+JSON.stringify(pos));
 assert.match(await page.locator("#portal-story-result").innerText(),/点上面的播放按钮/);
 assert.equal(await page.locator("#timeline-slider").isDisabled(),true);
 if(width===390&&reduced)await screen(page,"story-first-initial-390.png");
 await page.locator("#hero-quickstart").click();
 assert.equal(await page.locator("#timeline-slider").isEnabled(),true);
 if(reduced){
  assert.equal(await page.locator("#timeline-slider").inputValue(),"20","Reduced motion must show completed model snapshots after one click");
  assert.match(await page.locator("#story-phase").innerText(),/播完/);
 }else{
  await page.waitForFunction(()=>Number(document.querySelector("#timeline-slider").value)>=2,null,{timeout:7000});
  await page.locator("#timeline-play").click(); // pause to prevent nondeterministic step racing
 }
 let t=Number(await page.locator("#timeline-slider").inputValue());
 assert.ok(t>=1&&t<=20);
 const expected=await page.evaluate((tick)=>{
  const a=new window.ZKSim(7,{n_agents:41,ticks:20}),b=new window.ZKSim(7,{n_agents:41,ticks:20});
  b.shock("链主外迁");
  for(let j=0;j<tick;j++){a.step();b.step();}
  return window.ZKStoryInsight.narrate(a._snap(),b._snap(),tick,"链主外迁");
 },t);
 assert.equal(await page.locator("#portal-story-result").innerText(),expected.title);
 assert.equal(await page.locator("#story-explanation").innerText(),expected.description);
 assert.deepEqual(await page.locator("#story-people .story-person").evaluateAll(xs=>xs.map(x=>x.dataset.name)),
  expected.items.map(x=>x.name),"Story cards must match the actual model snapshots");
 assert.ok((await page.locator("#story-people .story-person").count())<=3);
 assert.match(await page.locator(".story-result").innerText(),/不能证明因果关系/);
 if(expected.items.length){
   await page.locator("#story-people .story-person").first().click();
   assert.equal(await page.locator("#subject-name").textContent(),expected.items[0].name);
 }
 assert.equal(await page.locator("#world-node-count").innerText(),"41");
 await page.locator("#story-settings summary").click();
 assert.equal(await page.locator("#portal-population").isVisible(),true);
 await page.locator("#portal-population").selectOption("24");
 assert.equal(await page.locator("#world-node-count").innerText(),"24");
 assert.match(await page.locator("#portal-story-result").innerText(),/点上面的播放按钮/);
 await page.locator("#portal-shock").selectOption("技术突破");
 await page.locator("#portal-run").click();
 assert.equal(await page.locator("#timeline-slider").isEnabled(),true);
 await page.locator("#story-research summary").click();
 assert.ok(await page.locator("#metric-disaster").isVisible());
 const v=Number(await page.locator("#metric-disaster").innerText());
 assert.ok(Number.isFinite(v)&&v>=0&&v<=1);
 await dimensions(page,width);
 if(width===390&&reduced)await screen(page,"story-first-research-390.png");
 assert.deepEqual(errors,[],"Hologram runtime "+errors.join(" | "));
 await page.close();
}
async function lab(browser,port,width){
 const page=await browser.newPage({viewport:{width,height:width<700?812:900},reducedMotion:"reduce"});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:"+port+"/v3/lab.html");
 await page.waitForFunction(()=>document.querySelectorAll("#lab-all-shocks option").length===14);
 assert.ok(await page.locator("#lab-story-start").isVisible());
 assert.equal(await page.locator("#lab-preview .lab-quick-row").count(),0);
 await page.locator("#lab-story-start").click();
 await page.waitForFunction(()=>document.querySelectorAll("#lab-preview .lab-quick-row").length===5,null,{timeout:12000});
 assert.equal(await page.locator("#lab-b-name").innerText(),"链主外迁");
 assert.match(await page.locator("#lab-plain-result").innerText(),/模型对照|几乎没有变化/);
 assert.match(await page.locator("#lab-plain-result").innerText(),/不是现实的经济损失/);
 assert.ok(await page.locator("#v39-time").isEnabled());
 assert.deepEqual(errors,[],"Lab runtime "+errors.join(" | "));
 const x=await page.evaluate(()=>({vw:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(x.scroll<=x.vw+4,"Lab overflow "+JSON.stringify(x));
 if(width===390)await screen(page,"story-first-lab-390.png");
 await page.close();
}
(async()=>{
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));let browser;
 try{browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
 for(const width of [1440,390,360]){await visit(browser,server.address().port,width,true);await lab(browser,server.address().port,width);}
 await visit(browser,server.address().port,390,false);
 console.log("PASS story-first 1440/390/360: one-click real Sim and A/B, no made-up figures, reduced motion, preserved expert controls");
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});