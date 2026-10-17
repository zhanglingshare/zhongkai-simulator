'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),shots=path.join(root,'v3/screenshots');fs.mkdirSync(shots,{recursive:true});
const types={'.html':'text/html;charset=utf-8','.js':'application/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json;charset=utf-8'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,d)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':types[path.extname(file)]||'text/plain'});res.end(d);});});
async function open(browser,port,width,file='story-lab.html',fallback=false){const page=await browser.newPage({viewport:{width,height:width<700?844:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.addEventListener('zk:story-frame',e=>window.__frame=e.detail);window.addEventListener('zk:story-repeat',e=>window.__repeat=e.detail);window.addEventListener('zk:story-evidence',e=>window.__evidence=e.detail);window.addEventListener('zk:home-frame',e=>window.__home=e.detail);Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async s=>window.__copied=s}});});
 if(fallback)await page.addInitScript(()=>{const old=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:old.call(this,type,...args);};});
 await page.goto(`http://127.0.0.1:${port}/v3/${file}`);return {page,errors};}
async function geometry(p){const d=await p.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(d.scroll<=d.w+3,'No horizontal overflow '+JSON.stringify(d));}
async function shot(p,name){await p.screenshot({path:path.join(shots,name),fullPage:false});}
async function lab(browser,port,width,fallback=false){const {page:p,errors}=await open(browser,port,width,'index.html',fallback);
 await p.waitForFunction(()=>window.__home?.displayed.agents.length===41);await p.locator('#hero-quickstart').click();await p.locator('#timeline-slider').fill('6');
 const original=await p.evaluate(()=>window.__home);
 const link=p.locator('.site-nav a[href^="story-lab.html"]');assert.equal(await link.count(),1);await link.click();await p.waitForURL('**/v3/story-lab.html?**');
 assert.match(await p.locator('#story-continuity').innerText(),/41 个角色/);assert.match(await p.locator('#story-continuity').innerText(),/第 6 步/);
 assert.equal(await p.locator('#story-reveal').isDisabled(),true);assert.equal(await p.locator('#story-time').isDisabled(),true);assert.equal(await p.locator('#story-alive').innerText(),'—');
 await p.locator('[data-guess="less"]').click();await p.locator('#story-reveal').click();await p.waitForFunction(()=>window.__frame?.tick===6);
 const f=await p.evaluate(()=>window.__frame);assert.deepEqual(f.a,original.baseline);assert.deepEqual(f.b,original.scenario);assert.deepEqual(f.edges,original.edges);assert.equal(f.settings.pop,41);
 const out=await p.evaluate(()=>window.ZKStoryLab.outcome(window.ZKStoryLab.run(window.ZKSim,{...window.__frame.settings,tick:20})));
 assert.match(await p.locator('#guess-result').innerText(),new RegExp('未改变 '+out.a+' 个，改变后 '+out.b+' 个'));assert.match(await p.locator('#stage-prediction').innerText(),/最后一步/);
 for(const t of [0,9,20,6]){await p.locator('#story-time').fill(String(t));const truth=await p.evaluate(()=>{const r=window.ZKStoryLab.run(window.ZKSim,window.__frame.settings);return {a:r.A[window.__frame.tick],b:r.B[window.__frame.tick],info:window.ZKHomeStory.frameInfo(r,window.__frame.tick)};});
  assert.deepEqual(await p.evaluate(()=>window.__frame.a),truth.a);assert.deepEqual(await p.evaluate(()=>window.__frame.b),truth.b);assert.equal(await p.locator('#story-alive').innerText(),String(truth.info.b.alive));assert.equal(await p.locator('#story-links').innerText(),String(truth.info.b.links));}
 await p.locator('#story-stage').scrollIntoViewIfNeeded();await p.locator('.story-absence').waitFor({state:'visible'});await p.locator('#story-stage').screenshot({path:path.join(shots,`v324-lab-${width}${fallback?'-2d':''}.png`)});
 const camera=await p.evaluate(()=>window.__frame.camera);await p.locator('#story-hold').focus();await p.keyboard.down('Space');
 assert.equal(await p.locator('#story-hold').getAttribute('aria-pressed'),'true');assert.deepEqual(await p.evaluate(()=>window.__frame.displayed),original.baseline);assert.deepEqual(await p.evaluate(()=>window.__frame.camera),camera);await p.locator('.story-absence').waitFor({state:'hidden'});
 await p.locator('#story-stage').screenshot({path:path.join(shots,`v324-before-${width}.png`)});await p.keyboard.up('Space');assert.deepEqual(await p.evaluate(()=>window.__frame.displayed),original.scenario);
 const h=await p.locator('#story-hold').boundingBox();await p.mouse.move(h.x+h.width/2,h.y+h.height/2);await p.mouse.down();assert.equal(await p.evaluate(()=>window.__frame.peek),true);await p.mouse.up();assert.equal(await p.evaluate(()=>window.__frame.peek),false);
 await p.locator('#metric-details summary').click();assert.equal(await p.locator('#metric-a').innerText(),original.baseline.state.disaster.toFixed(3));await p.locator('[data-metric="abundance"]').click();assert.equal(await p.locator('#metric-b').innerText(),original.scenario.state.abundance.toFixed(3));
 await p.locator('#story-repeat').click();await p.waitForFunction(()=>window.__repeat?.values.length===24);
 const repeat=await p.evaluate(()=>window.__repeat),truth=await p.evaluate(()=>Array.from({length:24},(_,i)=>{const s={...window.__frame.settings,seed:window.ZKStoryLab.seedAt(window.__frame.settings.seed,i)};return window.ZKStoryLab.outcome(window.ZKStoryLab.run(window.ZKSim,s)).delta;}));
 assert.deepEqual(repeat.values,truth);assert.equal(repeat.summary.less+repeat.summary.same+repeat.summary.more,24);assert.equal(await p.locator('#repeat-chart circle').count(),24);await p.locator('#repeat-chart circle').first().focus();assert.match(await p.locator('#repeat-range').innerText(),/第 1 组/);
 if(width===390)await p.locator('.repeat-section').screenshot({path:path.join(shots,'v324-repeat-390.png')});
 await p.locator('#story-share').click();const shared=await p.evaluate(()=>window.__copied);const payload=JSON.parse(decodeURIComponent(new URL(shared).searchParams.get('scenario')));assert.deepEqual(payload,{v:3,kind:'exit',target:'TCL华星',seed:7,pop:41,tick:6});
 await p.locator('#story-target').selectOption({index:1});assert.equal(await p.locator('#story-time').isDisabled(),true);assert.equal(await p.locator('#story-alive').innerText(),'—');assert.equal(await p.locator('#repeat-results').isVisible(),false);assert.equal(await p.locator('#story-reveal').isDisabled(),true);
 await p.locator('[data-scenario="技术突破"]').click();await p.locator('[data-guess="same"]').click();await p.locator('#story-reveal').click();assert.equal(await p.evaluate(()=>window.__frame.settings.kind),'shock');assert.equal(await p.evaluate(()=>window.__frame.settings.shock),'技术突破');
 await geometry(p);assert.deepEqual(errors,[]);await p.close();}
