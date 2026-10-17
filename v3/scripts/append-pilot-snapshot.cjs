/* Append-only ingestion adapter for an existing external daily public-data Skills job.
 * This program does NOT schedule scraping and does NOT rewrite prior snapshots. */
"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const P=require("../pilot-closure-core.js");
const root=path.resolve(__dirname,"../data/snapshots");
function save(raw,rootDir=root){
 const check=P.validateRegistry(raw);if(!check.ok)throw Error(check.errors.join("; "));
 if(!P.date(raw.capturedAt))throw Error("Missing UTC/date-stamped capturedAt YYYY-MM-DD");
 if(!raw.snapshotId||!/^[a-z0-9][a-z0-9-]{4,95}$/i.test(raw.snapshotId))throw Error("Invalid snapshotId");
 const content=JSON.stringify(raw,null,2)+"\n",
  sha=crypto.createHash("sha256").update(content).digest("hex"),
  file=path.join(rootDir,raw.capturedAt+"-"+sha.slice(0,12)+".json");
 fs.mkdirSync(rootDir,{recursive:true});
 // wx guarantees prior snapshots can never be silently overwritten.
 try{fs.writeFileSync(file,content,{flag:"wx"});}
 catch(err){if(err.code!=="EEXIST")throw err;
   const existing=fs.readFileSync(file,"utf8");
   if(existing!==content)throw Error("Snapshot filename collision with different content");
 }
 return {filename:file,sha256:sha,sourceCount:raw.cases.reduce((s,c)=>s+c.source.length,0),
  statement:"Archive file is append-only by local exclusive create; provenance still requires Git review, timestamps, and primary-source validation."};
}
if(require.main===module){
 try{
  const input=process.argv[2];if(!input)throw Error("Usage: node v3/scripts/append-pilot-snapshot.cjs <validated-external-skills-output.json>");
  const json=JSON.parse(fs.readFileSync(path.resolve(input),"utf8"));
  const out=save(json);console.log(JSON.stringify(out,null,2));
 }catch(e){console.error("SOURCE_SNAPSHOT_REJECTED:",e.message);process.exitCode=1;}
}
module.exports={save};
