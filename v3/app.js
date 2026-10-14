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
        el("compare-note").textContent="设置已变化：下方保留上一轮对比，点击“按当前选择运行 A/B”更新。当前局的运行不改变上一轮 A/B 结果。";
        el("status-b").textContent="历史对比";
      }
    }
    el("shock-sel").addEventListener("change",()=>{
      el("scenario-label").textContent=el("shock-sel").value+" · 在第 0 步注入";
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
    function metricPairs(a,b){
      const result=el("compare-metrics");
      result.replaceChildren();
      keys.forEach(spec=>{
        const A=currentMetric(a,spec.key),B=currentMetric(b,spec.key);
        const difference=B-A;
        const item=create("div","delta-card");
        item.append(create("div","name",spec.name));
        item.append(create("div","values","A "+fmt(A)+" / B "+fmt(B)));
        const num=create("strong",difference>=0?"positive":"negative",(difference>0?"+":"")+fmt(difference));
        item.append(num);
        const bar=create("div","delta-bar");
        const fill=create("span");
        fill.style.width=Math.min(100,Math.abs(difference)/(spec.range[1]-spec.range[0])*100)+"%";
        if(difference<0)fill.style.background="#087d8d";
        bar.append(fill);item.append(bar);
        result.append(item);
      });
    }
    function drawCompareNetwork(svg,model,positions){
      svg.replaceChildren();
      const sx=1,sy=430/560;
      const labelNames=new Set(model.agents.filter(a=>a.type==="anchor").map(a=>a.name));
      model.edges.forEach(edge=>{
        const p=positions[edge.a],q=positions[edge.b];
        if(!p||!q)return;
        const a=model._byName(edge.a),b=model._byName(edge.b);
        svg.append(svgNode("line",{x1:p.x*sx,y1:p.y*sy,x2:q.x*sx,y2:q.y*sy,stroke:"#b6c8d1","stroke-width":1.5,opacity:a&&b&&a.alive&&b.alive?.48:.09}));
      });
      model.agents.forEach(a=>{
        const p=positions[a.name];if(!p)return;
        const color=typeof typeColor==="function"?typeColor(a.type):"#087d8d";
        const g=svgNode("g",{opacity:a.alive?1:.29});
        g.append(svgNode("circle",{cx:p.x*sx,cy:p.y*sy,r:a.type==="anchor"?12:7.5,fill:a.alive?color:"#a8b6c2",stroke:a.sentiment<-.12?"#bd6460":"#fff","stroke-width":a.type==="anchor"?3:1.5}));
        g.append(svgNode("title",{},a.name+(a.alive?"":"（已退场）")));
        if(labelNames.has(a.name))g.append(svgNode("text",{x:p.x*sx,y:p.y*sy-17,"text-anchor":"middle","font-size":14,fill:"#41556a"},a.name));
        svg.append(g);
      });
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
        const ticks=params.ticks||20;
        for(let t=0;t<ticks;t++){A.step();B.step();}
        const positions=layoutForce(A.agents,A.edges,760,560);
        drawCompareNetwork(el("graph-a"),A,positions);
        drawCompareNetwork(el("graph-b"),B,positions);
        metricPairs(A,B);
        el("status-a").textContent="已运行 t"+ticks;
        el("status-b").textContent="已运行 t"+ticks;
        el("scenario-label").textContent=type+" · 第 0 步";
        el("compare-note").textContent="计算完成 · 相同种子 "+seed+" · 每局 "+ticks+" 步 · B 在 t0 注入“"+type+"”冲击"+(applied.killed?" · 直接退场 "+applied.killed+" 个模型主体":"")+"。注意：冲击可能改变随机数消耗顺序，同种子不等于严格因果识别。";
        comparison={seed,type,A,B};
        if(matchMedia("(max-width:760px)").matches)switchMobile("compare");
      }catch(e){
        fail(e&&e.message?e.message:String(e));
      }finally{
        btn.disabled=false;btn.textContent=originalText;
      }
    }
    el("btn-compare").addEventListener("click",runComparison);
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