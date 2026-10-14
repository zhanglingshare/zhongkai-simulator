/* V3.7 public reproducible scenarios, only permitted existing Sim shocks.
   Links encode input assumptions, NOT simulated scores or independently validated claims. */
(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;if(root)root.ZKShare=api;})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const shocks=["链主外迁","芯片断供","订单外流","产能过剩","政策收紧","用地收紧","限电","融资难","关税摩擦","供应链中断","人才流失","订单爆发","政策利好","技术突破"];
 const positive=new Set(["订单爆发","政策利好","技术突破"]);
 function valid(seed,shock){
   return Number.isSafeInteger(seed)&&seed>=1&&seed<=2147483647&&shocks.includes(shock);
 }
 function create(seed,shock){if(!valid(seed,shock))throw Error("仅接受已登记冲击及合法随机种子");return {v:1,seed,shock};}
 function encode(seed,shock){return encodeURIComponent(JSON.stringify(create(seed,shock)));}
 function decode(raw){
  try{
   if(typeof raw!=="string"||raw.length>320)return null;
   const item=JSON.parse(decodeURIComponent(raw));
   if(!item||item.v!==1||!valid(item.seed,item.shock))return null;
   return create(item.seed,item.shock);
  }catch{return null;}
 }
 function interpret(name,values){
  const spec=values&&typeof values==="object"?values:{};
  return {name,type:positive.has(name)?"opportunity":"risk",
    assumptions:"模型内演示冲击，非现实事件、概率或政策效果",
    strengths:Object.entries(spec).filter(([key,v])=>["abundance","order","disaster","mood","survivors"].includes(key)&&typeof v==="number"&&Number.isFinite(v))
    .map(([key,v])=>({key,delta:v,direction:v>0?"up":v<0?"down":"flat"}))};
 }
 return {shocks,positive:[...positive],valid,create,encode,decode,interpret};
});
