#!/usr/bin/env node
/**
 * verify_all.js — zhongkai-simulator V1.0 全量验证
 *
 * 1) 从 zhongkai_simulator.html 提取 KERNEL-BEGIN … KERNEL-END 之间的纯函数内核（不依赖 DOM）
 * 2) 同种子回归：单局 seed7 / 蒙特卡洛 400 局五指标 / 敏感性四杠杆 —— 与 v0.8.1 基线逐位一致
 * 3) 可复现性：力导向布局同种子输出一致、世界导入三格式解析
 * 4) 结构断言：V1.0 新界面（双模式导航 / 四步实验准备 / 抽屉 / 网络工具）关键节点与术语迁移
 *
 * 用法：node tests/verify_all.js
 * 退出码：0 = 全部通过；1 = 有失败项
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'zhongkai_simulator.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

let failed = 0;
const ok = (cond, label) => {
  if (!cond) { console.log('  ✗ ' + label); failed++; }
};
const close = (a, b, tol, label) => {
  if (Math.abs(a - b) > tol) { console.log(`  ✗ ${label}: ${a} ≠ ${b} (±${tol})`); failed++; }
};

console.log('zhongkai-simulator V1.0 verify_all');

/* ---------- 1. 提取内核 ---------- */
const m = html.match(/\/\*KERNEL-BEGIN\*\/([\s\S]*?)\/\*KERNEL-END\*\//);
ok(!!m, 'KERNEL 标记存在（/*KERNEL-BEGIN*/ … /*KERNEL-END*/）');
if (!m) process.exit(1);

const tmp = path.join(os.tmpdir(), 'zk_kernel_verify.js');
fs.writeFileSync(tmp, m[1] + '\n;module.exports={Sim,runMonteCarlo,runSensitivity,layoutForce,parseUploadText,autoConnect,applyWorld,CANDIDATES,RELATIONS,CAUSAL,PARAM_LINEAGE};');
const K = require(tmp);
const SIM_AGENTS = K.CANDIDATES.length;
const SIM_RELS = K.RELATIONS.length;
const SIM_CAUSAL = K.CAUSAL.length;
ok(SIM_AGENTS === 41, `数据规模：41 候选主体（实际 ${SIM_AGENTS}）`);
ok(SIM_RELS === 71, `数据规模：71 基础关系（实际 ${SIM_RELS}）`);
ok(SIM_CAUSAL === 15, `数据规模：15 时序因果链（实际 ${SIM_CAUSAL}）`);

/* ---------- 2. 回归：单局 seed7 ---------- */
console.log('· 回归基线（v0.8.1 → V1.0 同内核，须逐位一致）');
const sim = new K.Sim(7);
for (let t = 0; t < 20; t++) sim.step();
close(sim.state.abundance, 0.2231894065500021, 1e-12, '单局 seed7 景气');
close(sim.state.order, 0.6752224893592778, 1e-12, '单局 seed7 协同');
close(sim.state.disaster, 0.24668851102781955, 1e-12, '单局 seed7 风险');
close(sim.state.mood, -0.12220604321350684, 1e-12, '单局 seed7 信心');
close(sim.survivors(), 0.5833333333333334, 1e-12, '单局 seed7 存续');

/* ---------- 2b. 回归：蒙特卡洛 400 局 ---------- */
const stats = K.runMonteCarlo(7, 400, sim.params);
const expect = {
  abundance: [0.5367, 0.2288, 0.1920, 0.5760, 0.8647],
  order: [0.7824, 0.0882, 0.6305, 0.8253, 0.8474],
  disaster: [0.1087, 0.1361, 0.0180, 0.0320, 0.3562],
  mood: [0.2774, 0.2957, -0.2310, 0.4085, 0.5642],
  survivors: [0.8853, 0.1737, 0.5833, 1.0000, 1.0000],
};
['abundance', 'order', 'disaster', 'mood', 'survivors'].forEach((k) => {
  const s = stats[k], e = expect[k];
  ['mean', 'sd', 'p10', 'p50', 'p90'].forEach((f, i) =>
    close(s[f], e[i], 1e-4, `MC400 ${k}.${f}`));
});

/* ---------- 2c. 回归：敏感性四杠杆（40 局 ±0.15，页面默认档） ---------- */
const rows = K.runSensitivity(7, 40, 0.15, sim.params);
const expSens = { invest: 0.1145, service: 0.1077, land: 0.0758, external: 0.0208 };
rows.forEach((r) => close(r.abSwing, expSens[r.key], 1e-4, `SENS ${r.cn}`));
ok(rows.length === 4, '敏感性返回 4 个杠杆');
const sorted = rows.every((r, i) => i === 0 || rows[i - 1].abSwing >= r.abSwing);
ok(sorted, '敏感性按景气响应降序排列');

/* ---------- 3. 可复现性 ---------- */
const p1 = K.layoutForce(sim.agents, sim.edges, 760, 560);
const p2 = K.layoutForce(sim.agents, sim.edges, 760, 560);
close(p1.__minGap, p2.__minGap, 1e-9, '力导向布局同种子可复现');
ok(p1.__minGap > 0, `布局 0 重叠（最近间距 ${p1.__minGap.toFixed(1)}px）`);
const rCsv = K.parseUploadText('[entities]\n甲,anchor,3\n乙,supplier,2\n[relations]\n乙,甲,供货,0.8\n', 'w.csv');
ok(rCsv.ok && rCsv.mode === 'csv' && rCsv.entities.length === 2, 'CSV 解析');
const rJson = K.parseUploadText(JSON.stringify({ candidates: [{ name: '甲', type: 'anchor', w: 3 }], relations: [] }), 'w.json');
ok(rJson.ok && rJson.mode === 'json', 'JSON 解析');
const rTxt = K.parseUploadText('TCL华星 扩产 TCL华星 稳链 TCL华星 出货', 'r.txt');
ok(rTxt.ok && rTxt.mode === 'report' && rTxt.entities.length >= 1, 'TXT 词表抽取');

/* ---------- 4. V1.0 界面结构断言 ---------- */
console.log('· V1.0 界面结构');
const ids = [
  'view-home', 'view-run', 'view-mc', 'view-sens', 'view-iv', 'view-ledger', 'view-data', 'view-world',
  'prep-modal', 'prep-body', 'prep-next', 'prep-lock', 'st-mode', 'st-phase', 'st-runid',
  'netsvg', 'net-search', 'net-type', 'net-layer', 'net-full', 'drawer', 'drawer-body',
  'btn-prepare', 'btn-exit-formal', 'entry-explore', 'entry-formal', 'btn-export-manifest',
  'iv-neighbors', 'ledger-mode-tag', 'param-table', 'missroles', 'track', 'tl-log',
];
ids.forEach((id) => ok(html.includes('id="' + id + '"'), `关键节点存在：${id}`));
ok(html.includes('experimentState') && html.includes('canExecute'), '统一状态控制器（experimentState / canExecute）');
ok(html.includes('prepStep1HTML') && html.includes('prepStep4HTML'), '四步实验准备向导');
ok(html.includes('openDrawer'), '主体抽屉');
ok(html.includes('netSearch') && html.includes('netLayer'), '网络筛选（仅影响显示，不参与计算）');

/* 术语迁移：旧称只应出现在「术语对照表」与帮助语境；KERNEL 区历史注释除外 */
const uiOnly = html.replace(/\/\*KERNEL-BEGIN\*\/[\s\S]*?\/\*KERNEL-END\*\//, '');
const cntFate = (uiOnly.match(/命运重跑机器/g) || []).length;
const cntGates = (uiOnly.match(/验模三门/g) || []).length;
const cntGod = (uiOnly.match(/上帝视角/g) || []).length;
ok(cntFate <= 2, `「命运重跑机器」仅限帮助/术语对照（UI 区 ${cntFate} 次）`);
ok(cntGates <= 2, `「验模三门」仅限帮助/术语对照（UI 区 ${cntGates} 次）`);
ok(cntGod <= 2, `「上帝视角」仅限帮助/术语对照（UI 区 ${cntGod} 次）`);
ok(html.includes('产业协同仿真实验室'), '新标题「产业协同仿真实验室」');

/* ---------- 5. 人话呈现层（V1.1）断言 ---------- */
console.log('· 人话呈现层（冲击依据卡 / 一句话结论 / 术语人话化）');
const SHOCK_BASIS_BLOCK = (html.match(/const SHOCK_BASIS=\{([\s\S]*?)\n\};/) || [])[1] || '';
const basisTypes = [...SHOCK_BASIS_BLOCK.matchAll(/"([^"]+)":\{lv:"(official|media|estimate|hypo)",note:"([^"]+)",src:"([^"]+)"\}/g)].map((mm) => mm[1]);
ok(basisTypes.length === 14, `SHOCK_BASIS 覆盖全部冲击（实际 ${basisTypes.length} 条）`);
ok(['链主外迁', '芯片断供', '订单外流', '产能过剩', '政策收紧', '用地收紧', '限电', '融资难', '关税摩擦', '供应链中断', '人才流失', '订单爆发', '政策利好', '技术突破'].every((w) => basisTypes.includes(w)), 'SHOCK_BASIS 包含 14 个冲击名');
ok(SHOCK_BASIS_BLOCK.length > 0 && !/蒙特卡洛|敏感性/.test(SHOCK_BASIS_BLOCK), '依据卡文案不出现算法术语');
ok(html.includes('id="shock-basis"') && html.includes('renderShockBasis'), '冲击依据卡渲染（注入前显示）');
ok(html.includes('id="mc-story"') && html.includes('function mcPlain'), '批量重跑人话总结（mcPlain）');
ok(html.includes('function plainConclusion'), '报告一句话结论（plainConclusion）');
ok(html.includes('有公开依据，可回查') && html.includes('无现实苗头，仅作压力测试'), '冲击区分「有依据 / 纯假设」两类');
ok(html.includes('依据 · '), '依据卡带人话来源档位（官方统计/公开报道/合理估计/纯假设）');
ok(uiOnly.includes('批量重跑') && uiOnly.includes('变量影响'), '导航人话化：批量重跑 / 变量影响');
ok(uiOnly.includes('世界起点'), '顶栏人话化：Seed → 世界起点');
/* 裸算法术语只允许出现在「术语对照表」（帮助语境），主操作界面不可见 */
const uiVisible = uiOnly
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');
const uiTech = ['蒙特卡洛', '敏感性分析', '随机种子'].map((w) => [w, (uiVisible.match(new RegExp(w, 'g')) || []).length]);
uiTech.forEach(([w, n]) => ok(n <= 1, `裸算法术语「${w}」仅限术语对照表（可见 ${n} 处）`));

/* ---------- 6. 动态自适应产业网络（V1.2 · P0：状态/传播修正/快照） ---------- */
console.log('· 动态自适应产业网络（P0：动态关系状态 / 传播修正 / 网络快照）');
const dsim = new K.Sim(7, { dynamicNetwork: 1 });
ok(dsim.activeEdges.length === dsim.edges.length, `动态模式初始化：activeEdges 与事实边一一对应（${dsim.activeEdges.length}）`);
ok(dsim.activeEdges.every((e) => e.status === 'active' && e.origin && e.strength > 0 && e.createdTick === 0 && e.endedTick === null),
  '动态边带完整字段（status/origin/strength/createdTick/endedTick）');
ok(dsim.activeEdges.filter((e) => e.origin === 'observed').length > 0, '初始关系 origin=observed（事实层）');
dsim.step();
const s1 = dsim.snapshots[dsim.snapshots.length - 1];
ok(Array.isArray(s1.edges) && Array.isArray(s1.activeEdges), 'step 后快照包含 edges 与 activeEdges');

/* 主体退出 → 关联经营关系失效，且不再作为传播中间节点 */
const victim = dsim.agents.find((a) => a.alive && dsim.activeEdges.some((e) => e.a === a.name || e.b === a.name));
const victimName = victim.name;
const victimEdges = dsim.activeEdges.filter((e) => e.a === victimName || e.b === victimName);
dsim.removeAgent(victimName);
ok(victimEdges.length > 0 && dsim.activeEdges.filter((e) => (e.a === victimName || e.b === victimName) && e.status === 'broken').length === victimEdges.length,
  '主体退出后其全部活跃经营关系标记失效');
ok(dsim.activeEdges.some((e) => (e.a === victimName || e.b === victimName) && e.endedTick === dsim.tick), '失效关系记录 endedTick');
ok(dsim._neighbors(victimName).length === 0, '死亡主体不再被 _neighbors 返回（传播修正）');
ok(dsim.timeline.some((x) => x.kind === 'net'), '失效关系写入事件记录');

/* legacy 对照：V1.0 行为原样保留（不过滤） */
const lsim = new K.Sim(7);
const lv = lsim.agents.find((a) => a.alive);
lsim.removeAgent(lv.name);
ok(lsim._neighbors(lv.name).length > 0, 'legacy 模式 _neighbors 保留 V1.0 行为（含已退出主体）');

/* 同种子动态演化可复现 */
const run6 = (e) => { const s = new K.Sim(7, { dynamicNetwork: 1 }); for (let t = 0; t < 6; t++) s.step(); return s; };
const dA = run6(), dB = run6();
ok(JSON.stringify(dA.activeEdges.map((e) => [e.a, e.b, e.status, e.endedTick])) === JSON.stringify(dB.activeEdges.map((e) => [e.a, e.b, e.status, e.endedTick])),
  '同种子动态网络演化可复现（6 步边状态一致）');
ok(JSON.stringify(dA.snapshots.map((x) => x.activeEdges.length)) === JSON.stringify(dB.snapshots.map((x) => x.activeEdges.length)), '同种子快照序列一致');

/* seek 只读回放 vs 分支语义 */
const d3 = new K.Sim(7, { dynamicNetwork: 1 });
for (let t = 0; t < 10; t++) d3.step();
const beforeLen = d3.snapshots.length;
d3.seek(3, true);
ok(d3.snapshots.length === beforeLen, '只读回放（readonly）不截断后续快照');
d3.seek(3);
ok(d3.snapshots.length === 4, '写模式回放截断后续快照（分支语义）');
const l2 = new K.Sim(7);
for (let t = 0; t < 5; t++) l2.step();
const lb = l2.snapshots.length;
l2.seek(2);
ok(l2.snapshots.length === 3 && lb === 6, 'legacy 模式 seek 默认仍截断（V1.0 语义保留）');

/* ---------- 7. 动态自适应产业网络（V1.2 · P1：自主建边/增强/断裂/重组） ---------- */
console.log('· 动态自适应产业网络（P1：自主建边 / 断供替代 / 可复现）');
const runNet = (seed, steps) => {
  const s = new K.Sim(seed, { dynamicNetwork: 1 });
  for (let t = 0; t < steps; t++) s.step();
  return s;
};
/* 独立随机数流：动态模式开启不影响 legacy 随机序列（P0 已证 legacy 逐位一致）；此处证 netRng 存在且可复现 */
const n1 = runNet(7, 20), n2 = runNet(7, 20);
ok(JSON.stringify(n1.activeEdges.map((e) => [e.a, e.b, e.status, e.strength, e.createdTick, e.endedTick])) ===
   JSON.stringify(n2.activeEdges.map((e) => [e.a, e.b, e.status, e.strength, e.createdTick, e.endedTick])),
  'P1 同种子 20 步关系演化序列逐位一致（建立/断裂/强度全复现）');
const simEdges = n1.activeEdges.filter((e) => e.origin === 'simulated');
ok(simEdges.length > 0, `动态模式产生了模拟新合作（${simEdges.length} 条）`);
ok(simEdges.every((e) => e.layer === 'dyn' && e.origin === 'simulated' && e.strength > 0 && e.strength <= 1 && e.createdTick > 0),
  '新合作边：layer=dyn、origin=simulated、强度 0–1（创建时 0.4–0.6，演化中可变）、记录建立时点');
ok(n1.edges.length === new K.Sim(7, { dynamicNetwork: 1 }).edges.length, '事实网络 this.edges 不被模拟新合作污染（长度不变）');
/* 断供替代/供应补强：事件记录包含新合作 */
ok(n1.timeline.some((x) => x.kind === 'net' && x.text.includes('新合作')), '事件记录包含新合作（断供替代或供应补强）');
/* 新增合作受资源上限约束：任一主体新增活跃合作数 ≤ 其断供损失数 + 1 */
const countAdded = {};
n1.timeline.filter((x) => x.kind === 'net' && x.text.includes('新合作')).forEach((x) => {
  const mm = x.text.match(/新合作：(.+?) ↔ /);
  if (mm) countAdded[mm[1]] = (countAdded[mm[1]] || 0) + 1;
});
ok(Object.values(countAdded).every((c) => c <= 2), '单个主体单步新增合作受上限约束（≤2，断供损失+1）');
/* legacy 模式：动态机制零副作用，不生成任何模拟新边 */
const legacySim = new K.Sim(7);
for (let t = 0; t < 20; t++) legacySim.step();
ok(legacySim.activeEdges.every((e) => e.origin !== 'simulated'), 'legacy 模式不生成模拟新合作');

/* ---------- 8. 动态自适应产业网络（V1.2 · P2：反馈耦合 / 主体进入） ---------- */
console.log('· 动态自适应产业网络（P2：网络反馈耦合 / 候选池主体进入）');
const runFull = (seed) => { const s = new K.Sim(seed, { dynamicNetwork: 1 }); for (let t = 0; t < 20; t++) s.step(); return s; };
const ent = runFull(99);
ok(ent.timeline.some((x) => x.kind === 'net' && x.text.includes('主体进入')), '景气好时候选池主体有条件进入（事件记录）');
ok(ent.agents.length > 24, `主体进入后本局主体数增加（${ent.agents.length} > 24）`);
const poolNames = new Set(K.CANDIDATES.map((c) => c[0]));
ok(ent.agents.every((a) => poolNames.has(a.name)), '主体进入只来自候选池，不虚构候选池外真实企业');
ok(ent.ledger.some((l) => l.type === 'net_consequences'), '网络反馈写入审计记录（net_consequences）');
const eA = runFull(99), eB = runFull(99);
ok(JSON.stringify(eA.agents.map((a) => [a.name, a.alive])) === JSON.stringify(eB.agents.map((a) => [a.name, a.alive])),
  'P2 同种子主体进入序列一致');
ok(JSON.stringify(eA.activeEdges.map((e) => [e.a, e.b, e.status, e.createdTick])) ===
   JSON.stringify(eB.activeEdges.map((e) => [e.a, e.b, e.status, e.createdTick])), 'P2 同种子关系演化一致（含进入连边）');
/* 网络改变模型：动态 vs legacy 指标不同（seed7 已证 36 条关系失效改变传播） */
const lg7 = new K.Sim(7);
for (let t = 0; t < 20; t++) lg7.step();
const dy7 = runFull(7);
ok(JSON.stringify([lg7.state.abundance, lg7.state.order, lg7.state.disaster, lg7.survivors()]) !==
   JSON.stringify([dy7.state.abundance, dy7.state.order, dy7.state.disaster, dy7.survivors()]),
  '动态模式与 legacy 指标不同（网络改变模型，模型改变网络）');
ok(dy7.activeEdges.filter((e) => e.status === 'active').length < lg7.edges.length,
  '萧条局动态网络萎缩（活跃关系数 < 初始事实边数）——允许网络变小，不强制恢复');

/* ---------- 9. 动态自适应产业网络（V1.2 · P3：可视化 / 报告章节） ---------- */
console.log('· 动态自适应产业网络（P3：视图 / 报告章节 / 快照对齐）');
ok(html.includes('id="net-view"') && html.includes('value="structure"') && html.includes('value="change"') && html.includes('value="risk"'),
  '推演页提供三种网络视图（结构 / 关系变化 / 风险传播）');
ok(html.includes('value="dyn"') && html.includes('模拟新合作'), '关系筛选含「模拟新合作」层');
ok(html.includes('function netStats') && html.includes('function netReportBlock'), '报告含网络统计与章节生成函数');
ok(html.includes('产业网络演化与冲击传播分析'), '报告章节《产业网络演化与冲击传播分析》');
ok(html.includes('供应替代率') && html.includes('最大连通分量') && html.includes('孤立主体数') && html.includes('冲击传播时长'),
  '报告指标齐全（活跃/有效/新建/失效/孤立/连通/替代率/冲击传播时长）');
ok(html.includes('四时点快照') && html.includes('关系变化记录') && html.includes('netSnapSVG') && html.includes('net-snaps'),
  '报告含四时点网络结构图与关系变化记录');
const snapSim = new K.Sim(7, { dynamicNetwork: 1 });
for (let t = 0; t < 20; t++) snapSim.step();
ok(snapSim.snapshots.every((sn, i) => sn.tick === i), `快照索引与 tick 对齐（${snapSim.snapshots.length} 条：t0 初始 + 20 步）`);

/* ---------- 10. 仲恺 2030 · 一分钟命运实验（V1.2b · 大众入口） ---------- */
console.log('· 大众入口（一分钟命运实验：身份 / 冲击 / 选择 / 结果 / 分享卡）');
ok(html.includes('仲恺 2030 · 未来实验') && html.includes('五年后的仲恺，你还会选择留在这里吗？'),
  '首页第一句从「2000 亿目标」改为个人问题');
ok(html.includes('data-ident="work"') && html.includes('data-ident="shop"') && html.includes('data-ident="live"') && html.includes('data-ident="grad"'),
  '四个生活身份入口（上班/开店/生活/毕业）');
ok(html.includes('id="fate-modal"') && html.includes('id="fate-svg"') && html.includes('id="fate-share-dl"'),
  '一分钟命运实验（冲击播放 / 决策 / 分享卡）结构完整');
ok(html.includes('FATE_CHOICES') && html.includes('invest:.50') && html.includes('service:.45') && html.includes('talentBoost'),
  '三决策选项映射到已有内核干预（投资/服务业/人才近似）');
ok(html.includes('尚未实证标定') && html.includes('不宣称三者现实等价') && html.includes('模型不计算房价'),
  '边界声明：未标定近似 / 不等价比较 / 房价未建模 均如实标注');
ok(html.includes('id="entry-explore"') && html.includes('id="entry-formal"'), '专业工作台入口保留（快速探索/正式研究）');
ok(html.includes('routeHash') && html.includes('#fate=') && html.includes('choice='), '可复现 hash 路由（同情景分享）');
ok(html.includes('fateMechanism') && html.includes('慢变量'), '结果解释含「慢变量/模型边界」诚实措辞');
ok(html.includes('shocks:["链主外迁","芯片断供"]') && html.includes('shocks:["订单外流","供应链中断"]') && html.includes('shocks:["用地收紧","政策收紧"]') && html.includes('shocks:["人才流失","订单外流"]'),
  '四身份差异化冲击（不共用同一组冲击）');
ok(!html.includes('startFatePlay'), '未定义引用 startFatePlay 已清理');
ok(html.includes('fatePosCache') && html.includes('fatePosCacheSeed'), 'fateNetRender 布局缓存（节点不跳动）');
ok(html.includes('stepFateSim') && html.includes('if(s.tick===5)injectShocks') && html.includes('while(baseSim.tick<5)') && html.includes('injectShocks(baseSim)') && html.includes('while(pickSim.tick<5)') && html.includes('injectShocks(pickSim)') && html.includes('Object.assign(pickSim.params'),
  '时间口径统一：动画与基准同一轨迹（前5步→第5步冲击→到20）；政策组前5步同起点、冲击后才生效');
ok(html.includes('仲恺 2030 · 未来实验') && html.includes('V1.2b'), '品牌与版本号统一（V1.2b）');

/* ---------- 汇总 ---------- */
console.log(failed === 0
  ? '✓ verify_all PASS — 回归一致 + 结构完整'
  : `✗ verify_all FAIL — ${failed} 项未通过`);
process.exit(failed === 0 ? 0 : 1);
