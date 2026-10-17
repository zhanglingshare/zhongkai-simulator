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
 await page.goto(`http://127.0.0.1:${port}/v3/${file}`);return {page,errors};
}
async function home(browser,port,width,reduced=true,fallback=false){
 const {page,errors}=await open(browser,port,"index.html",width,reduced,fallback);
 await page.waitForFunction(()=>document.getElementById("world-node-count").textContent==="41");
 await page.waitForFunction(()=>document.getElementById("world-build-status").textContent.includes("组网完成"),null,{timeout:9000});
 const count=await page.evaluate(()=>{const s=new window.ZKSim(7,{n_agents:41,ticks:20});return {nodes:s.agents.length,edges:s.edges.length};});
 assert.match(await page.locator("#world-build-status").innerText(),new RegExp(count.nodes+" 个模型主体 / "+count.edges+" 条模型连线"));
 assert.equal(await page.locator("#build-batches li").count(),6);
 if(fallback)assert.match(await page.locator("#render-mode").innerText(),/2.5D/);
 await page.locator("#hero-quickstart").click();
 if(!reduced)await page.locator("#timeline-slider").fill("20");
 await page.locator("#timeline-slider").fill("9");
 const expected=await page.evaluate(()=>{
  const A=new window.ZKSim(7,{n_agents:41,ticks:20}),B=new window.ZKSim(7,{n_agents:41,ticks:20});B.shock("链主外迁");
  for(let t=0;t<9;t++){A.step();B.step();}
  const prior=new Map(A.agents.map(a=>[a.name,a]));
  return {roles:window.ZKRoleStory.compare(A._snap(),B._snap(),3).map(c=>c.name),
   exits:B.agents.filter(n=>prior.get(n.name)?.alive&&!n.alive).length,
   weaker:B.agents.filter(n=>prior.get(n.name)?.alive&&n.alive&&n.energy<prior.get(n.name).energy-.005).length};
 });
 const cards=await page.locator(".role-story-person").allTextContents();
 for(const name of expected.roles)assert.ok(cards.some(text=>text.includes(name)),"Cards must name actual A/B changes");
 const banner=await page.locator("#world-variation").innerText();
 assert.ok(banner.includes(expected.exits+" 个角色退出"));assert.ok(banner.includes(expected.weaker+" 个角色状态更弱"));
 if(expected.roles.length){await page.locator(".role-story-person").first().click();await page.waitForTimeout(150);assert.ok(await page.locator(".holo-node-label.story-focus").count()>0);}
 await geometry(page);
 await page.locator("#world-stage").screenshot({path:path.join(shots,`v322-network-${width}${fallback?"-2d":""}.png`)});
 if(width===1440){await page.locator("#world-build-replay").click();await page.screenshot({path:path.join(shots,"v322-home-1440.png")});}
 if(!reduced){
  await page.locator("#world-build-replay").click();await page.waitForTimeout(600);
  assert.match(await page.locator("#world-build-status").innerText(),/正在接入/);
  await page.locator("#hero-quickstart").click();
  assert.match(await page.locator("#world-build-status").innerText(),/组网完成/);
 }
 assert.deepEqual(errors,[]);await page.close();
}
async function lab(browser,port,width){
 const {page,errors}=await open(browser,port,"lab.html",width);
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
  await home(browser,server.address().port,390,true,true);
  console.log("PASS V3.22 Chrome 1440/390/360: grouped entry, same-tick names/banner, WebGL+2D, live bars, timeline sync, invalidation");
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
