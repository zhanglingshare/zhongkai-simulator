/* V3.7 public-shared wind-tunnel experiment contract tests. */
const assert=require("node:assert/strict");
const S=require("../explore-core.js");
assert.ok(S.shocks.length>=14);
assert.ok(S.positive.includes("技术突破"));
assert.equal(S.valid(7,"链主外迁"),true);
assert.equal(S.valid(7,"订单爆发"),true);
assert.equal(S.valid(0,"链主外迁"),false);
assert.equal(S.valid(7,"自定义非法冲击"),false);
for(const shock of S.shocks){
 const url=S.encode(123456,shock);
 assert.deepEqual(S.decode(url),{v:1,seed:123456,shock});
}
for(const garbage of [
 "",undefined,"%",JSON.stringify({v:1,seed:7,shock:"not-registered"}),
 encodeURIComponent(JSON.stringify({v:2,seed:7,shock:"限电"})),
 encodeURIComponent(JSON.stringify({v:1,seed:7,shock:"限电",__proto_pollution:"x"})).repeat(10),
 encodeURIComponent(JSON.stringify({v:1,seed:-2,shock:"政策利好"})),
 encodeURIComponent(JSON.stringify({v:1,seed:2.5,shock:"政策利好"})),
 encodeURIComponent(JSON.stringify({v:1,seed:2147483648,shock:"限电"}))
])assert.equal(S.decode(garbage),null);
assert.throws(()=>S.encode(1,"伪造官方预测"),/已登记冲击/);
const up=S.interpret("技术突破",{abundance:.1,disaster:-.04,mood:0});
assert.equal(up.type,"opportunity");
assert.deepEqual(up.strengths.map(x=>x.direction),["up","down","flat"]);
assert.equal(S.interpret("限电",{disaster:.3}).type,"risk");
assert.ok(S.interpret("限电",{disaster:.3}).assumptions.includes("非现实事件"));
console.log("PASS V3.7: safe reproducible input-only scenario links, strict shock validation, no fabricated outputs");
