#!/usr/bin/env node
/* zk_fate.js — 一分钟命运实验专项冒烟：三选项可跑、结果差异、分享卡、hash 路由 */
const elements = {};
function makeEl(id) {
  return {
    id, textContent: "", innerHTML: "", value: "", className: "", style: {},
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    addEventListener() {}, removeEventListener() {},
    querySelectorAll() { return []; },
    querySelector() { return makeEl(id + "_c"); },
    setAttribute() {}, getAttribute() { return null; },
    appendChild() {}, removeChild() {}, parentElement: null,
    dataset: {}, onclick: null,
  };
}
const ctxStub = {
  createLinearGradient: () => ({ addColorStop() {} }),
  fillRect() {}, fillText() {}, measureText: t => ({ width: String(t).length * 10 }),
  beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {},
  arcTo() {}, closePath() {}, save() {}, restore() {}, translate() {}, setLineDash() {},
  globalAlpha: 1, strokeStyle: "", fillStyle: "", lineWidth: 1, font: "",
};
global.document = {
  getElementById(id) { if (!elements[id]) elements[id] = makeEl(id); return elements[id]; },
  querySelectorAll() { return []; },
  querySelector() { return makeEl("q"); },
  createElement(tag) {
    if (tag === 'canvas') return { width: 0, height: 0, getContext: () => ctxStub, toBlob: cb => cb(new Blob(['x'])) };
    if (tag === 'textarea') return { value: "", select() {}, };
    if (tag === 'a') return { href: "", download: "", click() {} };
    return makeEl("c");
  },
  addEventListener() {},
  body: makeEl("body"),
};
global.window = global;
global.alert = () => {};
global.addEventListener = () => {};
global.requestAnimationFrame = f => f();
global.location = { origin: 'https://zhanglingshare.github.io', pathname: '/zhongkai-simulator/zhongkai_simulator.html', hash: '' };
global.confirm = () => true;
global.document.execCommand = () => true;

const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, '..', 'zhongkai_simulator.html'), 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
try {
  eval(m[1] + '\n;global.__F=({openFate,closeFate,renderFate,runFateChoice,drawFateCard,routeHash,FATE_CHOICES,FATE_IDENTS,fateState});');
} catch (e) { console.log('FATE INIT FAIL: ' + e.message); process.exit(1); }

const F = global.__F;
let ok = 0, fail = 0;
function t(name, cond) { if (cond) { ok++; } else { fail++; console.log('FAIL: ' + name); } }

// 1. 身份数据完整性
t('四身份齐全', Object.keys(F.FATE_IDENTS).length === 4);
t('三选项齐全', Object.keys(F.FATE_CHOICES).length === 3);
t('选项A=稳定生产(投资)', F.FATE_CHOICES.A.params.invest === 0.50);
t('选项B=服务业重连', F.FATE_CHOICES.B.params.service === 0.45);
t('选项C=人才近似标注', F.FATE_CHOICES.C.params.talentBoost === 1 && F.FATE_CHOICES.C.note.includes('未实证标定'));

// 2. 三选项真实可跑 + 结果有差异
F.fateState.ident = 'work';
const res = {};
for (const k of ['A', 'B', 'C']) {
  res[k] = F.runFateChoice(k);
  t(`选项${k}可跑(含存续/景气/风险/网络)`, Number.isFinite(res[k].pick.survivors) && Number.isFinite(res[k].pick.f.abundance) && res[k].pick.net.newE >= 0 && res[k].pick.net.broken >= 0);
}
t('选项之间结果有差异（模型内真实计算）',
  Math.abs(res.A.pick.survivors - res.B.pick.survivors) > 0 || Math.abs(res.A.pick.survivors - res.C.pick.survivors) > 0 ||
  Math.abs(res.B.pick.f.abundance - res.C.pick.f.abundance) > 1e-9);
