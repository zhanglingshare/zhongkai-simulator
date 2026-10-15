/*KERNEL-BEGIN*/
"use strict";
/* ---------- 可复现 PRNG ---------- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function clone(o){return JSON.parse(JSON.stringify(o));}
function clamp(x,a,b){return x<a?a:x>b?b:x;}
function mean(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:0;}
function quantile(a,q){const s=[...a].sort((x,y)=>x-y);const pos=(s.length-1)*q;const b=Math.floor(pos),r=pos-b;return s[b]+(s[Math.min(b+1,s.length-1)]-s[b])*r;}
function sd(a){const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)*(x-m))));}

/* ---------- 8 类产业主体画像（living=会外迁/停产/破产；produce/consume 决定承载力） ---------- */
const TYPE_CFG={
  anchor:  {cn:"链主",power:.85,renown:.82,produce:.002,consume:.010,living:true, goal:"稳链扩能、守住基本盘", acts:["扩产","研发","增资","招商","订单","外迁"]},
  oem:     {cn:"整机",power:.62,renown:.55,produce:.001,consume:.013,living:true, goal:"拿订单、出货走量", acts:["订单","扩产","降价","裁员","停产","退链"]},
  supplier:{cn:"配套",power:.48,renown:.40,produce:.002,consume:.011,living:true, goal:"就近配套、稳定供货", acts:["就近配套","供货","涨价","断供","退链","破产"]},
  service: {cn:"服务",power:.42,renown:.45,produce:.012,consume:.003,living:true, goal:"提供生产性服务、提效", acts:["物流","检测","金融服务","研发服务","聚集"]},
  talent:  {cn:"人才",power:.35,renown:.30,produce:.001,consume:.012,living:true, goal:"就业、成长与安家", acts:["就业","聚集","跳槽","流失"]},
  capital: {cn:"资本",power:.55,renown:.50,produce:.015,consume:.001,living:false,goal:"投资造血、耐心陪伴", acts:["投资","增资","撤资"]},
  land:    {cn:"载体",power:.40,renown:.55,produce:.017,consume:.001,living:false,goal:"供地载企、连片成园", acts:["供地","建设","收地"]},
  infra:   {cn:"设施",power:.45,renown:.45,produce:.014,consume:.001,living:false,goal:"保障要素流通与互联", acts:["基建","物流","保供","瓶颈"]}
};

/* ---------- 产业行动效果表 [Δ景气,Δ协同,Δ风险] ---------- */
const ACT_FX={
  扩产:[.05,.02,-.02], 研发:[.035,.015,-.015], 增资:[.04,.02,-.02], 招商:[.045,.05,-.015],
  订单:[.055,.01,0], 降价:[-.015,-.005,.02], 裁员:[-.03,-.02,.05],
  外迁:[-.06,-.055,.11], 停产:[-.05,-.035,.085], 退链:[-.045,-.055,.075], 破产:[-.05,-.05,.09],
  就近配套:[.04,.055,-.02], 供货:[.03,.025,-.005], 涨价:[-.02,-.01,.03], 断供:[-.04,-.045,.08],
  物流:[.025,.035,-.015], 检测:[.015,.025,-.01], 金融服务:[.035,.035,-.025], 研发服务:[.03,.02,-.015],
  聚集:[.01,.02,0], 就业:[.02,.01,-.005], 跳槽:[-.005,-.005,.01], 流失:[-.015,-.015,.03],
  投资:[.04,.03,-.015], 撤资:[-.035,-.03,.06],
  供地:[.045,.02,-.005], 建设:[.025,.05,-.02], 收地:[-.02,-.015,.03],
  基建:[.025,.055,-.02], 保供:[.02,.02,-.02], 瓶颈:[-.025,-.02,.05]
};
/* ---------- 信号表（景气沿网络传播，影响信心） ---------- */
const ACT_SIGNAL={
  扩产:.22,研发:.15,增资:.20,招商:.18,订单:.28,降价:-.10,裁员:-.18,
  外迁:-.38,停产:-.32,退链:-.26,破产:-.32,
  就近配套:.16,供货:.12,涨价:-.08,断供:-.22,
  物流:.10,检测:.06,金融服务:.14,研发服务:.10,聚集:.08,
  就业:.10,跳槽:-.04,流失:-.14,
  投资:.18,撤资:-.20,供地:.10,建设:.08,收地:-.08,
  基建:.10,保供:.08,瓶颈:-.16
};

/* ---------- 候选实体池（仲恺真实主体；t=产业链时序, w=链主权重；共 41 个） ---------- */
let CANDIDATES=[
  // anchor 链主（w=3，5 家；享“不随机消亡”保护，但上帝视角可令其外迁）
  ["TCL王牌","anchor",40,3],["TCL华星","anchor",58,3],["德赛西威","anchor",62,3],
  ["亿纬锂能","anchor",72,3],["龙旗电子","anchor",86,3],
  // oem 整机
  ["TCL电子","oem",42,2],["智能手机整机","oem",90,2],["机顶盒厂","oem",96,1],["车载终端厂","oem",106,1],
  // supplier 配套
  ["AGC玻璃基板","supplier",50,2],["显示模组厂","supplier",56,2],["聚飞光电","supplier",78,2],
  ["德赛电池","supplier",70,2],["艾比森","supplier",76,2],["雷曼光电","supplier",80,2],
  ["PCB板厂","supplier",88,1],["连接器厂","supplier",94,1],["锂电材料厂","supplier",100,1],
  // service 生产性服务
  ["物流企业","service",118,1],["检测认证","service",122,1],["工业设计","service",124,1],
  ["软件信息","service",128,1],["人力资源服务","service",132,1],
  // talent 人才
  ["显示技术人才","talent",140,1],["电池工程师","talent",142,1],
  ["智能终端工匠","talent",146,1],["研发工程师","talent",150,1],
  // capital 资本（不含“产业基金”，那是门②漏项）
  ["政府母基金","capital",152,2],["创投机构","capital",158,1],
  ["银行信贷","capital",162,2],["融资租赁","capital",164,1],
  // land 园区载体
  ["惠南科技园","land",12,1],["东江科技园","land",15,1],["中韩产业园","land",18,2],
  ["人工智能产业园","land",24,2],["潼湖生态智慧区","land",28,2],
  // infra 设施（不含“物流通道”，那是门②漏项）
  ["电力保障","infra",168,2],["高速路网","infra",174,1],["仲恺B保","infra",178,2],
  ["深惠城际","infra",184,1],["算力数据中心","infra",190,1]
];

