/* The release is authorized for the story edition only. Freeze all other existing production files. */
const assert=require("node:assert/strict"),fs=require("node:fs"),cp=require("node:child_process"),path=require("node:path");
const root=path.resolve(__dirname,"../.."),baseline="aadab124d2ac27cf9ffd9d19966587a64f015dbf";
const git=args=>cp.execFileSync("git",args,{cwd:root,encoding:"utf8"}).trim();
const allowed=new Set(["v3/index.html","v3/portal.js","v3/README.md",".github/workflows/v3-browser-smoke.yml"]);
const changed=git(["diff","--name-only","--diff-filter=M",baseline,"HEAD"]).split("\n").filter(Boolean);
for(const name of changed)assert.ok(allowed.has(name)||name.startsWith("v3/tests/"),"Other existing versions must remain byte-identical: "+name);
for(const name of ["v3/lab.html","v3/portal-render.js","v3/story-first.css","v3/portal-classic.html","v3/portal-classic.js","model.js","v3/portal-kernel.js"]){
 const before=cp.execFileSync("git",["show",baseline+":"+name],{cwd:root});
 assert.deepEqual(fs.readFileSync(path.join(root,name)),before,name+" changed outside story edition");
}
const story=fs.readFileSync(path.join(root,"v3/index.html"),"utf8");
assert.ok(story.includes('src="story-render.js"'));
assert.ok(!story.includes('src="portal-render.js"'));
assert.ok(story.includes('href="story-lab.html"'));
assert.ok(!fs.readFileSync(path.join(root,"v3/lab.html"),"utf8").includes('lab-play.js'));
console.log("PASS story-only release: original professional, classic, shared renderer/styles, data and model files remain unchanged");
