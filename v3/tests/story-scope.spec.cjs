/*
 * Release invariant for the consolidated Zhongkai family.
 * Earlier releases were "story only" and enforced full-file equality for hot.json,
 * life.json and whole HTML pages. That rule is invalid after the explicitly
 * authorized family integration and would also reject Doubao's daily updates.
 *
 * The scientific contract remains strict: model & immutable simulation modules
 * must match their historical reviewed bytes; changes to the 11 V3 UI pages
 * from the pre-family revision are limited to the two navigation script tags.
 */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),cp=require("node:child_process"),path=require("node:path");
const root=path.resolve(__dirname,"../..");
const immutableBase="0e824060ad1b4855ab66f3b4fcb56c04f2eb27b9";
const preFamily="06c5bf35e39c28eda319897d499a4a4da251fed4";
function historic(rev,file){return cp.execFileSync("git",["show",rev+":"+file],{cwd:root});}
function current(file){return fs.readFileSync(path.join(root,file));}
// Protect the original Sim and 3D rendering/scientific modules exactly.
const protectedFiles=[
 "model.js",
 "v3/portal-kernel.js",
 "v3/story-render.js",
 "v3/home-story-core.js",
 "v3/app.js",
 "v3/lab-v311.js",
 "v3/lab-play.js",
 "v3/visual-interaction.css",
 "v3/visual-entry-core.js",
 "v3/portal-render.js",
 "v3/story-first.css",
 "v3/portal-classic.js"
];
for(const file of protectedFiles){
 assert.deepEqual(current(file),historic(immutableBase,file),
   "Protected simulation/renderer changed; requires separate scientific review: "+file);
}
// The family change was an additive navigation adapter, never a silent V3 UI rewrite.
const uiPages=[
 "v3/index.html","v3/story-lab.html","v3/lab.html","v3/inflow.html",
 "v3/trust.html","v3/puzzles.html","v3/story-evidence.html",
 "v3/portal-classic.html","v3/verification.html","v3/measurement.html",
 "v3/observations.html"
];
const navTags='<script defer src="../family/handoff.js"></script><script defer src="../family/nav.js"></script>';
for(const file of uiPages){
 const html=current(file).toString("utf8");
 assert.equal(html.split(navTags).length-1,1,"Family navigation must appear once: "+file);
 assert.equal(html.replace(navTags,""),historic(preFamily,file).toString("utf8"),
   "Page changed beyond approved family navigation: "+file);
}
// Daily skills own their data files; verify basic parse rather than freezing bytes.
for(const file of ["hot.json","life.json"]){
 const data=JSON.parse(current(file).toString("utf8"));
 assert.ok(data!==null&&typeof data==="object"&&!Array.isArray(data),
   "Daily source file is not an object: "+file);
}
const story=current("v3/index.html").toString("utf8");
assert.ok(story.includes('src="story-render.js"'));
assert.ok(!story.includes('src="portal-render.js"'));
assert.ok(story.includes('href="story-lab.html"'));
assert.ok(!current("v3/lab.html").toString("utf8").includes('src="lab-play.js"'));
const lilin=current("lilin/index.html").toString("utf8");
assert.ok(lilin.includes("均衡·可直接使用"));
assert.ok(!lilin.includes('id="unlock"'));
console.log("PASS: immutable Sim/renderer protected; V3 pages add only approved family navigation; daily files remain dynamic; Lilin unlocked");
