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

/* ---------- 汇总 ---------- */
console.log(failed === 0
  ? '✓ verify_all PASS — 回归一致 + 结构完整'
  : `✗ verify_all FAIL — ${failed} 项未通过`);
process.exit(failed === 0 ? 0 : 1);
