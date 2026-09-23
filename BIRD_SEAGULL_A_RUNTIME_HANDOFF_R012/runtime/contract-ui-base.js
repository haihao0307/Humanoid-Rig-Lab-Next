(()=>{
'use strict';
const $=id=>document.getElementById(id);
const C=window.__BIRD_R007_CONTRACT;
const fail=(message,error)=>{
  const text=String(message||error?.message||error||'R0.07 合同层未知错误');
  const el=$('contractStatus');
  if(el){el.textContent='合同层失败：'+text;el.className='contract-status error'}
  window.__BIRD_R007_CONTRACT_QA={ready:false,error:text};
  if(error)console.error(error);else console.error(text);
};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const fmt=(v,d=3)=>Number(v).toFixed(d);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function phaseAt(frameZero){
  const f=frameZero+1;
  if(f<=9)return{id:'downstroke',label:'下击候选',note:'翼尖平均 Y 正在下降'};
  if(f===10)return{id:'bottom',label:'下止点反转',note:'翼尖平均 Y 达到来源最小值'};
  if(f<=40)return{id:'upstroke',label:'上举候选',note:'翼尖平均 Y 正在上升'};
  if(f===41)return{id:'top',label:'上止点反转',note:'翼尖平均 Y 达到来源最大值'};
  return{id:'return',label:'回落 / 下击候选',note:'翼尖平均 Y 回落至循环入口'};
}
function setupPhaseBand(){
  const band=$('phaseBand');
  if(!band)return;
  band.innerHTML='';
  const ranges=[
    {n:9,label:'下击候选',cls:'down'},
    {n:1,label:'下止点反转',cls:'reversal'},
    {n:30,label:'上举候选',cls:'up'},
    {n:1,label:'上止点反转',cls:'reversal top'},
    {n:9,label:'回落 / 下击候选',cls:'return'}
  ];
  for(const r of ranges){
    const i=document.createElement('i');
    i.style.width=(r.n/50*100)+'%';
    i.className=r.cls;
    i.title=r.label;
    band.appendChild(i);
  }
}
function setupEvents(api){
  const root=$('keyFrames');
  if(!root)return;
  root.innerHTML='';
  const labels={
    cycle_entry:['循环入口','来源帧'],
    bottom_reversal:['下止点','翼尖 Y 最小'],
    fastest_upstroke_interval:['最快上举','速度峰值'],
    top_reversal:['上止点','翼尖 Y 最大'],
    body_minimum:['身体最低','滞后 4 帧'],
    maximum_asymmetry:['最大不对称','同时最大翼展'],
    maximum_span:['最大翼展','与不对称同帧'],
    fastest_downstroke_interval:['最快下击','速度峰值']
  };
  const order=['cycle_entry','bottom_reversal','fastest_upstroke_interval','top_reversal','body_minimum','maximum_asymmetry','fastest_downstroke_interval'];
  const byId=Object.fromEntries(C.eventLedger.map(e=>[e.id,e]));
  for(const id of order){
    const e=byId[id]; if(!e)continue;
    const b=document.createElement('button');
    b.type='button';b.dataset.frame=String(e.frame-1);b.dataset.event=id;
    const [a,c]=labels[id]||[id,''];
    b.innerHTML=`<b>${String(e.frame).padStart(2,'0')}</b><span>${a}</span><small>${c}</small>`;
    b.addEventListener('click',()=>api.setFrame(e.frame-1));
    root.appendChild(b);
  }
}
function setupAudits(){
  const seg=$('segmentAudit');
  if(seg){
    const rows=[
      ['左翼 根→内',C.segmentLengthAudit.leftRootToInner],
      ['左翼 内→外',C.segmentLengthAudit.leftInnerToOuter],
      ['左翼 外→尖',C.segmentLengthAudit.leftOuterToTip],
      ['右翼 根→内',C.segmentLengthAudit.rightRootToInner],
      ['右翼 内→外',C.segmentLengthAudit.rightInnerToOuter],
      ['右翼 外→尖',C.segmentLengthAudit.rightOuterToTip]
    ];
    seg.innerHTML=rows.map(([name,m])=>`<div><span>${name}</span><b>${m.mean.toFixed(4)}</b><small>漂移 ${m.range.toExponential(1)}</small></div>`).join('');
  }
  const risks=$('riskList');
  if(risks){
    const names={
      outer_chain_nearly_locked:'外翼链近似锁死',
      late_cycle_asymmetry_spike:'循环末段不对称峰值',
      speed_imbalance:'上下行速度不对称',
      body_lag:'身体相位滞后'
    };
    risks.innerHTML=C.riskFlags.map(r=>`<div class="risk"><b>${names[r.id]||r.id}</b><span>${r.evidence}</span><small>${r.risk}</small></div>`).join('');
  }
  const transfer=$('transferList');
  if(transfer){
    transfer.innerHTML=C.transferCandidates.map(x=>`<div class="transfer"><i>可蒸馏</i><span>${x}</span></div>`).join('')+
      C.nonTransferableOrUnproven.map(x=>`<div class="transfer reject"><i>不可继承</i><span>${x}</span></div>`).join('');
  }
  $('bottomFrame').textContent=String(C.timingAudit.bottomReversalFrame).padStart(2,'0');
  $('topFrame').textContent=String(C.timingAudit.topReversalFrame).padStart(2,'0');
  $('lagFrames').textContent=C.timingAudit.bodyMinimumLagAfterTopFrames+' 帧';
  $('speedRatio').textContent=C.timingAudit.absoluteDownToUpSpeedRatio.toFixed(2)+'×';
  $('symmetryPeak').textContent=C.symmetryAudit.maxRms.toFixed(4)+' @ F'+String(C.symmetryAudit.maxFrame).padStart(2,'0');
  $('wristLock').textContent=C.angleRangeAudit.leftWristFoldDeg.range.toFixed(4)+'°';
}
function canvasSize(canvas,minW=260,minH=160){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const w=Math.max(minW,Math.floor(canvas.clientWidth*dpr));
  const h=Math.max(minH,Math.floor(canvas.clientHeight*dpr));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
  return{ctx:canvas.getContext('2d'),w,h,dpr};
}
function drawGrid(ctx,w,h,pad,dpr,yLabels=[]){
  ctx.fillStyle='#08151d';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#203b48';ctx.lineWidth=dpr;
  for(let i=0;i<=4;i++){
    const y=pad.t+i/4*(h-pad.t-pad.b);ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();
  }
  ctx.font=`${9*dpr}px sans-serif`;ctx.fillStyle='#6f8995';ctx.textAlign='right';
  yLabels.forEach((v,i)=>{const y=pad.t+i/(Math.max(1,yLabels.length-1))*(h-pad.t-pad.b);ctx.fillText(String(v),pad.l-5*dpr,y+3*dpr)});
  ctx.strokeStyle='#31505d';ctx.strokeRect(pad.l,pad.t,w-pad.l-pad.r,h-pad.t-pad.b);
}
function drawSeries(ctx,data,X,Y,color,width=1.8,dpr=1){
  ctx.strokeStyle=color;ctx.lineWidth=width*dpr;ctx.beginPath();
  data.forEach((v,i)=>{const x=X(i),y=Y(v);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();
}
function eventMarkers(ctx,X,pad,h,dpr){
  const events=[10,22,41,45,47,49];
  ctx.save();ctx.setLineDash([3*dpr,3*dpr]);ctx.strokeStyle='#6d889455';ctx.lineWidth=dpr;
  for(const f of events){const x=X(f-1);ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,h-pad.b);ctx.stroke()}
  ctx.restore();
}
function drawContractGraph(frame){
  const c=$('phaseContractGraph');if(!c)return;
  const {ctx,w,h,dpr}=canvasSize(c,300,210),pad={l:42*dpr,r:12*dpr,t:14*dpr,b:25*dpr};
  const pw=w-pad.l-pad.r,ph=h-pad.t-pad.b,X=i=>pad.l+i/49*pw;
  drawGrid(ctx,w,h,pad,dpr,['0.30','0.05','-0.20','-0.45','-0.70']);
  const yMin=-0.72,yMax=.30,Y=v=>pad.t+(yMax-v)/(yMax-yMin)*ph;
  const blocks=[{a:0,b:8,c:'#3d86a522'},{a:9,b:9,c:'#d8b45d33'},{a:10,b:39,c:'#4ab98e22'},{a:40,b:40,c:'#d8b45d33'},{a:41,b:49,c:'#a37ac222'}];
  for(const q of blocks){ctx.fillStyle=q.c;ctx.fillRect(X(q.a),pad.t,Math.max(2*dpr,X(Math.min(49,q.b+1))-X(q.a)),ph)}
  drawSeries(ctx,C.series.averageWingtipY,X,Y,'#72d8ed',2,dpr);
  drawSeries(ctx,C.series.bodyY.map(v=>v*5),X,Y,'#e8b964',1.5,dpr);
  eventMarkers(ctx,X,pad,h,dpr);
  ctx.strokeStyle='#ffffff';ctx.lineWidth=1.2*dpr;ctx.beginPath();ctx.moveTo(X(frame),pad.t);ctx.lineTo(X(frame),h-pad.b);ctx.stroke();
  ctx.fillStyle='#eaf6f9';ctx.textAlign='center';ctx.fillText('F'+String(frame+1).padStart(2,'0'),X(frame),h-7*dpr);
}
function drawVelocityGraph(frame){
  const c=$('velocityGraph');if(!c)return;
  const {ctx,w,h,dpr}=canvasSize(c,300,150),pad={l:42*dpr,r:12*dpr,t:14*dpr,b:24*dpr};
  const data=C.series.averageWingtipVelocityPerSecond;const max=Math.max(...data.map(Math.abs))*1.08,pw=w-pad.l-pad.r,ph=h-pad.t-pad.b,X=i=>pad.l+i/49*pw,Y=v=>pad.t+(max-v)/(2*max)*ph;
  drawGrid(ctx,w,h,pad,dpr,[max.toFixed(1),(max/2).toFixed(1),'0',(-max/2).toFixed(1),(-max).toFixed(1)]);
  ctx.strokeStyle='#8098a3';ctx.beginPath();ctx.moveTo(pad.l,Y(0));ctx.lineTo(w-pad.r,Y(0));ctx.stroke();
  drawSeries(ctx,data,X,Y,'#d87dc9',1.8,dpr);eventMarkers(ctx,X,pad,h,dpr);
  ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(X(frame),pad.t);ctx.lineTo(X(frame),h-pad.b);ctx.stroke();
}
function drawAngleGraph(frame){
  const c=$('angleGraph');if(!c)return;
  const {ctx,w,h,dpr}=canvasSize(c,300,205),pad={l:42*dpr,r:12*dpr,t:14*dpr,b:25*dpr};
  const pw=w-pad.l-pad.r,ph=h-pad.t-pad.b,X=i=>pad.l+i/49*pw,yMin=-60,yMax=75,Y=v=>pad.t+(yMax-v)/(yMax-yMin)*ph;
  drawGrid(ctx,w,h,pad,dpr,['75°','41°','8°','-26°','-60°']);
  drawSeries(ctx,C.series.leftRootElevationDeg,X,Y,'#42c9e8',1.8,dpr);
  drawSeries(ctx,C.series.rightRootElevationDeg,X,Y,'#dd78c9',1.5,dpr);
  drawSeries(ctx,C.series.leftElbowFoldDeg,X,Y,'#e9b963',1.5,dpr);
  eventMarkers(ctx,X,pad,h,dpr);
  ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(X(frame),pad.t);ctx.lineTo(X(frame),h-pad.b);ctx.stroke();
  ctx.fillStyle='#dce9ed';ctx.textAlign='center';ctx.fillText(String(frame+1),X(frame),h-7*dpr);
}
function point(api,frame,joint){
  if(api.sourceMode==='static'){
    const a=api.staticJoints;return[a[joint*3],a[joint*3+1],a[joint*3+2]];
  }
  const a=api.jointFrames,o=(frame*api.boneCount+joint)*3;return[a[o],a[o+1],a[o+2]];
}
function drawWingChain(api,frame){
  const c=$('chainCanvas');if(!c)return;
  const {ctx,w,h,dpr}=canvasSize(c,300,235);ctx.fillStyle='#08151d';ctx.fillRect(0,0,w,h);
  const panels=[{x:8*dpr,y:8*dpr,w:w-16*dpr,h:(h-24*dpr)/2,label:'正视：X / Y',axes:[0,1]},{x:8*dpr,y:(h/2)+4*dpr,w:w-16*dpr,h:(h-24*dpr)/2,label:'俯视：X / Z',axes:[0,2]}];
  const joints=[1,2,3,4,7,8,9,10];
  const pts=Object.fromEntries(joints.map(j=>[j,point(api,frame,j)]));
  for(const p of panels){
    ctx.strokeStyle='#284653';ctx.strokeRect(p.x,p.y,p.w,p.h);ctx.fillStyle='#7f99a5';ctx.font=`${9*dpr}px sans-serif`;ctx.fillText(p.label,p.x+8*dpr,p.y+13*dpr);
    const values=joints.map(j=>pts[j]);const xvals=values.map(v=>v[p.axes[0]]),yvals=values.map(v=>v[p.axes[1]]);let xmin=Math.min(...xvals),xmax=Math.max(...xvals),ymin=Math.min(...yvals),ymax=Math.max(...yvals);const xm=(xmax-xmin)*.12||.1,ym=(ymax-ymin)*.20||.1;xmin-=xm;xmax+=xm;ymin-=ym;ymax+=ym;
    const X=v=>p.x+(v-xmin)/(xmax-xmin)*p.w,Y=v=>p.y+p.h-(v-ymin)/(ymax-ymin)*p.h;
    ctx.strokeStyle='#1d3946';ctx.beginPath();ctx.moveTo(X(0),p.y);ctx.lineTo(X(0),p.y+p.h);ctx.stroke();
    const chain=(ids,color)=>{ctx.strokeStyle=color;ctx.lineWidth=2*dpr;ctx.beginPath();ids.forEach((id,i)=>{const v=pts[id],x=X(v[p.axes[0]]),y=Y(v[p.axes[1]]);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();ctx.fillStyle=color;ids.forEach(id=>{const v=pts[id],x=X(v[p.axes[0]]),y=Y(v[p.axes[1]]);ctx.beginPath();ctx.arc(x,y,3*dpr,0,Math.PI*2);ctx.fill()})};
    chain([1,2,3,4],'#42c9e8');chain([7,8,9,10],'#dd78c9');
    ctx.save();ctx.setLineDash([3*dpr,3*dpr]);ctx.strokeStyle='#92a9b680';ctx.lineWidth=dpr;ctx.beginPath();[1,2,3,4].forEach((id,i)=>{const v=pts[id].slice();v[0]*=-1;const x=X(v[p.axes[0]]),y=Y(v[p.axes[1]]);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();ctx.restore();
  }
}
function updateCurrent(api,frame){
  const phase=phaseAt(frame);$('contractPhase').textContent=phase.label;$('contractPhaseNote').textContent=phase.note;
  $('phaseLabel').textContent='数据合同：'+phase.label;$('phaseBoundary').textContent='由翼尖平均 Y 的方向与极值划分 · 非空气动力学真值';
  $('avgTipY').textContent=fmt(C.series.averageWingtipY[frame],4);
  $('tipVelocity').textContent=fmt(C.series.averageWingtipVelocityPerSecond[frame],3);
  $('rootElevation').textContent=fmt((C.series.leftRootElevationDeg[frame]+C.series.rightRootElevationDeg[frame])/2,2)+'°';
  $('elbowFold').textContent=fmt((C.series.leftElbowFoldDeg[frame]+C.series.rightElbowFoldDeg[frame])/2,2)+'°';
  $('symmetryRms').textContent=fmt(C.series.wingSymmetryRms[frame],4);
  $('bodyLagState').textContent=frame+1===C.timingAudit.bodyMinimumFrame?'身体最低点':'F45 为身体最低点';
  document.querySelectorAll('#keyFrames button').forEach(b=>b.classList.toggle('active',Number(b.dataset.frame)===frame));
  drawContractGraph(frame);drawVelocityGraph(frame);drawAngleGraph(frame);drawWingChain(api,frame);
}
async function start(){
  if(!C)throw new Error('R0.07 合同数据没有到达');
  let api=null;
  for(let i=0;i<300;i++){
    if(window.__BIRD_R007_API&&window.__BIRD_QA?.ready){api=window.__BIRD_R007_API;break}
    await sleep(20);
  }
  if(!api)throw new Error('基础三维运行时未就绪');
  setupPhaseBand();setupEvents(api);setupAudits();
  let lastFrame=-1,lastMode='';
  const tick=()=>{
    const frame=api.frame|0,mode=api.sourceMode;
    if(frame!==lastFrame||mode!==lastMode){lastFrame=frame;lastMode=mode;updateCurrent(api,frame)}
    requestAnimationFrame(tick);
  };
  window.addEventListener('resize',()=>updateCurrent(api,api.frame|0));
  updateCurrent(api,api.frame|0);
  const qa={
    ready:true,version:'R0.07',contractVersion:C.version,phaseCount:C.phaseContract.length,eventCount:C.eventLedger.length,
    bottomReversalFrame:C.timingAudit.bottomReversalFrame,topReversalFrame:C.timingAudit.topReversalFrame,
    maxSymmetryFrame:C.symmetryAudit.maxFrame,segmentAuditCount:Object.keys(C.segmentLengthAudit).length,
    externalRuntimeDependencies:0
  };
  window.__BIRD_R007_CONTRACT_QA=qa;
  Object.assign(window.__BIRD_QA,{contractReady:true,contractVersion:'R0.07',eventCount:qa.eventCount,phaseCount:qa.phaseCount});
  document.body.dataset.contractReady='true';
  const cs=$('contractStatus');if(cs){cs.textContent='运动合同层已载入｜反转点、翼链角度、对称性与风险边界已建立';cs.className='contract-status ready'}
  requestAnimationFrame(tick);
}
start().catch(error=>fail(error.message,error));
})();