/* ---------- 时序因果链（t 映射到推演时刻；演仲恺产业崛起史；special: kill_object/null） ---------- */
let CAUSAL=[
  {s:"中韩产业园",act:"建设",o:"",t:30,type:"建设",special:null,line:"中韩（惠州）产业园起步，仲恺园区骨架铺开"},
  {s:"潼湖生态智慧区",act:"建设",o:"",t:38,type:"建设",special:null,line:"潼湖生态智慧区建设（2026 目标产值 900 亿）"},
  {s:"TCL王牌",act:"订单",o:"",t:48,type:"订单",special:null,line:"TCL 电视年销量稳居全球第二（2025 智能电视 2988.65 万台，+3.4%）"},
  {s:"显示模组厂",act:"就近配套",o:"TCL华星",t:58,type:"配套",special:null,line:"模组配套群就近配套华星，本地配套率提升"},
  {s:"AGC玻璃基板",act:"供货",o:"TCL华星",t:66,type:"供货",special:null,line:"AGC 玻璃基板就近供货华星"},
  {s:"TCL华星",act:"扩产",o:"",t:80,type:"扩张",special:null,line:"华星高世代线放量，超高清冲到 975.7 亿（+23.6%）"},
  {s:"德赛西威",act:"研发",o:"",t:90,type:"研发",special:null,line:"德赛西威智能座舱研发放量"},
  {s:"龙旗电子",act:"订单",o:"",t:101,type:"订单",special:null,line:"龙旗整机放量，智能终端集群达 1212.8 亿"},
  {s:"亿纬锂能",act:"扩产",o:"",t:110,type:"扩张",special:null,line:"亿纬锂能扩产，能源电子冲到 811.6 亿（+18.7%，唯一高增）"},
  {s:"TCL华星",act:"扩产",o:"",t:122,type:"扩张",special:null,line:"超高清首破千亿，达 1034.5 亿（+6%，增速腰斩）"},
  {s:"智能手机整机",act:"扩产",o:"",t:132,type:"扩张",special:null,line:"智能终端冲到 1345.8 亿（+11%，增速回落）"},
  {s:"银行信贷",act:"撤资",o:"",t:144,type:"风险",special:null,line:"固定资产投资 −22.3%、工业投资 −23.6%（连续两年大幅下滑）"},
  {s:"电力保障",act:"保供",o:"",t:160,type:"保供",special:null,line:"全社会用电 102.01 亿千瓦时（+14.4%），印证产能爬坡"},
  {s:"深惠城际",act:"基建",o:"",t:185,type:"互联",special:null,line:"深惠城际等通道建设，区域互联互通提速"},
  {s:"政府母基金",act:"投资",o:"",t:215,type:"投资",special:null,line:"“十五五”瞄准规上工业 6500 亿、GDP 破 2000 亿"}
];

/* ---------- 预设产业链关系（subject,predicate,object；共 71 条） ---------- */
let RELATIONS=[
  // —— 超高清 / 华星链 ——
  ["AGC玻璃基板","供货","TCL华星"],["显示模组厂","配套","TCL华星"],["聚飞光电","供货","TCL华星"],
  ["PCB板厂","配套","TCL华星"],["连接器厂","供货","TCL华星"],["工业设计","服务","TCL华星"],
  ["软件信息","服务","TCL华星"],["检测认证","服务","TCL华星"],["物流企业","运输","TCL华星"],
  ["电力保障","供电","TCL华星"],["银行信贷","授信","TCL华星"],["研发工程师","受雇","TCL华星"],
  ["TCL华星","供货","TCL王牌"],
  // —— 智能终端 / 王牌·龙旗链 ——
  ["显示模组厂","配套","TCL王牌"],["德赛电池","供货","TCL王牌"],["连接器厂","供货","TCL王牌"],
  ["TCL电子","关联","TCL王牌"],["机顶盒厂","采购","TCL王牌"],["显示模组厂","配套","龙旗电子"],
  ["德赛电池","供货","龙旗电子"],["PCB板厂","配套","龙旗电子"],["连接器厂","供货","龙旗电子"],
  ["检测认证","服务","龙旗电子"],["银行信贷","授信","龙旗电子"],["智能手机整机","同业","龙旗电子"],
  // —— 能源电子 / 锂电链 ——
  ["锂电材料厂","供货","亿纬锂能"],["德赛电池","竞争","亿纬锂能"],["检测认证","服务","亿纬锂能"],
  ["物流企业","运输","亿纬锂能"],["电力保障","供电","亿纬锂能"],["电池工程师","受雇","亿纬锂能"],
  ["政府母基金","投资","亿纬锂能"],["创投机构","投资","亿纬锂能"],["银行信贷","授信","亿纬锂能"],
  ["德赛西威","采购","亿纬锂能"],
  // —— 汽车电子 / 德赛西威链 ——
  ["车载终端厂","配套","德赛西威"],["软件信息","服务","德赛西威"],["连接器厂","供货","德赛西威"],
  ["检测认证","服务","德赛西威"],["融资租赁","服务","德赛西威"],["研发工程师","受雇","德赛西威"],
  ["人力资源服务","服务","德赛西威"],
  // —— 园区·载体·要素 ——
  ["中韩产业园","承载","TCL王牌"],["潼湖生态智慧区","承载","TCL华星"],["潼湖生态智慧区","承载","亿纬锂能"],
  ["人工智能产业园","承载","龙旗电子"],["人工智能产业园","承载","智能手机整机"],
  ["东江科技园","承载","艾比森"],["东江科技园","承载","雷曼光电"],["惠南科技园","承载","机顶盒厂"],
  ["中韩产业园","承载","车载终端厂"],["电力保障","供电","智能手机整机"],["电力保障","供电","龙旗电子"],
  ["深惠城际","连接","潼湖生态智慧区"],["高速路网","连接","中韩产业园"],["仲恺B保","服务","物流企业"],
  ["算力数据中心","服务","软件信息"],["政府母基金","投资","显示模组厂"],["政府母基金","投资","锂电材料厂"],
  ["创投机构","投资","艾比森"],["创投机构","投资","雷曼光电"],["融资租赁","服务","TCL王牌"],
  ["工业设计","服务","龙旗电子"],["智能终端工匠","受雇","智能手机整机"],["显示技术人才","受雇","艾比森"],
  ["物流企业","运输","智能手机整机"],["物流企业","运输","德赛西威"],["人力资源服务","服务","龙旗电子"],
  ["电池工程师","受雇","德赛电池"],["算力数据中心","服务","人工智能产业园"],
  ["高速路网","连接","潼湖生态智慧区"]
];

