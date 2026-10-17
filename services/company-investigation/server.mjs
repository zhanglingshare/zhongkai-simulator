/* V3.17 optional licensed-company data backend. No scraping.
   A real contract, token, fixed endpoint and frontend origin are required. */
import http from "node:http";
import {timingSafeEqual} from "node:crypto";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const Engine=require("../../v3/company-investigation-core.js");
function text(v,max=120){return String(v??"").trim().slice(0,max);}
function settings(env){
 const origin=text(env.INVESTIGATION_ALLOWED_ORIGIN,220);
 const endpoint=text(env.TYC_ENTERPRISE_ENDPOINT,400),token=text(env.TYC_TOKEN,1000);
 const gatewayToken=text(env.INVESTIGATION_GATEWAY_TOKEN,1000);
 let validEndpoint=false;
 try{const u=new URL(endpoint);validEndpoint=u.protocol==="https:"&&u.hostname==="open.api.tianyancha.com"&&
   /^\/services\//.test(u.pathname)&&!u.username&&!u.password&&!u.hash;}catch{}
 let validOrigin=false;try{const u=new URL(origin);
   validOrigin=(u.protocol==="https:"||u.hostname==="localhost"&&u.protocol==="http:")&&
   u.origin===origin;}catch{}
 return {origin,endpoint,token,gatewayToken,available:!!(validEndpoint&&validOrigin&&token&&token.length>=8&&gatewayToken.length>=16)};
}
function toDocument(raw,name,at){
 const root=raw?.result;
 const result=Array.isArray(root)?root[0]:root;
 if(!result||typeof result!=="object")return null;
 if(Engine.normal(result.name||result.companyName)!==Engine.normal(name))return null;
 const fields={
  name:text(result.name||result.companyName,120),
  registrationStatus:text(result.regStatus||result.registrationStatus,120),
  registeredAddress:text(result.regLocation||result.regAddress||result.registeredAddress,200),
  business:text(result.businessScope||result.scope||result.business,600),
  website:text(result.website||result.webSite||"",180),
  unifiedCreditCode:text(result.creditCode||result.socialStaffNum||result.creditNo||"",18)
 };
 // Registered address never becomes operational address without independent evidence.
 const doc={companyName:fields.name,fields,
  source:{publisher:"天眼查授权企业数据",url:"https://open.tianyancha.com/open/365",type:"licensed_registry",
    independenceGroup:"tianyancha-vendor",checkedAt:at,licensed:true,
    assertion:"经授权接口返回的登记线索；数据商信息仍需与官方登记或其他来源交叉核验"}};
 return Engine.document(doc,name);
}
function createHandler({env=process.env,fetcher=globalThis.fetch,now=()=>Date.now()}={}){
 const config=settings(env),rate=new Map();
 return async function(req,res){
  const origin=req.headers.origin||"";
  function answer(code,body){res.writeHead(code,{"content-type":"application/json; charset=utf-8",
   "cache-control":"no-store, private","x-content-type-options":"nosniff",
   ...(origin&&origin===config.origin?{"access-control-allow-origin":origin,"access-control-allow-credentials":"true","vary":"Origin"}:{})});
   res.end(JSON.stringify(body));}
  if(origin&&origin!==config.origin){answer(403,{ok:false,error:"origin-not-allowed"});return;}
  if(req.url==="/api/investigation-health"&&req.method==="GET"){
   answer(200,{ok:true,configured:config.available,provider:"tianyancha",mode:config.available?"licensed-ready":"disabled"});
   return;
  }
  if(req.url!=="/api/company-investigate"){answer(404,{ok:false,error:"not-found"});return;}
  if(req.method==="OPTIONS"){
   if(!origin||origin!==config.origin){answer(403,{ok:false,error:"origin-not-allowed"});return;}
   res.writeHead(204,{"access-control-allow-origin":origin,"access-control-allow-credentials":"true","access-control-allow-methods":"POST, OPTIONS",
    "access-control-allow-headers":"content-type","access-control-max-age":"3600"});res.end();return;
  }
  if(req.method!=="POST"){answer(405,{ok:false,error:"method-not-allowed"});return;}
  if(!config.available){answer(503,{ok:false,error:"licensed-provider-not-configured"});return;}
  // This token MUST be injected by an authenticated trusted reverse proxy.
  // This service must bind to loopback, never be exposed directly.
  const supplied=Buffer.from(text(req.headers["x-internal-investigation-gateway"],1000));
  const trusted=Buffer.from(config.gatewayToken);
  if(supplied.length!==trusted.length||!timingSafeEqual(supplied,trusted)){
   answer(403,{ok:false,error:"trusted-gateway-required"});return;
  }
  const identity=req.socket?.remoteAddress||"unknown";
  const stamp=now(),bucket=rate.get(identity)||{start:stamp,count:0};
  if(stamp-bucket.start>60000){bucket.start=stamp;bucket.count=0;}
  bucket.count++;rate.set(identity,bucket);
  if(rate.size>1000)rate.clear();
  if(bucket.count>12){answer(429,{ok:false,error:"too-many-requests"});return;}
  let payload="";
  try{
   for await(const chunk of req){payload+=chunk;if(Buffer.byteLength(payload)>2048)throw new Error("too-long");}
  }catch{answer(413,{ok:false,error:"input-too-large"});return;}
  let body;try{body=JSON.parse(payload);}catch{answer(400,{ok:false,error:"invalid-json"});return;}
  const query=text(body.name,90);
  if(body.consent!==true||Engine.normal(query).length<2||query.length>80){
   answer(400,{ok:false,error:"explicit-consent-and-valid-company-name-required"});return;
  }
  const upstream=new URL(config.endpoint);
  upstream.searchParams.set("keyword",query);
  const abort=new AbortController(),clock=setTimeout(()=>abort.abort(),9000);
  try{
   const response=await fetcher(upstream.href,{method:"GET",headers:{
    Authorization:config.token,Accept:"application/json"},signal:abort.signal});
   if(!response.ok){answer(502,{ok:false,error:"licensed-provider-unavailable",status:response.status});return;}
   const raw=await response.json();
   if(raw.error_code!==undefined&&Number(raw.error_code)!==0){
    answer(502,{ok:false,error:"licensed-provider-rejected-request"});return;
   }
   const at=new Date(now()).toISOString(),document=toDocument(raw,query,at);
   if(!document){answer(200,{ok:true,name:query,documents:[],message:"接口未找到与输入全称严格一致的企业；不得自动当作同一主体"});return;}
   answer(200,{ok:true,name:query,documents:[document],
    message:"已获得一条授权数据商线索；不能代替国家企业登记核验。"});
  }catch{
   answer(502,{ok:false,error:"licensed-provider-timeout-or-invalid-response"});
  }finally{clearTimeout(clock);}
 };
}
function start(env=process.env){
 const port=Number(env.PORT||8787);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error("Invalid PORT");
 const server=http.createServer(createHandler({env}));
 server.listen(port,env.HOST||"127.0.0.1");
 return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))start();
export {settings,toDocument,createHandler,start};
