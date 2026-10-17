const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const H=require("../home-story-core.js"),ctx={console,window:{}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve("../portal-kernel.js"),"utf8"),ctx);
const Sim=vm.runInContext("Sim",ctx),serialize=x=>JSON.parse(JSON.stringify(x));
for(const size of [24,32,41])for(const seed of [7,29]){
 const original=new Sim(seed,{n_agents:size,ticks:20}),target=H.hero(original.agents).name;
 const run=H.exitRun(Sim,seed,size,target),a=new Sim(seed,{n_agents:size,ticks:20}),b=new Sim(seed,{n_agents:size,ticks:20});
 b.removeAgent(target);
 assert.equal(run.A.length,21);assert.equal(run.B.length,21);
 assert.equal(run.incident,original.edges.filter(e=>e.a===target||e.b===target).length);
 for(let t=0;t<=20;t++){
  assert.deepEqual(serialize(run.A[t]),serialize(a._snap()));assert.deepEqual(serialize(run.B[t]),serialize(b._snap()));
  const info=H.frameInfo(run,t),alive=new Set(b.agents.filter(n=>n.alive).map(n=>n.name));
  assert.equal(info.b.alive,alive.size);assert.equal(info.b.links,b.edges.filter(e=>alive.has(e.a)&&alive.has(e.b)).length);
  assert.equal(run.B[t].agents.find(n=>n.name===target).alive,false);
  if(t<20){a.step();b.step();}
 }
 const scores=run.A.map((v,t)=>H.changes(v,run.B[t]).length);
 assert.equal(run.keyTick,scores.indexOf(Math.max(...scores)),"Pause at the earliest maximum observed differences");
 const first=H.frameInfo(run,0);
 assert.equal(first.a.alive-first.b.alive,1);assert.equal(first.a.links-first.b.links,run.incident);
}
assert.throws(()=>H.exitRun(Sim,7,41,"编造企业"),/不是当前模型/);
assert.equal(H.changes({agents:[{name:"甲",alive:true,energy:.5}]},{agents:[{name:"甲",alive:true,energy:.5}]}).length,0);
console.log("PASS homepage: exact original named-removal experiment, live endpoint link counts, honest same-tick differences across 6 configurations");