/* ---------- 产业冲击词表（14；ab=景气 di=风险 or=协同 mo=信心 kill=连带退链/消亡） ---------- */
const SHOCK_WORDS={
  链主外迁:{ab:-.18,di:.22,or:-.08,mo:-.15,kill:.22},
  芯片断供:{ab:-.12,di:.18,or:-.04,kill:.12},
  订单外流:{ab:-.16,di:.12,kill:.10},
  产能过剩:{ab:-.14,di:.14,kill:.08},
  政策收紧:{di:.10,or:-.05},
  用地收紧:{ab:-.08,di:.08,kill:.06},
  限电:{ab:-.10,di:.12,kill:.07},
  融资难:{ab:-.08,di:.12,kill:.08},
  关税摩擦:{ab:-.12,di:.14,kill:.08},
  供应链中断:{ab:-.12,di:.16,kill:.12},
  人才流失:{ab:-.06,di:.08},
  订单爆发:{ab:.20,mo:.18,or:.04},
  政策利好:{ab:.12,mo:.12,or:.06},
  技术突破:{ab:.14,mo:.10,di:-.05}
};
/* 门②漏项：产业生态最致命的 7 类缺失 */
const MISS_ROLES=[
  ["下游整机客户","谁下订单（外部品牌 / 海外市场）","oem"],
  ["产业基金","谁给耐心钱（战略性产业资本）","capital"],
  ["生产性服务业集群","研发 / 物流 / 检测体系（三产仅 +2.2% 的病灶）","service"],
  ["物流通道","货怎么进出（多式联运 / 枢纽）","infra"],
  ["技能人才池","谁来造（技能人才总量与结构）","talent"],
  ["周边竞争园区","谁在抢项目（东莞 / 深圳 / 中山）","land"],
  ["存量工业用地","项目落在哪（可连片熟地）","land"]
];
/* 参数血统：A=公报直接核对 B=可由公报推算 C=需持续/间接检验 D=无法验证 */
const PARAM_LINEAGE=[
  ["n_agents",24,"A","每局活跃主体数（结构常量）",false],
  ["ticks",20,"A","推演步数（结构常量）",false],
  ["abundance0",.5,"B","初始景气（由规上工业总产值 4037.12 亿、产能利用率推算）",false],
  ["order0",.5,"C","初始协同（由本地配套率对照，需持续跟踪）",true],
  ["disaster0",.2,"C","初始风险（由工业投资 −23.6%、外部依赖对照）",false],
  ["spread_rate",.22,"C","景气沿链传播率（无法直接观测，需到期检验）",true],
  ["disaster_rate",.08,"C","风险累积速率（需到期对照公报）",true],
  ["invest",.35,"B","投资强度（由工业投资增速 −23.6% 对照）",false],
  ["external",.62,"B","外部依赖（由外贸破 1500 亿、芯片进口对照）",false],
  ["service",.30,"B","服务业配套（由三产增加值 +2.2% 对照）",false],
  ["land",.45,"C","用地供给（由存量工业用地、供地节奏对照）",false]
];

