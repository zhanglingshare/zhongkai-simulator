'use strict';
/* New visual-first P0 contract: no hardcoded scenario results, original Sim A/B only. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('puzzles.html'),css=read('puzzles.css'),js=read('puzzles.js');
new vm.Script(js,{filename:'puzzles.js'});
function has(id){assert.ok(html.includes('id="'+id+'"'),'missing visual control: '+id);}
for(const id of ['scene-data','scene-network','scene-inflow','data-interpret','impact-canvas','impact-labels','impact-tip','run-exit','target','compare-hold','toggle-play','sim-time','gate-number','gate-state','gate-progress-bar','evidence-cards','lab-next'])has(id);
assert.equal((html.match(/class="scene /g)||[]).length,3,'three cinematic acts');
assert.equal((html.match(/data-evidence="/g)||[]).length,5,'five explorable evidence dimensions');
assert.ok(html.includes('portal-kernel.js')&&html.includes('story-render.js')&&html.includes('home-story-core.js'),'original model and existing renderer must be loaded');
assert.ok(js.includes('H.exitRun(Sim,7,41,target,20)'),'network animation must use actual A/B model run');
assert.ok(js.includes('H.frameInfo(experiment,tick)'),'network readout must use real same-tick snapshots');
assert.ok(js.includes('view.setFrame(snapshot.agents'),'network visuals must change with model');
assert.ok(js.includes('view.setStoryFocus(peek?[]:info.changes)'),'network must animate role-level differences');
assert.ok(js.includes('experiment.A[tick]')&&js.includes('experiment.B[tick]'),'hold compare needs both paths at same timestep');
assert.ok(js.includes("new URL('story-lab.html'"),'professional lab should inherit exact scenario');
assert.ok(js.includes('不代表现实资料已经审核通过'),'evidence gate must not imply verified information');
assert.ok(html.includes('observations.html')&&html.includes('inflow.html#zhongkai-demo'));
assert.ok(css.includes('max-width:700px')&&css.includes('max-width:390px'),'responsive mobile design required');
assert.ok(css.includes('prefers-reduced-motion:reduce'),'reduced motion required');
assert.equal((html.match(/<section(?:\s|>)/g)||[]).length,(html.match(/<\/section>/g)||[]).length,'section tags balanced');

// Real model invariants: no constants inserted as fictional scenario outcomes.
const context=vm.createContext({window:{}});
vm.runInContext(read('portal-kernel.js'),context,{filename:'portal-kernel.js'});
vm.runInContext(read('home-story-core.js'),context,{filename:'home-story-core.js'});
const Sim=context.window.ZKSim,H=context.window.ZKHomeStory;
assert.ok(typeof Sim==='function'&&typeof H.exitRun==='function');
const initial=new Sim(7,{n_agents:41,ticks:20});
const target=H.hero(initial.agents);
assert.ok(target&&target.type==='anchor');
const run=H.exitRun(Sim,7,41,target.name,20);
assert.equal(run.A.length,21);
assert.equal(run.B.length,21);
assert.ok(run.edges.length>0);
const a=H.frameInfo(run,0),b=H.frameInfo(run,20);
assert.equal(a.a.total,41);assert.equal(b.b.total,41);
assert.ok(Number.isFinite(b.b.alive-b.a.alive));
assert.ok(run.keyTick>=0&&run.keyTick<=20);
assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());
console.log('puzzles visual-first structural + original-model checks: PASS');