async function links(browser,port){const {page:p,errors}=await open(browser,port,390,'story-lab.html');
 assert.match(await p.locator('#story-continuity').innerText(),/41 个模型角色/);
 await p.locator('[data-guess="same"]').click();await p.locator('#story-reveal').click();assert.equal(await p.evaluate(()=>window.__frame.settings.pop),41);
 const url=new URL(p.url());url.searchParams.set('scenario',encodeURIComponent(JSON.stringify({v:1,seed:29,shock:'技术突破'})));await p.goto(url.toString());assert.equal(await p.locator('#story-size').inputValue(),'24');assert.equal(await p.locator('#story-seed').inputValue(),'29');
 url.searchParams.set('scenario',encodeURIComponent(JSON.stringify({v:3,kind:'exit',target:'不存在',seed:7,pop:41,tick:6})));await p.goto(url.toString());assert.match(await p.locator('#story-notice').innerText(),/无效/);assert.equal(await p.locator('#story-time').isDisabled(),true);
 // Interrupted repetition is invalidated, never attached to a different input.
 await p.locator('[data-guess="less"]').click();await p.locator('#story-reveal').click();await p.locator('#story-repeat').click();await p.locator('[data-scenario="供应链中断"]').click();assert.equal(await p.locator('#repeat-results').isVisible(),false);assert.equal(await p.locator('#story-alive').innerText(),'—');
 assert.deepEqual(errors,[]);await p.close();}
async function evidence(browser,port,width){const {page:p,errors}=await open(browser,port,width,'story-evidence.html');await p.waitForFunction(()=>!document.getElementById('evidence-metric').disabled);
 const ledger=JSON.parse(fs.readFileSync(path.join(root,'v3/observations/annual-2019-2025.json'),'utf8'));await p.locator('#evidence-metric').selectOption('gdp_current');await p.locator('#evidence-year').selectOption('2024');
 const expected=ledger.observations.find(r=>r.metric==='gdp_current'&&r.year===2024);assert.deepEqual(await p.evaluate(()=>window.__evidence.row),expected);for(const id of expected.source_ids)assert.ok((await p.locator('#evidence-source a').allTextContents()).some(t=>t.includes(ledger.sources[id].title)));
 await p.locator('#evidence-metric').selectOption('budget_current');await p.locator('#evidence-chart [data-year="2019"]').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#evidence-year').inputValue(),'2019');
 await p.locator('#panel-facts').screenshot({path:path.join(shots,`v324-evidence-${width}.png`)});
 await p.locator('#tab-claims').click();const pilots=JSON.parse(fs.readFileSync(path.join(root,'v3/data/pilot-cases-v321.json'),'utf8'));const first=pilots.cases[0];assert.match(await p.locator('#claim-support').innerText(),new RegExp(first.source[0].support.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.ok((await p.locator('#claim-excludes').innerText()).includes(first.source[0].excludes));
 await p.locator('#panel-claims').screenshot({path:path.join(shots,`v324-claims-${width}.png`)});await p.locator('#tab-claims').focus();await p.keyboard.press('ArrowRight');assert.equal(await p.locator('#panel-method').isVisible(),true);assert.match(await p.locator('#evidence-method-status').innerText(),/不是独立留出集/);assert.match(await p.locator('#evidence-date').innerText(),/归档/);
 await geometry(p);assert.deepEqual(errors,[]);await p.close();
 // A failed ledger fetch must not leave a plausible fabricated chart.
 if(width===390){const q=await browser.newPage();await q.route('**/annual-2019-2025.json',r=>r.fulfill({status:503,body:'unavailable'}));await q.goto(`http://127.0.0.1:${port}/v3/story-evidence.html`);await q.locator('#evidence-error').waitFor({state:'visible'});assert.equal(await q.locator('#evidence-metric').isDisabled(),true);assert.equal(await q.locator('#evidence-chart circle').count(),0);await q.close();}}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});const port=server.address().port;
 for(const w of [1440,390,360]){await lab(browser,port,w);await evidence(browser,port,w);}await lab(browser,port,390,true);await links(browser,port);
 console.log('PASS story journey Chrome: homepage handoff, guess/reveal, exact snapshots, pointer/keyboard hold, role focus, 24 same-condition seeds, invalidation, legacy shares, sourced evidence and mobile geometry');
 }finally{if(browser)await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
