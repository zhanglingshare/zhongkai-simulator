const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {chromium}=require("playwright"),root=path.resolve(__dirname,"../..");
const server=http.createServer((req,res)=>{let f;try{f=path.resolve(root,"."+decodeURI(new URL(req.url,"http://localhost").pathname));}catch{res.writeHead(400).end();return;}
if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}
fs.readFile(f,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader("Content-Type",f.endsWith(".js")?"application/javascript":f.endsWith(".css")?"text/css":f.endsWith(".json")?"application/json":"text/html");res.end(data);});});
(async()=>{await new Promise(ok=>server.listen(0,"127.0.0.1",ok));let browser;
try{browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
for(const width of [1440,390,360]){
const page=await browser.newPage({viewport:{width,height:812},reducedMotion:"reduce"}),errors=[];
page.on("pageerror",e=>errors.push(e.message));
await page.goto("http://127.0.0.1:"+server.address().port+"/v3/index.html");
await page.locator("#hero-quickstart").click();
await page.waitForFunction(()=>document.getElementById("story-phase")?.textContent?.includes("播完"));
const lines=await page.locator(".story-affected-role").count();
assert.ok(lines>=1&&lines<=3,"Must show real top model role differences, not empty/fabricated list");
const name=await page.locator(".story-affected-role b").first().innerText();
assert.ok(name.trim().length>0);
await page.locator(".story-affected-role").first().click();
assert.equal(await page.locator("#subject-name").textContent(),name);
assert.equal(await page.locator(".story-affected-role").first().getAttribute("aria-pressed"),"true");
assert.match(await page.locator(".story-affected-disclaimer").innerText(),/不证明企业之间真实的影响关系/);
const geometry=await page.evaluate(()=>({screen:innerWidth,overflow:document.documentElement.scrollWidth}));
assert.ok(geometry.overflow<=geometry.screen+4,JSON.stringify(geometry));
assert.deepEqual(errors,[]);
await page.close();
}
console.log("PASS real model changed-name cards, network focus, evidence caution and responsive Chrome 1440/390/360");
}finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});