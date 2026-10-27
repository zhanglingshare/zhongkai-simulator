/* Cross-page input protocol only. NO model/results/secrets are transported. */
(function(root,factory){const x=factory();if(typeof module==='object'&&module.exports)module.exports=x;if(root)root.ZKFamily=x;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const VERSION=1,SAFE_TARGETS=['TCL华星','TCL王牌','亿纬锂能','德赛西威','龙旗电子'];
const KINDS=['exit','shock','explore','research','town'],SIZES=[24,32,41];
const SCENE_SHOCKS=['技术突破','供应链中断','链主外迁','芯片断供','限电'];
function boundedStr(s,n=100){return typeof s==='string'&&s.length<=n&&s.trim()!==''?s.trim():null;}
function num(n,lo,hi){n=Number(n);return Number.isSafeInteger(n)&&n>=lo&&n<=hi?n:null;}
function validate(o){
 if(!o||typeof o!=='object'||Array.isArray(o)||o.v!==VERSION)return null;
 const kind=KINDS.includes(o.kind)?o.kind:null;if(!kind)return null;
 const seed=o.seed==null?7:num(o.seed,1,2147483647),pop=o.pop==null?41:num(o.pop,24,41),tick=o.tick==null?0:num(o.tick,0,20);
 if(seed===null||!SIZES.includes(pop)||tick===null)return null;
 const entity=boundedStr(o.entity,50)||null,target=kind==='exit'?(SAFE_TARGETS.includes(o.target)?o.target:null):null,shock=kind==='shock'?(SCENE_SHOCKS.includes(o.shock)?o.shock:null):null;
 if(kind==='exit'&&!target||kind==='shock'&&!shock)return null;
 const v={v:VERSION,kind,seed,pop,tick};if(entity)v.entity=entity;if(target)v.target=target;if(shock)v.shock=shock;if(kind==='town')v.town='沥林';
 if(['see','test','research','lilin','hub'].includes(o.source))v.source=o.source;
 return v;
}
function encode(o){const v=validate({...o,v:VERSION});return v?encodeURIComponent(JSON.stringify(v)):null;}
function decode(raw){try{if(typeof raw!=='string'||raw.length>750)return null;return validate(JSON.parse(decodeURIComponent(raw)));}catch{return null;}}
function parseSearch(search){try{return decode(new URLSearchParams(search).get('zkctx'));}catch{return null;}}
function storyPayload(ctx){const v=validate({...ctx,v:VERSION});if(!v||!['exit','shock'].includes(v.kind))return null;
 return v.kind==='exit'?{v:3,kind:'exit',target:v.target,seed:v.seed,pop:v.pop,tick:v.tick}:{v:2,shock:v.shock,seed:v.seed,pop:v.pop,tick:v.tick};}
function withContext(url,ctx){const data=encode(ctx);if(!data)return url;return url+(url.includes('?')?'&':'?')+'zkctx='+encodeURIComponent(data);}
function toStory(url,ctx){const data=storyPayload(ctx);if(!data)return withContext(url,ctx);return url+(url.includes('?')?'&':'?')+'scenario='+encodeURIComponent(encodeURIComponent(JSON.stringify(data)));}
function checkTownTransfer(source,target){return source==='仲恺'&&target==='沥林'||source==='沥林'&&target==='仲恺';}
return {VERSION,SAFE_TARGETS,SCENE_SHOCKS,validate,encode,decode,parseSearch,storyPayload,withContext,toStory,checkTownTransfer};
});