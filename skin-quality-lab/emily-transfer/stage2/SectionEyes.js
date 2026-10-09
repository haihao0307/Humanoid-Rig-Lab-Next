import {ContourEyes} from '../stage1/ContourEyes.js';
import {SECTION_BASELINE,reconstructSection} from './SectionField.js';
import {createCanthalTissue,updateCanthalTissue} from './CanthalTissue.js';
export const EYE_VERSION='eyes/9.0.0-s2';
export class SectionEyes extends ContourEyes{
 constructor(options){
  super(options);this.sectionEnabled=true;
  this.ready=this.ready.then(()=>{
   for(const e of this.eyes)e.section={...createCanthalTissue(this,e),beforePositions:new Float32Array(e.lid.mesh.geometry.attributes.position.array.length),beforeNormals:new Float32Array(e.lid.mesh.geometry.attributes.normal.array.length)};
   for(const e of this.eyes)e.c.stage2MarginReady=true;
   this.update(0,true);this.state.version=EYE_VERSION;return this;
  });
 }
 updateLid(e,blink){
  e.c.stage2MarginDeltaMM=0;this._stage2MeasuringEye=e.c;
  try{super.updateLid(e,blink);}finally{this._stage2MeasuringEye=null;}if(!e.section)return;
  const b=this.config.manualBlink>=0?this.config.manualBlink:blink;
  if(this.sectionEnabled!==false&&this.closedRestEnabled!==false&&!this.contourBaseline){reconstructSection(this,e,b);updateCanthalTissue(this,e,b);}
  else{e.section.medial.mesh.visible=false;e.section.lateral.mesh.visible=false;}
 }
 margin(c,a,blink){
  const p=super.margin(c,a,blink);
  if(!c.stage2MarginReady||this.sectionEnabled===false||this.contourBaseline||this.closedRestEnabled===false||blink>=1)return p;
  const u=(Math.cos(a)*c.sign+1)*.5,medial=u<.12,temporal=u>.90;if(!medial&&!temporal)return p;
  const upper=Math.sin(a)>=0,extent=medial?.12:.10,near=medial?0:1,end=medial?extent:1-extent;
  const sample=s=>{const theta=Math.acos(Math.max(-1,Math.min(1,(s*2-1)*c.sign)));return super.margin(c,upper?theta:Math.PI*2-theta,blink).z;};
  const z0=sample(near),z1=sample(end),dir=medial?1:-1,eps=.001,d0=Math.max(-.014,Math.min(.014,(sample(near+dir*eps)-z0)/eps)),d1=(sample(end+dir*eps)-sample(end-dir*eps))/(2*eps),t=Math.abs(u-near)/extent,t2=t*t,t3=t2*t;
  const fair=(2*t3-3*t2+1)*z0+(t3-2*t2+t)*extent*d0+(-2*t3+3*t2)*z1+(t3-t2)*extent*d1;
  const w=1-blink*blink*(3-2*blink),z=p.z+(fair-p.z)*w;
  if(this._stage2MeasuringEye===c)c.stage2MarginDeltaMM=Math.max(c.stage2MarginDeltaMM||0,Math.abs(z-p.z)*1000);p.z=z;return p;
 }
 compareStage1(on){this.sectionEnabled=!on;this.update(0,true);this.requestRender();}
 sectionReport(){return {version:EYE_VERSION,stage:2,baseline:SECTION_BASELINE,enabled:this.sectionEnabled!==false,firstStageClosedSurfacePreserved:true,globeRecalibrated:false,materialsRebuilt:false,physicalDynamicsRebuilt:false,eyes:this.eyes.map(e=>({name:e.c.name,maxOpenCanthalDepthCorrectionMM:e.c.stage2MarginDeltaMM||0,...e.section?.report,canthus:e.section?.canthalReport}))};}
 sections(name='right'){
  const e=this.eyes.find(e=>e.c.name===name);if(!e)throw Error('Unknown eye');const {lid}=e,P=lid.mesh.geometry.attributes.position,E=lid.edge.geometry.attributes.position,I=lid.inside.geometry.attributes.position;
  const result={eye:name,units:'metres',upper:[],lower:[],upperMargin:[],lowerMargin:[],upperMucosa:[],lowerMucosa:[]};
  for(const [key,a]of[['upper',lid.A/4],['lower',3*lid.A/4]]){
   for(let j=0;j<=lid.R;j++){const k=j*(lid.A+1)+a;result[key].push([P.getX(k),P.getY(k),P.getZ(k)]);}
   for(let j=0;j<=lid.es;j++){const k=a*(lid.es+1)+j;result[key+'Margin'].push([E.getX(k),E.getY(k),E.getZ(k)]);}
   for(let j=0;j<=10;j++){const k=j*(lid.A+1)+a;result[key+'Mucosa'].push([I.getX(k),I.getY(k),I.getZ(k)]);}
  }return result;
 }
 audit(detailed=false){
  const report=super.audit(detailed);report.version=EYE_VERSION;report.section=this.sectionReport();
  if(detailed)for(const row of report.eyes){
   const e=this.eyes.find(e=>e.c.name===row.name);this._fittingEye=e;const tests=[];
   for(const [name,m] of [['outer',e.lid.mesh],['medial',e.section?.medial.mesh],['lateral',e.section?.lateral.mesh]]){
    if(!m)continue;const p=m.geometry.attributes.position,ix=m.geometry.index.array;let min=Infinity,n=0,bad=0;
    for(let k=0;k<ix.length;k+=3)for(const w of [[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5]]){
     let x=0,y=0,z=0;for(let i=0;i<3;i++){x+=w[i]*p.getX(ix[k+i]);y+=w[i]*p.getY(ix[k+i]);z+=w[i]*p.getZ(ix[k+i]);}
     const front=this.eyeFront(e.c,x,y);if(front===null)continue;const gap=z-front;n++;min=Math.min(min,gap);if(gap<-1e-7)bad++;
    }tests.push({name,samples:n,penetrations:bad,minAxialGapMM:Number.isFinite(min)?min*1000:null});
   }row.stage2SurfaceTests=tests;
  }
  this._fittingEye=null;return report;
 }
 snapshot(){return {...super.snapshot(),stage2:{schema:'kaopu/eye-section@1',baseline:SECTION_BASELINE,enabled:this.sectionEnabled!==false}};}
 restore(o){if(o?.stage2){if(o.stage2.schema!=='kaopu/eye-section@1'||o.stage2.baseline!==SECTION_BASELINE)throw Error('Wrong stage-two recipe');this.sectionEnabled=o.stage2.enabled!==false;}super.restore(o);}
 info(){return {...super.info(),sectionStage2:this.sectionReport()};}
 dispose(){for(const e of this.eyes)for(const k of ['medial','lateral']){const m=e.section?.[k]?.mesh;m?.geometry.dispose();m?.material.dispose();m?.removeFromParent();}super.dispose();}
}