/* ================= 仿真内核 ================= */
class Sim{
  constructor(seed,params){
    this.seed=seed;
    this.params=Object.assign({n_agents:24,ticks:20,pool_ratio:.55,abundance0:.5,order0:.5,
      disaster0:.2,disaster_rate:.08,mood_gain:.6,spread_rate:.22,spread_depth:2,
      invest:.35,external:.62,service:.30,land:.45},params||{});
    this.rng=mulberry32(seed);
    this.tick=0;
    this.agents=[]; this.edges=[]; this.timeline=[]; this.snapshots=[]; this.ledger=[]; this.gold=[];
    this.addedCount=0;
    this.state={abundance:this.params.abundance0,order:this.params.order0,disaster:this.params.disaster0,mood:0};
    this._sampleAgents();
    this._computeKcap();
    this._buildNetwork();
    this._log("init",{seed,agents:this.agents.length});
    this.snapshots.push(this._snap());
  }
  _log(type,payload){this.ledger.push({t:this.tick,type,payload});}
  _byName(n){return this.agents.find(a=>a.name===n);}
  _sampleAgents(){
    const N=this.params.n_agents;
    const chosen=[]; const used=new Set();
    // w>=3 世界导演级核心必入（少数；唯一享有“不饿死”保护）
    CANDIDATES.filter(c=>c[3]>=3).forEach(c=>{chosen.push(c);used.add(c[0]);});
    // w==2 史料关键角色以中等概率入场（约半数局能演对应因果链；缺席是跨局变异）
    CANDIDATES.filter(c=>c[3]===2).forEach(c=>{if(this.rng()<.45){chosen.push(c);used.add(c[0]);}});
    // 其余名额从全池均匀随机抽（多数为脆弱角色，决定承载力与存续方差）
    const rest=CANDIDATES.filter(c=>!used.has(c[0]));
    while(chosen.length<N && rest.length){
      const idx=Math.floor(this.rng()*rest.length);
      chosen.push(rest[idx]); used.add(rest[idx][0]); rest.splice(idx,1);
    }
    chosen.forEach(c=>{
      const cfg=TYPE_CFG[c[1]];
      this.agents.push({name:c[0],type:c[1],t:c[2],w:c[3],
        power:cfg.power,renown:cfg.renown,
        energy:cfg.living?clamp(.5+.34*cfg.power+ (this.rng()-.5)*.1,.18,.97):1,
        sentiment:0,alive:true,memory:[`${c[0]}入场（${cfg.cn}）`]});
    });
  }
  _computeKcap(){
    let p=0,c=0;
    this.agents.forEach(a=>{p+=TYPE_CFG[a.type].produce;c+=TYPE_CFG[a.type].consume;});
    // 用地供给、服务业配套决定园区能承载多少企业（高于现状 → 容量上移）；目标限幅避免端点
    const landBoost=(this.params.land-.5)*.28+(this.params.service-.5)*.18;
    this.Kcap=clamp(.62+(p-c)*7+landBoost,.15,.90);
  }
  _addEdge(a,b,layer,rel){
    if(a===b)return;
    if(this.edges.some(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a)))return;
    this.edges.push({a,b,layer,rel});
  }
  _buildNetwork(){
    this.edges=[];
    const alive=this.agents.map(a=>a.name);
    const has=n=>alive.includes(n);
    // 史料层：因果
    CAUSAL.forEach(c=>{if(has(c.s)&&c.o&&has(c.o))this._addEdge(c.s,c.o,"hist",c.type);});
    // 史料层：预设关系
    RELATIONS.forEach(r=>{if(has(r[0])&&has(r[2]))this._addEdge(r[0],r[2],"hist",r[1]);});
    // 同类亲和：同类型按 t 相邻
    const byType={};
    this.agents.forEach(a=>{(byType[a.type]=byType[a.type]||[]).push(a);});
    Object.values(byType).forEach(list=>{
      list.sort((x,y)=>x.t-y.t);
      for(let i=0;i<list.length-1;i++)this._addEdge(list[i].name,list[i+1].name,"affinity","同类");
    });
    // 同域接触：时序相近
    const contactCount={};
    const pairs=[];
    for(let i=0;i<this.agents.length;i++)for(let j=i+1;j<this.agents.length;j++){
      const A=this.agents[i],B=this.agents[j];
      if(Math.abs(A.t-B.t)<=12)pairs.push([A.name,B.name,Math.abs(A.t-B.t)]);
    }
    pairs.sort((x,y)=>x[2]-y[2]);
    pairs.forEach(p=>{
      const ca=contactCount[p[0]]||0,cb=contactCount[p[1]]||0;
      if(ca<2&&cb<2){this._addEdge(p[0],p[1],"contact","同域");contactCount[p[0]]=ca+1;contactCount[p[1]]=cb+1;}
    });
  }
  _neighbors(name){
    const nb=[];
    this.edges.forEach(e=>{if(e.a===name)nb.push(e.b);else if(e.b===name)nb.push(e.a);});
    return nb;
  }
  _mapTick(t){return clamp(Math.round((t-26)/(240-26)*this.params.ticks),0,this.params.ticks-1);}
  /* 统一“消亡”措辞：人才流失 / 服务业倒闭 / 制造企业停产·退链·破产·外迁 */
  _kill(a,scene){
    a.alive=false;a.energy=0;
    let verb,label;
    if(a.type==="talent"){verb="流失";label="岗位收缩，人才"}
    else if(a.type==="service"){verb="倒闭";label="需求不足，服务机构"}
    else if(scene==="drain"){verb="停产破产";label="订单枯竭、资金链断裂，"}
    else if(scene==="crowd"){verb="退链出局";label="同质化内卷中被淘汰，"}
    else {verb="断链外迁";label="产业链危机中"}
    a.memory.push(`${a.name}${verb}`);
    this.timeline.push({tick:this.tick,kind:"death",text:`${label}${a.name}${verb}`});
  }

  /* ---- 单步：双拍闭环 ---- */
  step(){
    if(this.tick>=this.params.ticks)return;
    this.tick++;
    let da=0,do_=0,dd=0; const signals={}, actCount={};
    const fired=new Set();
    const addSig=(n,v)=>{signals[n]=(signals[n]||0)+v;};
    const applyAct=(ag,act)=>{
      const fx=ACT_FX[act]||[0,0,0];
      da+=fx[0];do_+=fx[1];dd+=fx[2];
      addSig(ag.name,ACT_SIGNAL[act]||0);
      actCount[act]=(actCount[act]||0)+1;
      ag.memory.push(`${ag.name}${act}`);
    };
    // 拍一·史料因果优先
    CAUSAL.forEach(c=>{
      if(this._mapTick(c.t)!==this.tick-1)return;
      const ag=this._byName(c.s);
      if(!ag||!ag.alive)return;
      fired.add(c.s);
      applyAct(ag,c.act);
      this.timeline.push({tick:this.tick,kind:"hist",text:c.line});
      if(c.special==="kill_object"&&c.o){
        const tg=this._byName(c.o);
        if(tg&&tg.alive){tg.alive=false;tg.memory.push(`${c.o}被${c.s}所杀`);
          this.timeline.push({tick:this.tick,kind:"death",text:`${c.o}亡`});}
      }
      if(c.special==="kill_self"){
        ag.alive=false;
        this.timeline.push({tick:this.tick,kind:"death",text:`${c.s}道渴而死`});
      }
    });
    // 拍一·其余主体私域决策
    this.agents.forEach(ag=>{
      if(!ag.alive||fired.has(ag.name))return;
      const act=this._chooseAct(ag);
      applyAct(ag,act);
    });
    const aliveList=this.agents.filter(a=>a.alive);
    const N=aliveList.length;
    const st=this.state;
    // —— 景气：趋向 Kcap（上限 .90）；行动/投资经 logistic 饱和（端点→0，不顶格/不归零）；风险拖累 + 中枢回归 ——
    const satA=4*st.abundance*(1-st.abundance);
    // 投资 / 服务低于正常(.5)为持续拖累（投资崩、三产滞后），经 logistic 饱和：越近端点影响越弱（存量韧性）
    const investPush=(this.params.invest-.5)*.040+(this.params.service-.5)*.020;
    st.abundance += .26*(Math.min(this.Kcap,.90)-st.abundance)
                 + (da/N)*1.4*satA
                 - st.disaster*.06*(.25+st.abundance)
                 + investPush*3.0*satA
                 + .020*(.48-st.abundance);
    // —— 拍二·信号沿三层网传播 ——
    const received={};
    Object.entries(signals).forEach(([src,v])=>{
      if(!v)return;
      received[src]=(received[src]||0)+v*.5;
      let frontier=[[src]]; const seen=new Set([src]);
      for(let d=0;d<this.params.spread_depth;d++){
        const nxt=[];
        frontier.forEach(([node])=>{
          this._neighbors(node).forEach(nb=>{
            if(seen.has(nb))return;seen.add(nb);
            const amt=v*Math.pow(this.params.spread_rate,d+1)*1.4;
            received[nb]=(received[nb]||0)+amt; nxt.push([nb]);
          });
        });
        frontier=nxt;
      }
    });
    this.agents.forEach(ag=>{
      const r=received[ag.name]||0;
      let sit=0;
      if(TYPE_CFG[ag.type].living){ // 处境项：景气/协同/风险/自身经营
        sit=(st.abundance-.5)*.7+(st.order-.5)*.5-st.disaster*.7+(ag.energy-.5)*.5;
      }
      ag.sentiment=clamp(.5*ag.sentiment+.28*r+.3*sit,-1,1);
    });
    const living=this.agents.filter(a=>a.alive&&TYPE_CFG[a.type].living);
    const meanSent=mean(living.map(a=>a.sentiment));
    // —— 风险：趋向“风险天花板”（外部依赖高/景气低/协同低则上移，最高 .85）；行动经饱和；路径依赖 ——
    const satD=4*st.disaster*(1-st.disaster);
    const fracMitigate=((actCount["保供"]||0)+(actCount["金融服务"]||0)+(actCount["检测"]||0)+(actCount["物流"]||0))/N;
    const riskCeil=clamp(.12+(this.params.external-.5)*.5+(.5-st.abundance)*.5+(.5-st.order)*.4,.05,.85);
    st.disaster += .22*(riskCeil-st.disaster)
                 + (dd/N)*1.2*satD
                 + st.disaster*st.disaster*.15*(1-st.order)*satD
                 - fracMitigate*.05;
    // —— 信心：情绪均值（处境已内含协同/风险）——
    st.mood=clamp(.55*st.mood+.45*meanSent,-1,1);
    // —— 协同：趋向 .72；建设/配套行动经 logistic 饱和；信心/风险；服务业润滑 ——
    const satO=4*st.order*(1-st.order);
    st.order += .20*(.72-st.order)
             + ((do_/N)*1.3+((actCount["就近配套"]||0)+(actCount["招商"]||0)+(actCount["建设"]||0))/N*.05)*satO
             + st.mood*.04*satO - st.disaster*.07*(.3+st.order)
             + (this.params.service-.5)*.016;
    // —— 经营收支：高景气订单>成本（可持续/全活），低景气净亏损（配套/整机/人才先退场）；w>=3 链主享保护 ——
    this.agents.forEach(ag=>{
      if(!ag.alive)return;
      const cfg=TYPE_CFG[ag.type];
      if(!cfg.living)return;
      const baseNeed=cfg.consume*2.6 + (st.disaster>.4?.02:0);
      const intake=clamp(st.abundance,0,1)**2*.16;
      ag.energy += intake-baseNeed;
      if(ag.w>=3){ag.energy=Math.max(ag.energy,.34);}
      if(ag.energy<=0){
        if(ag.w<3)this._kill(ag,"drain");
        else ag.energy=.34;
      }
      ag.energy=clamp(ag.energy,0,1);
    });
    // —— 过载竞争淘汰：资源不足以养活现有生物时，脆弱者按压力概率死亡 ——
    const livNow=this.agents.filter(a=>a.alive&&TYPE_CFG[a.type].living);
    let bioLoad=0;livNow.forEach(a=>bioLoad+=TYPE_CFG[a.type].consume);
    const pressure=clamp((bioLoad-clamp(st.abundance,0,1)*.34)/Math.max(bioLoad,.001),0,1);
    if(pressure>0)livNow.filter(a=>a.w<3).forEach(a=>{
      if(this.rng()<pressure*.22)this._kill(a,"crowd");
    });
    // —— 高风险损毁：产业链危机，载体/资本/设施与各类主体（w<3）亦受冲击 ——
    if(st.disaster>.4){
      this.agents.filter(a=>a.alive&&a.w<3).forEach(a=>{
        if(this.rng()<(st.disaster-.35)*.25)this._kill(a,"crisis");
      });
    }
    st.abundance=clamp(st.abundance,0,1);st.order=clamp(st.order,0,1);st.disaster=clamp(st.disaster,0,1);
    this._log("step",{tick:this.tick,state:clone(st)});
    this.snapshots.push(this._snap());
  }
  _chooseAct(ag){
    const acts=TYPE_CFG[ag.type].acts;
    const st=this.state;
    const w=acts.map(a=>{
      let x=1;
      // 景气足 / 信心高 → 扩张与协同
      if(a==="扩产"||a==="增资")x+=st.abundance*4+(st.mood>0?2:0);
      if(a==="研发"||a==="研发服务")x+=st.abundance*2+st.order*2;
      if(a==="订单")x+=st.abundance*3+1;
      if(a==="招商"||a==="投资")x+=st.order*3+(st.mood>0?2:0);
      if(a==="就近配套"||a==="供货")x+=st.order*4+st.abundance;
      if(a==="供地")x+=st.abundance*2+st.order;
      if(a==="就业"||a==="聚集")x+=st.abundance*3+(st.mood>0?2:0);
      if(a==="金融服务"||a==="保供")x+=st.order*2+(st.disaster>.3?2:0);
      if(a==="物流"||a==="基建"||a==="建设")x+=st.order*2+(st.disaster>.3?2:0);
      if(a==="检测")x+=1+st.order;
      // 景气低 / 风险高 → 收缩、退链、外迁
      if(a==="降价")x+=(st.abundance<.4?3:0);
      if(a==="裁员")x+=(st.abundance<.35?3:0)+st.disaster*2;
      if(a==="停产")x+=(st.abundance<.3?3:0)+st.disaster*3;
      if(a==="退链")x+=st.disaster*3+(st.abundance<.35?2:0);
      if(a==="破产")x+=st.disaster*3+(st.abundance<.25?2:0);
      if(a==="断供")x+=st.disaster*3;
      if(a==="涨价")x+=(st.disaster>.3?2:0);
      if(a==="撤资"||a==="收地")x+=st.disaster*3+(st.abundance<.35?2:0);
      if(a==="瓶颈")x+=st.disaster*3;
      if(a==="跳槽"||a==="流失")x+=(st.abundance<.4?2.5:0)+st.disaster*2;
      if(a==="外迁")x+=st.disaster*4+(st.abundance<.35?2:0);
      return x;
    });
    let tot=w.reduce((s,x)=>s+x,0),r=this.rng()*tot,i=0;
    while(r>w[i]){r-=w[i];i++;}
    return acts[i];
  }
  /* ---- 上帝视角 ---- */
  shock(type){
    const cfg=SHOCK_WORDS[type]; if(!cfg)return {ok:false,msg:"未知冲击"};
    const st=this.state;
    if(cfg.ab)st.abundance=clamp(st.abundance+cfg.ab,0,1);
    if(cfg.di)st.disaster=clamp(st.disaster+cfg.di,0,1);
    if(cfg.or)st.order=clamp(st.order+cfg.or,0,1);
    if(cfg.mo)st.mood=clamp(st.mood+cfg.mo,-1,1);
    let killed=0;
    if(cfg.kill){
      this.agents.filter(a=>a.alive&&TYPE_CFG[a.type].living&&a.w<3).forEach(a=>{
        if(this.rng()<cfg.kill){
          a.alive=false;a.memory.push(`${a.name}受「${type}」波及，${a.type==="talent"?"流失":"退链"}`);killed++;
        }
      });
    }
    this.gold.push(this.tick+1);
    this.timeline.push({tick:this.tick+1,kind:"gold",text:`[上帝] ${type}${killed?` · 连带退链/流失 ${killed} 家`:""}`});
    this._log("shock",{type,killed});
    return {ok:true,killed};
  }
  removeAgent(name){
    const ag=this._byName(name);
    if(!ag)return {ok:false,msg:`「${name}」不在本局候选`};
    if(!ag.alive)return {ok:false,msg:`「${name}」已不在场`};
    ag.alive=false; ag.memory.push(`${name}被移除`);
    this.gold.push(this.tick+1);
    this.timeline.push({tick:this.tick+1,kind:"gold",text:`[上帝] 移除 ${name}`});
    this._log("remove",{name});
    return {ok:true};
  }
  perturb(metric,delta){
    this.state[metric]=clamp(this.state[metric]+delta,metric==="mood"?-1:0,1);
    this.gold.push(this.tick+1);
    this.timeline.push({tick:this.tick+1,kind:"gold",text:`[上帝] ${metric} ${delta>=0?"+":""}${delta.toFixed(2)}`});
    this._log("perturb",{metric,delta});
    return {ok:true};
  }
  addMissing(roleIdxs){
    let added=0,edgesAdded=0;
    roleIdxs.forEach(i=>{
      const r=MISS_ROLES[i]; if(!r)return;
      if(this._byName(r[0]))return;
      const cfg=TYPE_CFG[r[2]];
      this.agents.push({name:r[0],type:r[2],t:240+this.addedCount,w:1,
        power:cfg.power,renown:cfg.renown,energy:.7,sentiment:0,alive:true,memory:[`${r[0]}补入：${r[1]}`]});
      // 连 3 条边：连到权重最高的若干在场主体
      const targets=[...this.agents].filter(a=>a.name!==r[0]).sort((x,y)=>y.w-x.w).slice(0,3);
      targets.forEach(tg=>{this._addEdge(r[0],tg.name,"hist","补录");edgesAdded++;});
      added++;this.addedCount++;
    });
    this._computeKcap();
    this._log("audit_add",{added,edgesAdded});
    return {added,edgesAdded};
  }
  /* ---- 自然语言解析（零API） ---- */
  parseNL(text){
    const s=text.trim();
    // ① 产业冲击词（芯片断供 / 订单外流 / 关税摩擦 / 链主外迁 …）
    for(const w in SHOCK_WORDS){if(s.includes(w))return {kind:"shock",type:w};}
    // ② 链主泛称：链主停产 / 链主走（“链主外迁”已在①作为冲击处理）
    if(/链主/.test(s)&&/停产|退链|破产|走/.test(s)){
      const anchors=this.agents.filter(a=>a.alive&&a.type==="anchor");
      if(!anchors.length)return {error:"本局没有在场链主。"};
      const pick=anchors.find(a=>s.includes(a.name))||anchors[0];
      return {kind:"remove",name:pick.name};
    }
    // ③ 显式移除 / 产业死法词 + 在场主体
    let m=s.match(/(?:移除|外迁|停产|退链|破产|倒闭)\s*([\u4e00-\u9fa5A-Za-z]+)/);
    const deadWords=["外迁","停产","退链","破产","倒闭","流失","撤资","退场"];
    if(m||deadWords.some(d=>s.includes(d))){
      const name=m?m[1]:null;
      const hit=name?this.agents.find(a=>a.name===name):this.agents.find(a=>s.includes(a.name));
      if(hit&&hit.alive)return {kind:"remove",name:hit.name};
      if(hit&&!hit.alive)return {error:`「${hit.name}」已退场。`};
      return {error:`检测到产业死法词，但没匹配到本局在场主体。可移除：${this.agents.filter(a=>a.alive).map(a=>a.name).slice(0,10).join("、")}`};
    }
    // ④ 干扰：指标 + 数字（“增长动能 −0.2”=景气）
    const metricMap={增长动能:"abundance",景气:"abundance",协同:"order",风险:"disaster",信心:"mood",
      abundance:"abundance",order:"order",disaster:"disaster",mood:"mood"};
    for(const k in metricMap){
      if(s.includes(k)){
        const nm=s.match(/(-?\d+\.?\d*)/);
        if(nm)return {kind:"perturb",metric:metricMap[k],delta:parseFloat(nm[1])};
        if(s.includes("上升")||s.includes("增加")||s.includes("提升"))return {kind:"perturb",metric:metricMap[k],delta:.2};
        if(s.includes("下降")||s.includes("减少"))return {kind:"perturb",metric:metricMap[k],delta:-.2};
      }
    }
    return {error:"没解析出来。可试：TCL华星外迁｜链主外迁｜芯片断供｜增长动能 -0.2｜移除亿纬锂能"};
  }
  execNL(text){
    const r=this.parseNL(text);
    if(r.error)return r;
    if(r.kind==="shock")return Object.assign({exec:this.shock(r.type)},r);
    if(r.kind==="remove")return Object.assign({exec:this.removeAgent(r.name)},r);
    if(r.kind==="perturb")return Object.assign({exec:this.perturb(r.metric,r.delta)},r);
    return {error:"未知"};
  }
  /* ---- Interview ---- */
  interview(name){
    const ag=this._byName(name); if(!ag)return null;
    const cfg=TYPE_CFG[ag.type];
    let care;
    if(!ag.alive)care="我已退场（外迁 / 停产），只能从记忆里复盘这局了。";
    else if(ag.energy<.32)care=`我最在意能不能撑下去——订单 / 现金流只剩${(ag.energy*100|0)}，再不来订单就得停产。`;
    else if(this.state.disaster>.4)care="产业链风险还在升高，我最在意这波危机何时见底、订单何时回来。";
    else if(ag.sentiment<-.25)care="周遭信心很弱、同行都在收缩，我最在意这股预期还能不能稳住。";
    else if(ag.type==="anchor")care="我最在意稳链扩能、守住基本盘，把本地配套和订单稳住。";
    else if(ag.type==="oem")care="我最在意拿到订单、出货走量，别在价格战里被拖垮。";
    else if(ag.type==="supplier")care="我最在意就近配套、稳定供货，别被链主采购调整甩出局。";
    else if(ag.type==="capital")care="我最在意把耐心钱投给能跑出来的链与企业，别投错、别断供。";
    else if(ag.type==="land")care="我最在意腾出连片熟地、把好项目装进来。";
    else care=`我最在意${cfg.goal}，眼下尚可周旋。`;
    return {name:ag.name,type:ag.type,typeCn:cfg.cn,power:ag.power,renown:ag.renown,
      energy:ag.energy,sentiment:ag.sentiment,alive:ag.alive,goal:cfg.goal,
      memory:ag.memory.slice(-5),care};
  }
  survivors(){const l=this.agents.filter(a=>a.alive).length;return l/this.agents.length;}
  _snap(){return {tick:this.tick,state:clone(this.state),agents:clone(this.agents),
    timeline:clone(this.timeline),gold:clone(this.gold)};}
  seek(t){
    if(t<0||t>=this.snapshots.length)return;
    const snap=clone(this.snapshots[t]);
    this.tick=snap.tick;this.state=snap.state;this.agents=snap.agents;
    this.timeline=snap.timeline;this.gold=snap.gold;
    this.snapshots=this.snapshots.slice(0,t+1);
    this._log("seek",{tick:t});
  }
  report(){
    const st=this.state;
    const deaths=this.timeline.filter(e=>e.kind==="death").map(e=>e.text);
    const hist=this.timeline.filter(e=>e.kind==="hist").map(e=>e.text);
    return {final:clone(st),survivors:this.survivors(),
      alive:this.agents.filter(a=>a.alive).map(a=>a.name),
      histEvents:hist,deaths};
  }
}

