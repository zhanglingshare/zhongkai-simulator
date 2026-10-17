/* V3.21 Chrome E2E: five authentic pilots, potential conflicts, human review,
 * safeguarded conditional economics, source snapshot diff and JSON export. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {chromium}=require("playwright"),root=path.resolve(__dirname,"../..");
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"};
const server=http.createServer((req,res)=>{
 let name;try{name=path.resolve(root,"."+decodeURI(new URL(req.url,"http://localhost").pathname));}
 catch{res.writeHead(400).end();return;}
 if(!name.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(name,(err,data)=>{if(err){res.writeHead(404).end();return;}
 res.writeHead(200,{"content-type":types[path.extname(name)]||"text/plain"});res.end(data);});
});
async function verify(browser,port,width){
 const page=await browser.newPage({viewport:{width,height:920},reducedMotion:"reduce",acceptDownloads:true});
 const errors=[],external=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",r=>{if(!r.url().startsWith("http://127.0.0.1:"))external.push(r.url());});
 await page.goto("http://127.0.0.1:"+port+"/v3/trust.html");
 await page.waitForFunction(()=>document.querySelectorAll("#pilot-case option").length===5,null,{timeout:10000});
 assert.equal(await page.locator("#pilot-case option").count(),5);
 assert.equal(await page.locator(".enterprise-choice").count(),20,"Original V3.20 trust UI must still work");
 assert.equal(await page.locator("#pilot-export").isDisabled(),true);
 assert.match(await page.locator("#pilot-source").innerText(),/华阳精机/);
 assert.match(await page.locator("#pilot-source").innerText(),/环评文件受理/);
 assert.match(await page.locator("#pilot-source").innerText(),/不证明环评最终批准/);
 assert.match(await page.locator("#pilot-issues").innerText(),/仍缺/);
 await page.locator("#pilot-run").click();
 assert.match(await page.locator("#pilot-status").innerText(),/确认/);
 await page.locator("#pilot-evidence-field").selectOption("site");
 await page.locator("#pilot-evidence-value").fill("另一个来源所列项目位置，待确认是否同一地块");
 await page.locator("#pilot-evidence-url").fill("https://example.org/project-notice");
 await page.locator("#pilot-evidence-date").fill("2026-10-17");
 await page.locator("#pilot-evidence-reviewer").fill("researcher-demo");
 await page.locator("#pilot-evidence-form button[type=submit]").click();
 assert.match(await page.locator("#pilot-issues").innerText(),/可能存在来源差异/);
 assert.equal(await page.locator(".pilot-conflict").count(),1);
 assert.equal(await page.locator(".pilot-added").count(),1);
 await page.locator(".pilot-review-buttons button").first().click();
 assert.match(await page.locator(".pilot-added").innerText(),/human-reviewed-unverified/);
 assert.match(await page.locator("#pilot-issues").innerText(),/待补证据|不同文本|来源差异|口径/);
 await page.locator("#pilot-reviewer").fill("researcher-demo");
 await page.locator("#pilot-review-note").fill("环评受理属于前期手续，仍未知真正扩产投资兑现与产线投产状态。");
 await page.locator("#pilot-confirm").check();
 await page.locator("#pilot-run").click();
 assert.match(await page.locator("#pilot-status").innerText(),/至少输入一项项目增量/);
 await page.locator(".pilot-assumptions summary").click();
 await page.locator("#pilot-investment-low").fill("1");
 await page.locator("#pilot-investment-high").fill("3");
 await page.locator("#pilot-run").click();
 assert.equal(await page.locator("#pilot-export").isEnabled(),true);
 assert.match(await page.locator("#pilot-results").innerText(),/一次性新增投资/);
 assert.match(await page.locator("#pilot-results").innerText(),/未知/,"Missing jobs stay unknown");
 const [d]=await Promise.all([page.waitForEvent("download"),page.locator("#pilot-export").click()]);
 const report=JSON.parse(fs.readFileSync(await d.path(),"utf8"));
 assert.equal(report.schema,"zk-v321-pilot-session-v1");
 assert.equal(report.caseId,"e18");
 assert.equal(report.evidence.conflicts.length,1);
 assert.equal(report.conditionalStudy.verifiedInvestment,false);
 assert.equal(report.conditionalStudy.economics.metrics.netJobs.provided,false);
 assert.equal(report.cryptographicallySealed,false);
 assert.ok(report.eventJournal.some(x=>x.action==="review-user-claim"));
 await page.locator("#pilot-case").selectOption("e19");
 assert.match(await page.locator("#pilot-source").innerText(),/企业官网联系页/);
 assert.equal(await page.locator("#pilot-kind").inputValue(),"backfill");
 await page.locator("#pilot-reviewer").fill("researcher-demo");
 await page.locator("#pilot-review-note").fill("企业官网地址只作旧企业参考，不代表2026年新引入。");
 await page.locator("#pilot-confirm").check();
 await page.locator("#pilot-run").click();
 assert.match(await page.locator("#pilot-results").innerText(),/0 亿元/);
 assert.match(await page.locator("#pilot-results").innerText(),/0 人/);
 await page.locator("#pilot-kind").selectOption("proposed_new");
 await page.locator("#pilot-run").click();
 assert.match(await page.locator("#pilot-status").innerText(),/项目专属|旧企业不能/);
 assert.equal(await page.locator("#pilot-export").isDisabled(),true);
 await page.locator("#pilot-case").selectOption("e08");
 assert.match(await page.locator("#pilot-source").innerText(),/40万元/);
 assert.match(await page.locator("#pilot-source").innerText(),/不是项目投资额/);
 await page.locator(".pilot-snapshot summary").click();
 const updated=JSON.parse(fs.readFileSync(path.join(root,"v3/data/pilot-cases-v321.json"),"utf8"));
 updated.snapshotId="pilot-comparison-2026-10-18";updated.capturedAt="2026-10-18";
 updated.cases[0].source[0].support="有新增证据线索，仍未核实实情";
 await page.locator("#pilot-compare-file").setInputFiles({
  name:"new-source-snapshot.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(updated))});
 await page.waitForFunction(()=>document.querySelector("#pilot-changes")?.textContent?.includes("原来源发生变化"),null,{timeout:5000});
 assert.match(await page.locator("#pilot-changes").innerText(),/原来源发生变化/);
 const [saved]=await Promise.all([page.waitForEvent("download"),page.locator("#pilot-export-review").click()]);
 const session=JSON.parse(fs.readFileSync(await saved.path(),"utf8"));
 assert.equal(session.conditionalStudy,null);
 assert.equal(session.independentVerification,false);
 assert.equal(session.caseId,"e08");
 assert.equal(session.sourceDiff.changedCases,1);
 const geom=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(geom.scroll<=geom.width+4,"Horizontal overflow "+JSON.stringify(geom));
 assert.deepEqual(errors,[],"Runtime errors: "+errors.join(" || "));
 assert.deepEqual(external,[],"No automatic third-party lookups or source fetching");
 if(width===390){const dir=path.join(root,"v3/screenshots");fs.mkdirSync(dir,{recursive:true});
   await page.screenshot({path:path.join(dir,"v321-evidence-closure-mobile-390.png"),fullPage:true});}
 await page.close();
}
(async()=>{await new Promise(done=>server.listen(0,"127.0.0.1",done));let browser;
 try{browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
  for(const width of [1440,390,360])await verify(browser,server.address().port,width);
  console.log("PASS V3.21 live evidence-to-human-review-to-assumption simulation, snapshots, exports, old-economy zero, 1440/390/360");
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
