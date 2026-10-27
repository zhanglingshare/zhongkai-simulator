/* Family cross-page Playwright acceptance, desktop and mobile.
 Run from repo root with a local server on :8765. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
const OUT=path.resolve(__dirname,'shots');
fs.mkdirSync(OUT,{recursive:true});
const base='http://127.0.0.1:8765/';
const issue=[];
async function run(viewport,tag){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport,deviceScaleFactor:viewport.width<=500?2:1,storageState:{cookies:[],origins:[]}});
  page.on('pageerror',e=>issue.push(tag+' JS: '+e.message));
  page.on('console',m=>{if(m.type()==='error')console.log(tag+' console warning: '+m.text())});
  await page.goto(base+'family/index.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.getElementById('world-data-status').textContent.includes('41个模型主体'),{timeout:12000});
  assert.equal(await page.locator('#orbits .orbnode').count(),41);
  assert.equal(await page.locator('#orbits line').count(),71);
  await page.screenshot({path:path.join(OUT,tag+'-hub.png'),fullPage:false});

  const chosen=await page.evaluate(()=>{
   const g=[...document.querySelectorAll('#orbits .orbnode')].find(x=>x.getAttribute('aria-label')==='查看TCL华星');
   if(!g)throw Error('missing TCL华星 in source graph');g.dispatchEvent(new MouseEvent('click',{bubbles:true}));
   return new URL(document.getElementById('enter-world').href).searchParams.get('zkctx');
  });
  assert.ok(chosen,'node selection should create handoff input');
  await page.locator('#enter-world').click();
  await page.waitForURL(/v3\/index\.html/);
  await page.waitForFunction(()=>window.ZKFamily?.parseSearch(location.search)?.entity==='TCL华星',{timeout:14000});
  await page.waitForFunction(()=>document.getElementById('subject-name')?.textContent==='TCL华星',{timeout:14000});
  assert.ok(await page.locator('#zk-family-nav').count());
  await page.screenshot({path:path.join(OUT,tag+'-see.png'),fullPage:false});

  await page.locator('#zk-family-nav a[data-dest="test"]').click();
  await page.waitForURL(/story-lab\.html/);
  await page.waitForFunction(()=>document.getElementById('story-target')?.options.length>0,{timeout:14000});
  assert.equal(await page.locator('#story-target').inputValue(),'TCL华星');
  assert.equal(await page.locator('#story-seed').inputValue(),'7');
  await page.screenshot({path:path.join(OUT,tag+'-test.png'),fullPage:false});

  await page.locator('#zk-family-nav a[data-dest="research"]').click();
  await page.waitForURL(/v3\/lab\.html/);
  assert.ok(await page.locator('#zk-family-nav').count());
  await page.screenshot({path:path.join(OUT,tag+'-research.png'),fullPage:false});

  await page.locator('#zk-family-nav a[data-dest="lilin"]').click();
  await page.waitForURL(/lilin\/index\.html/);
  assert.ok(await page.locator('#zk-family-nav').count());
  await page.locator('[data-v="teacher"]').click();
  const s4=page.locator('#scn button[data-i="S4"]');
  assert.equal(await s4.count(),1);
  assert.ok(!(await s4.getAttribute('class')||'').includes('lock'));
  page.on('dialog',async d=>{issue.push(tag+' Unexpected dialog: '+d.message());await d.dismiss();});
  await s4.click();
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('lins')||'{}'));
  assert.equal(state.w,'bal');assert.equal(state.r,'mid');assert.equal(state.c,'0.30');
  await page.screenshot({path:path.join(OUT,tag+'-lilin-s4-unlocked.png'),fullPage:false});

  await page.locator('#zk-family-nav a[data-dest="see"]').click();
  await page.waitForURL(/v3\/index\.html/);
  const inbound=await page.evaluate(()=>window.ZKFamily?.parseSearch(location.search));
  assert.equal(inbound.kind,'town');assert.equal(inbound.town,'沥林');
  assert.ok(!location.pathname.includes('lilin'),'should return to regional view');
  await page.screenshot({path:path.join(OUT,tag+'-return-region.png'),fullPage:false});
  console.log(tag+' ALL routes verified');
 }finally{await browser.close();}
}
(async()=>{
 await run({width:1440,height:900},'desktop');
 await run({width:390,height:844},'mobile');
 console.log('Browser acceptance issues',issue);
 assert.equal(issue.length,0,'All pages must run without uncaught JS errors / password prompts');
})().catch(e=>{console.error('family browser acceptance failed',e);process.exitCode=1;});
