(()=>{
'use strict';
window.__BIRD_R008_CONTROLLER={"version":"R0.08","title":"Seagull A source-contract wing controller transfer","sourceContractVersion":"R0.07","sourceAsset":"seagull (A).zip","sourceGlbSha256":"175c61f65e3f2c8b561d422f9d0c61b23bfd85928dd3b66ad8547638d84a90aa","license":"CC-BY-NC-SA-4.0","anchorFramesZeroBased":[0,9,21,40,44,46,48,49],"anchorFramesHuman":[1,10,22,41,45,47,49,50],"anchorLabels":["cycle_entry","bottom_reversal","fastest_upstroke_interval","top_reversal","body_minimum","maximum_span_and_asymmetry","fastest_downstroke_interval","cycle_close"],"controllerChannels":["leftRootElevationDeg","rightRootElevationDeg","leftMidElevationDeg","rightMidElevationDeg","leftOuterElevationDeg","rightOuterElevationDeg","averageWingtipY","tipSpan","bodyY"],"normalizedWingSegments":{"rootToInner":0.26047,"innerToOuter":0.39854,"outerToTip":0.34099,"sourceMeanTotal":0.95631},"defaultInterpolation":"smoothstep","allowedInterpolation":["smoothstep","linear"],"defaultAsymmetryGain":1.0,"asymmetryGainRange":[0.0,1.0],"transferBoundary":{"mayTransfer":["three-segment chain ratios","source-derived reversal timing","root/mid/outer elevation envelopes","explicit left-right asymmetry channel","body coupling curve as a separate channel"],"mustNotTransfer":["separated source feather plates","source outer-fan lock as a desired design","unverified biological or aerodynamic claims","unprovided glide, soar, turn, takeoff, landing or escape poses","source asset into a commercial runtime"],"unresolvedDofs":["spanwise wing twist","outer-fan articulation","primary feather spread","secondary feather overlap","aerodynamic load response"]},"visualAcceptance":false,"productionReady":false,"commercialRuntimeEligible":false};
document.title='Bird Mother｜Seagull A 控制器迁移审计台 R0.08';
const titleNode=document.querySelector('.title-block b');
if(titleNode)titleNode.textContent='Bird Mother｜Seagull A 控制器迁移审计台 R0.08';
const subtitleNode=document.querySelector('.title-block small');
if(subtitleNode)subtitleNode.textContent='8 锚点｜9 通道｜84% 参数压缩｜左右残差｜插值审计｜不修改来源网格';
const pillNode=document.querySelector('header .pill');
if(pillNode)pillNode.textContent='SOURCE CONTROLLER TRANSFER';
const rightMenu=document.getElementById('rightMenu');
if(rightMenu)rightMenu.textContent='迁移';
const stageNote=document.querySelector('.stage-note');
if(stageNote)stageNote.innerHTML='<b>第五道门：把 R0.07 来源运动合同压缩成可迁移的控制器。</b>本版继续不制作新鸟、不重建羽毛，也不补造滑翔、盘旋、转弯、起飞、降落或逃逸。只检查 8 个来源锚点能否重放 9 条控制通道，并把左右不对称保留为可调残差；控制器目前不改写来源网格。';
const footer=document.querySelector('footer');
if(footer&&!footer.textContent.includes('controllerTransferAudit=true')){
  const marker=document.createElement('span');
  marker.textContent='controllerTransferAudit=true';
  footer.appendChild(marker);
}
const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error('脚本载入失败：'+src));document.body.appendChild(s)});
const decode=async b64=>{const raw=atob(b64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));return await new Response(stream).text()};
(async()=>{
  await load('./runtime/contract-ui-base.js');
  window.__BIRD_R008_TRANSFER='';
  for(const src of ['./runtime/transfer-chunk-00.js','./runtime/transfer-chunk-01.js','./runtime/transfer-chunk-02.js'])await load(src);
  const payload=window.__BIRD_R008_TRANSFER;
  if(typeof payload!=='string'||payload.length!==8904)throw new Error('R0.08 迁移载荷长度不匹配');
  const source=await decode(payload);
  const sourceBytes=new TextEncoder().encode(source).length;
  if(sourceBytes!==19611)throw new Error('R0.08 迁移源码长度不匹配');
  (0,eval)(source);
  window.__BIRD_R008_LOADER_QA={ready:true,version:'R0.08',payloadChars:payload.length,sourceBytes};
})().catch(error=>{
  console.error(error);
  const el=document.getElementById('contractStatus');
  if(el){el.textContent='R0.08 迁移层失败：'+error.message;el.className='contract-status error'}
  window.__BIRD_R008_LOADER_QA={ready:false,error:error.message};
  window.__BIRD_R008_QA={ready:false,error:error.message};
});
})();
