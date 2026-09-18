// Authored shape guardrails for the R24 neutral perioral construction.
// These test geometry relationships; they cannot certify likeness or realism.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const source=readFileSync(new URL('../body/PerioralSurface.js',import.meta.url),'utf8'),context=vm.createContext({});
new vm.Script(source+'\nglobalThis.api={p:COMPACT_PERIORAL_STRUCTURE,depth:compactMuzzleDepth,outline:compactAnatomicalLipOutline,relief:compactAnatomicalLipRelief};').runInContext(context);
const {p,depth,outline,relief}=context.api;let checks=0;
const check=(value,message)=>{assert(value,message);checks++;};
function section(u,upper){
  const samples=Array.from({length:1201},(_,i)=>relief(u,i/1200*p.attachmentRadius,upper)),peak=Math.max(...samples),index=samples.indexOf(peak);
  return {samples,peakM:peak,crest:index/1200*p.attachmentRadius};
}
let maximumPeakM=0,maximumAttachmentCurvature=0;
for(let i=0;i<=80;i++){
  const u=-1+i/40;
  check(Math.abs(relief(u,0,true)-relief(u,0,false))<1e-12,'both lips must preserve the common neutral contact depth');
  for(const upper of [true,false]){
    const q=section(u,upper);maximumPeakM=Math.max(maximumPeakM,q.peakM);
    check(q.samples.every(Number.isFinite)&&q.samples.every(z=>z>=0),'a lip section must be finite above its common bed');
    check(q.crest>0&&q.crest<1,'a lip body crest must remain within the vermilion');
    const index=q.samples.indexOf(q.peakM);
    check(q.samples.every((v,j)=>j===0||(j<=index?v>=q.samples[j-1]-1e-13:v<=q.samples[j-1]+1e-13)),'lip bodies must not acquire secondary concentric rolls');
    const R=p.attachmentRadius,h=1e-5,z0=relief(u,R,upper),z1=relief(u,R-h,upper),z2=relief(u,R-2*h,upper),d2=(z0-2*z1+z2)/(h*h);
    maximumAttachmentCurvature=Math.max(maximumAttachmentCurvature,Math.abs(d2));
    check(Math.abs(z0)<1e-12&&Math.abs((z0-z1)/h)<1e-6&&Math.abs(d2)<1e-4,'outer attachment must retain zero height, slope and curvature');
  }
}
const upperCentre=section(0,true),upperSide=section(.50,true),lowerCentre=section(0,false),lowerLobe=section(.28,false);
check(upperCentre.peakM<.0019,'the old isolated 2.18 mm central upper button must not return');
check(upperCentre.peakM/upperSide.peakM<1.30,'upper lateral bodies must carry a substantial share of projection');
check(upperSide.crest>upperCentre.crest+.06,'upper lateral bodies must turn at a different depth section');
check(lowerLobe.peakM>lowerCentre.peakM&&lowerLobe.peakM<lowerCentre.peakM*1.10,'paired lower bodies must remain subtle and connected');
const centre=outline(p.centreX),bow=outline(p.centreX+p.halfWidth*.20);
check(bow.top>centre.top&&bow.top-centre.top<.0018,'Cupid contour must be present without an isolated exaggerated arch');
check(p.seamY-centre.seam<.0006,'central lip contact must not form the old deep V when opening');
check(centre.seam-centre.bottom>centre.top-centre.seam,'neutral lower body must have greater vertical span than the upper body');
let maxLateralDepthStepM=0;
for(let y=1.441;y<=1.478;y+=.001)for(let x=p.centreX-.040;x<p.centreX+.040;x+=.00025){
  const a=depth(x,y),b=depth(x+.00025,y);check(Number.isFinite(a)&&Number.isFinite(b),'the oral bed must be finite');
  maxLateralDepthStepM=Math.max(maxLateralDepthStepM,Math.abs(a-b));
}
check(maxLateralDepthStepM<.0002,'the dental arc must not add sharp transverse ridges');
const sulcus=depth(p.centreX,p.labiomental.y),chin=depth(p.centreX,p.mentalis.y),lowerLipBed=depth(p.centreX,1.452);
check(sulcus<chin&&sulcus<lowerLipBed,'the chin/lower-lip support must preserve the labiomental valley');
check(depth(p.centreX,1.468)>depth(p.centreX+.032,1.468)+.0008,'the cutaneous upper lip must wrap a projecting dental support');
console.log(JSON.stringify({revision:p.revision,sourceSHA256:createHash('sha256').update(source).digest('hex'),checks,
  maximumPeakM,maximumAttachmentCurvature,maxLateralDepthStepM,
  upperCentre:{peakM:upperCentre.peakM,crest:upperCentre.crest},upperSide:{peakM:upperSide.peakM,crest:upperSide.crest},
  lowerCentre:{peakM:lowerCentre.peakM,crest:lowerCentre.crest},lowerLobe:{peakM:lowerLobe.peakM,crest:lowerLobe.crest},
  labiomentalSupportM:{sulcus,chin,lowerLipBed},visualAcceptance:false},null,2));
