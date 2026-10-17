/* V3.15 Chrome: Chinese-first search handoff, real sourced Zhongkai case, no hidden network scraping. */
const assert=require("node:assert/strict"),fs=require("node:fs"),http=require("node:http"),path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"../..");
const types={".html":"text/html;charset=utf-8",".js":"application/javascript;charset=utf-8",".css":"text/css;charset=utf-8"};
const server=http.createServer((req,res)=>{
 let file;try{file=path.resolve(root,"."+decodeURI(new URL(req.url,"http://localhost").pathname));}catch{res.writeHead(400).end();return;}
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{"Content-Type":types[path.extname(file)]||"text/plain"});res.end(b);});
});
async function test(browser,port,width){
 const page=await browser.newPage({viewport:{width,height:890},reducedMotion:"reduce"});
 const errors=[],foreign=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",r=>{if(!r.url().startsWith("http://127.0.0.1:"))foreign.push(r.url());});
 await page.goto("http://127.0.0.1:"+port+"/v3/inflow.html");
 await page.waitForFunction(()=>document.querySelectorAll("#company-links .suggestion").length>0,null,{timeout:12000});
 assert.equal(await page.locator("#load-zhongkai-case").count(),1);
 await page.locator("#load-zhongkai-case").click();
 assert.equal(await page.locator("#company-name").inputValue(),"惠州市博实结科技有限公司");
 assert.match(await page.locator("#company-business").inputValue(),/物联网/);
 assert.match(await page.locator("#company-location").inputValue(),/仲恺高新区/);
 assert.match(await page.locator("#source").inputValue(),/gxj\.huizhou\.gov\.cn/);
 assert.equal(await page.locator("#company-type").inputValue(),"oem");
 assert.equal(await page.locator("#evidence").inputValue(),"unverified");
 assert.ok((await page.locator("#company-search-status").innerText()).includes("已载入"));
 assert.equal(await page.locator("#link-one").inputValue(),"","Cannot invent a real contract by default");
 assert.equal(await page.locator("#company-confirm").isChecked(),false);
 await page.locator("#inflow-run").click();
 assert.ok((await page.locator("#form-message").innerText()).includes("勾选确认"));
 await page.locator("#company-links .suggestion").first().click();
 assert.notEqual(await page.locator("#link-one").inputValue(),"");
 await page.locator("#company-confirm").check();
 await page.locator("#inflow-run").click();
 await page.waitForFunction(()=>document.querySelectorAll("#inflow-metrics .metric").length===4,null,{timeout:16000});
 assert.equal(await page.locator("#count-a").innerText(),"24");
 assert.equal(await page.locator("#count-b").innerText(),"25");
 const snap=await page.evaluate(()=>window.ZKCompanyResearchUI.snapshot());
 assert.equal(snap.publicCandidate.kind,"existing-enterprise-as-model-inflow");
 assert.equal(snap.confirmedByUser,true);
 assert.ok(await page.locator("#inflow-export").isEnabled());
 if(width===390){const file=path.join(root,"v3/screenshots/v315-domestic-case-390.png");fs.mkdirSync(path.dirname(file),{recursive:true});await page.screenshot({path:file,fullPage:true});}
 await page.locator("#company-search").click();
 assert.equal(await page.locator(".china-search-link").count(),6);
 const href=await page.locator(".china-search-link a").first().getAttribute("href");
 assert.ok(href.startsWith("https://www.baidu.com/s?wd="));
 assert.equal(await page.locator("#company-confirm").isChecked(),false);
 await page.locator("#company-name").fill("自定义公开企业");
 await page.locator("#company-excerpt").fill("企业经营车载智能终端设备制造，位于惠州市仲恺高新区惠风西三路。");
 await page.locator("#extract-company-excerpt").click();
 assert.match(await page.locator("#company-business").inputValue(),/车载智能终端/);
 assert.equal(await page.locator("#company-type").inputValue(),"oem");
 await page.locator("#source").fill("https://example.org/article");
 assert.equal(await page.locator("#inflow-export").isDisabled(),true);
 assert.equal(await page.locator("#company-confirm").isChecked(),false);
 const geometry=await page.evaluate(()=>({w:innerWidth,doc:document.documentElement.scrollWidth}));
 assert.ok(geometry.doc<=geometry.w+4,"horizontal overflow "+JSON.stringify(geometry));
 assert.deepEqual(errors,[]);
 assert.deepEqual(foreign,[],"No auto-query to foreign or paid providers; navigation only after deliberate link click");
 await page.close();
}
(async()=>{
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));let browser;
 try{browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
  for(const width of [1440,390,360])await test(browser,server.address().port,width);
  console.log("PASS V3.15 Chinese search handoff, Zhongkai local example, approved actual Sim, mobile, no hidden lookups");
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});