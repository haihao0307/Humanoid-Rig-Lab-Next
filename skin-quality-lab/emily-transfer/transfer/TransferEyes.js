import {bindTissueCoordinates} from '../stage3/TissueCoordinates.js';
import {ChartEyes} from '../stage3/ChartEyes.js';
import {medialRecess,MEDIAL_PROFILE_VERSION} from './MedialProfile.mjs';
export const EYE_VERSION='eyes/11.0.0-transfer';
export class TransferEyes extends ChartEyes{
 constructor(options){super(options);this.medialFix=true;this.ready=this.ready.then(()=>{this.medialTransferReady=true;this.update(0,true);bindTissueCoordinates(this);this.state.version=EYE_VERSION;return this;});}
 margin(c,a,blink){
  const p=super.margin(c,a,blink);
  if(!this.medialTransferReady||!this.medialFix||this.contourBaseline||this.closedRestEnabled===false||this.sectionEnabled===false)return p;
  const s=(Math.cos(a)*c.sign+1)/2;if(s>=.18||blink>=1)return p;
  const front=this.eyeFront(c,p.x,p.y);if(front===null)return p;
  const r=medialRecess({s,closure:blink,anterior:p.z,support:front,radius:c.radius});p.z=r.z;return p;
 }
 medialBefore(on){this.medialFix=!on;this.update(0,true);this.requestRender();}
 medialReport(){
  const rows=[];
  for(const e of this.eyes){
   this._fittingEye=e;const saved=this.medialFix,points=[];
   for(const s of [0,.025,.05,.075,.1,.15,.18]){
    const a=Math.acos((s*2-1)*e.c.sign),b=this.config.manualBlink>=0?this.config.manualBlink:0;
    this.medialFix=false;const old=this.margin(e.c,a,b);this.medialFix=true;const p=this.margin(e.c,a,b);this.medialFix=saved;
    points.push({fromNasal:s,beforeMM:old.toArray().map(x=>x*1000),afterMM:p.toArray().map(x=>x*1000),recessMM:(old.z-p.z)*1000});
   }
   rows.push({name:e.c.name,points,centreMM:e.pivot.position.toArray().map(v=>v*1000),radiusMM:e.c.radius*1000});
  }
  this._fittingEye=null;return {version:MEDIAL_PROFILE_VERSION,enabled:this.medialFix,closure:this.config.manualBlink,eyes:rows,sourceHeadReplaced:false,sharedAttachmentRebuilt:true,closedEndpointPreserved:true};
 }
 snapshot(){return {...super.snapshot(),medialTransfer:{schema:MEDIAL_PROFILE_VERSION,enabled:this.medialFix!==false}};}
 restore(o){if(o?.medialTransfer){if(o.medialTransfer.schema!==MEDIAL_PROFILE_VERSION)throw Error('Wrong medial recipe');this.medialFix=o.medialTransfer.enabled!==false;}super.restore(o);}
}
