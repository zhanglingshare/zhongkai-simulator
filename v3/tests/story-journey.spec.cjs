const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),C=require('../story-lab-core.js'),H=require('../home-story-core.js');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('../portal-kernel.js'),'utf8'),ctx);const Sim=ctx.window.ZKSim;Sim.storyShocks=ctx.window.ZKRegisteredShocks;
const plain=v=>JSON.parse(JSON.stringify(v));
for(const pop of [24,32,41])for(const kind of ['exit','shock']){
 const s={kind,seed:7,pop,tick:6,...(kind==='exit'?{target:'TCL华星'}:{shock:'技术突破'})},r=C.run(Sim,s),a=new Sim(s.seed,{n_agents:pop,ticks:20}),b=new Sim(s.seed,{n_agents:pop,ticks:20});
 if(kind==='exit')b.removeAgent(s.target);else b.shock(s.shock);
 for(let t=0;t<=20;t++){assert.deepEqual(plain(r.A[t]),plain(a._snap()));assert.deepEqual(plain(r.B[t]),plain(b._snap()));if(t<20){a.step();b.step();}}
 assert.deepEqual(C.decode(Sim,encodeURIComponent(JSON.stringify(C.payload(s)))),s);
 const result=C.outcome(r);assert.equal(result.delta,b.agents.filter(n=>n.alive).length-a.agents.filter(n=>n.alive).length);
 assert.equal(result.choice,result.delta<0?'less':result.delta>0?'more':'same');
}
const s={kind:'exit',target:'TCL华星',seed:7,pop:41,tick:20},home=H.exitRun(Sim,7,41,'TCL华星');assert.deepEqual(plain(C.run(Sim,s)),plain(home),'Second page must continue the exact homepage experiment');
const values=Array.from({length:24},(_,i)=>C.outcome(C.run(Sim,{...s,seed:C.seedAt(s.seed,i)})).delta),summary=C.summarize(values);
assert.equal(summary.less+summary.same+summary.more,24);assert.equal(summary.min,Math.min(...values));assert.equal(summary.max,Math.max(...values));assert.equal(C.seedAt(2147483647,1),1);
for(const value of [{v:3,kind:'exit',target:'不存在',seed:7,pop:41,tick:6},{v:3,kind:'exit',target:'TCL华星',seed:-1,pop:41,tick:6},{v:2,shock:'编造冲击',seed:7,pop:41,tick:6},{v:2,shock:'技术突破',seed:7,pop:999,tick:6},{v:2,shock:'技术突破',seed:7,pop:41,tick:21}])assert.equal(C.decode(Sim,encodeURIComponent(JSON.stringify(value))),null);
assert.deepEqual(C.decode(Sim,encodeURIComponent(JSON.stringify({v:1,seed:29,shock:'技术突破'}))),{kind:'shock',seed:29,pop:24,tick:20,shock:'技术突破'});
console.log('PASS story journey: exact same homepage snapshots, named/generic experiments, strict shares and the same 24-seed original-model repetition');
