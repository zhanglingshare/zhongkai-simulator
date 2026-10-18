/* Read-only language for the story edition. No model rules or forecasts. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ZKStoryReading=api;})(typeof window!=='undefined'?window:null,function(){'use strict';
function explain(info,tick){const exits=info.exits.length,kept=info.returns.length,delta=info.b.alive-info.a.alive,changed=info.weaker.length+info.stronger.length;
 const prefix='第 '+tick+' 步：';
 if(exits||kept)return prefix+'只在改变后退出 '+exits+' 个，只在改变后仍运转 '+kept+' 个，合起来'+(delta>0?'净多 '+delta+' 个':delta<0?'净少 '+(-delta)+' 个':'数量相同')+'。'+(delta>=0?'总数不能代替具体名单。':'向下看，具体是谁。');
 return prefix+(changed?'数量相同，但 '+changed+' 个存续角色的经营状态不同。':'两边数量相同，尚未发现明显角色差异。');
}
function question(settings,edges,preferred){
 if(settings.kind==='exit'){
  const neighbors=[...new Set(edges.flatMap(e=>e.a===settings.target?[e.b]:e.b===settings.target?[e.a]:[]))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
  const role=neighbors.includes(preferred)?preferred:neighbors[0]||null;
  return {role,title:role?'「'+settings.target+'」与「'+role+'」在现实中有可核实的业务或用工联系吗？':'「'+settings.target+'」在现实中有哪些直接业务或用工联系？',
   check:'向双方核对同一时期的订单、协作或用工记录，记下日期与出处。',
   scope:'这是一条待核实的模型关系。年度总量或单方项目材料，不能单独证明双方确有联系。'};
 }
 const growth=['技术突破','订单爆发','政策利好'].includes(settings.shock),supply=['芯片断供','供应链中断','限电'].includes(settings.shock);
 return {role:null,title:growth?'「'+settings.shock+'」带来的新增订单或生产，已经兑现了吗？':supply?'「'+settings.shock+'」是否已让企业减产或停产？':'「'+settings.shock+'」涉及的实际变化，发生在谁身上、幅度有多大？',
  check:growth?'核对同一项目的承诺、实际订单和生产记录，分开记录计划与兑现。':supply?'核对发生时间、受影响企业及实际生产记录。': '核对同一时期的企业记录，分别记下变化前后和来源。',
  scope:'这是当前情景需要补证的问题。年度总量和单条企业材料，不能单独证实这次变化或它的影响。'};
}
return {explain,question};
});