/* ---- 力导向布局（纯函数，可复现，可测0重叠） ---- */
function layoutForce(agents,edges,W,H){
  // Fruchterman–Reingold：斥力 k²/d、弹簧 d²/k，温度冷却限幅，保证收敛不发散
  const N=agents.length, rng=mulberry32(42);
  const k=Math.sqrt(W*H/N);
  const pos={};
  agents.forEach((a,i)=>{const ang=(i/N)*Math.PI*2;
    pos[a.name]={x:W/2+Math.cos(ang)*Math.min(W,H)*.30+(rng()-.5)*20,
                 y:H/2+Math.sin(ang)*Math.min(W,H)*.30+(rng()-.5)*20};});
  const R=17; let t=W*.18;
  for(let it=0;it<300;it++){
    const names=agents.map(a=>a.name);
    const disp={};names.forEach(n=>disp[n]={x:0,y:0});
    for(let i=0;i<N;i++)for(let j=i+1;j<N;j++){
      let dx=pos[names[i]].x-pos[names[j]].x,dy=pos[names[i]].y-pos[names[j]].y;
      let d=Math.sqrt(dx*dx+dy*dy)||.01;
      const f=k*k/d, ux=dx/d,uy=dy/d;
      disp[names[i]].x+=ux*f;disp[names[i]].y+=uy*f;
      disp[names[j]].x-=ux*f;disp[names[j]].y-=uy*f;
    }
    edges.forEach(e=>{const p=pos[e.a],q=pos[e.b];if(!p||!q)return;
      let dx=p.x-q.x,dy=p.y-q.y;let d=Math.sqrt(dx*dx+dy*dy)||.01;
      const f=d*d/k,ux=dx/d,uy=dy/d;
      disp[e.a].x-=ux*f;disp[e.a].y-=uy*f;
      disp[e.b].x+=ux*f;disp[e.b].y+=uy*f;});
    names.forEach(n=>{
      disp[n].x+=(W/2-pos[n].x)*.02;disp[n].y+=(H/2-pos[n].y)*.02;
      const d=Math.sqrt(disp[n].x*disp[n].x+disp[n].y*disp[n].y)||.01;
      const step=Math.min(d,t);
      pos[n].x+=disp[n].x/d*step;pos[n].y+=disp[n].y/d*step;
      pos[n].x=clamp(pos[n].x,R+2,W-R-2);pos[n].y=clamp(pos[n].y,R+2,H-R-2);
    });
    t=Math.max(t*.96,.5);
  }
  const out={};Object.entries(pos).forEach(([kk,p])=>out[kk]={x:p.x,y:p.y});
  out.__minGap=minGap(agents,out,R);
  return out;
}
function minGap(agents,pos,R){
  let mg=999;
  for(let i=0;i<agents.length;i++)for(let j=i+1;j<agents.length;j++){
    const p=pos[agents[i].name],q=pos[agents[j].name];
    const g=Math.sqrt((p.x-q.x)**2+(p.y-q.y)**2)-2*R;
    if(g<mg)mg=g;
  }
  return mg;
}

