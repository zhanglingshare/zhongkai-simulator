/* Mock-only licensed provider integration; no live vendor token in CI. */
import assert from "node:assert/strict";
import http from "node:http";
import {settings,toDocument,createHandler} from "../../services/company-investigation/server.mjs";
const baseEnv={
 INVESTIGATION_ALLOWED_ORIGIN:"https://zhanglingshare.github.io",
 INVESTIGATION_GATEWAY_TOKEN:"this-is-only-a-test-gateway-secret",
 TYC_ENTERPRISE_ENDPOINT:"https://open.api.tianyancha.com/services/v4/open/baseinfoV3",
 TYC_TOKEN:"fake-api-token-never-sent-to-real-host"
};
assert.equal(settings(baseEnv).available,true);
assert.equal(settings({...baseEnv,TYC_ENTERPRISE_ENDPOINT:"http://open.api.tianyancha.com/services/test"}).available,false);
assert.equal(settings({...baseEnv,TYC_ENTERPRISE_ENDPOINT:"https://evil.example/services/open/x"}).available,false);
assert.equal(settings({...baseEnv,INVESTIGATION_GATEWAY_TOKEN:""}).available,false);
assert.equal(settings({...baseEnv,INVESTIGATION_ALLOWED_ORIGIN:"*"}).available,false);
const n="惠州市示例智能装备有限公司";
const provider={
 error_code:0,result:{
  name:n,regStatus:"存续",regLocation:"广东省惠州市仲恺高新区",
  businessScope:"智能制造装备及电子元件生产",
  creditCode:"91320594MA1MG0JH1C",phone:"000-0000",legalPersonName:"不应输出"
 }};
const normalized=toDocument(provider,n,"2026-10-17T00:00:00Z");
assert.equal(normalized.fields.registeredAddress,"广东省惠州市仲恺高新区");
assert.equal(normalized.fields.operationAddress,undefined,"Registration is not proof of business operations");
assert.equal(normalized.source.licensed,true);
assert.equal(toDocument(provider,"另一个公司","2026-10-17"),null,"No sloppy identity matching");
let upstreamCalls=0;
const fetcher=async(url,init)=>{
 upstreamCalls++;
 const u=new URL(url);assert.equal(u.hostname,"open.api.tianyancha.com");
 assert.equal(u.searchParams.get("keyword"),n);
 assert.equal(init.headers.Authorization,baseEnv.TYC_TOKEN);
 assert.equal(init.method,"GET");
 return {ok:true,json:async()=>provider};
};
const server=http.createServer(createHandler({env:baseEnv,fetcher,now:()=>1781654400000}));
await new Promise(done=>server.listen(0,"127.0.0.1",done));
const base="http://127.0.0.1:"+server.address().port;
const call=async(body,headers={})=>{
 const r=await fetch(base+"/api/company-investigate",{method:"POST",headers:{
  Origin:baseEnv.INVESTIGATION_ALLOWED_ORIGIN,"content-type":"application/json",...headers},
  body:JSON.stringify(body)});return {status:r.status,body:await r.json(),headers:r.headers};
};
try{
 let r=await fetch(base+"/api/investigation-health",{headers:{Origin:baseEnv.INVESTIGATION_ALLOWED_ORIGIN}});
 let status=await r.json();assert.equal(status.configured,true);
 assert.ok(!JSON.stringify(status).includes("fake-api-token"));
 let response=await call({name:n,consent:true});
 assert.equal(response.status,403);
 assert.equal(upstreamCalls,0);
 response=await call({name:n,consent:false},{"x-internal-investigation-gateway":baseEnv.INVESTIGATION_GATEWAY_TOKEN});
 assert.equal(response.status,400);
 response=await call({name:n,consent:true},{"x-internal-investigation-gateway":baseEnv.INVESTIGATION_GATEWAY_TOKEN,Origin:"https://attacker.example"});
 assert.equal(response.status,403);
 assert.equal(upstreamCalls,0);
 response=await call({name:n,consent:true},{"x-internal-investigation-gateway":baseEnv.INVESTIGATION_GATEWAY_TOKEN});
 assert.equal(response.status,200);
 assert.equal(response.body.documents.length,1);
 assert.equal(response.body.documents[0].fields.operationAddress,undefined);
 assert.ok(!JSON.stringify(response.body).includes("phone"));
 assert.ok(!JSON.stringify(response.body).includes("legalPersonName"));
 assert.ok(!JSON.stringify(response.body).includes("fake-api-token"));
 assert.equal(response.headers.get("access-control-allow-credentials"),"true");
 const p=await fetch(base+"/api/company-investigate",{method:"OPTIONS",headers:{Origin:baseEnv.INVESTIGATION_ALLOWED_ORIGIN}});
 assert.equal(p.status,204);
 for(let i=0;i<10;i++)await call({name:n,consent:true},{"x-internal-investigation-gateway":baseEnv.INVESTIGATION_GATEWAY_TOKEN});
 response=await call({name:n,consent:true},{"x-internal-investigation-gateway":baseEnv.INVESTIGATION_GATEWAY_TOKEN});
 assert.equal(response.status,429,"Must bound paid provider calls");
 console.log("PASS V3.17 backend secret never exposed, fixed upstream, consent, exact origin, gateway trust, rate limit, registration separation");
}finally{server.close();}
