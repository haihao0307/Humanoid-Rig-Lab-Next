(function(){
'use strict';
const S=FirstFault34.summarize(RF34_DATA),t=S.terminal,e=t.edge,el=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;return n;};
const section=el('section','');section.className='card';section.id='terminal-fault';
section.append(el('h2','真正触发回滚：第 '+t.fittingStepOneBased+' 个适配步 · '+(t.role==='top'?'上衣':'下装')+' '+e.panelId+' · 边 '+e.edgeIndex));
section.append(el('p','当前 '+(e.lengthM*1000).toFixed(6)+' mm ÷ 原参考 '+(e.restM*1000).toFixed(6)+' mm = '+e.ratio.toFixed(6)+'，超过原门限 1.45。原门对应长度上界为 '+(e.restM*1.45*1000).toFixed(6)+' mm。'));
if(t.firstTransientRecoveredAt)section.append(el('p','更早出现的'+(S.firstObserved.worstEdge.role==='top'?'上衣':'裤片')+'瞬时峰值 '+S.firstObserved.worstEdge.ratio.toFixed(6)+' 已在随后检查点回落；它不是本次最终触发回滚的同一事件。'));
const last=t.lastIncreaseBeforeGate,si=e.solver;
if(last.before&&last.before.states[si].maxEdgeIndex===e.edgeIndex&&last.after.states[si].maxEdgeIndex===e.edgeIndex)section.append(el('p','最后一次记录增大：'+last.before.states[si].maxRatio.toFixed(6)+' → '+last.after.states[si].maxRatio.toFixed(6)+'；发生在 '+last.after.stage+'。该操作之前已经略超限，不能把它单独称为全部根因。'));
const row=el('div','');row.className='toolbar';
function focus(){const select=document.getElementById('edge-select');const found=[...select.options].find(o=>o.textContent.includes('原门禁前')&&o.textContent.endsWith('边 '+e.edgeIndex));if(!found)throw Error('TERMINAL_EDGE_OPTION_MISSING');select.value=found.value;select.dispatchEvent(new Event('change'));window.__REALITY_S34__.selectEvent(S.guard.event.sequence-1);}
const button=el('button','定位真正回滚边');button.className='primary';button.id='focus-terminal';button.onclick=focus;row.append(button);
const prediction=el('button','查看最后持续跨线阶段');prediction.id='focus-persistent';prediction.onclick=()=>window.__REALITY_S34__.selectEvent(t.persistentRoleCrossing.after.sequence-1);row.append(prediction);section.append(row);
const warning=el('p','分级后候选参考长度为 '+(e.targetRestM*1000).toFixed(6)+' mm；与运行使用的原参考不同。这只是待核对的参考度量差异，不授权直接替换参考长度来让门禁通过。');warning.className='muted small';section.append(warning);
document.getElementById('metrics').before(section);
document.querySelector('#metrics .metric span').textContent='最早瞬时峰值（与最终回滚分开）';
})();
