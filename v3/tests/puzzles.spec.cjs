'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const here = path.resolve(__dirname,'..');
const read = name => fs.readFileSync(path.join(here,name),'utf8');
const html = read('puzzles.html');
const js = read('puzzles.js');
const css = read('puzzles.css');
const home = read('index.html');
const story = read('story-lab.html');

new vm.Script(js,{filename:'puzzles.js'});
for(const id of ['puzzle-1','puzzle-2','puzzle-3']){
  assert.match(html,new RegExp('id="'+id+'"'));
}
assert.equal((html.match(/data-puzzle="/g)||[]).length,3,'three real chapters');
assert.equal((html.match(/data-choice="/g)||[]).length,9,'three choices per chapter');
assert.equal((html.match(/class="answer-panel" hidden/g)||[]).length,3,'no prefabricated revealed result');
for(const target of ['observations.html','story-lab.html','inflow.html#zhongkai-demo','trust.html']){
  assert.ok(html.includes('href="'+target+'"'),'missing real destination '+target);
}
assert.ok(home.includes('href="puzzles.html"'),'holographic homepage must offer a story route');
assert.ok(story.includes('puzzles.html#puzzle-3'),'network story must continue into next puzzle');
assert.match(html,/规上工业总产值增速/);
assert.match(html,/工业投资增速/);
assert.ok(css.includes('@media(max-width:540px)'),'mobile style required');
assert.ok(css.includes('prefers-reduced-motion'),'respect reduced motion');
assert.ok(!html.includes('model.js')&&!html.includes('portal-kernel.js'),'landing must not masquerade as model runner');
assert.ok(!js.includes('fetch(')&&!js.includes('localStorage'),'landing makes no hidden data calls or persistent tracking');

// DOM-free behavior contract: choice -> reveal -> progress -> changing choice clears stale reveal.
function mockButton(choice){
  const listeners={};
  return {dataset:{choice:String(choice)},attrs:{},disabled:false,textContent:'',
    addEventListener(type,fn){listeners[type]=fn;},
    setAttribute(key,value){this.attrs[key]=value;},
    click(){assert.ok(listeners.click,'handler missing');listeners.click();}};
}
function mockChapter(index){
  const options=[0,1,2].map(mockButton),reveal=mockButton(0),panel={hidden:true},
  response={textContent:''};
  return {dataset:{puzzle:String(index)},options,reveal,panel,response,
    querySelectorAll(selector){assert.equal(selector,'[data-choice]');return options;},
    querySelector(selector){return selector==='.reveal-btn'?reveal:selector==='.answer-panel'?panel:selector==='.answer-response'?response:null;}};
}
const chapters=[1,2,3].map(mockChapter);
const progress={textContent:''};
const document={querySelectorAll(selector){assert.equal(selector,'[data-puzzle]');return chapters;},
getElementById(id){assert.equal(id,'journey-progress');return progress;}};
vm.runInNewContext(js,{document},{filename:'puzzles.js'});
assert.match(progress.textContent,/0 \/ 3/);
for(let i=0;i<3;i++){
  const q=chapters[i];
  q.options[2].click();
  assert.equal(q.reveal.disabled,false);
  assert.equal(q.options[2].attrs['aria-pressed'],'true');
  q.reveal.click();
  assert.equal(q.panel.hidden,false);
  assert.ok(q.response.textContent.length>10,'feedback must not be empty');
  assert.match(progress.textContent,new RegExp((i+1)+' \\/ 3'));
}
chapters[0].options[0].click();
assert.equal(chapters[0].panel.hidden,true,'changing selection hides old reveal');
assert.match(progress.textContent,/2 \/ 3/);
chapters[0].reveal.click();
assert.match(progress.textContent,/3 \/ 3/);
console.log('three-mystery narrative and interactions: PASS');