/* ---- 蒙特卡洛批量 ---- */
function runMonteCarlo(baseSeed,n,params,onTick){
  const res={abundance:[],order:[],disaster:[],mood:[],survivors:[]};
  for(let i=0;i<n;i++){
    const sim=new Sim(baseSeed*1000+i,params);
    for(let t=0;t<(params&&params.ticks||20);t++)sim.step();
    res.abundance.push(sim.state.abundance);res.order.push(sim.state.order);
    res.disaster.push(sim.state.disaster);res.mood.push(sim.state.mood);
    res.survivors.push(sim.survivors());
    if(onTick&&i%Math.max(1,n/50|0)===0)onTick(i,n);
  }
  const stats={};
  ["abundance","order","disaster","mood","survivors"].forEach(k=>{
    stats[k]={mean:mean(res[k]),sd:sd(res[k]),p10:quantile(res[k],.1),p50:quantile(res[k],.5),p90:quantile(res[k],.9),values:res[k]};
  });
  return stats;
}

/* ---- 敏感性分析（对 4 杠杆做 ±扰动，按景气/存续响应幅度排序，供龙卷风图） ---- */
function runSensitivity(baseSeed,n,delta,params,onTick){
  const levers=[
    {key:"invest",cn:"投资强度"},{key:"external",cn:"外部依赖"},
    {key:"service",cn:"服务业配套"},{key:"land",cn:"用地供给"}
  ];
  const defVal={invest:.35,external:.62,service:.30,land:.45};
  const base=params||{};
  const run=(overrides)=>{
    const p=Object.assign({},base,overrides);
    const ab=[],su=[];
    for(let i=0;i<n;i++){
      const sim=new Sim(baseSeed*700+i,p);
      for(let t=0;t<(p.ticks||20);t++)sim.step();
      ab.push(sim.state.abundance);su.push(sim.survivors());
    }
    return {ab:mean(ab),su:mean(su)};
  };
  const rows=[];
  levers.forEach((L,idx)=>{
    const center=base[L.key]!==undefined?base[L.key]:defVal[L.key];
    const lo=run({[L.key]:clamp(center-delta,0,1)});
    const hi=run({[L.key]:clamp(center+delta,0,1)});
    rows.push({key:L.key,cn:L.cn,center,
      abLo:lo.ab,abHi:hi.ab,abSwing:Math.abs(hi.ab-lo.ab),
      suLo:lo.su,suHi:hi.su,suSwing:Math.abs(hi.su-lo.su)});
    if(onTick)onTick(idx+1,levers.length);
  });
  rows.sort((a,b)=>b.abSwing-a.abSwing);
  return rows;
}

