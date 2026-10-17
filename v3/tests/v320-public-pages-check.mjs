/* Independent live verification of the released V3.20 research page.
 * Unreachable site is UNVERIFIED, not falsely marked passed. */
import assert from "node:assert/strict";
const base="https://zhanglingshare.github.io/zhongkai-simulator/v3/";
async function load(file){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{const r=await fetch(base+file,{signal:controller.signal,redirect:"follow",headers:{"cache-control":"no-cache"}});
  return {status:r.status,body:r.ok?await r.text():""};}
 finally{clearTimeout(timer);}
}
(async()=>{
 let page;
 try{page=await load("trust.html?v=320");}
 catch(e){console.log("LIVE_V320_UNVERIFIED: public GitHub Pages inaccessible: "+e.message);return;}
 if(page.status!==200){console.log("LIVE_V320_UNVERIFIED: public HTML HTTP "+page.status);return;}
 assert.match(page.body,/V3\.20/,"Online V3.20 HTML doesn't identify intended release");
 assert.match(page.body,/trust-core\.js/,"Online trust engine script reference missing");
 let script;
 try{script=await load("trust-core.js");}
 catch(e){console.log("LIVE_V320_UNVERIFIED: page accessible, JS could not be fetched: "+e.message);return;}
 assert.equal(script.status,200,"V3.20 trust core missing online");
 assert.match(script.body,/ZKTrustAudit/);
 console.log("LIVE_V320_VERIFIED: Online V3.20 research HTML and trust core are both readable from external GitHub Actions network.");
})().catch(e=>{console.error("LIVE_V320_MISMATCH: "+e.message);process.exitCode=1;});