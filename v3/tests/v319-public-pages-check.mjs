/* Best-effort independent GitHub Pages availability check; reports unverified
   when blocked by network. It is NOT the local Chrome regression. */
import assert from "node:assert/strict";
const base="https://zhanglingshare.github.io/zhongkai-simulator/v3/";
async function get(path){
 const stop=new AbortController(),timer=setTimeout(()=>stop.abort(),10000);
 try{const r=await fetch(base+path,{signal:stop.signal,redirect:"follow",headers:{"cache-control":"no-cache"}});
  return {status:r.status,content:r.ok?await r.text():""};}
 finally{clearTimeout(timer);}
}
(async()=>{
 let html;
 try{html=await get("inflow.html?v=319");}
 catch(e){console.log("LIVE_SITE_UNVERIFIED: 网络无法访问正式 GitHub Pages："+e.message);return;}
 if(html.status!==200){console.log("LIVE_SITE_UNVERIFIED: GitHub Pages 返回 HTTP "+html.status);return;}
 assert.match(html.content,/V3\.19/, "Formal site is reachable but does not identify deployed V3.19");
 assert.match(html.content,/decision-reversal-core\.js/);
 assert.match(html.content,/decision-reversal-ui\.js/);
 let core;
 try{core=await get("decision-reversal-core.js");}
 catch(e){console.log("LIVE_SITE_UNVERIFIED: 核心JS请求未完成："+e.message);return;}
 assert.equal(core.status,200,"Deployed V3.19 script is missing");
 assert.match(core.content,/ZKDecisionReversal/);
 console.log("LIVE_SITE_VERIFIED: Official V3.19 HTML and decision reversal JavaScript responded with valid content");
})().catch(e=>{console.error("LIVE_SITE_VERSION_MISMATCH: "+e.message);process.exitCode=1;});