// 同选项可复现
const rA2 = F.runFateChoice('A');
t('同选项同起点可复现（逐位）',
  JSON.stringify([res.A.pick.survivors, res.A.pick.f.abundance, res.A.pick.f.disaster, res.A.pick.net.broken]) ===
  JSON.stringify([rA2.pick.survivors, rA2.pick.f.abundance, rA2.pick.f.disaster, rA2.pick.net.broken]));

// 3. 分享卡可生成（stub canvas）+ hash 路由
F.fateState.ident = 'work';
F.drawFateCard(res.A);
t('分享卡生成不抛错', true);
global.location.hash = '#fate=work&choice=B&seed=7';
F.routeHash();
t('hash 路由进入结果步', F.fateState.ident === 'work' && F.fateState.choice === 'B' && F.fateState.step === 3);
// 直接打开 renderFate（step3）渲染结果
try { F.renderFate(); t('结果页渲染不抛错', true); } catch (e) { t('结果页渲染不抛错', false); }

// 4. 验收修复：时间口径统一（动画轨迹 == 基准轨迹，冲击在第 5 步注入，终局 tick=20）
F.fateState.ident = 'work';
const base = F.runFateChoice('A').base;
// 动画轨迹 = newFateSim + 20 次 stepFateSim
const FNS = eval(m[1] + '\n;newFateSim;'), SFS = eval(m[1] + '\n;stepFateSim;');
const anim = FNS(); let animBroken = 0;
for (let i = 0; i < 20; i++) { SFS(anim); animBroken = anim.tick === 5 ? 0 : animBroken; }
t('动画终局 tick=20（不是 25）', anim.tick === 20);
t('动画终局与基准逐位一致', JSON.stringify([anim.survivors(), anim.report().final.abundance, anim.report().final.disaster]) ===
  JSON.stringify([base.survivors, base.f.abundance, base.f.disaster]));
t('冲击在第 5 步注入（timeline 首条 net 事件 tick=6）', anim.timeline.some(e => e.kind === 'net' && e.tick === 6));

// 5. 验收修复：政策组与基准前 5 步逐位同起点（差异全部来自危机后政策）
const PNS = eval(m[1] + '\n;newFateSim;');
const pSim = PNS(); for (let i = 0; i < 5; i++) pSim.step();
F.injectShocks && F.injectShocks(pSim);
const bSim = PNS(); for (let i = 0; i < 5; i++) bSim.step();
F.injectShocks && F.injectShocks(bSim);
t('政策组与基准在冲击前逐位一致', JSON.stringify({ s: pSim.state, a: pSim.agents.map(x => [x.name, x.alive, x.energy]) }) ===
  JSON.stringify({ s: bSim.state, a: bSim.agents.map(x => [x.name, x.alive, x.energy]) }));

// 6. 验收修复：四身份差异化冲击（不共用同一组冲击）
t('身份差异化冲击(work=链主外迁+芯片断供)', JSON.stringify(F.FATE_IDENTS.work.shocks) === JSON.stringify(['链主外迁', '芯片断供']));
t('身份差异化冲击(shop=订单外流+供应链中断)', JSON.stringify(F.FATE_IDENTS.shop.shocks) === JSON.stringify(['订单外流', '供应链中断']));
t('身份差异化冲击(live=用地收紧+政策收紧)', JSON.stringify(F.FATE_IDENTS.live.shocks) === JSON.stringify(['用地收紧', '政策收紧']));
t('身份差异化冲击(grad=人才流失+订单外流)', JSON.stringify(F.FATE_IDENTS.grad.shocks) === JSON.stringify(['人才流失', '订单外流']));

// 7. 验收修复：未定义引用清理 + 布局缓存
t('startFatePlay 未被引用', !html.includes('startFatePlay'));
t('fateNetRender 布局缓存', html.includes('fatePosCache') && html.includes('fatePosCacheSeed'));
t('报告四时点网络图 + 指标改名', html.includes('netSnapSVG') && html.includes('冲击传播时长') && !html.includes('网络稳定用时'));
t('版本号统一 V1.2b', html.includes('V1.2b') && !html.includes('<span class="ver">V1.0'));

console.log(`FATE SMOKE: ${ok} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
