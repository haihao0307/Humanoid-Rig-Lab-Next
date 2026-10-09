import {ContourEyes} from '../stage1/ContourEyes.js';
import {SECTION_BASELINE,reconstructSection} from './SectionField.js';
import {createCanthalTissue,updateCanthalTissue} from './CanthalTissue.js';
export const EYE_VERSION='eyes/9.0.0-s2';
export class SectionEyes extends ContourEyes{
 constructor(options){
  super(options);this.sectionEnabled=true;
  this.ready=this.ready.then(()=>{
   for(const e of this.eyes)e.section={...createCanthalTissue(this,e),beforePositions:new Float32Array(e.lid.mesh.geometry.attributes.position.array.length),beforeNormals:new Float32Array(e.lid.mesh.geometry.attributes.normal.array.length)};
   this.update(0,true);this.state.version=EYE_VERSION;return this;
  });
 }
 updateLid(e,blink){
  super.updateLid(e,blink);if(!e.section)return;
  const b=this.config.manualBlink>=0?this.config.manualBlink:blink;
  if(this.sectionEnabled!==false&&this.closedRestEnabled!==false&&!this.contourBaseline){reconstructSection(this,e,b);updateCanthalTissue(this,e,b);}
  else{e.section.medial.mesh.visible=false;e.section.lateral.mesh.visible=false;}
 }
 compareStage1(on){this.sectionEnabled=!on;this.update(0,true);this.requestRender();}
 sectionReport(){return {version:EYE_VERSION,stage:2,baseline:SECTION_BASELINE,enabled:this.sectionEnabled!==false,firstStageClosedSurfacePreserved:true,globeRecalibrated:false,materialsRebuilt:false,physicalDynamicsRebuilt:false,eyes:this.eyes.map(e=>({name:e.c.name,...e.section?.report,canthus:e.section?.canthalReport}))};}
 sections(name='right'){
  const e=this.eyes.find(e=>e.c.name===name);if(!e)throw Error('Unknown eye');const {lid}=e,P=lid.mesh.geometry.attributes.position,E=lid.edge.geometry.attributes.position,I=lid.inside.geometry.attributes.position;
  const result={eye:name,units:'metres',upper:[],lower:[],upperMargin:[],lowerMargin:[],upperMucosa:[],lowerMucosa:[]};
  for(const [key,a]of[['upper',lid.A/4],['lower',3*lid.A/4]]){
   for(let j=0;j<=lid.R;j++){const k=j*(lid.A+1)+a;result[key].push([P.getX(k),P.getY(k),P.getZ(k)]);}
   for(let j=0;j<=lid.es;j++){const k=a*(lid.es+1)+j;result[key+'Margin'].push([E.getX(k),E.getY(k),E.getZ(k)]);}
   for(let j=0;j<=10;j++){const k=j*(lid.A+1)+a;result[key+'Mucosa'].push([I.getX(k),I.getY(k),I.getZ(k)]);}
  }return result;
 }
 snapshot(){return {...super.snapshot(),stage2:{schema:'kaopu/eye-section@1',baseline:SECTION_BASELINE,enabled:this.sectionEnabled!==false}};}
 restore(o){if(o?.stage2){if(o.stage2.schema!=='kaopu/eye-section@1'||o.stage2.baseline!==SECTION_BASELINE)throw Error('Wrong stage-two recipe');this.sectionEnabled=o.stage2.enabled!==false;}super.restore(o);}
 info(){return {...super.info(),sectionStage2:this.sectionReport()};}
 dispose(){for(const e of this.eyes)for(const k of ['medial','lateral']){const m=e.section?.[k]?.mesh;m?.geometry.dispose();m?.material.dispose();m?.removeFromParent();}super.dispose();}
}
