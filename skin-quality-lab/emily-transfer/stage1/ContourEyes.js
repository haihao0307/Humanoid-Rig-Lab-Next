import * as THREE from 'three';
import {IntegratedEyes} from '../talkinghead/IntegratedEyes.js';
import {prepareClosedSurface,repairClosedSurface,closureWeight} from './ClosedSurface.js';
import {sampleContour,contourSpecification,BASELINE} from './Contours.mjs';
export const EYE_VERSION='eyes/8.0.1-s1';
const clamp=THREE.MathUtils.clamp,mix=THREE.MathUtils.lerp,TAU=Math.PI*2;
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
/** The inherited topology, globe, texture assets and behavior remain. The S1.1
 * patch corrects the entire closed outer envelope against the captured scan.
 * It does not claim stage-two anatomical or stage-four physical reconstruction.
 */
export class ContourEyes extends IntegratedEyes {
 constructor(options){
  super(options);
  this.ready=this.ready.then(()=>{
   this.contourBaseline=false;
   this.lockedCalibration=this.eyes.map(e=>({name:e.c.name,centreMM:e.pivot.position.toArray().map(v=>v*1000),radiusMM:e.c.radius*1000,irisRadiusMM:e.c.radius*.435*1000,irisPlaneLocalMM:e.c.radius*this.config.irisDepth*1000,cornealApexLocalMM:Math.max(...e.ball.geometry.attributes.position.array.filter((v,i)=>i%3===2))*1000,depthFit:{...e.depthFit}}));
   this.state.version=EYE_VERSION;this.setInspectionPose(0);return this;
  });
 }
 makeLid(c,sample,mat){const lid=super.makeLid(c,sample,mat);prepareClosedSurface(lid,c,sample);return lid;}
 updateLid(e,blink){
  super.updateLid(e,blink);
  const b=this.config.manualBlink>=0?this.config.manualBlink:blink;
  repairClosedSurface(this,e,b);
 }
 margin(c,a,blink){
  if(this.contourBaseline)return super.margin(c,a,blink);
  const nx=Math.cos(a),ny=Math.sin(a),s=clamp((nx*c.sign+1)*.5,0,1);
  const q=sampleContour(c.name,s,{closure:blink,opening:(this.config.opening??.88)/.88,pitch:c.gazePitch||0,yaw:(c.gazeYaw||0)*c.sign,squint:this.config.squint||0});
  const x=c.x+c.sign*q.temporalXMM/1000,y=c.y+(ny>=0?q.upperMM:q.lowerMM)/1000;
  const front=this.eyeFront(c,x,y),corner=smooth(Math.min(s,1-s)/.11),clearance=mix(.00015,mix(ny>=0?.00078:.00030,.00032,blink),corner);
  if(front===null)throw Error('ET08 contour left the locked globe support');
  let z=front+clearance;
  if(this.closedRestEnabled!==false&&c.closedScanMargin){
   const rest=c.closedScanMargin(s),canthus=1-smooth(Math.min(s,1-s)/.14);
   // Canthi are fixed to the observed closed crease, not to the far-back
   // equator of the globe. The central open contour stays globe supported.
   z=mix(z,rest.z,canthus);z=mix(z,rest.z,closureWeight(blink));
  }
  return new THREE.Vector3(x,y,z);
 }
 setInspectionPose(closure=0,{yaw=0,pitch=0,squint=0}={}){
  if(![closure,yaw,pitch,squint].every(Number.isFinite))throw Error('Invalid inspection pose');
  this.setBehavior({enabled:false,headMotion:false,paused:true,manualYaw:0,manualPitch:0});
  Object.assign(this.config,{enabled:true,autoBlink:false,autoPupil:false,pupilMM:3.4,manualBlink:clamp(closure,0,1),squint:clamp(squint,0,1),opening:.88,mode:'fixed'});
  this.lockedTarget.set(-.004+Math.tan(yaw)*10,.069-Math.tan(pitch)*10,10.065);
  this.update(0,true);this.requestRender();
 }
 compareClosureBefore(on){this.closedRestEnabled=!on;this.update(0,true);this.requestRender();}
 closureSurfaceReport(){return {version:EYE_VERSION,eyes:this.eyes.map(e=>({name:e.c.name,...e.lid.closedSurface?.report}))};}
 compareOriginal(on){this.contourBaseline=!!on;this.update(0,true);this.requestRender();}
 contourReport(){
  const rows=[];
  for(const e of this.eyes){
   this._fittingEye=e;const c=e.c,upper=[],lower=[];
   for(let i=0;i<=1024;i++){const s=i/1024,a=Math.acos(clamp((s*2-1)*c.sign,-1,1));upper.push(this.margin(c,a,0));lower.push(this.margin(c,TAU-a,0));}
   const hi=upper.reduce((a,p,i)=>p.y>upper[a].y?i:a,0),lo=lower.reduce((a,p,i)=>p.y<lower[a].y?i:a,0),u=upper[512],l=lower[512],R=c.radius*.435;
   let gap=0;for(let i=0;i<=256;i++){const a=Math.acos((i/128-1)*c.sign);gap=Math.max(gap,this.margin(c,a,1).distanceTo(this.margin(c,TAU-a,1)));}
   const P=e.lid.mesh.geometry.attributes.position;let actualClosedGap=null;
   if(this.config.manualBlink===1){actualClosedGap=0;for(let i=0;i<=e.lid.A/2;i++){const j=e.lid.A-i;actualClosedGap=Math.max(actualClosedGap,Math.hypot(P.getX(i)-P.getX(j),P.getY(i)-P.getY(j),P.getZ(i)-P.getZ(j))*1000);}}
   const closed=this.config.manualBlink>=0?this.config.manualBlink:this.state.blink||0,an=Math.acos(-c.sign),at=Math.acos(c.sign);
   rows.push({name:c.name,currentCanthiMM:{nasal:this.margin(c,an,closed).toArray().map(v=>v*1000),temporal:this.margin(c,at,closed).toArray().map(v=>v*1000)},widthMM:Math.abs(upper[1024].x-upper[0].x)*1000,heightAtAxisMM:(u.y-l.y)*1000,maxHeightMM:Math.max(...upper.map((p,i)=>(p.y-lower[i].y)*1000)),upperPeakFromNasal:hi/1024,lowerLowFromNasal:lo/1024,upperPeakMM:upper[hi].toArray().map(v=>v*1000),lowerLowMM:lower[lo].toArray().map(v=>v*1000),nasalMM:upper[0].toArray().map(v=>v*1000),temporalMM:upper[1024].toArray().map(v=>v*1000),canthalTiltDegrees:Math.atan2(upper[1024].y-upper[0].y,Math.abs(upper[1024].x-upper[0].x))*180/Math.PI,upperIrisCoverProjectedMM:(R-(u.y-c.y))*1000,lowerIrisCoverProjectedMM:(R+(l.y-c.y))*1000,closureCurveGapMM:gap*1000,actualClosedMarginGapMM:actualClosedGap,calibration:this.lockedCalibration?.find(v=>v.name===c.name)});
  }
  this._fittingEye=null;
  return {schema:'kaopu/eye-contour-review@1',baseline:BASELINE,version:EYE_VERSION,comparison:this.contourBaseline?'ET07.3':'ET08-S1',currentClosure:this.config.manualBlink,irisCoverageMeaning:'unrefracted iris reference projected on the neutral globe, not a measured photograph',scope:'sampled curves and current free-margin vertices; not continuous collision certification',eyes:rows,specification:contourSpecification()};
 }
 audit(detailed=false){
  const report=super.audit(detailed);report.version=EYE_VERSION;report.closedSurface=this.closureSurfaceReport();
  report.marginLengthDefinition='actual upper/lower free-edge vertex polylines; cross-section lengths reported separately; no arc-length conservation claim';
  for(const row of report.eyes){
   const e=this.eyes.find(e=>e.c.name===row.name),P=e.lid.mesh.geometry.attributes.position,A=e.lid.A;
   const length=(start,end)=>{let sum=0;for(let i=start+1;i<=end;i++)sum+=Math.hypot(P.getX(i)-P.getX(i-1),P.getY(i)-P.getY(i-1),P.getZ(i)-P.getZ(i-1));return sum*1000;};
   row.upperMarginCrossSectionArcMM=row.upperFreeMarginArcMM;row.lowerMarginCrossSectionArcMM=row.lowerFreeMarginArcMM;
   row.upperFreeMarginArcMM=length(0,A/2);row.lowerFreeMarginArcMM=length(A/2,A);
   if(![row.upperFreeMarginArcMM,row.lowerFreeMarginArcMM].every(v=>Number.isFinite(v)&&v>=row.horizontalApertureMM-1e-4))throw Error('Invalid free-margin length');
  }
  return report;
 }
 snapshot(){return {...super.snapshot(),stage1:{schema:'kaopu/eye-contour-stage1@1',baseline:BASELINE,compareOriginal:!!this.contourBaseline,closedRestEnabled:this.closedRestEnabled!==false}};}
 restore(o){
  if(o?.stage1){if(o.stage1.schema!=='kaopu/eye-contour-stage1@1'||o.stage1.baseline!==BASELINE)throw Error('Unsupported contour recipe');this.contourBaseline=!!o.stage1.compareOriginal;this.closedRestEnabled=o.stage1.closedRestEnabled!==false;}
  super.restore(o);
 }
 info(){return {...super.info(),contourStage1:{baseline:BASELINE,independentEyeSplines:true,closedSurfaceFromCapturedReference:true,globeAndIrisRescaled:false,centreDepthLocked:true,openPersonSpecificScan:false,stage2Rebuilt:false,stage4DynamicsRebuilt:false}};}
}
