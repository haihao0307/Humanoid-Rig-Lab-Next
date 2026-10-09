import {TalkingHeadBehaviorKernel,TALKINGHEAD_SOURCE} from './vendor/TalkingHeadBehavior.mjs';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const DEFAULT_BEHAVIOR=Object.freeze({enabled:true,mood:'neutral',headMotion:true,headAmount:.42,eyeContact:.82,paused:false,manualYaw:0,manualPitch:0});
/** Native TalkingHead animation templates + evaluators; host-owned clock only.
 * Outputs semantic channels, never touches meshes, lights, audio, DOM or RAF.
 */
export class BehaviorController {
 constructor(settings={}){this.settings={...DEFAULT_BEHAVIOR};this.kernel=null;this.manualBlinkUntil=0;this.gestureUntil=0;this.blinksIssued=0;this.reset(settings);}
 reset(settings={}){
  this.settings={...DEFAULT_BEHAVIOR,...settings};this.kernel=new TalkingHeadBehaviorKernel({avatarIdleEyeContact:this.settings.eyeContact,avatarIdleHeadMove:.35});
  this.kernel.setMood(this.settings.mood);this.manualBlinkUntil=0;this.gestureUntil=0;this._eyeRef=null;this.eyeContact=true;this.frame=this.readFrame();
 }
 configure(settings){
  const old=this.settings;const next={...old,...settings};
  if(!['neutral','happy','sad','sleep'].includes(next.mood))throw Error('Unsupported eye mood');
  for(const k of ['enabled','headMotion','paused'])if(typeof next[k]!=='boolean')throw Error(k+' must be boolean');
  for(const [key,min,max] of [['headAmount',0,1],['eyeContact',0,1],['manualYaw',-.38,.38],['manualPitch',-.24,.24]]){
   if(!Number.isFinite(next[key]))throw Error(key+' must be finite');next[key]=clamp(next[key],min,max);
  }
  if(next.mood!==old.mood||next.eyeContact!==old.eyeContact){
   this.kernel.animQueue.length=0;this.kernel.opt.avatarIdleEyeContact=next.eyeContact;this.kernel.setMood(next.mood);this._eyeRef=null;
  }
  this.settings=next;
 }
 advance(dt,autoBlink=true){
  if(!this.settings.paused){
   this.kernel.step(clamp(dt,0,.1)*1000);
   const eye=this.kernel.animQueue.find(a=>a.template.name==='eyes');
   if(eye!==this._eyeRef){this._eyeRef=eye;if(eye&&!('eyeContact' in eye.vs))this.eyeContact=false;}
   if(this.kernel.lastSignals.eyeContact!==null)this.eyeContact=this.kernel.lastSignals.eyeContact;
  }
  this.frame=this.readFrame(autoBlink);return this.frame;
 }
 readFrame(autoBlink=true){
  const k=this.kernel,get=n=>Number.isFinite(k.mtAvatar[n]?.value)?k.mtAvatar[n].value:0;
  const closed=get('eyesClosed'),allow=autoBlink||k.animClock<this.manualBlinkUntil||this.settings.mood==='sleep';
  const sides=['Right','Left'];
  return {blink:sides.map(s=>allow?clamp(get('eyeBlink'+s)+closed,0,1):0),
   squint:sides.map(s=>clamp(get('eyeSquint'+s),0,1)),wide:sides.map(s=>clamp(get('eyeWide'+s),0,1)),
   pitch:clamp(get('eyesLookDown')-get('eyesLookUp'),-.6,.6),
   yaw:clamp(get('eyeLookOutLeft')-get('eyeLookInLeft'),-.6,.6),
   head:[get('bodyRotateX')+get('headRotateX'),get('bodyRotateY')+get('headRotateY'),get('bodyRotateZ')+get('headRotateZ')],
   eyeContact:this.eyeContact!==false,gestureActive:k.animClock<this.gestureUntil};
 }
 blink(kind='single'){
  if(!['single','double','left','right'].includes(kind))throw Error('Unknown blink type');
  const k=this.kernel,template=k.deepCopy(k.animTemplateBlink.alt[kind==='double'?1:0]);
  template.name='manual-blink';template.delay=0;
  if(kind==='left')template.vs.eyeBlinkRight=template.vs.eyeBlinkRight.map(()=>0);
  if(kind==='right')template.vs.eyeBlinkLeft=template.vs.eyeBlinkLeft.map(()=>0);
  k.animQueue=k.animQueue.filter(a=>a.template.name!=='manual-blink');
  const track=k.animFactory(template,false);this.manualBlinkUntil=track.ts.at(-1)+30;k.animQueue.push(track);this.blinksIssued++;
 }
 gesture(kind){
  if(!['yes','no'].includes(kind))throw Error('Unsupported head gesture');
  const k=this.kernel,template={...k.gestureTemplates[kind],name:'manual-head-gesture'};
  k.animQueue=k.animQueue.filter(a=>a.template.name!=='manual-head-gesture');
  const track=k.animFactory(template,false);this.gestureUntil=track.ts.at(-1);k.animQueue.push(track);
 }
 diagnostics(){return {source:TALKINGHEAD_SOURCE,clockMS:this.kernel.animClock,upstreamSteps:this.kernel.steps,queueLength:this.kernel.animQueue.length,blinksIssued:this.blinksIssued,frame:this.frame,settings:{...this.settings},ownsRenderer:false,ownsAnimationFrame:false,ownsAudio:false,fullTalkingHeadClassInstantiated:false};}
}
