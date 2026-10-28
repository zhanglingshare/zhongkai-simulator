/**
 * Zhongkai family / Lilin integration contract tests (Node built-ins only).
 * Test scope: navigation/state and unchanged source boundaries, not model validation.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const family=require('../family/handoff.js');
const world=JSON.parse(read('family/worlds.json'));
const whole=JSON.parse(read('examples/world_seed_zhongkai.json'));
const lilin=read('lilin/index.html');
test('All-zone seed is the original 41 subjects / 71 relationships',()=>{
 assert.equal(whole.candidates.length,41);assert.equal(whole.relations.length,71);
});
test('Lilin remains a distinct town model with independent 20 nodes / 21 edges',()=>{
 const m=lilin.match(/NO:\[(.*?)\],LK:\[(.*?)\],BRI:/s);
 assert.ok(m);
 assert.equal([...m[1].matchAll(/\["n\d+","[^"]+"/g)].length,20);
 assert.equal([...m[2].matchAll(/\["n\d+","n\d+",\d/g)].length,21);
 assert.deepEqual(world.worlds.map(w=>w.scope_type),['regional_simulation','town_simulation']);
 assert.deepEqual(world.cross_scale.confirmed_entity_matches,[]);
});
test('Lilin has no remaining passcode, gates, or hardcoded secret',()=>{
 for(const k of ['M7-LILIN','M7 口令','PASS=','S.s4','封存·M7解锁','prompt('])assert.equal(lilin.includes(k),false,'still present '+k);
 assert.ok(lilin.includes('均衡·可直接使用'));
 assert.ok(!lilin.includes('id="unlock"'));
});
test('Lilin scenario S1–S6 are still available',()=>{
 for(let i=1;i<=6;i++)assert.ok(lilin.includes('["S'+i+'",'));
});
test('Every main entry has non-destructive family navigation',()=>{
 for(const p of ['index.html','v2/index.html','v3/index.html','v3/story-lab.html','v3/lab.html','v3/inflow.html','v3/trust.html','lilin/index.html']){
  const s=read(p);const prefix=p.includes('/')?'../family/':'family/';
  assert.ok(s.includes(prefix+'handoff.js'),p+' lacks contract');
  assert.ok(s.includes(prefix+'nav.js'),p+' lacks navigation');
 }
});
test('All shared navigation and page JavaScript parse',()=>{
 for(const p of ['family/handoff.js','family/nav.js','v3/portal.js','v3/story-lab-ui.js']){
  assert.doesNotThrow(()=>new Function(read(p)),p);
 }
 for(const p of ['lilin/index.html','family/index.html']){
  const m=[...read(p).matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)];
  for(const script of m)assert.doesNotThrow(()=>new Function(script[1]),p+' inline script');
 }
});
test('Contract roundtrip carries public model inputs only',()=>{
 const ctx=family.validate({v:1,kind:'exit',seed:7,pop:41,tick:12,target:'TCL华星',source:'see'});
 assert.ok(ctx);assert.equal(ctx.target,'TCL华星');
 assert.deepEqual(family.decode(family.encode(ctx)),ctx);
 const link=family.withContext('/v3/lab.html',ctx);
 assert.deepEqual(family.parseSearch(link.slice(link.indexOf('?'))),ctx);
});
test('Story link preserves existing V3 format',()=>{
 const ctx={v:1,kind:'exit',seed:7,pop:41,tick:12,target:'TCL华星',source:'see'};
 const u=new URL(family.toStory('https://example.invalid/v3/story-lab.html',ctx));
 const payload=JSON.parse(decodeURIComponent(u.searchParams.get('scenario')));
 assert.deepEqual(payload,{v:3,kind:'exit',target:'TCL华星',seed:7,pop:41,tick:12});
});
test('Invalid handoff inputs are rejected',()=>{
 for(const obj of [
 {v:1,kind:'exit',target:'not a validated anchor'},
 {v:1,kind:'exit',target:'TCL华星',seed:-1},
 {v:1,kind:'shock',shock:'unknown event'},
 {v:999,kind:'explore'},
 {v:1,kind:'town',pop:999}
 ])assert.equal(family.validate(obj),null);
 assert.equal(family.decode('%ZZ'),null);
 assert.equal(family.decode('x'.repeat(99999)),null);
});
test('Town / region scope never claims simulation parameters are interchangeable',()=>{
 assert.ok(family.checkTownTransfer('仲恺','沥林'));
 assert.equal(family.checkTownTransfer('沥林','博罗'),false);
 assert.ok(world.cross_scale.forbidden_transfer.includes('town parameters'));
 assert.ok(world.cross_scale.forbidden_transfer.includes('raw graph edges'));
});
test('Daily Doubao updates are left in place and not mirrored',()=>{
 assert.ok(world.worlds[0].data_inputs.includes('hot.json'));
 assert.ok(world.worlds[0].data_inputs.includes('life.json'));
 assert.equal(world.worlds[0].data_updater,'Doubao Skills (unchanged)');
});
