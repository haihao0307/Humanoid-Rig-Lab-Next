(function(){'use strict';
const app=window.__REALITY_S312_LOCAL__,section=document.createElement('section');section.className='card';section.id='boundary-obstruction';const costs=document.getElementById('all-channels').closest('section');costs.before(section);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
let lastTrust=null;
function render(){const r=app.report(),audit=r.data.boundaryAudit;if(lastTrust===r.trust&&section.childElementCount)return;lastTrust=r.trust;section.replaceChildren();section.append(node('h2','新的范围限制：固定边本来就穿过身体'));
 section.append(node('p',(r.trust==='built-in'?'原生冻结状态的几何复核':'外部文件声明，未重新运行原人物')+'。第30步只允许移动427、448、449时，相邻衣物边48—49两端均不动，却已经严格穿过两个身体三角面。','notice'));
 const t=document.createElement('table'),head=document.createElement('tr');for(const x of ['来源状态','可动节点数','仍跨身体的固定边','严格交点数'])head.append(node('th',x));t.append(head);
 for(const c of audit.cases)for(let i=0;i<c.stages.length;i++){const s=c.stages[i],tr=document.createElement('tr');for(const x of ['第'+c.step+'步 / 边界检查'+(i+1),s.movableNodes.length,s.blockedEdges,s.hits.length])tr.append(node('td',String(x)));t.append(tr);}const wrap=node('div',undefined,'table-wrap');wrap.append(t);section.append(wrap);
 section.append(node('p','只移动第三个角点，无法让一条两端不动、且已与身体相交的边分离。因此这个三点范围先天不足；必须先处理被锁在范围边界上的交叉。','compact'));
 section.append(node('p','第30步纳入48、49后，五点范围不再有这种固定边障碍，但这只是必要条件：不代表已经找到满足全部接触与形变限制的位移。本轮十三点求解也未通过，不能将“扩大范围”直接写成成功。第102步的边界检查继续传播到16点仍未闭合。','notice compact'));
 const detail=document.createElement('details'),summary=node('summary','查看两处严格交点与冻结几何来源');detail.append(summary,node('pre',JSON.stringify({fixtureRun:audit.fixtureRun,fixtureSHA256:audit.cases[0].fixtureSHA256,firstFixedEdgeHits:audit.cases[0].stages[0].hits,limitations:audit.limitations},null,2)));section.append(detail);
}
render();new MutationObserver(render).observe(document.getElementById('trust'),{childList:true,subtree:true,characterData:true});
})();
