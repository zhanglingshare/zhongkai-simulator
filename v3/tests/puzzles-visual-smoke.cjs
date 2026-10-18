'use strict';
/* Real Chromium screenshots: main visual, model-driven changes, and evidence gate.
   Checks mobile overflow and A/B values without fixing outcomes in page content. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),shots=path.join(root,'v3/screenshots');
fs.mkdirSync(shots,{recursive:true});
const types={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'text/javascript;charset=utf-8','.json':'application/json'};
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':types[path.extname(file)]||'text/plain'});res.end(data);});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port,browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:width===390?844:960},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+port+'/v3/puzzles.html',{waitUntil:'load'});
   await page.waitForFunction(()=>document.querySelector('#count-after').textContent==='41',{timeout:15000});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert.ok(overflow<=4,'no horizontal mobile overflow at '+width+'px: '+overflow);
   await page.locator('#scene-data').screenshot({path:path.join(shots,'puzzles-v2-signal-'+width+'.png')});
   await page.locator('#data-interpret').click();
   assert.match(await page.locator('#data-insight').innerText(),/投资|项目周期/);

   await page.locator('#run-exit').click();
   await page.locator('#sim-time').fill('7');
   await page.waitForFunction(()=>document.querySelector('#network-tick').textContent.includes('07'));
   const numbers=await page.evaluate(()=>{
     const s=new window.ZKSim(7,{n_agents:41,ticks:20});
     const name=document.querySelector('#target').value;
     const result=window.ZKHomeStory.exitRun(window.ZKSim,7,41,name,20);
     const frame=window.ZKHomeStory.frameInfo(result,7);
     return {alive:frame.b.alive,changed:frame.changes.length,before:frame.a.alive};
   });
   assert.equal(Number(await page.locator('#count-after').innerText()),numbers.alive,'B count from real model');
   assert.equal(Number(await page.locator('#count-changed').innerText()),numbers.changed,'changed roles from same-tick A/B');
   await page.locator('#scene-network').screenshot({path:path.join(shots,'puzzles-v2-hologram-'+width+'.png')});
   await page.locator('#compare-hold').focus();
   await page.keyboard.down('Space');
   assert.equal(Number(await page.locator('#count-after').innerText()),numbers.before,'hold must show baseline A same step');
   await page.keyboard.up('Space');
   assert.equal(Number(await page.locator('#count-after').innerText()),numbers.alive,'release must show changed B');
   assert.match(await page.locator('#lab-next').getAttribute('href'),/scenario=/);

   await page.locator('[data-evidence="0"]').click();
   await page.locator('[data-evidence="1"]').click();
   assert.equal(await page.locator('#gate-number').innerText(),'2/5');
   assert.match(await page.locator('#evidence-warning').innerText(),/不代表/);
   await page.locator('#scene-inflow').screenshot({path:path.join(shots,'puzzles-v2-gate-'+width+'.png')});
   assert.deepEqual(errors,[],'no JS page errors at '+width+'px');
   await page.close();
  }
  console.log('puzzles visual-first Chrome desktop/mobile + screenshots: PASS');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(err=>{console.error(err);process.exitCode=1;server.close();});
