#!/usr/bin/env node
/* regress.js — 单局 seed7 20 步逐位回归（V1.0 基线）
   用法：node tests/regress.js */
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'zhongkai_simulator.html'), 'utf8');
const m = html.match(/\/\*KERNEL-BEGIN\*\/([\s\S]*?)\/\*KERNEL-END\*\//);
const K = new Function(m[1] + '\n;return {Sim};')();
const s = new K.Sim(7);
for (let t = 0; t < 20; t++) s.step();
const f = s.state;
const got = [f.abundance, f.order, f.disaster, f.mood, s.survivors()];
const exp = [0.2231894065500021, 0.6752224893592778, 0.24668851102781955, -0.12220604321350684, 0.5833333333333334];
let pass = true;
got.forEach((v, i) => { if (Math.abs(v - exp[i]) > 1e-12) { pass = false; console.log(`MISMATCH[${i}]: got ${v} exp ${exp[i]}`); } });
console.log(pass ? 'REG RESS: PASS 全部一致' : 'REG RESS: FAIL');
process.exit(pass ? 0 : 1);
