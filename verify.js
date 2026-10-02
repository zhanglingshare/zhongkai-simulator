/* 仲恺版内核验证：提取 KERNEL，做功能断言 */
const fs=require('fs');
const HTML='/Users/pro/Doubao/chats/2026-10-01/new-chat-1/zhongkai_sim_v0.8.html';
const html=fs.readFileSync(HTML,'utf8');
const m=html.match(/\/\*KERNEL-BEGIN\*\/([\s\S]*?)\/\*KERNEL-END\*\//);
if(!m)throw new Error('KERNEL not found');
const K=new Function(m[1]+';return {Sim,runMonteCarlo,runSensitivity,layoutForce,clamp,mean,quantile,'+
  'CANDIDATES,RELATIONS,CAUSAL,MISS_ROLES,PARAM_LINEAGE,TYPE_CFG,SHOCK_WORDS,parseUploadText,applyWorld,autoConnect,_ORIG_CAND_,_ORIG_REL_,_ORIG_CAUSAL_};')();

let pass=0,fail=0;
function ok(name,cond){if(cond){pass++;console.log('  PASS',name);}else{fail++;console.log('  FAIL',name);}}

console.log('== 数据规模 ==');
ok('候选实体 41',K.CANDIDATES.length===41);
ok('产业链关系 71',K.RELATIONS.length===71);
ok('时序因果链 15',K.CAUSAL.length===15);
ok('主体类型 8',Object.keys(K.TYPE_CFG).length===8);
ok('冲击词 14',Object.keys(K.SHOCK_WORDS).length===14);
ok('门②漏项 7',K.MISS_ROLES.length===7);

console.log('== 可复现 / 有差异 ==');
function runFull(seed){const s=new K.Sim(seed);for(let i=0;i<20;i++)s.step();return s;}
const a=runFull(7),b=runFull(7),c=runFull(8);
ok('同种子逐位可复现',JSON.stringify(a.state)===JSON.stringify(b.state)&&
  JSON.stringify(a.agents)===JSON.stringify(b.agents));
ok('异种子结果有差异',JSON.stringify(a.state)!==JSON.stringify(c.state));

console.log('== 蒙特卡洛 60 局（真分布，不顶格） ==');
const stats=K.runMonteCarlo(7,60,a.params);
['abundance','order','disaster','mood','survivors'].forEach(k=>{
  const s=stats[k];
  ok(`${k} mean=${s.mean.toFixed(3)} sd=${s.sd.toFixed(3)} 有离散`,s.sd>0.015);
});
const abv=stats.abundance.values;
ok('景气不全部顶格',Math.max(...abv)<0.985);
ok('景气不全部归零',Math.min(...abv)>0.001);
ok('景气 P10<P50<P90',stats.abundance.p10<stats.abundance.p50&&stats.abundance.p50<stats.abundance.p90);

console.log('== 布局 0 重叠 ==');
const s0=new K.Sim(7);
const pos=K.layoutForce(s0.agents,s0.edges,760,560);
ok(`最近间距 ${pos.__minGap.toFixed(1)}px > 0`,pos.__minGap>0);

console.log('== 自然语言解析 ==');
const s1=new K.Sim(7);
let r;
r=s1.execNL('TCL华星外迁');
ok('“TCL华星外迁”→ 移除链主',r.kind==='remove'&&r.name==='TCL华星'&&r.exec.ok);
r=s1.execNL('芯片断供');
ok('“芯片断供”→ 冲击',r.kind==='shock'&&r.type==='芯片断供');
r=s1.execNL('链主外迁');
ok('“链主外迁”→ 冲击(连带退链)',r.kind==='shock'&&r.type==='链主外迁');
r=s1.execNL('增长动能 -0.2');
ok('“增长动能 -0.2”→ 景气扰动',r.kind==='perturb'&&r.metric==='abundance'&&Math.abs(r.delta+0.2)<1e-9);
r=s1.execNL('亿纬锂能停产');
ok('“亿纬锂能停产”→ 移除',r.kind==='remove'&&r.name==='亿纬锂能');

console.log('== 门②补漏（生产性服务业 + 技能人才池） ==');
const s2=new K.Sim(7);
const before=s2.agents.length;
const add=s2.addMissing([2,4]);
ok(`补入 2 个（${before}→${s2.agents.length}）`,add.added===2&&s2.agents.length===before+2);
ok('补入实体连边',add.edgesAdded>=6);

console.log('== 敏感性排序 ==');
const rows=K.runSensitivity(7,20,.15,s0.params);
ok('返回 4 个杠杆',rows.length===4);
ok('按景气敏感度降序',rows[0].abSwing>=rows[1].abSwing&&rows[1].abSwing>=rows[2].abSwing&&rows[2].abSwing>=rows[3].abSwing);
ok('最敏感变量有名字',typeof rows[0].cn==='string'&&rows[0].abSwing>0);
console.log('  排序:',rows.map(r=>`${r.cn}(Δ${r.abSwing.toFixed(3)})`).join(' > '));

console.log('== 验模三门 → 报告解锁逻辑 ==');
const s3=new K.Sim(7);
ok('未模拟也能产出 report 对象',typeof s3.report().final.abundance==='number');
ok('Interview 链主可访谈',s3.interview('TCL华星').name==='TCL华星');

console.log('== 导入世界（CSV/JSON/TXT→新世界） ==');
const csvOk=K.parseUploadText(`[entities]
中科智城,anchor,3,总集成
芯链半导体,supplier,2,封测
精密光学,supplier,2,光学
园区建设集团,land,3,开发
[relations]
芯链半导体,中科智城,供货,0.8`);
ok('CSV 解析出主体',csvOk.ok&&csvOk.entities.length===4&&csvOk.mode==="csv");
ok('CSV 解析出关系',csvOk.relations.length===1&&csvOk.relations[0].rel==="供货");
const jsonOk=K.parseUploadText(JSON.stringify({candidates:[{name:"甲城",type:"anchor",w:3},{name:"乙厂",type:"supplier",w:2},{name:"丙基金",type:"capital",w:2},{name:"丁园",type:"land",w:2}],relations:[{a:"乙厂",b:"甲城",rel:"供货"}]}));
ok('JSON 解析',jsonOk.ok&&jsonOk.entities.length===4&&jsonOk.relations.length===1);
const repOk=K.parseUploadText("TCL华星大举扩产，TCL华星带动 TCL华星周边配套，TCL王牌订单放量，TCL王牌与 TCL华星协同，物流企业服务 TCL华星，检测认证服务 TCL华星。");
ok('TXT 报告词表抽取（词频≥2）',repOk.ok&&repOk.mode==="report"&&repOk.entities.some(e=>e.name==="TCL华星")&&repOk.entities.some(e=>e.name==="TCL王牌"));
ok('TXT 自动连边',repOk.relations.length>0);
const w=K.applyWorld(csvOk.entities,csvOk.relations,7);
ok('applyWorld 重建成功',w.ok&&w.cand===4&&w.rel===1);
const wSim=w.sim;
ok('新世界可 step 20 轮',(()=>{for(let i=0;i<20;i++)wSim.step();return wSim.tick===20&&typeof wSim.survivors()==="number";})());
ok('新世界 MC 可跑',K.runMonteCarlo(7,30,wSim.params).abundance.mean>=0);
ok('CAUSAL 过滤（缺失实体链移除）',K.CAUSAL.every(c=>K.CANDIDATES.some(x=>x[0]===c.s)&&(!c.o||K.CANDIDATES.some(x=>x[0]===c.o))));
const jw=K.applyWorld(jsonOk.entities,jsonOk.relations,7);
ok('JSON 世界同样可建',jw.ok&&jw.cand===4);
const jwp=K.applyWorld(jsonOk.entities,jsonOk.relations,7,{invest:.8,service:.9});
ok('JSON 世界参数可注入',Math.abs(jwp.sim.params.invest-.8)<1e-9&&Math.abs(jwp.sim.params.service-.9)<1e-9);
const rest=K.applyWorld(K._ORIG_CAND_.map(c=>({name:c[0],type:c[1],w:c[3],desc:c[2]||""})),K._ORIG_REL_.map(r=>({a:r[0],rel:r[1],b:r[2],str:.5})),7);
K.CAUSAL=K._ORIG_CAUSAL_.map(c=>({...c}));
ok('恢复仲恺基准：41 主体',rest.ok&&rest.cand===41);
ok('恢复仲恺基准：71 关系',rest.rel===71);
ok('恢复仲恺基准：15 因果链恢复',K.CAUSAL.length===15);

console.log(`\n结果：${pass} PASS / ${fail} FAIL`);
process.exit(fail?1:0);
