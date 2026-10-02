/* 仲恺版上帝视角压测：同世界同种子，双冲击（TCL华星外迁+芯片断供）对比四种政策场景
 * A=基线无冲击 / B=双冲击 / C=双冲击+补生产性服务业(service .45+补入集群) / D=双冲击+扭转投资(invest .55)
 * 受控实验：四场景共享同一批种子（baseSeed*700+i），世界构成逐局一致（C 额外补入=处理本身）。
 */
const fs=require('fs');
const HTML='/Users/pro/Doubao/chats/2026-10-01/new-chat-1/zhongkai_sim_v0.8.html';
const html=fs.readFileSync(HTML,'utf8');
const m=html.match(/\/\*KERNEL-BEGIN\*\/([\s\S]*?)\/\*KERNEL-END\*\//);
if(!m)throw new Error('KERNEL not found');
const K=new Function(m[1]+';return {Sim,mean,sd,quantile,clamp};')();
const {Sim,mean,sd,quantile}=K;

const SHOCKS=['TCL华星外迁','芯片断供'];
const TICKS=20, SHOCK_AT=5, N=120, BASE=7;

function runScenario(name,makeSim,shocks){
  const res={abundance:[],order:[],disaster:[],mood:[],survivors:[]};
  let killedTotal=0;
  for(let i=0;i<N;i++){
    const sim=makeSim(BASE*700+i);
    for(let t=0;t<TICKS;t++){
      if(t===SHOCK_AT&&shocks)shocks.forEach(txt=>{
        const r=sim.execNL(txt); if(r&&r.exec&&r.exec.killed)killedTotal+=r.exec.killed;
      });
      sim.step();
    }
    res.abundance.push(sim.state.abundance);res.order.push(sim.state.order);
    res.disaster.push(sim.state.disaster);res.mood.push(sim.state.mood);
    res.survivors.push(sim.survivors());
  }
  const stats={};
  Object.keys(res).forEach(k=>{stats[k]={mean:mean(res[k]),sd:sd(res[k]),p10:quantile(res[k],.1),p50:quantile(res[k],.5),p90:quantile(res[k],.9)};});
  return {name,stats,killedTotal};
}

const base=new Sim(7);
const A=runScenario('A 基线(无冲击)',seed=>new Sim(seed,Object.assign({},base.params)),null);
const B=runScenario('B 双冲击',seed=>new Sim(seed,Object.assign({},base.params)),SHOCKS);
const C=runScenario('C 双冲击+补生产性服务业',seed=>{
  const sim=new Sim(seed,Object.assign({},base.params,{service:.45}));
  sim.addMissing([2]); return sim;
},SHOCKS);
const D=runScenario('D 双冲击+扭转投资',seed=>new Sim(seed,Object.assign({},base.params,{invest:.55})),SHOCKS);

const fmt=x=>x.toFixed(3);
const line=s=>`${s.name.padEnd(20)} 景气 ${fmt(s.stats.abundance.mean)} 协同 ${fmt(s.stats.order.mean)} 风险 ${fmt(s.stats.disaster.mean)} 信心 ${fmt(s.stats.mood.mean)} 存续 ${fmt(s.stats.survivors.mean)} | 景气P10 ${fmt(s.stats.abundance.p10)} 风险P90 ${fmt(s.stats.disaster.p90)} 存续P10 ${fmt(s.stats.survivors.p10)}`;
console.log('== 四场景对比（各 '+N+' 局，tick5 注入冲击，受控同世界） ==');
[A,B,C,D].forEach(s=>console.log(line(s)));
console.log('\n== 双冲击连带退链合计（'+N+' 局）==');
console.log('B:',B.killedTotal,' C:',C.killedTotal,' D:',D.killedTotal);

const d=(a,b)=>fmt(a.stats.abundance.mean-b.stats.abundance.mean);
const dsu=(a,b)=>fmt(a.stats.survivors.mean-b.stats.survivors.mean);
const ddi=(a,b)=>fmt(a.stats.disaster.mean-b.stats.disaster.mean);
console.log('\n== 冲击破坏（B−A）==  景气'+d(B,A)+' 存续'+dsu(B,A)+' 风险'+ddi(B,A));
console.log('== 补服务业恢复（C−B）== 景气'+d(C,B)+' 存续'+dsu(C,B)+' 风险'+ddi(C,B));
console.log('== 补投资恢复（D−B）==  景气'+d(D,B)+' 存续'+dsu(D,B)+' 风险'+ddi(D,B));
console.log('== 服务 vs 投资（C−D）== 景气'+d(C,D)+' 存续'+dsu(C,D)+' 风险'+ddi(C,D));
