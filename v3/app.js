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
      if(comparison){
        comparison.stale=true;
        el("compare-note").textContent="实验设置已变化：下方保留上一次对比（种子 "+comparison.seed+"，冲击“"+comparison.type+"”）。点击“按当前选择运行 A/B”才能更新结果。";
        el("status-b").textContent="旧结果 · t"+comparison.tick;
      }
    }
    el("shock-sel").addEventListener("change",()=>{
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
        comparison={seed,type,A,B,A0,B0,params,positions,ticks,tick:ticks,focus:null,stale:false};
        el("compare-tick").disabled=false;
        el("compare-tick").max=String(ticks);
        renderComparisonAt(ticks);
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
    clearMini(el("graph-a"),"等待模拟");
    clearMini(el("graph-b"),"等待模拟");
  }catch(error){
    fail(error&&error.message?error.message:String(error));
    if(window.console)console.error(error);
  }
})();