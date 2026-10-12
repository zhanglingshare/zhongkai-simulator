#!/usr/bin/env node
/* dom_smoke.js — 最小 DOM stub 冒烟：初始化 + 全量渲染（含 V1.2 动态网络视图/报告章节）
   用法：node tests/dom_smoke.js */
const elements = {};
function makeEl(id) {
  return {
    id, textContent: "", innerHTML: "", value: "", className: "", style: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {},
    querySelectorAll() { return []; },
    querySelector() { return makeEl(id + "_c"); },
    setAttribute() {}, getAttribute() { return null; },
    appendChild() {}, removeChild() {}, parentElement: null,
    scrollIntoView() {},
  };
}
global.document = {
  getElementById(id) { if (!elements[id]) elements[id] = makeEl(id); return elements[id]; },
  querySelectorAll() { return []; },
  querySelector() { return makeEl("q"); },
  createElement() { return makeEl("c"); },
  addEventListener() {},
  body: makeEl("body"),
};
global.window = global;
global.alert = () => {};
global.addEventListener = () => {};
global.location = { origin: 'x', pathname: '/x.html', hash: '' };
global.requestAnimationFrame = (f) => f();
global.localStorage = { _d:{}, getItem(k){return this._d[k]??null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };

const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'zhongkai_simulator.html'), 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.log('no script'); process.exit(1); }
try {
  eval(m[1] + '\n;global.__Sim=Sim;global.__render=render;global.__renderNetwork=renderNetwork;global.__netViewSetter=(v)=>{netView=v;};global.__renderHot=renderHot;global.__renderTown=renderTown;global.__setHot=(d)=>{hotData=d;};global.__setLife=(d)=>{lifeData=d;};');
} catch (e) {
  console.log('UI INIT FAIL: ' + e.message);
  process.exit(1);
}
try {
  const Sim = global.__Sim, render = global.__render, renderNetwork = global.__renderNetwork;
  sim = new Sim(7, { dynamicNetwork: 1 });
  for (let t = 0; t < 20; t++) sim.step();
  render();                       // render → renderNetwork(含视图分支) + renderReport(含 netReportBlock)
  sim.seek(3, true); render();    // 只读回放
  sim.seek(8); render();          // 分支回放
  global.__netViewSetter('change'); renderNetwork();
  global.__netViewSetter('risk'); renderNetwork();
  global.__netViewSetter('structure'); renderNetwork();
  console.log('SMOKE: PASS (dynamic, render + 3 views + report OK)');
  sim = new Sim(7);
  for (let t = 0; t < 20; t++) sim.step();
  render();
  console.log('SMOKE: PASS (legacy render OK)');
  // 今日仲恺 / 仲恺各镇 接地气视图渲染冒烟
  global.__setHot({updated:'2026-10-12 22:50',count:2,frequency:'每日更新一次',note:'n',items:[
    {title:'上半年GDP增长5.8%：14宗产业项目开工、19宗竣工投产，今年新增公办学位2040个',cat:'industry',emoji:'📈',tier:'较高',srcLevel:'官方发布',summary:'精工精等14宗项目开工、19宗竣工投产',url:'http://x'},
    {title:'陈江夜市开了',cat:'food',emoji:'🍜',tier:'中',srcLevel:'媒体报道',summary:'陈江美丽示范街区夜市'}
  ]});
  global.__renderHot();
  global.__setLife({updated:'2026-10-12 22:50',freq:'每日更新一次',note:'n',sourceLabel:'s',pulse:['智谷彩街开街','碌鹅季'],towns:[
    {n:'陈江',tag:'商贸中心',level:'高',foods:['陈江砂锅粥'],plays:['陈江夜市'],why:'人口最密，夜市带火夜经济'},
    {n:'东江科技园',tag:'智造集群',level:'较高',plays:['园区绿道'],why:'高企集聚'}
  ]});
  global.__renderTown();
  console.log('SMOKE: PASS (hot/town life-view render OK)');
} catch (e) {
  console.log('SMOKE FAIL: ' + e.stack.split('\n').slice(0, 4).join('\n'));
  process.exit(1);
}
