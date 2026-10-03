// Milestones, not elapsed-time estimates. No interval ever advances this bar.
export function createLoadProgress(bar,label){
 let completed=0,epoch=0;const history=[];
 const names=['读取动物文件','内嵌文件已解包','生成动物与初始化画面','绑定参数与动作','准备完成'];
 function update(value,token=epoch){if(token!==epoch)return;completed=Math.max(completed,Math.min(4,value));bar.value=completed;label.textContent=names[completed]+' · '+completed+' / 4';bar.setAttribute('aria-valuetext',label.textContent);history.push({epoch,completed,at:performance.now()});}
 return {start(token){epoch=token;completed=0;history.length=0;update(0);},update,history,error(){label.textContent='加载未完成 · '+completed+' / 4';}};
}