/* ---- 世界导入（数据/报告 → 世界种子；无 DOM，可 Node 验证） ---- */
const _ORIG_CAND_=CANDIDATES.map(c=>c.slice()),_ORIG_REL_=RELATIONS.map(r=>r.slice()),_ORIG_CAUSAL_=CAUSAL.map(c=>({...c})); // 仲恺基准副本，用于一键恢复
let REPORT_LEXICON={}; // 词表：主体名 → [类型,权重]，随世界重建刷新
(function(){CANDIDATES.forEach(c=>{REPORT_LEXICON[c[0]]=[c[1],c[3]];});})();

function parseUploadText(text,fname){
  const t=text.trim();
  if(!t)return {ok:false,msg:"内容为空。"};
  // ② CSV 优先（[entities] 标记 / 表头 / 文件扩展名；避免 "[entities]" 被当作 JSON 数组开头）
  const isCsv=/\[entities\]/.test(t)||/^name,type/i.test(t)||/^source,target/i.test(t)||(fname&&/\.(csv|tsv)$/i.test(fname));
  if(isCsv){
    const ents=[],rels=[];let sec=null;
    t.split(/\r?\n/).forEach(line=>{
      const s=line.trim();if(!s||s.startsWith("#"))return;
      if(s==="[entities]"){sec="e";return;}
      if(s==="[relations]"){sec="r";return;}
      const parts=s.split(",").map(x=>x.trim());
      if(sec==="r"&&parts.length>=2){rels.push({a:parts[0],b:parts[1],rel:parts[2]||"协作",str:parseFloat(parts[3])||.5});return;}
      if(parts.length>=2&&/^[a-zA-Z][a-zA-Z0-9_]*$/.test(parts[0]))return;
      if(parts.length>=2)ents.push({name:parts[0],type:parts[1],w:parseInt(parts[2])||1,desc:parts[3]||""});
    });
    return {ok:ents.length>0,mode:"csv",entities:ents,relations:rels,params:{},note:`CSV：${ents.length} 主体 / ${rels.length} 关系`};
  }
  // ① JSON
  if(/^[\s]*[\[{]/.test(t)){
    try{
      const d=JSON.parse(t);
      const arr=Array.isArray(d)?d:(d.candidates||d.entities||[]);
      const rels=Array.isArray(d)?[]:(d.relations||[]);
      const ents=arr.map(x=>({name:x.name||x[0],type:x.type||x[1],w:x.w!=null?x.w:(x[3]||1),desc:x.desc||x[2]||""}));
      return {ok:true,mode:"json",entities:ents,relations:rels.map(r=>({a:r.a||r[0],b:r.b||r[2],rel:r.rel||r[1]||"协作",str:r.str!=null?r.str:(r[3]||.5)})),params:d.params||{},note:`JSON：${ents.length} 主体 / ${rels.length} 关系`};
    }catch(e){return {ok:false,msg:"JSON 解析失败："+e.message};}
  }
  // ③ TXT 报告：内置词表抽取（非智能抽取，诚实标注）
  const hits={};
  Object.keys(REPORT_LEXICON).forEach(name=>{
    const n=t.split(name).length-1;
    if(n>0&&(n>=2||t.length<600))hits[name]=n;
  });
  const ents=Object.keys(hits).map(name=>{
    const tp=REPORT_LEXICON[name];return {name,type:tp[0],w:tp[1],desc:`词表命中 ${hits[name]} 次`};
  });
  if(!ents.length)return {ok:false,msg:"报告未命中内置词表（当前词表为仲恺 41 主体名）。词表抽取≠智能抽取：请改用 CSV/JSON，或粘贴包含这些主体名的报告片段。"};
  return {ok:true,mode:"report",entities:ents,relations:autoConnect(ents),params:{},note:`报告词表抽取：${ents.length} 主体 · 关系按类型自动连边（${autoConnect(ents).length} 条）`};
}
function autoConnect(ents){
  const rels=[],push=(a,b,rel)=>{if(a&&b&&a!==b)rels.push({a,b,rel,str:.5});};
  const by=t=>ents.filter(x=>x.type===t);
  const core=by("anchor").concat(by("oem"),by("supplier"));
  by("anchor").forEach(a=>{by("supplier").concat(by("oem")).forEach(b=>push(a.name,b.name,"供货"));});
  by("oem").concat(by("supplier")).forEach(a=>{by("anchor").forEach(b=>push(a.name,b.name,"配套"));});
  core.forEach(x=>{
    by("service").forEach(y=>push(y.name,x.name,"服务"));
    by("capital").forEach(y=>push(y.name,x.name,"授信"));
    by("land").forEach(y=>push(y.name,x.name,"承载"));
    by("infra").forEach(y=>push(y.name,x.name,"连接"));
    by("talent").forEach(y=>push(y.name,x.name,"受雇"));
  });
  const seen=new Set();
  return rels.filter(r=>{const k=r.a+"|"+r.b;if(seen.has(k))return false;seen.add(k);return true;});
}
function applyWorld(ents,rels,seed,params){
  const seen=new Set(),bad=[],cand=[];
  ents.forEach(e=>{
    const name=(e.name||"").trim();
    if(!name||seen.has(name)){bad.push((name||"空名")+"(重复)");return;}
    if(!TYPE_CFG[e.type]){bad.push(name+"(类型"+e.type+")");return;}
    seen.add(name);
    cand.push([name,e.type,0,Math.max(1,Math.min(3,Math.round(+e.w||1)))]);
  });
  if(cand.length<4)return {ok:false,msg:"有效主体少于 4 个，无法成世界："+bad.slice(0,6).join("、")};
  const relation=[];
  rels.forEach(r=>{const a=(r.a||"").trim(),b=(r.b||"").trim();if(seen.has(a)&&seen.has(b)&&a!==b)relation.push([a,(r.rel||"协作").trim()||"协作",b]);});
  CANDIDATES=cand;RELATIONS=relation;
  CAUSAL=CAUSAL.filter(c=>seen.has(c.s)&&(!c.o||seen.has(c.o)));
  REPORT_LEXICON={};CANDIDATES.forEach(c=>{REPORT_LEXICON[c[0]]=[c[1],c[3]];});
  const sim=new Sim(seed);
  if(params&&typeof params==="object"){Object.keys(params).forEach(k=>{if(k in sim.params)sim.params[k]=clamp(+params[k]||0,0,1);});}
  return {ok:true,sim,cand:cand.length,rel:relation.length,bad:bad.slice(0,6)};
}
/*KERNEL-END*/
/* Public research kernel of model.js, kept mathematically unchanged. */
window.ZKSim=Sim;
window.ZKRegisteredShocks=Object.keys(SHOCK_WORDS);
window.ZKCandidateCount=CANDIDATES.length;
