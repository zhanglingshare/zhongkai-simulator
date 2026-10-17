/* Real browser acceptance for audience comprehension: named model difference
 * must equal same-tick computed A/B; cards, focus, graph and copy stay in sync. */
"use strict";
const assert=require("node:assert/strict"),http=require("node:http"),fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright"),root=path.resolve(__dirname,"../..");
const type={".html":"text/html;charset=utf-8",".css":"text/css;charset=utf-8",
 ".js":"application/javascript;charset=utf-8",".json":"application/json;charset=utf-8"};
const server=http.createServer((req,res)=>{
 let file;try{file=path.resolve(root,"."+decodeURI(new URL(req.url,"http://localhost").pathname));}
 catch{res.writeHead(400).end();return;}
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}
 res.writeHead(200,{"content-type":type[path.extname(file)]||"text/plain"});res.end(data);});
});
async function check(browser,port,width){
 const page=await browser.newPage({viewport:{width,height:width<600?812:900},reducedMotion:"reduce"});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:"+port+"/v3/index.html");
 await page.waitForFunction(()=>document.getElementById("world-node-count")?.textContent==="41",null,{timeout:10000});
 assert.equal(await page.locator("#story-people .story-person").count(),0);
 assert.match(await page.locator("#story-people").innerText(),/开始播放/);
 assert.equal(await page.locator("#story-spotlight").isVisible(),false);
 await page.locator("#hero-quickstart").click();
 assert.equal(await page.locator("#timeline-slider").inputValue(),"20");
 for(const tick of [0,4,9,15,20]){
  await page.locator("#timeline-slider").fill(String(tick));
  // Independent replay of the same untouched Sim engine and seed: verify facts are
  // source snapshots, not fabricated hardcoded company lists or CSS only.
  const expected=await page.evaluate((t)=>{
   const a=new window.ZKSim(7,{n_agents:41,ticks:20});
   const b=new window.ZKSim(7,{n_agents:41,ticks:20});
   b.shock("链主外迁");
   for(let i=0;i<t;i++){a.step();b.step();}
   return window.ZKStoryEvidence.compare(a._snap(),b._snap(),a.edges,3).items
    .map(x=>({name:x.name,kind:x.kind,energyB:x.energyB}));
  },tick);
  const shown=await page.locator("#story-people .story-person").evaluateAll(nodes=>
   nodes.map(n=>({name:n.dataset.actor,kind:n.dataset.kind})));
  assert.deepEqual(shown,expected.map(({name,kind})=>({name,kind})),
   "Named story actors must be precisely the computed A/B findings at t="+tick);
  assert.equal(await page.locator("#world-stage").getAttribute("data-story-tick"),String(tick));
  assert.equal(await page.locator("#world-stage").getAttribute("data-highlighted-actors"),
   expected.map(x=>x.name).join("|"));
  const summary=await page.locator("#portal-story-result").innerText();
  assert.match(summary,new RegExp("模拟第 "+tick+" 步"));
  assert.match(summary,/这不是现实企业受损名单/);
  if(expected.length){
   assert.equal(await page.locator("#story-spotlight").isVisible(),true);
   assert.equal(await page.locator("#story-spotlight-name").innerText(),expected[0].name);
   assert.ok(summary.includes(expected[0].name));
   const tags=await page.locator("#holo-labels .story-highlight").count();
   assert.ok(tags<=3,"Never clutter hologram with >3 highlighted names");
   await page.locator("#story-people .story-person").first().click();
   assert.equal(await page.locator("#subject-name").innerText(),expected[0].name,
    "Click model actor in story must move original hologram focus");
  }else{
   assert.equal(await page.locator("#story-spotlight").isVisible(),false);
   assert.match(summary,/没有发现明显不同/);
  }
 }
 await page.locator("#story-settings summary").click();
 await page.locator("#portal-population").selectOption("24");
 assert.equal(await page.locator("#story-spotlight").isVisible(),false);
 assert.equal(await page.locator("#story-people .story-person").count(),0,
  "Old actor names must disappear when assumptions change");
 assert.equal(await page.locator("#world-stage").getAttribute("data-highlighted-actors"),"");
 await page.locator("#portal-shock").selectOption("技术突破");
 await page.locator("#portal-run").click();
 await page.locator("#timeline-slider").fill("12");
 assert.match(await page.locator("#portal-story-result").innerText(),/模拟第 12 步/);
 const dims=await page.evaluate(()=>({vw:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(dims.scroll<=dims.vw+4,JSON.stringify(dims));
 if(width===390){
  const dir=path.join(root,"v3/screenshots");fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,"story-evidence-390.png"),fullPage:false});
 }
 assert.deepEqual(errors,[],"Browser runtime error(s) "+errors.join(" | "));
 await page.close();
}
(async()=>{
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));let browser;
 try{browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
 for(const width of [1440,390,360])await check(browser,server.address().port,width);
 console.log("PASS named who-changed storyboard and persistent network highlights match untouched actual Sim A/B at ticks 0/4/9/15/20 in 1440/390/360");
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
