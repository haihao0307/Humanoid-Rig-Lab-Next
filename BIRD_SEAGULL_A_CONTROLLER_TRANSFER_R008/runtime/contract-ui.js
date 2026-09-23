(()=>{
'use strict';
window.__BIRD_R008_CONTROLLER={"version":"R0.08","title":"Seagull A source-contract wing controller transfer","sourceContractVersion":"R0.07","sourceAsset":"seagull (A).zip","sourceGlbSha256":"175c61f65e3f2c8b561d422f9d0c61b23bfd85928dd3b66ad8547638d84a90aa","license":"CC-BY-NC-SA-4.0","anchorFramesZeroBased":[0,9,21,40,44,46,48,49],"anchorFramesHuman":[1,10,22,41,45,47,49,50],"anchorLabels":["cycle_entry","bottom_reversal","fastest_upstroke_interval","top_reversal","body_minimum","maximum_span_and_asymmetry","fastest_downstroke_interval","cycle_close"],"controllerChannels":["leftRootElevationDeg","rightRootElevationDeg","leftMidElevationDeg","rightMidElevationDeg","leftOuterElevationDeg","rightOuterElevationDeg","averageWingtipY","tipSpan","bodyY"],"normalizedWingSegments":{"rootToInner":0.26047,"innerToOuter":0.39854,"outerToTip":0.34099,"sourceMeanTotal":0.95631},"defaultInterpolation":"smoothstep","allowedInterpolation":["smoothstep","linear"],"defaultAsymmetryGain":1,"asymmetryGainRange":[0,1],"transferBoundary":{"mayTransfer":["three-segment chain ratios","source-derived reversal timing","root/mid/outer elevation envelopes","explicit left-right asymmetry channel","body coupling curve as a separate channel"],"mustNotTransfer":["separated source feather plates","source outer-fan lock as a desired design","unverified biological or aerodynamic claims","unprovided glide, soar, turn, takeoff, landing or escape poses","source asset into a commercial runtime"],"unresolvedDofs":["spanwise wing twist","outer-fan articulation","primary feather spread","secondary feather overlap","aerodynamic load response"]},"visualAcceptance":false,"productionReady":false,"commercialRuntimeEligible":false};
const script=document.createElement('script');
script.src='./runtime/contract-ui-r008-loader.js';
script.async=false;
script.onerror=()=>{
  const text='R0.08 迁移载荷没有到达';
  const el=document.getElementById('contractStatus');
  if(el){el.textContent=text;el.className='contract-status error'}
  window.__BIRD_R008_QA={ready:false,error:text};
  console.error(text);
};
document.body.appendChild(script);
})();
