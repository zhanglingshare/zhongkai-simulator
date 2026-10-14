/* V3.7 scenario math and falsifiability guards. Fake Sim is ONLY a test fixture. */
const assert=require("node:assert/strict");
const W=require("../windtunnel-core.js");
const copy=x=>JSON.parse(JSON.stringify(x));
function clamp(x,min,max){return Math.max(min,Math.min(max,x));}
class FakeSim{
 constructor(seed,options){
   this.seed=seed;this.params={ticks:20,invest:.35,service:.30,land:.45,external:.62,
     spread_rate:.22,disaster_rate:.08,...options};
   this.state={abundance:.5,order:.5,disaster:.2,mood:0};
   this.agents=[{name:"甲",alive:true,type:"anchor"},{name:"乙",alive:true,type:"supplier"}];
   this.edges=[{a:"甲",b:"乙",layer:"hist",rel:"样本"}];
   this.snapshots=[this._snap()];this.tick=0;this.shockValue=0;
 }
 _snap(){return {tick:this.tick,state:copy(this.state),agents:copy(this.agents),timeline:[]};}
 shock(name){
   if(!W.shocks.includes(name))return {ok:false};
   this.shockValue=W.shockGroups.positive.includes(name)?.035:-.035;
   this.state.abundance+=this.shockValue;
   this.state.disaster-=this.shockValue*.5;
   return {ok:true,killed:0};
 }
 step(){
   this.tick++;
   this.state.abundance=clamp(this.state.abundance+.014*(this.params.invest-.35)+
    .018*(this.params.service-.30)+.009*(this.params.land-.45)-
    .018*(this.params.external-.62),0,1);
   this.state.order=clamp(this.state.order+.015*(this.params.service-.30)+.008*(this.params.spread_rate-.22),0,1);
   this.state.disaster=clamp(this.state.disaster+.02*(this.params.disaster_rate-.08),0,1);
   this.snapshots.push(this._snap());
 }
 survivors(){return this.agents.filter(a=>a.alive).length/this.agents.length;}
}
assert.equal(W.shocks.length,11);
assert.equal(W.shockGroups.negative.length,8);
assert.equal(W.shockGroups.positive.length,3);
assert.equal(W.linkConfig("").intensity,.14);
const raw={seed:19,shock:"链主外迁",intervention:"none",intensity:.14};
const cfg=W.sanitize(raw);
assert.deepEqual(cfg,raw);
assert.deepEqual(W.linkConfig("?"+W.serialize(cfg)),cfg);
assert.deepEqual(W.linkConfig("?shock=bad&seed=-1&try=invalid&strength=NaN"),W.sanitize({}));
const a=W.one(FakeSim,cfg),b=W.one(FakeSim,cfg);
assert.deepEqual(a.diff,b.diff);
assert.equal(a.ticks,20);
assert.equal(a.a.length,21);
assert.equal(a.b.length,21);
assert.equal(a.modelOnly,true);
assert.ok(a.diff.abundance<0);
assert.equal(a.diff.survivors,0);
const positive=W.one(FakeSim,{...raw,shock:"技术突破"});
assert.ok(positive.diff.abundance>0);
const rescue=W.one(FakeSim,{...raw,intervention:"invest",intensity:.14});
assert.ok(rescue.diff.abundance>a.diff.abundance,"investment scenario increases fictional model abundance");
assert.equal(W.scenarioParams({invest:.98},W.sanitize({intervention:"invest",intensity:.25})).invest,1);
const ensemble=W.multiple(FakeSim,cfg,8);
assert.equal(ensemble.n,8);
assert.equal(ensemble.summary.abundance.n,8);
assert.equal(ensemble.summary.abundance.negative,8);
assert.equal(ensemble.modelOnly,true);
assert.ok(ensemble.summary.abundance.p10<=ensemble.summary.abundance.median);
assert.ok(ensemble.summary.abundance.median<=ensemble.summary.abundance.p90);
const sens=W.scan(FakeSim,cfg,"abundance",3);
assert.equal(sens.factors.length,6);
assert.ok(sens.factors.every(x=>Number.isFinite(x.up)&&Number.isFinite(x.down)));
assert.ok(sens.factors.every(x=>x.grade==="B"||x.grade==="C"));
assert.ok(sens.factors.every((x,i,arr)=>i===0||arr[i-1].magnitude>=x.magnitude));
assert.throws(()=>W.multiple(FakeSim,cfg,1));
assert.throws(()=>W.scan(FakeSim,cfg,"gdp",4));
assert.throws(()=>W.one(null,cfg));
const unicode={seed:220,shock:"政策利好",intervention:"bundle",intensity:.2};
assert.deepEqual(W.linkConfig("?"+W.serialize(unicode)),unicode);
console.log("PASS V3.7: original Sim contract, paired seed experiments, growth/stress signs, model-only ensembles and factor directions, share roundtrips");
