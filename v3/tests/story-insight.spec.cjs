/* Model-truth guard for non-expert story: compare A[t] to B[t] only, no fabricated change. */
"use strict";
const assert=require("node:assert/strict");
const Story=require("../story-insight.js");
const at=(agents)=>({agents});
const roles=[{name:"链主甲",alive:true,energy:.85},{name:"配套乙",alive:true,energy:.67},
 {name:"服务丙",alive:true,energy:.48},{name:"园区丁",alive:true,energy:.6},
 {name:"人才戊",alive:false,energy:.0}];
const A=at(roles);
const B=at([{name:"链主甲",alive:false,energy:0},{name:"配套乙",alive:true,energy:.53},
 {name:"服务丙",alive:true,energy:.65},{name:"园区丁",alive:true,energy:.57},
 {name:"人才戊",alive:true,energy:.42}]);
const d=Story.compare(A,B);
assert.equal(d.total,4,"Only four model changes above threshold, not the whole graph");
assert.deepEqual(d.items.map(x=>x.name),["人才戊","链主甲","服务丙"]); // entry and exit tie sort by Chinese name, energy next
assert.equal(d.items[1].kind,"exit");
assert.equal(d.items[2].tone,"up");
assert.equal(d.counts.down,1);
assert.equal(d.counts.up,1);
assert.equal(d.counts.exit,1);
assert.equal(d.counts.enter,1);
const n=Story.narrate(A,B,8,"链主外迁");
assert.ok(n.title.includes("人才戊"));
assert.ok(n.description.includes("没有加入「链主外迁」假设"));
assert.ok(n.items.every(x=>roles.some(r=>r.name===x.name)));
assert.equal(Story.compare(A,A).total,0,"No fabricated downstream effect when snapshots identical");
assert.match(Story.narrate(A,A,10,"链主外迁").title,/没有明显/);
const marginal=at(roles.map(x=>({...x})));marginal.agents[1].energy=.64;
assert.equal(Story.compare(A,marginal).total,0,"Negligible differences must not be embellished");
assert.throws(()=>Story.compare(null,A));
assert.throws(()=>Story.compare(A,{}));
const reversed=Story.compare(B,A);
assert.ok(reversed.items.some(x=>x.name==="链主甲"&&x.kind==="enter"),"Direction must reverse with data");
const one=Story.compare(A,B,1);
assert.equal(one.items.length,1);assert.equal(one.total,4);
console.log("PASS story-truth: named actual A/B changes, no fabricated differences, stable status directions, <=3 highlights");
