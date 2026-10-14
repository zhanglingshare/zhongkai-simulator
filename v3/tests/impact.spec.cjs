/* V3.9 no fabricated inference: the impact lens only uses two Sim snapshots. */
const assert=require("node:assert/strict");
const K=require("../impact-core.js");
const a={tick:4,state:{abundance:.5,order:.5,disaster:.2,mood:0},
 agents:[{name:"企业A",alive:true,energy:.8,sentiment:.1},{name:"企业B",alive:true,energy:.5,sentiment:0}]};
const b={tick:4,state:{abundance:.38,order:.55,disaster:.28,mood:.02},
 agents:[{name:"企业A",alive:false,energy:0,sentiment:-.3},{name:"企业B",alive:true,energy:.7,sentiment:.1}]};
const ds=K.compare(a,b);
assert.equal(ds.length,5);
assert.deepEqual(ds.map(x=>x.key),["abundance","order","disaster","mood","survivors"]);
assert.equal(ds.find(x=>x.key==="disaster").favorability,"unfavorable","Risk rising must be negative, not growth");
assert.equal(ds.find(x=>x.key==="order").favorability,"favorable");
assert.equal(ds.find(x=>x.key==="abundance").direction,"down");
assert.equal(ds.find(x=>x.key==="survivors").delta,-.5);
const impact=K.affected(a,b);
assert.deepEqual(impact.map(x=>x.name),["企业A","企业B"]);
assert.equal(impact[0].exit,-1);
assert.ok(impact[1].energy>.19);
const value=K.value({state:{abundance:0},agents:[]},"abundance");
assert.equal(value,0);
assert.equal(K.value({state:{},agents:[]},"abundance"),null);
assert.throws(()=>K.compare(a,{agents:[],state:{}}),/模型状态不完整/);
assert.equal(K.prepare(a,b,[a],[b]).trends.length,5);
assert.equal(K.prepare(a,b,[a],[b]).observedChanged,2);
assert.deepEqual(K.prepare(a,b).trends,[]);
assert.ok(!Object.keys(K).includes("probability"),"Do not manufacture occurrence probability");
console.log("PASS V3.9: honest snapshots, five indicators, risk semantics, and observed subjects");
