/* Model atlas must enumerate ALL actual Sim nodes; never invent a company registry. */
const assert=require("node:assert/strict");
const Core=require("../atlas-core.js");
const graph={nodes:[
 {name:"龙头A",type:"oem",typeName:"链主/整机",w:3,alive:true,energy:.55,sentiment:.1},
 {name:"配套B",type:"service",typeName:"生产性服务",w:2,alive:true,energy:.18,sentiment:-.4},
 {name:"空间C",type:"land",typeName:"土地空间",w:1,alive:false,energy:0,sentiment:0}
],edges:[
 {a:"龙头A",b:"配套B",layer:"hist",rel:"历史/预设模型边"},
 {a:"空间C",b:"配套B",layer:"affinity",rel:"推断连边"},
 {a:"龙头A",b:"missing",layer:"hist"},
 {a:"空间C",b:"配套B",layer:"weird",rel:"未知"}
]};
const a=Core.build(graph);
assert.equal(a.total,3);assert.equal(a.active,2);
assert.equal(Core.find(a).length,3);
assert.deepEqual(Core.find(a).map(n=>n.name),["龙头A","配套B","空间C"]);
assert.deepEqual(Core.find(a,{status:"core"}).map(n=>n.name),["龙头A"]);
assert.deepEqual(Core.find(a,{status:"active"}).map(n=>n.name),["龙头A","配套B"]);
assert.deepEqual(Core.find(a,{status:"inactive"}).map(n=>n.name),["空间C"]);
assert.deepEqual(Core.find(a,{status:"stressed"}).map(n=>n.name),["配套B"]);
assert.deepEqual(Core.find(a,{query:"土地"}).map(n=>n.name),["空间C"],"also search role classification");
assert.deepEqual(Core.find(a,{type:"生产性服务"}).map(n=>n.name),["配套B"]);
assert.equal(Core.find(a,{query:"not-listed"}).length,0);
assert.deepEqual(a.types,["土地空间","生产性服务","链主/整机"].sort((a,b)=>a.localeCompare(b,"zh-CN")));
const b=a.items.find(x=>x.name==="配套B"),info=Core.summary(b);
assert.equal(info.total,3);
assert.equal(info.historical,1);
assert.equal(info.inferred,2);
assert.ok(info.categories.some(x=>x.key==="affinity"&&x.count===1));
assert.ok(info.categories.some(x=>x.key==="unknown"&&x.count===1));
assert.equal(a.items.find(x=>x.name==="龙头A").relations.length,1);
assert.throws(()=>Core.build(null),/缺少/);
assert.throws(()=>Core.build({nodes:[{name:"A"},{name:"A"}],edges:[]}),/重复/);
assert.ok(!("realTrade" in b), "Do not claim verified material flows");
console.log("PASS model atlas: full node enumeration, types, status, search, provenance and no official registry claims");
