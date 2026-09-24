(()=>{
'use strict';
const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=(v,d=3)=>Number.isFinite(Number(v))?Number(v).toFixed(d):'—';

const LABELS={
 leftRootElevationDeg:'左翼根仰角',rightRootElevationDeg:'右翼根仰角',
 leftMidElevationDeg:'左中翼仰角',rightMidElevationDeg:'右中翼仰角',
 leftOuterElevationDeg:'左外翼仰角',rightOuterElevationDeg:'右外翼仰角',
 leftElbowFoldDeg:'左翼肘折角',rightElbowFoldDeg:'右翼肘折角',
 averageWingtipY:'平均翼尖 Y',tipSpan:'翼尖跨度',bodyY:'身体 Y',
 wingSymmetryRms:'镜像 RMS',leftWristFoldDeg:'左外翼末段折角',rightWristFoldDeg:'右外翼末段折角'
};
const COLORS=['#55d8ef','#ef7dcc','#e9ba66','#71d29b','#9d8cff','#ff8f73','#7bb5ff','#d9e17b'];

function fail(message,error){
 const text=String(message||error?.message||error||'R0.09 未知错误');
 const el=$('r009Status');
 if(el){el.textContent='R0.09 失败：'+text;el.className='r009-status error'}
 window.__BIRD_R009_QA={ready:false,error:text};
 if(error)console.error(error);else console.error(text);
}

function injectStyle(){
 if($('r009Style'))return;
 const s=document.createElement('style');s.id='r009Style';s.textContent=`
 .r009-card{border:1px solid #284653;background:#0a1921;border-radius:10px;padding:10px;margin:10px 0}
 .r009-card h3{margin:0 0 8px;color:#d9edf2;font-size:13px}
 .r009-note{color:#9bb1bb;font-size:11px;line-height:1.55}
 .r009-note b{color:#f0c56e}
 .r009-group-grid,.r009-mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
 .r009-group-grid button,.r009-mode-grid button{min-height:34px}
 .r009-group-grid button.active,.r009-mode-grid button.active{border-color:#56d4ea;background:#143442;color:#effcff}
 .r009-slider{display:grid;gap:5px;margin-top:8px}
 .r009-slider label{display:flex;justify-content:space-between;color:#9fb5bf;font-size:11px}
 .r009-slider input{width:100%}
 .r009-status{position:absolute;left:50%;bottom:76px;transform:translateX(-50%);z-index:8;
  border:1px solid #2a5362;background:#07141ddd;color:#b9d1d9;padding:6px 10px;border-radius:8px;
  font-size:11px;pointer-events:none;max-width:min(88%,760px);text-align:center}
 .r009-status.ready{border-color:#2e8c72;color:#bff6df}.r009-status.error{border-color:#a94a52;color:#ffd5d8}
 .r009-analysis{border:1px solid #2b4b58;background:#07161d;border-radius:12px;padding:10px;margin:0 0 12px}
 .r009-analysis>h3{margin:10px 0 7px}.r009-analysis>h3:first-child{margin-top:0}
 .r009-canvas-wrap{border:1px solid #203d49;border-radius:9px;overflow:hidden;background:#061219}
 #r009ChannelCanvas{display:block;width:100%;height:250px}
 .r009-legend{display:flex;flex-wrap:wrap;gap:8px;padding:7px 8px;color:#8fa7b1;font-size:10px}
 .r009-legend b{color:#dcebef}.r009-legend i{display:inline-block;width:15px;border-top:2px solid #67d5e8;margin-right:4px;vertical-align:middle}
 .r009-legend i.dashed{border-top-style:dashed;opacity:.75}
 .r009-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
 .r009-metrics>div{border:1px solid #213e4a;background:#0a1b23;border-radius:8px;padding:7px}
 .r009-metrics span{display:block;color:#7e98a3;font-size:9px}.r009-metrics b{display:block;margin-top:3px;color:#e4f0f3;font-size:12px}
 .r009-limits{display:grid;gap:5px}
 .r009-limit{display:grid;grid-template-columns:94px 1fr 70px;gap:6px;align-items:center;padding:5px 6px;border:1px solid #1d3741;border-radius:7px;background:#091820}
 .r009-limit>span{font-size:10px;color:#b7c9d0}.r009-limit>small{text-align:right;font-size:9px;color:#8198a2}
 .r009-bar{height:8px;background:#112933;border-radius:999px;position:relative;overflow:visible}
 .r009-bar i,.r009-bar em{position:absolute;top:50%;width:7px;height:14px;transform:translate(-50%,-50%);border-radius:3px}
 .r009-bar i{background:#e9ba66}.r009-bar em{background:#58d4ea;border:1px solid #e8fdff}
 .r009-limit.out{border-color:#9f4d57}.r009-limit.out .r009-bar em{background:#ff6d79}
 .r009-continuity{display:grid;gap:5px}
 .r009-cont-row{display:grid;grid-template-columns:88px repeat(3,1fr);gap:5px;align-items:center;padding:6px;border:1px solid #203b46;border-radius:7px}
 .r009-cont-row span{font-size:10px;color:#b9cbd2}.r009-cont-row b{font-size:10px;color:#ddecf0;text-align:right}.r009-cont-row small{font-size:8px;color:#6f8994}
 .r009-lock{border:1px solid #765d2e;background:#271f10;border-radius:8px;padding:8px;color:#d9c594;font-size:10px;line-height:1.5}
 .r009-boundary{display:grid;gap:5px}.r009-boundary div{padding:6px 7px;border-radius:7px;font-size:10px;line-height:1.45}
 .r009-boundary .ok{background:#0e2a23;color:#bdebd9}.r009-boundary .no{background:#2b1719;color:#f0bec3}
 @media(max-width:900px){
  .r009-metrics{grid-template-columns:1fr 1fr}
  #r009ChannelCanvas{height:220px}
  .r009-limit{grid-template-columns:80px 1fr 62px}
  .r009-status{bottom:64px}
 }
 `;
 document.head.appendChild(s);
}

function injectUI(){
 document.title='Bird Mother｜Seagull A 通道分离与关节限位台 R0.09';
 const title=document.querySelector('.title-block b');if(title)title.textContent='Bird Mother｜Seagull A 通道分离与关节限位台 R0.09';
 const sub=document.querySelector('.title-block small');if(sub)sub.textContent='翼根驱动｜翼肘折叠｜身体耦合｜显式不对称｜来源限位｜连续性审计';
 const pill=document.querySelector('header .pill');if(pill)pill.textContent='SOURCE CHANNEL CONTRACT';
 const right=$('rightMenu');if(right)right.textContent='限位';

 const controls=$('controls'),analysis=$('analysis'),stage=document.querySelector('.stage');
 if(!controls||!analysis||!stage)throw new Error('R0.09 页面锚点缺失');

 const controlCard=document.createElement('section');controlCard.className='r009-card';controlCard.id='r009Controls';
 controlCard.innerHTML=`
  <h3>第六道门：通道分离与来源限位</h3>
  <div class="r009-note"><b>只处理来源已经证明的运动。</b> 四组通道只影响下方控制器审计图，不改写来源鸟体；外翼扇面和飞羽自由度继续锁定。</div>
  <div class="r009-group-grid" id="r009GroupButtons">
   <button type="button" data-r009-group="all" class="active">四组总览</button>
   <button type="button" data-r009-group="wing_root_drive">翼根驱动</button>
   <button type="button" data-r009-group="wing_elbow_fold">翼肘折叠</button>
   <button type="button" data-r009-group="body_coupling">身体耦合</button>
   <button type="button" data-r009-group="explicit_asymmetry">显式不对称</button>
  </div>
  <h3 style="margin-top:10px">控制器重放</h3>
  <div class="r009-mode-grid" id="r009Interpolation">
   <button type="button" data-r009-interp="smoothstep" class="active">平滑重放</button>
   <button type="button" data-r009-interp="linear">线性重放</button>
  </div>
  <div class="r009-slider">
   <label><span>来源不对称残差</span><b id="r009AsymmetryValue">100%</b></label>
   <input id="r009Asymmetry" type="range" min="0" max="100" step="1" value="100">
  </div>
  <div class="r009-lock" style="margin-top:9px"><b>外翼扇面：锁定</b><br>来源末段折角总变化仅约 0.007°；不足以证明可迁移的扇面关节。</div>`;
 const note=controls.querySelector('.stage-note');if(note)note.insertAdjacentElement('afterend',controlCard);else controls.prepend(controlCard);

 const panel=document.createElement('section');panel.className='r009-analysis';panel.id='r009Analysis';
 panel.innerHTML=`
  <h3>R0.09 通道重放与来源对照</h3>
  <div class="r009-canvas-wrap">
   <canvas id="r009ChannelCanvas" width="560" height="250" aria-label="R0.09 来源与控制器通道对照图"></canvas>
   <div class="r009-legend"><span><i></i><b>实线</b> 来源逐帧</span><span><i class="dashed"></i><b>虚线</b> 8 锚点重放</span><span>各通道按自身来源范围归一化</span></div>
  </div>
  <div class="r009-metrics" style="margin-top:7px">
   <div><span>来源限位越界</span><b id="r009SourceExceed">—</b></div>
   <div><span>重放限位越界</span><b id="r009ReplayExceed">—</b></div>
   <div><span>锚点精确命中</span><b id="r009AnchorExact">—</b></div>
   <div><span>当前通道组</span><b id="r009ActiveGroup">—</b></div>
  </div>
  <h3>当前帧关节限位</h3>
  <div class="r009-limits" id="r009LimitRows"></div>
  <h3>连续性审计</h3>
  <div class="r009-continuity" id="r009ContinuityRows"></div>
  <h3>未解锁自由度</h3>
  <div class="r009-boundary">
   <div class="ok">已分离：翼根驱动、翼肘折叠、身体耦合、来源范围内不对称残差。</div>
   <div class="no">仍锁定：展向扭转、外翼扇面、初级飞羽展开、次级飞羽重叠、空气载荷响应，以及未提供的滑翔/盘旋/转弯/起降/逃逸。</div>
  </div>`;
 analysis.prepend(panel);

 const st=document.createElement('div');st.id='r009Status';st.className='r009-status';st.textContent='正在建立 R0.09 通道合同……';stage.appendChild(st);
 const footer=document.querySelector('footer');if(footer&&!footer.textContent.includes('channelLimitContract=true')){const x=document.createElement('span');x.textContent='channelLimitContract=true';footer.appendChild(x)}
}

function interpWeight(t,mode){return mode==='linear'?t:t*t*(3-2*t)}
function interpolate(source,anchors,mode){
 const out=new Array(50);
 for(let f=0;f<50;f++){
  let a=anchors[0],b=anchors[anchors.length-1];
  for(let i=0;i<anchors.length-1;i++){if(f>=anchors[i]&&f<=anchors[i+1]){a=anchors[i];b=anchors[i+1];break}}
  if(f<=anchors[0]){out[f]=source[anchors[0]];continue}
  if(f>=anchors[anchors.length-1]){out[f]=source[anchors[anchors.length-1]];continue}
  const t=(f-a)/Math.max(1,b-a),w=interpWeight(t,mode);
  out[f]=source[a]+(source[b]-source[a])*w;
 }
 return out;
}
const pair=(a,b)=>a.map((v,i)=>(v+b[i])/2);
const residual=(a,b)=>a.map((v,i)=>(v-b[i])/2);
const combine=(m,r,g,sign)=>m.map((v,i)=>v+sign*r[i]*g);
const maxAbs=a=>Math.max(...a.map(v=>Math.abs(v)));
const rangeOf=a=>({min:Math.min(...a),max:Math.max(...a)});
function normalizeSeries(a,lim){const span=Math.max(1e-12,lim.max-lim.min);return a.map(v=>(v-lim.min)/span)}
function finiteMetrics(a,fps){
 let maxV=0,maxA=0;
 for(let i=0;i<a.length-1;i++)maxV=Math.max(maxV,Math.abs((a[i+1]-a[i])*fps));
 for(let i=1;i<a.length-1;i++)maxA=Math.max(maxA,Math.abs((a[i+1]-2*a[i]+a[i-1])*fps*fps));
 return{loopGap:Math.abs(a[a.length-1]-a[0]),maxVelocity:maxV,maxAcceleration:maxA};
}

function makeReplay(S,K,state){
 const anchors=K.controller.anchorFramesZeroBased;
 const out={};
 const pairs=[
  ['leftRootElevationDeg','rightRootElevationDeg','root'],
  ['leftMidElevationDeg','rightMidElevationDeg','mid'],
  ['leftOuterElevationDeg','rightOuterElevationDeg','outer'],
  ['leftElbowFoldDeg','rightElbowFoldDeg','elbow']
 ];
 for(const [l,r,key] of pairs){
  const m=pair(S[l],S[r]),res=residual(S[l],S[r]);
  const mi=interpolate(m,anchors,state.interpolation),ri=interpolate(res,anchors,state.interpolation);
  out[l]=combine(mi,ri,state.asymmetryGain,1);out[r]=combine(mi,ri,state.asymmetryGain,-1);
  out[key+'Mean']=mi;out[key+'Residual']=ri.map(v=>v*state.asymmetryGain);
 }
 for(const key of ['averageWingtipY','tipSpan','bodyY'])out[key]=interpolate(S[key],anchors,state.interpolation);
 out.wingSymmetryRms=interpolate(S.wingSymmetryRms,anchors,state.interpolation).map(v=>v*state.asymmetryGain);
 return out;
}
function anchorExact(S,R,K){
 const channels=['leftRootElevationDeg','rightRootElevationDeg','leftMidElevationDeg','rightMidElevationDeg','leftOuterElevationDeg','rightOuterElevationDeg','leftElbowFoldDeg','rightElbowFoldDeg','averageWingtipY','tipSpan','bodyY'];
 return K.controller.anchorFramesZeroBased.every(f=>channels.every(k=>Math.abs(S[k][f]-R[k][f])<2e-5));
}
function countExceed(seriesMap,limits,tol=1e-5){
 let n=0;
 for(const [key,lim] of Object.entries(limits)){const a=seriesMap[key];if(!a)continue;for(const v of a)if(v<lim.min-tol||v>lim.max+tol)n++}
 return n;
}

function groupLines(S,R,state,K){
 const mean=(l,r)=>pair(S[l],S[r]),res=(l,r)=>residual(S[l],S[r]);
 const source={
  rootMean:mean('leftRootElevationDeg','rightRootElevationDeg'),
  elbowMean:mean('leftElbowFoldDeg','rightElbowFoldDeg'),
  bodyY:S.bodyY,
  rootResidual:res('leftRootElevationDeg','rightRootElevationDeg')
 };
 const replay={rootMean:R.rootMean,elbowMean:R.elbowMean,bodyY:R.bodyY,rootResidual:R.rootResidual};
 if(state.group==='wing_root_drive')return[
  {label:'左翼根',s:S.leftRootElevationDeg,r:R.leftRootElevationDeg,lim:K.sourceLimits.leftRootElevationDeg},
  {label:'右翼根',s:S.rightRootElevationDeg,r:R.rightRootElevationDeg,lim:K.sourceLimits.rightRootElevationDeg}
 ];
 if(state.group==='wing_elbow_fold')return[
  {label:'左翼肘',s:S.leftElbowFoldDeg,r:R.leftElbowFoldDeg,lim:K.sourceLimits.leftElbowFoldDeg},
  {label:'右翼肘',s:S.rightElbowFoldDeg,r:R.rightElbowFoldDeg,lim:K.sourceLimits.rightElbowFoldDeg}
 ];
 if(state.group==='body_coupling')return[
  {label:'平均翼尖Y',s:S.averageWingtipY,r:R.averageWingtipY,lim:K.sourceLimits.averageWingtipY},
  {label:'翼展',s:S.tipSpan,r:R.tipSpan,lim:K.sourceLimits.tipSpan},
  {label:'身体Y',s:S.bodyY,r:R.bodyY,lim:K.sourceLimits.bodyY}
 ];
 if(state.group==='explicit_asymmetry'){
  const defs=[
   ['翼根残差',res('leftRootElevationDeg','rightRootElevationDeg'),R.rootResidual],
   ['中翼残差',res('leftMidElevationDeg','rightMidElevationDeg'),R.midResidual],
   ['外翼残差',res('leftOuterElevationDeg','rightOuterElevationDeg'),R.outerResidual],
   ['翼肘残差',res('leftElbowFoldDeg','rightElbowFoldDeg'),R.elbowResidual],
   ['镜像RMS',S.wingSymmetryRms,R.wingSymmetryRms]
  ];
  return defs.map(([label,s,r])=>{const m=Math.max(maxAbs(s),1e-8);return{label,s,r,lim:{min:-m,max:m}}});
 }
 return[
  {label:'翼根均值',s:source.rootMean,r:replay.rootMean,lim:rangeOf(source.rootMean)},
  {label:'翼肘均值',s:source.elbowMean,r:replay.elbowMean,lim:rangeOf(source.elbowMean)},
  {label:'身体Y',s:source.bodyY,r:replay.bodyY,lim:K.sourceLimits.bodyY},
  {label:'翼根残差',s:source.rootResidual,r:replay.rootResidual,lim:{min:-Math.max(maxAbs(source.rootResidual),1e-8),max:Math.max(maxAbs(source.rootResidual),1e-8)}}
 ];
}

function drawChannels(S,R,state,K,frame){
 const c=$('r009ChannelCanvas');if(!c)return;
 const dpr=Math.min(devicePixelRatio||1,2),w=Math.max(360,Math.floor(c.clientWidth*dpr)),h=Math.max(210,Math.floor(c.clientHeight*dpr));
 if(c.width!==w||c.height!==h){c.width=w;c.height=h}
 const ctx=c.getContext('2d'),pad={l:34*dpr,r:10*dpr,t:14*dpr,b:24*dpr},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;
 ctx.fillStyle='#07151c';ctx.fillRect(0,0,w,h);
 ctx.strokeStyle='#1e3944';ctx.lineWidth=dpr;
 for(let i=0;i<=4;i++){const y=pad.t+i*ph/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke()}
 const X=i=>pad.l+i/49*pw,Y=v=>pad.t+(1-clamp(v,0,1))*ph;
 const lines=groupLines(S,R,state,K);
 lines.forEach((line,j)=>{
  const color=COLORS[j%COLORS.length],sn=normalizeSeries(line.s,line.lim),rn=normalizeSeries(line.r,line.lim);
  ctx.strokeStyle=color;ctx.lineWidth=1.8*dpr;ctx.setLineDash([]);ctx.beginPath();sn.forEach((v,i)=>i?ctx.lineTo(X(i),Y(v)):ctx.moveTo(X(i),Y(v)));ctx.stroke();
  ctx.strokeStyle=color;ctx.globalAlpha=.72;ctx.lineWidth=1.4*dpr;ctx.setLineDash([5*dpr,4*dpr]);ctx.beginPath();rn.forEach((v,i)=>i?ctx.lineTo(X(i),Y(v)):ctx.moveTo(X(i),Y(v)));ctx.stroke();ctx.globalAlpha=1;
  ctx.fillStyle=color;ctx.font=`${9*dpr}px sans-serif`;ctx.textAlign='left';ctx.fillText(line.label,pad.l+4*dpr,pad.t+(j+1)*12*dpr);
 });
 ctx.setLineDash([]);ctx.strokeStyle='#fff';ctx.lineWidth=1.1*dpr;ctx.beginPath();ctx.moveTo(X(frame),pad.t);ctx.lineTo(X(frame),h-pad.b);ctx.stroke();
 ctx.fillStyle='#eef8fa';ctx.textAlign='center';ctx.font=`${9*dpr}px sans-serif`;ctx.fillText('F'+String(frame+1).padStart(2,'0'),X(frame),h-7*dpr);
}

function buildLimitRows(K){
 const root=$('r009LimitRows');root.innerHTML='';
 for(const [key,lim] of Object.entries(K.sourceLimits)){
  const row=document.createElement('div');row.className='r009-limit';row.dataset.channel=key;
  row.innerHTML=`<span>${LABELS[key]||key}</span><div class="r009-bar"><i></i><em></em></div><small>—</small>`;
  root.appendChild(row);
 }
}
function updateLimits(S,R,K,frame){
 for(const [key,lim] of Object.entries(K.sourceLimits)){
  const row=document.querySelector(`.r009-limit[data-channel="${key}"]`);if(!row)continue;
  const sv=S[key]?.[frame],rv=R[key]?.[frame],span=Math.max(1e-12,lim.max-lim.min);
  const sp=clamp((sv-lim.min)/span,0,1)*100,rp=clamp((rv-lim.min)/span,0,1)*100;
  row.querySelector('i').style.left=sp+'%';row.querySelector('em').style.left=rp+'%';
  const out=rv<lim.min-1e-5||rv>lim.max+1e-5;row.classList.toggle('out',out);
  row.querySelector('small').textContent=`${fmt(sv,lim.unit==='deg'?1:3)} / ${fmt(rv,lim.unit==='deg'?1:3)}${lim.unit==='deg'?'°':''}`;
 }
}

function updateContinuity(S,R,K){
 const root=$('r009ContinuityRows');
 const srcRoot=pair(S.leftRootElevationDeg,S.rightRootElevationDeg),repRoot=R.rootMean;
 const srcElbow=pair(S.leftElbowFoldDeg,S.rightElbowFoldDeg),repElbow=R.elbowMean;
 const srcAsym=residual(S.leftRootElevationDeg,S.rightRootElevationDeg),repAsym=R.rootResidual;
 const rows=[
  ['翼根驱动',finiteMetrics(srcRoot,24),finiteMetrics(repRoot,24)],
  ['翼肘折叠',finiteMetrics(srcElbow,24),finiteMetrics(repElbow,24)],
  ['身体耦合',finiteMetrics(S.bodyY,24),finiteMetrics(R.bodyY,24)],
  ['不对称残差',finiteMetrics(srcAsym,24),finiteMetrics(repAsym,24)]
 ];
 root.innerHTML=rows.map(([name,s,r])=>`<div class="r009-cont-row"><span>${name}</span><b>闭环 ${fmt(s.loopGap,4)}<small>源</small></b><b>速度 ${fmt(r.maxVelocity,2)}<small>重放/s</small></b><b>加速度 ${fmt(r.maxAcceleration,1)}<small>重放/s²</small></b></div>`).join('');
 const avg=S.averageWingtipY,rep=R.averageWingtipY;
 const rev=(a,i)=>Math.abs((a[i+1]-a[i])*24-(a[i]-a[i-1])*24);
 root.insertAdjacentHTML('beforeend',`<div class="r009-cont-row"><span>反转连续性</span><b>F10 ${fmt(rev(avg,9),3)}<small>源速度跳变</small></b><b>F41 ${fmt(rev(avg,40),3)}<small>源速度跳变</small></b><b>${fmt(rev(rep,9)+rev(rep,40),3)}<small>重放合计</small></b></div>`);
 return rows;
}

async function start(){
 const K=window.__BIRD_R009_CONTRACT;if(!K)throw new Error('R0.09 合同数据没有到达');
 let api=null,S=null,C8=null;
 for(let i=0;i<600;i++){
  if(window.__BIRD_R007_API&&window.__BIRD_R007_CONTRACT&&window.__BIRD_R008_CONTROLLER&&window.__BIRD_R008_QA?.ready===true){
   api=window.__BIRD_R007_API;S=window.__BIRD_R007_CONTRACT.series;C8=window.__BIRD_R008_CONTROLLER;break;
  }
  await sleep(25);
 }
 if(!api||!S||!C8)throw new Error('R0.08 基础运行时未就绪');
 injectStyle();injectUI();buildLimitRows(K);

 const state={group:'all',interpolation:K.controller.defaultInterpolation,asymmetryGain:1,dirty:true};
 let R=makeReplay(S,K,state),sourceEx=countExceed(S,K.sourceLimits),replayEx=countExceed(R,K.sourceLimits),lastFrame=-1;
 const groupLabel=id=>id==='all'?'四组总览':K.channelGroups.find(x=>x.id===id)?.label||id;
 const recompute=()=>{
  R=makeReplay(S,K,state);replayEx=countExceed(R,K.sourceLimits);state.dirty=true;
  document.querySelectorAll('[data-r009-interp]').forEach(b=>b.classList.toggle('active',b.dataset.r009Interp===state.interpolation));
  document.querySelectorAll('[data-r009-group]').forEach(b=>b.classList.toggle('active',b.dataset.r009Group===state.group));
  $('r009AsymmetryValue').textContent=Math.round(state.asymmetryGain*100)+'%';
 };
 $('r009GroupButtons').addEventListener('click',e=>{const b=e.target.closest('[data-r009-group]');if(!b)return;state.group=b.dataset.r009Group;state.dirty=true});
 $('r009Interpolation').addEventListener('click',e=>{const b=e.target.closest('[data-r009-interp]');if(!b)return;state.interpolation=b.dataset.r009Interp;recompute()});
 $('r009Asymmetry').addEventListener('input',e=>{state.asymmetryGain=clamp(Number(e.target.value)/100,0,1);recompute()});

 const render=()=>{
  const frame=api.frame|0;
  if(frame!==lastFrame||state.dirty){
   lastFrame=frame;state.dirty=false;
   drawChannels(S,R,state,K,frame);updateLimits(S,R,K,frame);updateContinuity(S,R,K);
   const exact=state.asymmetryGain===1&&anchorExact(S,R,K);
   $('r009SourceExceed').textContent=String(sourceEx);
   $('r009ReplayExceed').textContent=String(replayEx);
   $('r009AnchorExact').textContent=exact?'是':'当前残差缩放';
   $('r009ActiveGroup').textContent=groupLabel(state.group);
   const qa={
    ready:true,version:'R0.09',groupCount:4,activeChannelCount:12,lockedChannelCount:2,
    limitRowCount:Object.keys(K.sourceLimits).length,sourceLimitExceedances:sourceEx,replayLimitExceedances:replayEx,
    anchorExact:exact,interpolation:state.interpolation,asymmetryGain:state.asymmetryGain,activeGroup:state.group,
    frame,controllerAnchorCount:K.controller.anchorFramesZeroBased.length,externalRuntimeDependencies:0,
    loopClosure:{root:finiteMetrics(pair(S.leftRootElevationDeg,S.rightRootElevationDeg),24).loopGap,
      elbow:finiteMetrics(pair(S.leftElbowFoldDeg,S.rightElbowFoldDeg),24).loopGap,
      body:finiteMetrics(S.bodyY,24).loopGap,asymmetry:finiteMetrics(residual(S.leftRootElevationDeg,S.rightRootElevationDeg),24).loopGap}
   };
   window.__BIRD_R009_QA=qa;
   Object.assign(window.__BIRD_QA,{channelContractReady:true,channelContractVersion:'R0.09'});
   document.body.dataset.r009Ready='true';
   const st=$('r009Status');st.textContent=`R0.09 已载入｜${groupLabel(state.group)}｜来源越界 ${sourceEx}｜重放越界 ${replayEx}`;st.className='r009-status ready';
  }
  requestAnimationFrame(render);
 };
 window.__BIRD_R009_API={
  setGroup:id=>{if(id==='all'||K.channelGroups.some(x=>x.id===id)){state.group=id;state.dirty=true}},
  setInterpolation:id=>{if(K.controller.allowedInterpolation.includes(id)){state.interpolation=id;recompute()}},
  setAsymmetryGain:v=>{state.asymmetryGain=clamp(Number(v),0,1);const slider=$('r009Asymmetry');if(slider)slider.value=String(Math.round(state.asymmetryGain*100));recompute()},
  getReplaySeries:()=>R,recompute
 };
 window.addEventListener('resize',()=>{state.dirty=true});
 render();
}
start().catch(error=>fail(error.message,error));
})();