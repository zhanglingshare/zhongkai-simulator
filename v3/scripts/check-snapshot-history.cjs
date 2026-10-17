/* CI guard: historical snapshot files under v3/data/snapshots/
 * can only be added, never modified, removed, or renamed after entering git. */
"use strict";
const {execFileSync}=require("node:child_process");
const path="v3/data/snapshots/";
let ref=process.env.V321_BASE_COMMIT||"HEAD^";
try{
 const names=execFileSync("git",["diff","--name-status",ref,"HEAD","--",path],{encoding:"utf8"});
 const lines=names.trim().split("\n").filter(Boolean);
 const invalid=lines.filter(l=>!l.startsWith("A\t"));
 if(invalid.length)throw Error("Historical evidence snapshots must be append-only: "+invalid.join(" | "));
 console.log("PASS v3.21 source snapshot history: "+lines.length+" additions; no historical modifications");
}catch(err){console.error("SNAPSHOT_HISTORY_GUARD_FAILURE:",err.message);process.exitCode=1;}
