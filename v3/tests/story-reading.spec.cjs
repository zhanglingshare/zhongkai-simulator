const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),R=require('../story-reading-core.js'),C=require('../story-lab-core.js'),H=require('../home-story-core.js');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('../portal-kernel.js'),'utf8'),ctx);const Sim=ctx.window.ZKSim;Sim.storyShocks=ctx.window.ZKRegisteredShocks;
for(const pop of [24,32,41])for(const seed of [7,29])for(const scenario of ['exit',...Sim.storyShocks]){
 const s={kind:scenario==='exit'?'exit':'shock',target:'TCL华星',shock:scenario,seed,pop,tick:6},run=C.run(Sim,s),before=JSON.stringify(run);
 for(const t of [0,run.keyTick,20]){const info=H.frameInfo(run,t),d=info.b.alive-info.a.alive;assert.equal(d,info.returns.length-info.exits.length);const text=R.explain(info,t);assert.ok(text.startsWith('第 '+t+' 步：'));if(d>0)assert.ok(text.includes('净多 '+d+' 个'));if(d<0)assert.ok(text.includes('净少 '+(-d)+' 个'));if(!d)assert.ok(text.includes('数量相同'));
  const q=R.question(s,run.edges,'<img src=x onerror=alert(1)>');assert.ok(!q.title.includes('<img'));if(s.kind==='exit'){assert.ok(run.edges.some(e=>e.a===s.target&&e.b===q.role||e.b===s.target&&e.a===q.role));assert.equal(R.question(s,run.edges,q.role).role,q.role);}else assert.equal(q.role,null);
 }
 assert.equal(JSON.stringify(run),before,'Reading and question selection never mutate snapshots or edges');
}
console.log('PASS reading: exact counts/signs, valid model-neighbor questions, all registered shocks and no model mutations across 90 experiments');
