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

const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'zhongkai_simulator.html'), 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.log('no script'); process.exit(1); }
try {
  eval(m[1] + '\n;global.__Sim=Sim;global.__render=render;global.__renderNetwork=renderNetwork;global.__netViewSetter=(v)=>{netView=v;};');
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
} catch (e) {
  console.log('SMOKE FAIL: ' + e.stack.split('\n').slice(0, 4).join('\n'));
  process.exit(1);
}
