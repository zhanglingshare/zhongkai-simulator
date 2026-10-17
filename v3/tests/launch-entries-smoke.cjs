/* Public project introduction: separated story/new vs historical classic paths.
   Real Chrome desktop+mobile; asserts old V3 experience remains usable. */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {chromium}=require("playwright"),root=path.resolve(__dirname,"../..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml"};
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const markdown=read("README.md"),page=read("index.html"),classic=read("v3/portal-classic.html"),story=read("v3/index.html");
assert.match(markdown,/在线体验入口（大众版与旧版分开）/);
assert.match(markdown,/v3\/index.html/);
assert.match(markdown,/v3\/portal-classic.html/);
assert.match(markdown,/v3\/lab.html/);
assert.match(markdown,/zhongkai_simulator.html/);
assert.match(page,/id="entry-story"[\s\S]*?href="v3\/index.html"|href="v3\/index.html" id="entry-story"/);
assert.match(page,/href="v3\/portal-classic.html" id="entry-classic"/);
assert.match(classic,/portal-classic.js/);
assert.match(story,/story-first.css/);
assert.ok(!classic.includes('story-first.css'),"Old page must not be replaced by new entry style");
assert.ok(!classic.includes('id="story-settings"'),"Old classic page must have visible original controls");
assert.ok(!story.includes('portal-classic.js'),"Story may not accidentally run vintage app");
const server=http.createServer((req,res)=>{
 let filename;try{filename=path.resolve(root,"."+decodeURI(new URL(req.url,"http://127.0.0.1").pathname));}
 catch{res.writeHead(400).end();return;}
 if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(filename,(err,data)=>{if(err){res.writeHead(404).end();return;}
 res.writeHead(200,{"content-type":types[path.extname(filename)]||"text/plain"});res.end(data);});
});
async function verify(browser,port,width){
 const endpoint="http://127.0.0.1:"+port+"/";
 const p=await browser.newPage({viewport:{width,height:width<600?812:900},reducedMotion:"reduce"});
 const errs=[];p.on("pageerror",e=>errs.push(e.message));
 await p.goto(endpoint,{waitUntil:"load"});
 assert.ok(await p.locator("#experience-entrances").isVisible());
 assert.equal(await p.locator("#entry-story").getAttribute("href"),"v3/index.html");
 assert.equal(await p.locator("#entry-classic").getAttribute("href"),"v3/portal-classic.html");
 assert.match(await p.locator("#entry-story").innerText(),/大众故事版/);
 assert.match(await p.locator("#entry-classic").innerText(),/经典全息版/);
 assert.ok(await p.locator('a[href="v3/lab.html"]').isVisible());
 const dims=await p.evaluate(()=>({vw:innerWidth,doc:document.documentElement.scrollWidth}));
 assert.ok(dims.doc<=dims.vw+4,"Root intro overflow: "+JSON.stringify(dims));
 if(width===390){const dir=path.join(root,"v3/screenshots");fs.mkdirSync(dir,{recursive:true});await p.screenshot({path:path.join(dir,"v321-launch-entries-390.png"),fullPage:false});}
 await p.locator("#entry-story").click();
 await p.waitForURL("**/v3/index.html");
 assert.match(await p.locator("#portal-title").innerText(),/假如一家大厂突然搬走/);
 assert.ok(await p.locator("#hero-quickstart").isVisible());
 await p.goto(endpoint,{waitUntil:"load"});
 await p.locator("#entry-classic").click();
 await p.waitForURL("**/v3/portal-classic.html");
 await p.waitForFunction(()=>document.getElementById("world-node-count")?.textContent==="41",null,{timeout:12000});
 assert.ok(await p.locator(".control-panel").isVisible(),"Original version controls should be visible by default");
 assert.ok(await p.locator("#metric-disaster").isVisible(),"Classic version keeps visible metrics");
 assert.equal(await p.locator("#story-settings").count(),0);
 await p.locator("#portal-shock").selectOption("技术突破");
 await p.locator("#portal-run").click();
 assert.equal(await p.locator("#timeline-slider").isEnabled(),true);
 await p.locator("#timeline-slider").fill("7");
 assert.equal(await p.locator("#timeline-output").innerText(),"T 07 / 20");
 assert.deepEqual(errs,[],"Entry navigation JS error "+errs.join(" | "));
 await p.close();
}
(async()=>{await new Promise(ok=>server.listen(0,"127.0.0.1",ok));let browser;
 try{browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
 for(const width of [1440,390,360])await verify(browser,server.address().port,width);
 console.log("PASS: public project intro exposes distinct working story / frozen classic V3 / expert links on 1440/390/360");
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});