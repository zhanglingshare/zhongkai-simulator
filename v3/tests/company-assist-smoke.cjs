/* V3.14 Chrome acceptance: one explicit public lookup with a MOCK of Wikidata.
   The test does not claim to audit live Wikidata network connectivity. */
const assert=require("node:assert/strict"),http=require("node:http"),fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"../..");
const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8"};
const server=http.createServer((req,res)=>{
 let target;try{const u=new URL(req.url,"http://127.0.0.1"),decoded=decodeURI(u.pathname);
  target=path.resolve(root,"."+decoded);}catch{res.writeHead(400);res.end();return;}
 if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(target,(e,b)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":mime[path.extname(target)]||"text/plain"});res.end(b);
 });
});
async function scenario(browser,port,width,offline=false){
 const page=await browser.newPage({viewport:{width,height:850}});
 const errors=[],requests=[];page.on("pageerror",e=>errors.push(e.message));
 await page.route("https://www.wikidata.org/w/api.php**",route=>{
  const u=new URL(route.request().url()),act=u.searchParams.get("action");
  requests.push(act);
  if(offline)return route.abort();
  const info=act==="wbsearchentities"?{search:[{id:"Q42",label:"测试机器人企业",description:"机器人整机制造"}]}:
   u.searchParams.get("props")==="labels"?{entities:{}}:
    {entities:{Q42:{id:"Q42",labels:{zh:{value:"测试机器人企业"}},
      descriptions:{zh:{value:"机器人整机制造商"}},claims:{
      P856:[{rank:"normal",mainsnak:{snaktype:"value",datavalue:{value:"https://example.com"}}}]}}}};
  route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(info)});
 });
 await page.goto("http://127.0.0.1:"+port+"/v3/inflow.html");
 await page.locator("#company-name").fill("测试机器人企业");
 assert.equal(await page.locator("#company-confirm").isChecked(),false);
 await page.locator("#company-search").click();
 if(!offline){
  await page.locator(".select-candidate").click();
  await page.waitForFunction(()=>document.querySelector("#company-search-status").textContent.includes("已填入公开知识库"));
  assert.equal(await page.locator("#company-business").inputValue(),"机器人整机制造商");
  assert.equal(await page.locator("#company-website").inputValue(),"https://example.com");
  assert.equal(await page.locator("#company-type").inputValue(),"oem","Conservative role hint from supplied description");
  assert.ok((await page.locator("#source").inputValue()).includes("/wiki/Q42"));
  assert.equal(await page.locator("#evidence").inputValue(),"unverified","Cannot promote third-party source into verified supply relationship");
  assert.equal(await page.locator(".candidate-card").count(),0);
 }else{
  await page.waitForFunction(()=>document.querySelector("#company-search-status").textContent.includes("在线查找暂不可用"));
  await page.locator("#company-business").fill("机器人整机制造商");
 }
 // User must explicitly choose a relationship; a suggested partner is never asserted as a fact.
 assert.equal(await page.locator("#link-one").inputValue(),"");
 await page.locator("#company-links .suggestion").first().click();
 assert.notEqual(await page.locator("#link-one").inputValue(),"");
 await page.locator("#inflow-run").click();
 assert.ok((await page.locator("#form-message").innerText()).includes("勾选确认"));
 await page.locator("#company-confirm").check();
 await page.locator("#inflow-run").click();
 await page.waitForFunction(()=>document.querySelectorAll("#inflow-metrics .metric").length===4,null,{timeout:15000});
 assert.equal(await page.locator("#count-b").innerText(),"25");
 assert.equal(await page.locator("#company-confirm").isChecked(),true);
 assert.ok(await page.locator("#inflow-export").isEnabled());
 const widthCheck=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+4);
 assert.equal(widthCheck,true,"Mobile layout must not overflow");
 if(width===390&&!offline){
  const shot=path.join(root,"v3/screenshots/v314-company-research-mobile.png");
  fs.mkdirSync(path.dirname(shot),{recursive:true});await page.screenshot({path:shot,fullPage:true});
 }
 await page.locator("#company-business").fill("半导体芯片");
 assert.equal(await page.locator("#company-confirm").isChecked(),false);
 assert.equal(await page.locator("#inflow-export").isDisabled(),true);
 assert.deepEqual(errors,[],errors.join("; "));
 assert.ok(requests.length>=1);
 await page.close();
}
(async()=>{
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 let browser;try{
  browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
  await scenario(browser,server.address().port,1440,false);
  await scenario(browser,server.address().port,390,false);
  await scenario(browser,server.address().port,360,true);
  console.log("PASS V3.14 browser sourced search, user-selected autofill, editable role, explicit link/confirmation, offline manual fallback, mobile");
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});