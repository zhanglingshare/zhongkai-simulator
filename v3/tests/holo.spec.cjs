/* V3.8 holo module tests: only real Sim nodes and links, no fake economic geography. */
const assert=require("node:assert/strict"),Core=require("../holo-core.js");
const agents=[
 {name:"A",type:"oem",w:3,alive:true,energy:.76,sentiment:.1},
 {name:"B",type:"service",w:1,alive:true,energy:.25,sentiment:-.1},
 {name:"C",type:"talent",w:2,alive:false,energy:0}
];
const edges=[
 {a:"A",b:"B",layer:"hist",rel:"模型史料边"},
 {a:"B",b:"C",layer:"affinity",rel:"模型同类假设"},
 {a:"B",b:"missing",layer:"contact",rel:"无效边应丢弃"}
];
const g=Core.build(agents,edges);
assert.equal(g.nodes.length,3);
assert.equal(g.edges.length,2);
assert.equal(g.alive,2);
assert.ok(g.nodes.every(n=>[n.x,n.y,n.z].every(Number.isFinite)));
assert.deepEqual(Core.build(agents,edges),g,"3D positions must reproduce");
const later=Core.update(g,agents.map(a=>({...a,energy:.5,alive:a.name==="C"})));
assert.equal(later.alive,1);
assert.deepEqual(later.nodes.map(n=>[n.x,n.y,n.z]),g.nodes.map(n=>[n.x,n.y,n.z]),"layout must be fixed across ticks");
assert.equal(later.nodes[0].alive,false);
assert.equal(later.nodes[2].alive,true);
assert.equal(Core.palette(g.nodes[2])[3],.3,"inactive nodes visibly dim");
assert.ok(Core.palette(g.nodes[1])[0]>.9,"stressed real state uses warm color");
assert.notDeepEqual(Core.project(g.nodes[0],{yaw:0,pitch:0,distance:6},1.8),
  Core.project(g.nodes[0],{yaw:1,pitch:.4,distance:6},1.8),"camera truly rotates 3D coordinates");
assert.equal(Core.metric({state:{abundance:.3},agents},'abundance'),.3);
assert.equal(Core.metric({state:{abundance:.3},agents},'survivors'),2/3);
assert.equal(Core.metric({state:{abundance:.3},agents},'gdp'),null);
assert.throws(()=>Core.build([{name:"A"},{name:"A"}],[]),/重复/);
assert.throws(()=>Core.build(null,[]),/缺少/);
assert.notEqual(Core.hash("A"),Core.hash("B"));
console.log("PASS V3.8 deterministic 3D Sim topology/coordinates, state projection, honest links and camera math");
