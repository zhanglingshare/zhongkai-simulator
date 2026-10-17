const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const Entry=require("../visual-entry-core.js"),Holo=require("../holo-core.js");
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve("../portal-kernel.js"),"utf8"),ctx);
for(const size of [24,32,41]){
 const sim=new ctx.window.ZKSim(7,{n_agents:size,ticks:20});
 const source=JSON.stringify({agents:sim.agents,edges:sim.edges,state:sim.state});
 const graph=Holo.build(sim.agents,sim.edges),before=JSON.stringify(graph),plan=Entry.plan(graph.nodes);
 assert.equal(plan.members.size,size);
 assert.equal(plan.batches.reduce((n,g)=>n+g.count,0),size);
 assert.equal(Entry.status(plan,plan.duration,graph.edges).arrived,size);
 assert.equal(Entry.status(plan,plan.duration,graph.edges).linked,graph.edges.length);
 assert.equal(Entry.status(plan,plan.duration,graph.edges).done,true);
 let growing=0;
 for(let t=0;t<=plan.duration;t+=17){
   for(const e of graph.edges){
    const p=Entry.edge(plan,e.a,e.b,t);
    if(p>0){assert.equal(Entry.node(plan,e.a,t),1);assert.equal(Entry.node(plan,e.b,t),1);}
    if(p>0&&p<1)growing++;
   }
 }
 assert.ok(growing>0,"Edges visibly grow, rather than only fading in");
 assert.equal(Entry.edge(plan,"nonexistent",graph.nodes[0].name,plan.duration),0);
 assert.equal(JSON.stringify(graph),before,"Presentation must not move real graph coordinates");
 assert.equal(JSON.stringify({agents:sim.agents,edges:sim.edges,state:sim.state}),source,"Presentation must never alter the model");
}
console.log("PASS entrance: 24/32/41 real nodes, endpoints land before each edge grows, no model mutation");
