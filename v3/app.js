/* V3 presentation / orchestration only.
   Uses Sim, sim, layoutForce and the legacy render function from ../model.js.
   No kernel implementation or parameter formula is duplicated here. */
(function(){
  "use strict";
  const el=id=>document.getElementById(id);
  const alertBox=el("runtime-alert");
  function fail(message){
    alertBox.hidden=false;
    alertBox.textContent="工作台无法初始化：" + message + "。原版 V2 仍可正常使用。";
  }
  try{
    if(typeof Sim!=="function" || typeof sim==="undefined" || typeof render!=="function"){
      throw new Error("未能加载原始 model.js");
    }

    const keys=[
      {key:"abundance",name:"景气",range:[0,1]},
      {key:"order",name:"协同",range:[0,1]},
      {key:"disaster",name:"风险",range:[0,1]},
      {key:"mood",name:"信心",range:[-1,1]},
      {key:"survivors",name:"存续率",range:[0,1]}
    ];
    const svgNS="http://www.w3.org/2000/svg";
    let selectedNode=null, comparison=null, currentView="network";
    let robustness=null, activeRobustnessToken=0;
    function create(tag,cls,txt){
      const obj=document.createElement(tag);
      if(cls)obj.className=cls;
      if(txt!==undefined)obj.textContent=String(txt);
      return obj;
    }
    function svgNode(tag,attrs,txt){
      const obj=document.createElementNS(svgNS,tag);
      Object.entries(attrs||{}).forEach(pair=>obj.setAttribute(pair[0],String(pair[1])));
      if(txt!==undefined)obj.textContent=String(txt);
      return obj;
    }
    function safeSeed(){
      const input=el("seed-input");
      const value=Number(input.value);
      if(!Number.isSafeInteger(value) || value<1 || value>2147483647){
        input.setCustomValidity("请输入 1 至 2147483647 之间的整数");
        input.reportValidity();
        return null;
      }
      input.setCustomValidity("");
      return value;
    }
    function switchMobile(view){
      const work=document.querySelector(".workstation");
      work.dataset.mobile=view;
      document.querySelectorAll("[data-mobile-to]").forEach(btn=>{
        const yes=btn.dataset.mobileTo===view;
        btn.setAttribute("aria-pressed",String(yes));
      });
      if(view==="compare")el("compare-section").scrollIntoView({block:"start",behavior:"auto"});
    }
    document.querySelectorAll("[data-mobile-to]").forEach(btn=>{
      btn.addEventListener("click",()=>switchMobile(btn.dataset.mobileTo));
    });

    function switchView(view){
      currentView=view;
      document.querySelectorAll("[data-view]").forEach(btn=>{
        const yes=btn.dataset.view===view;
        btn.classList.toggle("chosen",yes);
        btn.setAttribute("aria-selected",String(yes));
      });
      ["network","trends","timeline"].forEach(name=>{
        const pane=el("view-"+name);
        const yes=name===view;
        pane.hidden=!yes;
        pane.classList.toggle("active",yes);
      });
      if(view==="trends")drawTrends();
    }
    document.querySelectorAll("[data-view]").forEach(btn=>{
      btn.addEventListener("click",()=>switchView(btn.dataset.view));
    });

    function currentMetric(model,key){
      return key==="survivors" ? model.survivors() : model.state[key];
    }
    function snapshotMetric(snap,key){
      if(key==="survivors")return snap.agents.length ? snap.agents.filter(a=>a.alive).length/snap.agents.length : 0;
      return snap.state[key];
    }
    function fmt(n){return Number(n).toFixed(3);}
    function drawTrends(){
      const grid=el("trends-grid");
      grid.replaceChildren();
      const snaps=Array.isArray(sim.snapshots)?sim.snapshots:[];
      keys.forEach(spec=>{
        const tile=create("div","trend-tile");
        const title=create("h3");
        title.append(create("span","",spec.name),create("strong","",fmt(currentMetric(sim,spec.key))));
        tile.append(title);
        const svg=svgNode("svg",{viewBox:"0 0 260 96",role:"img","aria-label":spec.name+"随模型时间步变化"});
        const W=260,H=96,padL=21,padR=9,padT=9,padB=19;
        [0,.5,1].forEach(r=>{
          const y=padT+r*(H-padT-padB);
          svg.append(svgNode("line",{x1:padL,y1:y,x2:W-padR,y2:y,stroke:"#e4ebf0","stroke-width":1}));
        });
        if(snaps.length){
          const min=spec.range[0],max=spec.range[1],count=Math.max(1,sim.params.ticks);
          const points=snaps.map(snap=>{
            const x=padL+snap.tick/count*(W-padL-padR);
            const v=snapshotMetric(snap,spec.key);
            const y=padT+(1-(v-min)/(max-min))*(H-padT-padB);
            return x.toFixed(2)+","+Math.min(H-padB,Math.max(padT,y)).toFixed(2);
          }).join(" ");
          svg.append(svgNode("polyline",{points,fill:"none",stroke:spec.key==="disaster"?"#ba685c":"#0a8393","stroke-width":2.3,"stroke-linejoin":"round","stroke-linecap":"round"}));
        }
        svg.append(svgNode("text",{x:padL,y:H-3,"font-size":10,fill:"#97a6b4"},"t0"));
        svg.append(svgNode("text",{x:W-padR,y:H-3,"font-size":10,"text-anchor":"end",fill:"#97a6b4"},"t"+sim.params.ticks));
        tile.append(svg);grid.append(tile);
      });
    }
    function refreshCount(){
      const n=sim.agents.length, total=typeof CANDIDATES!=="undefined"?CANDIDATES.length:n;
      el("network-count").textContent="候选 "+total+" 主体 · 当前局 "+n+" 主体 · "+sim.edges.length+" 条当前局关系";
      el("seed-input").value=String(sim.seed);
      const active=selectedNode?sim._byName(selectedNode):null;
      if(selectedNode && !active)selectedNode=null;
      paintFocus();
      if(currentView==="trends")drawTrends();
    }
    function prepareNetworkKeyboard(){
      el("netsvg").querySelectorAll(".node").forEach(node=>{
        node.setAttribute("tabindex","0");
        node.setAttribute("role","button");
        node.setAttribute("aria-label","查看主体 "+node.dataset.name);
        node.addEventListener("keydown",e=>{
          if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();selectedNode=node.dataset.name;paintFocus();if(matchMedia("(max-width:760px)").matches)switchMobile("insight");}
        });
      });
    }
    function paintFocus(){
      const svg=el("netsvg");
      const box=el("focus-info");
      box.replaceChildren();
      if(!selectedNode){
        box.append(create("p","no-result","点击中央网络的主体节点，查看主体状态与相关记录。"));
        svg.querySelectorAll(".node").forEach(n=>n.classList.remove("focused","dimmed"));
        Array.from(svg.children).filter(n=>n.tagName.toLowerCase()==="line").forEach(n=>{
          n.classList.remove("edge-focused");n.style.removeProperty("opacity");
        });
        return;
      }
      const a=sim._byName(selectedNode);
      if(!a){selectedNode=null;return paintFocus();}
      const detail=sim.interview(selectedNode);
      box.append(create("strong","",selectedNode));
      box.append(create("span","focus-tag",detail?detail.typeCn:"主体"));
      box.append(create("p","",a.alive?"模型状态：仍在场":"模型状态：已退场"));
      box.append(create("p","","经营能量 "+Math.round(a.energy*100)+"% · 预期 "+fmt(a.sentiment)));
      if(detail&&detail.care)box.append(create("p","",detail.care));
      if(a.memory && a.memory.length){
        const list=create("ul");
        a.memory.slice(-3).forEach(msg=>list.append(create("li","",msg)));
        box.append(list);
      }
      svg.querySelectorAll(".node").forEach(n=>{
        const match=n.dataset.name===selectedNode || sim.edges.some(edge=>(edge.a===selectedNode && edge.b===n.dataset.name)||(edge.b===selectedNode && edge.a===n.dataset.name));
        n.classList.toggle("focused",n.dataset.name===selectedNode);
        n.classList.toggle("dimmed",!match);
      });
      const lines=Array.from(svg.children).filter(n=>n.tagName.toLowerCase()==="line");
      lines.forEach((line,i)=>{
        const edge=sim.edges[i];
        const active=!!edge&&(edge.a===selectedNode||edge.b===selectedNode);
        line.classList.toggle("edge-focused",active);
        if(!active)line.style.opacity=".06";else line.style.removeProperty("opacity");
      });
    }
    el("netsvg").addEventListener("click",event=>{
      const target=event.target && event.target.closest ? event.target.closest(".node") : null;
      if(!target)return;
      // The kernel's original node handler jumps to its old tab UI; V3 has an inspector instead.
      event.stopPropagation();
      selectedNode=target.dataset.name;
      paintFocus();
      if(matchMedia("(max-width:760px)").matches)switchMobile("insight");
    },true);
    el("btn-iv").addEventListener("click",()=>{
      selectedNode=el("iv-sel").value;
      paintFocus();
    });

    // One consistent post-render hook: all original model.js handlers still execute.
    const originalRender=render;
    render=function(){
      originalRender();
      prepareNetworkKeyboard();
      refreshCount();
    };
    // The original renderer has already initialized the visible network on script load.
    prepareNetworkKeyboard();
    refreshCount();
    drawTrends();

    function markCompareStale(){
      activeRobustnessToken++;
      el("btn-robust").disabled=false;
      el("btn-cancel-robust").hidden=true;
      if(robustness)el("robust-status").textContent="实验设置已改变：以下多种子结果来自上一次研究，不会自动更新。";
      if(comparison){
        comparison.stale=true;
        el("compare-note").textContent="实验设置已变化：下方保留上一次对比（种子 "+comparison.seed+"，冲击“"+comparison.type+"”）。点击“按当前选择运行 A/B”才能更新结果。";
        el("status-b").textContent="旧结果 · t"+comparison.tick;
        if(typeof refreshWindResults==="function")refreshWindResults();
      }
    }
    el("shock-sel").addEventListener("change",()=>{
      if(typeof syncWindChoices==="function")syncWindChoices();
      if(!comparison)el("scenario-label").textContent=el("shock-sel").value+" · 在第 0 步注入";
      markCompareStale();
    });
    el("scenario-label").textContent=el("shock-sel").value+" · 在第 0 步注入";
    el("research-question").addEventListener("change",markCompareStale);
    el("seed-input").addEventListener("input",markCompareStale);

    el("load-seed").addEventListener("click",()=>{
      const seed=safeSeed();
      if(seed===null)return;
      if(typeof playing!=="undefined" && playing){
        clearInterval(playTimer);
        playing=false;
        el("btn-play").textContent="▶ 播放";
      }
      sim=new Sim(seed);
      selectedNode=null;
      posCache=null;
      if(window.kpiHistory)window.kpiHistory=[];
      refreshSelectors();
      render();
      el("nl-result").textContent="已加载种子 "+seed+"，当前局回到初始状态。";
      markCompareStale();
      if(matchMedia("(max-width:760px)").matches)switchMobile("canvas");
    });

    // Never draw invented comparison values: the SVGs remain empty until models have run.
    function clearMini(svg,text){
      svg.replaceChildren(svgNode("text",{x:380,y:215,"text-anchor":"middle",fill:"#9aa9b5","font-size":22},text));
    }
    function metricPairs(aSnap,bSnap){
      const result=el("compare-metrics");
      result.replaceChildren();
      keys.forEach(spec=>{
        const A=snapshotMetric(aSnap,spec.key),B=snapshotMetric(bSnap,spec.key);
        const difference=B-A,domain=spec.range[1]-spec.range[0];
        const row=create("div","delta-row");
        row.append(create("div","delta-name",spec.name));
        const label=create("div","delta-values","A "+fmt(A)+"  /  B "+fmt(B));
        row.append(label);
        const chart=create("div","diverge-chart");
        chart.setAttribute("role","img");
        chart.setAttribute("aria-label",spec.name+"：B 减 A 等于 "+(difference>=0?"+":"")+fmt(difference));
        const zero=create("span","zero-axis");
        const bar=create("span","diverge-bar "+(difference>=0?"right":"left"));
        const magnitude=Math.min(50,Math.abs(difference)/domain*50);
        bar.style.width=magnitude.toFixed(2)+"%";
        chart.append(zero,bar);
        row.append(chart);
        const text=create("strong",difference>0?"positive":difference<0?"negative":"neutral",(difference>0?"+":"")+fmt(difference));
        row.append(text);
        result.append(row);
      });
    }
    function drawCompareNetwork(svg,model,positions,snapshot,focusedName){
      svg.replaceChildren();
      const sy=430/560, agents=snapshot.agents;
      const byName=new Map(agents.map(a=>[a.name,a]));
      const labelNames=new Set(agents.filter(a=>a.type==="anchor").map(a=>a.name));
      const neighbors=new Set();
      if(focusedName){
        neighbors.add(focusedName);
        model.edges.forEach(edge=>{
          if(edge.a===focusedName)neighbors.add(edge.b);
          if(edge.b===focusedName)neighbors.add(edge.a);
        });
      }
      model.edges.forEach(edge=>{
        const p=positions[edge.a],q=positions[edge.b];
        if(!p||!q)return;
        const pa=byName.get(edge.a),pb=byName.get(edge.b);
        const directlyFocused=!!focusedName&&(edge.a===focusedName||edge.b===focusedName);
        const opacity=focusedName?(directlyFocused?.8:.05):(pa&&pb&&pa.alive&&pb.alive?.42:.085);
        svg.append(svgNode("line",{x1:p.x,y1:p.y*sy,x2:q.x,y2:q.y*sy,stroke:directlyFocused?"#07869a":"#b6c8d1","stroke-width":directlyFocused?2.8:1.5,opacity}));
      });
      agents.forEach(a=>{
        const p=positions[a.name];if(!p)return;
        const color=typeof typeColor==="function"?typeColor(a.type):"#087d8d";
        const isFocused=focusedName===a.name;
        const isNeighbor=!focusedName||neighbors.has(a.name);
        const g=svgNode("g",{opacity:isNeighbor?(a.alive?1:.33):.10});
        g.append(svgNode("circle",{
          cx:p.x,cy:p.y*sy,r:isFocused?15:a.type==="anchor"?12:7.5,
          fill:a.alive?color:"#a8b6c2",stroke:isFocused?"#0491a2":a.sentiment<-.12?"#bd6460":"#fff",
          "stroke-width":isFocused?5:a.type==="anchor"?3:1.5
        }));
        g.append(svgNode("title",{},a.name+(a.alive?"":"（已退场）")));
        if(labelNames.has(a.name)||isFocused){
          g.append(svgNode("text",{x:p.x,y:p.y*sy-19,"text-anchor":"middle","font-size":14,fill:"#41556a"},a.name));
        }
        svg.append(g);
      });
    }
    function getComparisonSnapshots(t){
      const x=comparison;
      return {
        a:t===0?x.A0:x.A.snapshots[t],
        b:t===0?x.B0:x.B.snapshots[t]
      };
    }
    function renderImpactRows(aSnap,bSnap){
      const box=el("compare-agents");
      box.replaceChildren();
      const allA=new Map(aSnap.agents.map(a=>[a.name,a]));
      const list=bSnap.agents.map(b=>{
        const a=allA.get(b.name);
        if(!a)return null;
        const survivalChange=(b.alive?1:0)-(a.alive?1:0);
        const energyChange=b.energy-a.energy;
        const sentimentChange=b.sentiment-a.sentiment;
        return {name:b.name,survivalChange,energyChange,sentimentChange,
          score:Math.abs(survivalChange)*2+Math.abs(energyChange)+Math.abs(sentimentChange)*.5};
      }).filter(Boolean).sort((x,y)=>y.score-x.score||x.name.localeCompare(y.name,"zh-CN"));
      const significant=list.filter(item=>item.score>.0001).slice(0,8);
      if(!significant.length){
        box.append(create("p","no-result","在这一时间步，未观察到主体状态差异。"));
        return;
      }
      significant.forEach((item,index)=>{
        const btn=create("button","impact-row"+(comparison.focus===item.name?" selected":""));
        btn.type="button";
        btn.setAttribute("aria-pressed",String(comparison.focus===item.name));
        btn.append(create("span","impact-rank",String(index+1).padStart(2,"0")));
        const content=create("span","impact-detail");
        content.append(create("strong","",item.name));
        const detail=item.survivalChange!==0?(item.survivalChange<0?"B 中退场，A 仍存续":"B 中存续，A 已退场"):
          "经营能量 Δ"+(item.energyChange>=0?"+":"")+fmt(item.energyChange)+" · 预期 Δ"+(item.sentimentChange>=0?"+":"")+fmt(item.sentimentChange);
        content.append(create("span","",detail));
        btn.append(content);
        btn.addEventListener("click",()=>{
          comparison.focus=comparison.focus===item.name?null:item.name;
          renderComparisonAt(comparison.tick);
        });
        box.append(btn);
      });
    }
    function drawCompareTrends(){
      const grid=el("compare-trends");
      grid.replaceChildren();
      keys.forEach(spec=>{
        const tile=create("div","compare-trend-tile");
        const title=create("div","compare-trend-title",spec.name);
        tile.append(title);
        const svg=svgNode("svg",{viewBox:"0 0 340 82",role:"img","aria-label":spec.name+"在 A 与 B 情景下的模型演化曲线"});
        const L=16,R=8,T=8,B=17,W=340,H=82;
        svg.append(svgNode("line",{x1:L,y1:H-B,x2:W-R,y2:H-B,stroke:"#dfe7ee","stroke-width":1}));
        [comparison.A,comparison.B].forEach((model,idx)=>{
          const pts=[];
          for(let t=0;t<=comparison.ticks;t++){
            const snap=t===0?(idx===0?comparison.A0:comparison.B0):model.snapshots[t];
            const v=snapshotMetric(snap,spec.key);
            const x=L+t/comparison.ticks*(W-L-R);
            const y=T+(1-(v-spec.range[0])/(spec.range[1]-spec.range[0]))*(H-T-B);
            pts.push(x.toFixed(2)+","+Math.max(T,Math.min(H-B,y)).toFixed(2));
          }
          svg.append(svgNode("polyline",{points:pts.join(" "),fill:"none",
            stroke:idx===0?"#728ca3":"#c28748","stroke-width":2.4,"stroke-linejoin":"round"}));
        });
        const markerX=L+comparison.tick/comparison.ticks*(W-L-R);
        svg.append(svgNode("line",{x1:markerX,y1:T,x2:markerX,y2:H-B,stroke:"#0c5368","stroke-width":1,
          "stroke-dasharray":"3 3",opacity:.65}));
        svg.append(svgNode("text",{x:L,y:H-3,"font-size":10,fill:"#a2adba"},"t0"));
        svg.append(svgNode("text",{x:W-R,y:H-3,"font-size":10,fill:"#a2adba","text-anchor":"end"},"t"+comparison.ticks));
        tile.append(svg);
        grid.append(tile);
      });
    }
    function renderComparisonAt(t){
      if(!comparison)return;
      t=Math.min(comparison.ticks,Math.max(0,Math.trunc(t)));
      comparison.tick=t;
      const data=getComparisonSnapshots(t);
      drawCompareNetwork(el("graph-a"),comparison.A,comparison.positions,data.a,comparison.focus);
      drawCompareNetwork(el("graph-b"),comparison.B,comparison.positions,data.b,comparison.focus);
      metricPairs(data.a,data.b);
      renderImpactRows(data.a,data.b);
      drawCompareTrends();
      el("compare-tick").value=String(t);
      el("compare-tick-value").textContent="t"+t+" / "+comparison.ticks;
      el("compare-timeline-hint").textContent="显示第 "+t+" 个模型时间步的状态；模型时间步不等于日历日期。";
      el("status-a").textContent="t"+t+" / "+comparison.ticks;
      el("status-b").textContent=comparison.stale?"旧结果 · t"+t:"t"+t+" / "+comparison.ticks;
    }
    function runComparison(){
      const seed=safeSeed();
      if(seed===null)return;
      const type=el("shock-sel").value;
      const btn=el("btn-compare");
      const originalText=btn.textContent;
      btn.disabled=true;btn.textContent="计算中…";
      try{
        const params=Object.assign({},sim.params);
        // Matched input settings. No replay of the current partially run live session.
        const A=new Sim(seed,params),B=new Sim(seed,params);
        const applied=B.shock(type);
        if(!applied.ok)throw new Error("不支持冲击："+type);
        const A0=A._snap(), B0=B._snap();
        const ticks=params.ticks||20;
        for(let t=0;t<ticks;t++){A.step();B.step();}
        const positions=layoutForce(A.agents,A.edges,760,560);
        comparison={seed,type,A,B,A0,B0,params,positions,ticks,tick:ticks,focus:null,stale:false,question:el("research-question").value.trim()};
        resetRobustness("A/B 对比已更新。可对这组实验做多种子检查。");
        el("btn-export").disabled=false;
        el("compare-tick").disabled=false;
        el("compare-tick").max=String(ticks);
        renderComparisonAt(ticks);
        if(typeof refreshWindResults==="function")refreshWindResults();
        el("scenario-label").textContent=type+" · 第 0 步";
        el("compare-note").textContent="已运行 · A 为基线，B 在第 0 步注入“"+type+"”冲击"+(applied.killed?" · 冲击即时使 "+applied.killed+" 个模型主体退场":"")+"。两侧按同一时间步对齐，差值均为 B − A。";
        el("compare-provenance").textContent="模型基准：仲恺演示世界 · 随机种子："+seed+" · 每局 "+ticks+" 步 · 相同模型参数："+JSON.stringify({invest:params.invest,external:params.external,service:params.service,land:params.land})+" · 研究备注："+(el("research-question").value.trim()||"未填写")+"。相同种子不代表严格因果识别；冲击可改变后续随机数消耗；排名仅表示模型状态差异。";
        alertBox.hidden=true;
        if(matchMedia("(max-width:760px)").matches)switchMobile("compare");
      }catch(e){
        fail(e&&e.message?e.message:String(e));
      }finally{
        btn.disabled=false;btn.textContent=originalText;
      }
    }

    /* V3.2: Repeat *the same original Sim*, do not touch the simulation kernel. */
    function resetRobustness(message){
      activeRobustnessToken++;
      robustness=null;
      el("robust-results").replaceChildren(create("p","no-result","尚无重复实验结果。"));
      el("robust-status").textContent=message;
      el("btn-robust").disabled=false;
      el("btn-cancel-robust").hidden=true;
    }
    function sampleSeed(base,index){
      return ((base-1+index)%2147483647)+1;
    }
    function percentile(sorted,q){
      if(!sorted.length)return NaN;
      const at=(sorted.length-1)*q;
      const lo=Math.floor(at),hi=Math.ceil(at);
      return sorted[lo]+(sorted[hi]-sorted[lo])*(at-lo);
    }
    function drawRobustness(){
      const root=el("robust-results");
      root.replaceChildren();
      if(!robustness)return;
      const intro=create("p","robust-intro","每个点是一次种子下的 B−A 结果；横线为样本 P10–P90，圆点为中位数。各指标横轴有独立刻度，不能跨指标直接比长度。");
      root.append(intro);
      const cards=create("div","robust-grid");
      robustness.metrics.forEach(spec=>{
        const tile=create("article","robust-tile");
        const head=create("div","robust-tile-head");
        head.append(create("strong","",spec.name));
        head.append(create("span","robust-median","中位差 "+(spec.p50>0?"+":"")+fmt(spec.p50)));
        tile.append(head);
        const svg=svgNode("svg",{viewBox:"0 0 480 94",role:"img","aria-label":spec.name+"：差值 P10 "+fmt(spec.p10)+"，中位数 "+fmt(spec.p50)+"，P90 "+fmt(spec.p90)});
        const left=19,right=461,center=240,y=39;
        const scale=Math.max(.05,Math.abs(spec.min),Math.abs(spec.max))*1.13;
        const x=v=>Math.max(left,Math.min(right,center+v/scale*(right-center)));
        svg.append(svgNode("line",{x1:left,y1:y,x2:right,y2:y,stroke:"#e1e9ef","stroke-width":1.5}));
        svg.append(svgNode("line",{x1:center,y1:10,x2:center,y2:68,stroke:"#9aabb9","stroke-width":1.3,"stroke-dasharray":"3 3"}));
        spec.values.forEach((v,i)=>{
          svg.append(svgNode("circle",{cx:x(v),cy:y+((i*7)%11-5)*2,r:2.5,fill:"#8a9bad",opacity:.36}));
        });
        svg.append(svgNode("line",{x1:x(spec.p10),y1:y,x2:x(spec.p90),y2:y,stroke:"#087d8d","stroke-width":6,"stroke-linecap":"round"}));
        svg.append(svgNode("circle",{cx:x(spec.p50),cy:y,r:6,fill:"#b6753b",stroke:"#fff","stroke-width":1.5}));
        for(const [pos,value,anchor] of [[left,-scale,"start"],[center,0,"middle"],[right,scale,"end"]]){
          svg.append(svgNode("text",{x:pos,y:83,"font-size":12,"text-anchor":anchor,fill:"#7c8fa0"},(value>0?"+":"")+fmt(value)));
        }
        tile.append(svg);
        const bottom=create("div","robust-tile-bottom");
        const interval=create("span","", "P10 "+fmt(spec.p10)+"  ·  P90 "+fmt(spec.p90));
        const shares=create("span","", "B>A："+spec.positive+" / "+robustness.n+" 组");
        bottom.append(interval,shares);tile.append(bottom);
        cards.append(tile);
      });
      root.append(cards);
      const explain=create("p","robust-explain","这里展示的是模拟输出在 "+robustness.n+" 组种子下的差异分布；“B>A”仅为样本计数，不是现实发生概率，也不代表政策优劣。");
      root.append(explain);
    }
    async function runRobustness(){
      if(!comparison || comparison.stale){
        el("robust-status").textContent="请先运行或更新 A/B 对比，再执行多种子检查。";
        return;
      }
      const n=Number(el("robust-n").value);
      if(![24,48,96].includes(n)){
        el("robust-status").textContent="请选择受支持的模拟组数。";
        return;
      }
      const baseline={seed:comparison.seed,type:comparison.type,params:Object.assign({},comparison.params),ticks:comparison.ticks};
      const token=++activeRobustnessToken;
      const runBtn=el("btn-robust");
      const cancelBtn=el("btn-cancel-robust");
      runBtn.disabled=true;
      cancelBtn.hidden=false;
      const all=keys.map(k=>({key:k.key,name:k.name,values:[]}));
      try{
        for(let i=0;i<n;i++){
          if(token!==activeRobustnessToken)return;
          const seed=sampleSeed(baseline.seed,i);
          const A=new Sim(seed,baseline.params),B=new Sim(seed,baseline.params);
          const shock=B.shock(baseline.type);
          if(!shock.ok)throw new Error("冲击未被原有模型接受："+baseline.type);
          for(let t=0;t<baseline.ticks;t++){A.step();B.step();}
          all.forEach(rec=>rec.values.push(currentMetric(B,rec.key)-currentMetric(A,rec.key)));
          if((i+1)%8===0 || i===n-1){
            el("robust-status").textContent="正在计算 "+(i+1)+" / "+n+" 组模型对照…";
            await new Promise(resolve=>setTimeout(resolve,0));
          }
        }
        if(token!==activeRobustnessToken)return;
        robustness={
          seed:baseline.seed,type:baseline.type,n,ticks:baseline.ticks,params:baseline.params,
          metrics:all.map(rec=>{
            const sorted=[...rec.values].sort((a,b)=>a-b);
            return {
              key:rec.key,name:rec.name,values:rec.values,
              min:sorted[0],max:sorted[sorted.length-1],
              p10:percentile(sorted,.1),p50:percentile(sorted,.5),p90:percentile(sorted,.9),
              positive:rec.values.filter(v=>v>0).length
            };
          })
        };
        drawRobustness();
        el("robust-status").textContent="完成 "+n+" 组种子 · 从 "+baseline.seed+" 开始连续取种子（到上限循环）· 同一组内 A/B 的模型设置相同";
      }catch(error){
        el("robust-status").textContent="计算中断："+(error&&error.message?error.message:String(error));
      }finally{
        if(token===activeRobustnessToken){
          runBtn.disabled=false;
          cancelBtn.hidden=true;
        }
      }
    }
    el("btn-robust").addEventListener("click",runRobustness);
    el("btn-cancel-robust").addEventListener("click",()=>{
      activeRobustnessToken++;
      el("btn-robust").disabled=false;
      el("btn-cancel-robust").hidden=true;
      el("robust-status").textContent="已中止本次计算，未生成新的稳健性结果。";
    });
    el("btn-design-compare").addEventListener("click",()=>{
      runComparison();
      el("compare-section").scrollIntoView({block:"start",behavior:"auto"});
    });
    function exportResearch(){
      if(!comparison)return;
      const modelSummary=model=>Object.fromEntries(keys.map(k=>[k.key,currentMetric(model,k.key)]));
      const snapshots=model=>model.snapshots.map(snap=>({
        tick:snap.tick,
        metrics:Object.fromEntries(keys.map(k=>[k.key,snapshotMetric(snap,k.key)]))
      }));
      const data={
        schema:"zhongkai-v3-research-1",
        exportedAt:new Date().toISOString(),
        model:"Original model.js (unmodified)",
        disclaimer:"模型内实验；同种子不保证严格因果配对，结果不是现实经济预测。",
        researchQuestion:comparison.question,
        A_B:{seed:comparison.seed,shock:comparison.type,ticks:comparison.ticks,params:comparison.params,
          stale:!!comparison.stale,
          baselineFinal:modelSummary(comparison.A),scenarioFinal:modelSummary(comparison.B),
          baselineHistory:snapshots(comparison.A),scenarioHistory:snapshots(comparison.B)},
        multiseed:robustness?{
          seed:robustness.seed,shock:robustness.type,count:robustness.n,ticks:robustness.ticks,params:robustness.params,
          metrics:robustness.metrics
        }:null
      };
      const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement("a");
      anchor.href=url;
      anchor.download="zhongkai-v3-research-seed-"+comparison.seed+".json";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    el("btn-export").addEventListener("click",exportResearch);

    el("btn-compare").addEventListener("click",runComparison);
    el("compare-tick").addEventListener("input",()=>{
      if(comparison)renderComparisonAt(Number(el("compare-tick").value));
    });
    el("toggle-compare").addEventListener("click",()=>{
      const opened=el("compare-section").classList.toggle("fullscreen");
      document.body.classList.toggle("comparison-open",opened);
      el("toggle-compare").setAttribute("aria-pressed",String(opened));
      el("toggle-compare").textContent=opened?"退出专注模式 ×":"专注对比 ⛶";
    });
    document.addEventListener("keydown",e=>{
      if(e.key==="Escape" && el("compare-section").classList.contains("fullscreen")){
        el("toggle-compare").click();
      }
    });
    el("btn-clear-compare").addEventListener("click",()=>{
      comparison=null;
      if(typeof refreshWindResults==="function")refreshWindResults();
      resetRobustness("请先运行 A/B 对比，再执行多种子检查。");
      el("btn-export").disabled=true;
      el("compare-tick").disabled=true;
      el("compare-tick").value="20";
      el("compare-tick-value").textContent="t20 / 20";
      el("compare-timeline-hint").textContent="运行后可拖动到任意模型时间步，查看同一时刻的网络与指标差异。";
      el("compare-trends").replaceChildren(create("p","no-result","等待 A/B 模型运行。"));
      el("compare-agents").replaceChildren(create("p","no-result","等待主体差异计算。"));
      el("compare-provenance").textContent="对比尚未运行。运行后展示随机种子、实验设置与对比口径。";
      el("scenario-label").textContent=el("shock-sel").value+" · 在第 0 步注入";
      clearMini(el("graph-a"),"等待模拟");
      clearMini(el("graph-b"),"等待模拟");
      el("compare-metrics").replaceChildren(create("p","no-result","等待执行 A/B 对比。"));
      el("status-a").textContent="未运行";el("status-b").textContent="未运行";
      el("compare-note").textContent="基线 A 与冲击 B 使用相同种子和模型参数，均演化 20 步。B 在第 0 步注入选定冲击；此对照不修改上方当前局。";
    });

    /* V3.7: actual model-driven exploration, not a decorative fake forecast. */
    const shareApi=window.ZKShare;
    const windCatalog={
      "链主外迁":"模拟链主退出后的网络连带影响和存续变化",
      "芯片断供":"测试关键上游中断时网络如何传播压力",
      "限电":"检验用能约束冲击在模型内的扩散",
      "订单外流":"追踪需求下降对企业与协同的影响",
      "融资难":"探索资金压力对景气和存续的影响",
      "供应链中断":"观察连接失灵的连锁效应",
      "订单爆发":"研究需求增加的机会与潜在承载约束",
      "政策利好":"探索支持性环境改变后的动态效果",
      "技术突破":"观察技术改善下的增长与风险变化"
    };
    function syncWindChoices(){
      if(!shareApi)return;
      const type=el("shock-sel").value;
      document.querySelectorAll(".wind-preset").forEach(button=>{
        button.setAttribute("aria-pressed",String(button.dataset.shock===type));
      });
      el("wind-topic").textContent=type;
      el("wind-description").textContent=(windCatalog[type]||"检验此情景下模型产业主体和网络指标的变化。")+
       " 所有结果仅适用于当前模型与参数设定。";
      if(comparison&&comparison.type!==type){
        el("wind-feedback").textContent="情景输入已改变。重新运行 A/B 后才会更新结果，当前旧对比不能当作新情景。";
        el("wind-impact").replaceChildren();
      }
    }
    function refreshWindResults(){
      const tiles=el("wind-impact");
      if(!tiles)return;
      tiles.replaceChildren();
      if(!comparison||comparison.stale){
        el("wind-feedback").textContent="尚无当前有效模型对照。先选择情景，再点击“运行并对比”。";
        return;
      }
      const specs=[
        {key:"abundance",name:"景气变化 Δ"},
        {key:"order",name:"协同变化 Δ"},
        {key:"disaster",name:"风险变化 Δ"},
        {key:"survivors",name:"存续率变化 Δ"}
      ];
      for(const spec of specs){
        const difference=currentMetric(comparison.B,spec.key)-currentMetric(comparison.A,spec.key);
        const item=create("div");
        item.append(create("span","",spec.name),
          create("b",difference>0?"up":difference<0?"down":"", (difference>0?"+":"")+difference.toFixed(3)));
        tiles.append(item);
      }
      el("wind-feedback").textContent="已运行 "+comparison.type+" · 种子 "+comparison.seed+
        " · 对照显示模型内部指数差值 B − A。可拖动下方 A/B 时间轴继续研究和质疑。";
    }
    function setupWindDeck(){
      if(!shareApi)return;
      const risk=el("wind-risk"),opportunity=el("wind-opportunity");
      const riskList=["链主外迁","芯片断供","限电","订单外流","融资难","供应链中断"];
      const gainList=["订单爆发","政策利好","技术突破"];
      for(const [target,list,isGain] of [[risk,riskList,false],[opportunity,gainList,true]]){
        for(const shock of list){
          const button=create("button","wind-preset"+(isGain?" opportunity":""));
          button.type="button";button.dataset.shock=shock;button.setAttribute("aria-pressed","false");
          button.append(create("strong","",shock),create("small","",isGain?"+ 增长条件":"! 风险扰动"));
          button.addEventListener("click",()=>{
            el("shock-sel").value=shock;
            el("shock-sel").dispatchEvent(new Event("change",{bubbles:true}));
            el("wind-deck").scrollIntoView({block:"nearest",behavior:"auto"});
          });
          target.append(button);
        }
      }
      const impact=create("div","wind-impact");impact.id="wind-impact";
      el("wind-spotlight").append(impact);
      syncWindChoices();
      el("wind-run").addEventListener("click",()=>{
        runComparison();
        if(comparison&&!comparison.stale){
          el("compare-section").scrollIntoView({block:"start",behavior:"auto"});
        }
      });
      el("wind-copy").addEventListener("click",async()=>{
        const seed=safeSeed(),shock=el("shock-sel").value;
        if(seed===null||!shareApi.valid(seed,shock))return;
        const link=new URL(window.location.href);
        link.searchParams.set("scenario",shareApi.encode(seed,shock));
        link.hash="";
        try{
          if(!navigator.clipboard||typeof navigator.clipboard.writeText!=="function")throw Error("clipboard unavailable");
          await navigator.clipboard.writeText(link.toString());
          el("wind-feedback").textContent="已复制可复现实验链接 · "+shock+" · 种子 "+seed+
            "。链接只保存输入；不包含真实概率、模拟分数或不可变模型版本。";
        }catch{
          const old=el("wind-share-fallback");if(old)old.remove();
          const field=create("textarea","wind-share-fallback",link.toString());
          field.id="wind-share-fallback";field.readOnly=true;field.setAttribute("aria-label","可手动复制的情景链接");
          el("wind-feedback").after(field);field.focus();field.select();
          el("wind-feedback").textContent="剪贴板不可用，请复制下方链接。";
        }
      });
      const params=new URLSearchParams(window.location.search);
      const incoming=shareApi.decode(params.get("scenario"));
      if(incoming){
        el("seed-input").value=String(incoming.seed);
        el("shock-sel").value=incoming.shock;
        el("research-question").value="复现实验链接："+incoming.shock+"（种子 "+incoming.seed+"）";
        syncWindChoices();
        el("wind-feedback").textContent="已读取他人分享的实验条件。可点击运行并对比，复现本版本原模型结果；链接不证明现实中的效果。";
      }else if(params.has("scenario")){
        el("wind-feedback").textContent="分享参数格式无效或不受支持，已忽略。当前是本地默认情景。";
      }
    }
    setupWindDeck();

    clearMini(el("graph-a"),"等待模拟");
    clearMini(el("graph-b"),"等待模拟");
  }catch(error){
    fail(error&&error.message?error.message:String(error));
    if(window.console)console.error(error);
  }
})();