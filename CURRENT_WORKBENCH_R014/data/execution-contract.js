(()=>{
'use strict';
const C=window.__BIRD_R007_CONTRACT;
if(!C)throw new Error('R0.10 source contract missing');
const active=['leftRootElevationDeg','rightRootElevationDeg','leftMidElevationDeg','rightMidElevationDeg','leftOuterElevationDeg','rightOuterElevationDeg','leftElbowFoldDeg','rightElbowFoldDeg','averageWingtipY','tipSpan','bodyY'];
const locked=['leftWristFoldDeg','rightWristFoldDeg'];
const envelopes={};
for(const n of [...active,...locked]){const a=C.series[n];envelopes[n]={min:Math.min(...a),max:Math.max(...a),mean:a.reduce((s,v)=>s+v,0)/a.length,unit:n.endsWith('Deg')?'deg':'source'}}
window.__BIRD_R010_EXECUTION={
 version:'R0.10',title:'Bird Mother bounded source-channel execution contract',
 source:{asset:'seagull (A).zip',sourceGlbSha256:'175c61f65e3f2c8b561d422f9d0c61b23bfd85928dd3b66ad8547638d84a90aa',license:'CC-BY-NC-SA-4.0',kinematicContractVersion:'R0.07',controllerTransferVersion:'R0.08',channelLimitVersion:'R0.09',commercialRuntimeEligible:false},
 interface:{input:{phase01:{type:'number',range:'[0,1)',default:0},interpolation:{type:'enum',values:['smoothstep','linear'],default:'smoothstep'},rootDrive:{type:'number',range:[0,1],default:1},elbowFold:{type:'number',range:[0,1],default:1},bodyCoupling:{type:'number',range:[0,1],default:1},asymmetryResidual:{type:'number',range:[0,1],default:1},periodicClosure:{type:'number',range:[0,1],default:0}},output:{activeChannels:active,lockedReadOnlyChannels:locked,diagnosticReadOnlyChannels:['wingSymmetryRms'],diagnostics:['clippedFields','fallbackFields','lockedWriteRejects','postClampViolations','fallbackReason']}},
 controlGroups:[
  {id:'rootDrive',label:'翼根驱动',channels:['leftRootElevationDeg','rightRootElevationDeg','averageWingtipY']},
  {id:'elbowFold',label:'翼肘 / 中外翼折叠',channels:['leftMidElevationDeg','rightMidElevationDeg','leftOuterElevationDeg','rightOuterElevationDeg','leftElbowFoldDeg','rightElbowFoldDeg','tipSpan']},
  {id:'bodyCoupling',label:'身体耦合',channels:['bodyY']},
  {id:'asymmetryResidual',label:'来源左右残差',channels:['leftRootElevationDeg','rightRootElevationDeg','leftMidElevationDeg','rightMidElevationDeg','leftOuterElevationDeg','rightOuterElevationDeg','leftElbowFoldDeg','rightElbowFoldDeg']},
  {id:'periodicClosure',label:'周期缝工程候选',channels:active}
 ],
 execution:{anchorFramesZeroBased:[0,9,21,40,44,46,48,49],allowedInterpolation:['smoothstep','linear'],defaultInterpolation:'smoothstep',periodicCorrectionMethod:'tail cubic Hermite candidate over frames 41-50; source-envelope clamp follows correction',periodicCorrectionStartFrameZeroBased:40,sourceEnvelopeClamp:'always after controls and closure correction'},
 failurePolicy:{malformedInput:'last-valid then default',nonFiniteField:'last-valid then default',outOfRangeField:'clamp and report',invalidInterpolation:'last-valid then smoothstep',missingSourceSeries:'fail closed',postClampViolation:'fail closed',lockedChannelWrite:'ignore and report'},
 sourceEnvelopes:envelopes,
 hardLocks:{leftWristFoldDeg:'locked_read_only',rightWristFoldDeg:'locked_read_only',outerFanArticulation:'locked_unproven',spanwiseTwist:'locked_unproven',primaryFeatherSpread:'locked_unproven',secondaryFeatherOverlap:'locked_unproven',aerodynamicLoadResponse:'locked_unproven'},
 externalRuntimeDependencies:0,controllerAffectsSourceMesh:false,visualAcceptance:false,productionReady:false,commercialRuntimeEligible:false
};
})();
