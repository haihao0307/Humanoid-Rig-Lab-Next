import {SectionEyes} from '../stage2/SectionEyes.js';
import {prepareBrow,applyBrowHead,applyBrowLid,refineMedial} from './BrowMedial.js';
import {bindTissueCoordinates,updateTissueStrain,tissueReport} from './TissueCoordinates.js';
export const EYE_VERSION='eyes/10.0.0-s3';
export const STAGE3_BASELINE='cc5f13450e0618e371306183671838f2910bd96a';
export class ChartEyes extends SectionEyes{
 constructor(options){
  super(options);this.s3Ready=false;this.s3Geometry=true;this.chartMode='gray';
  this.ready=this.ready.then(()=>{
   this.prepareStage2Calibration();this.setInspectionPose(0);this.frozenStage2Centres=this.eyes.map(e=>e.pivot.position.toArray());
   prepareBrow(this);this.s3Ready=true;applyBrowHead(this,true);this.update(0,true);
   bindTissueCoordinates(this);this.state.version=EYE_VERSION;this.requestRender();return this;
  });
 }
 updateLid(e,blink){
  super.updateLid(e,blink);if(!this.s3Ready||!this.s3Geometry||!this.sectionEnabled||this.closedRestEnabled===false||this.contourBaseline)return;
  const b=this.config.manualBlink>=0?this.config.manualBlink:blink;
  applyBrowLid(this,e);refineMedial(this,e,b);
 }
 update(dt,instant=false){const result=super.update(dt,instant);if(this.chartBindings&&(result||instant))updateTissueStrain(this);return result;}
 stage3Pose(b=0,angles={}){this.prepareStage2Calibration();this.sectionEnabled=true;this.setInspectionPose(b,angles);this.requestRender();}
 compareStage2(on){this.prepareStage2Calibration();this.sectionEnabled=true;this.s3Geometry=!on;applyBrowHead(this,!on);this.update(0,true);this.requestRender();}
 chartReport(){
  return {version:'ET10-S3',baseline:STAGE3_BASELINE,geometryEnabled:this.s3Geometry,materialMode:this.chartMode,brow:this.browReport,eyes:this.eyes.map(e=>({name:e.c.name,brow:e.s3Brow,medial:e.s3Medial,radiusMM:e.c.radius*1000,centreMM:e.pivot.position.toArray().map(v=>v*1000),closedSurface:e.lid.closedSurface?.report})),coordinates:tissueReport(this),stage4FoldingPhysicsRebuilt:false,stage5OpticsRebuilt:false};
 }
 snapshot(){return {...super.snapshot(),stage3:{schema:'kaopu/tissue-chart-stage3@1',baseline:STAGE3_BASELINE,geometry:this.s3Geometry,mode:this.chartMode}};}
 restore(o){
  if(o?.stage3){if(o.stage3.schema!=='kaopu/tissue-chart-stage3@1'||o.stage3.baseline!==STAGE3_BASELINE)throw Error('Unsupported third-stage recipe');
   if(o.stage3.mode&&!['gray','grid','material','strain','regions'].includes(o.stage3.mode))throw Error('Unknown tissue inspection mode');
   this.s3Geometry=o.stage3.geometry!==false;this.chartMode=o.stage3.mode||'gray';applyBrowHead(this,this.s3Geometry);
  }super.restore(o);
 }
}
