import {fitBeanie} from './beanie.mjs';
import {fitKnit} from './knit.mjs';
/* R04: material thickness and supported fit are distinct. No pointwise contact clamp.
 * All source panels share a continuous fit transform; folded layers retain separation.
 * This is an explicit geometric fitting model, not a textile/contact dynamics solver. */
import {normals,sectionProfile,sample,measurements,FIT_SPECS} from '../mother.mjs';
import {sourceFitProfile as sourceDatum} from '../../r03/fit/field.mjs';
const TAU=2*Math.PI,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t,smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const CONSTRUCTION={
 cable:{bandY:12,pitch:0,material:3.6,apexAir:12,mode:'knit',sourceY:-.055,label:'针织：帽口与下冠承托；帽身有实体厚度，翻边保留叠层'},
 sherpa:{bandY:12,pitch:0,material:2.8,apexAir:12,mode:'knit-flaps',sourceY:-.036,label:'护耳：帽冠承托；耳片在耳外，系带不参与量头'},
 trilby:{bandY:28,pitch:1,material:1.6,mode:'blocked',sourceY:.026,label:'礼帽：内汗带承托；帽冠、外饰带和帽檐不贴头皮'},
 bowler:{bandY:19,pitch:0,material:1.8,mode:'blocked',sourceY:.022,label:'圆顶帽：汗带承托，保留原内外壳与圆顶空间'},
 top:{bandY:24,pitch:0,material:1.8,mode:'blocked',sourceY:.014,label:'高顶帽：帽口定位，高冠空腔与饰带保形'},
 fishing:{bandY:20,pitch:0,material:1,mode:'woven',sourceY:.019,label:'宽檐布帽：内圈承托，顶片与帽檐保留余量'},
 flatcap:{bandY:20,pitch:0,material:1.2,mode:'woven',sourceY:-.017,label:'鸭舌帽：内圈定位，前冠余量与前檐独立保留'},
 patrol:{bandY:20,pitch:0,material:1,mode:'woven',sourceY:.018,label:'便帽：内圈承托，平顶与前檐不按头皮投影'},
 visor:{bandY:20,pitch:0,material:1.2,mode:'open',sourceY:.037,label:'空顶帽：只由帽带承托，前檐与顶部空间不贴头'},
 cloche:{bandY:17,pitch:0,material:1.4,mode:'blocked',sourceY:-.013,label:'钟形帽：内圈承托，低垂檐不作为佩戴圈'},
 chef:{bandY:25,pitch:0,material:.8,mode:'gathered',sourceY:.029,label:'厨师帽：底带定位，帽顶褶量保留'}
};
// Intersect the actual input triangles with planes using one fixed axis; no changing centre.
function polarField(p,ix,ymin,ymax,rows=96,angles=128){
 const step=(ymax-ymin)/(rows-1),layers=[];
 for(let j=0;j<rows;j++){const y=ymin+j*step,seg=[];
  for(let f=0;f<ix.length;f+=3){const a=ix[f]*3,b=ix[f+1]*3,c=ix[f+2]*3;if(y<Math.min(p[a+1],p[b+1],p[c+1])||y>Math.max(p[a+1],p[b+1],p[c+1]))continue;const h=[];for(const [u,v] of [[a,b],[b,c],[c,a]]){const dy=p[v+1]-p[u+1];if(Math.abs(dy)<1e-12)continue;const t=(y-p[u+1])/dy;if(t>=0&&t<1)h.push([mix(p[u],p[v],t),mix(p[u+2],p[v+2],t)]);}if(h.length===2)seg.push(h);}
  const inner=new Float64Array(angles).fill(NaN),outer=new Float64Array(angles).fill(NaN);
  for(let a=0;a<angles;a++){const th=a*TAU/angles,dx=Math.cos(th),dz=Math.sin(th);let lo=Infinity,hi=-Infinity;for(const [s,e] of seg){const ux=e[0]-s[0],uz=e[1]-s[1],den=dx*uz-dz*ux;if(Math.abs(den)<1e-12)continue;const r=(s[0]*uz-s[1]*ux)/den,t=(s[0]*dz-s[1]*dx)/den;if(r>0&&t>=-1e-7&&t<=1+1e-7){lo=Math.min(lo,r);hi=Math.max(hi,r);}}if(Number.isFinite(lo)){inner[a]=lo;outer[a]=hi;}}
  layers.push({y,inner,outer});
 }
 return {layers,step,ymin,ymax,angles,rows};
}
function polarAt(F,y,a,which='inner'){
 const u=clamp((y-F.ymin)/F.step,0,F.rows-1.00001),j=Math.floor(u),v=((a%TAU+TAU)%TAU)*F.angles/TAU,k=Math.floor(v),q=v-k;
 const row=i=>{const b=F.layers[i][which],x=b[k],z=b[(k+1)%F.angles];return Number.isFinite(x)&&Number.isFinite(z)?mix(x,z,q):Number.isFinite(x)?x:z;};let l=row(j),h=row(j+1);if(!Number.isFinite(l))l=h;if(!Number.isFinite(h))h=l;return Number.isFinite(l)?mix(l,h,u-j):NaN;
}
function robustRing(F,y){const L=[];for(let a=0;a<F.angles;a++){let r=polarAt(F,y,a*TAU/F.angles);if(!Number.isFinite(r)||r<.03){r=polarAt(F,y+.003,a*TAU/F.angles);}L.push(r);}const good=L.filter(Number.isFinite).sort((a,b)=>a-b);if(good.length<F.angles*.7)throw Error('帽口截面不完整：必须补充该帽型测量锚点');const median=good[Math.floor(good.length/2)];return L.map(x=>Number.isFinite(x)&&x>.03?x:median);}
function roundRing(R,a){const t=((a%TAU+TAU)%TAU)*R.length/TAU,j=Math.floor(t);return mix(R[j],R[(j+1)%R.length],t-j);}
export function sourceFitProfile(mesh,meta){
 const c=CONSTRUCTION[meta.id],datum=sourceDatum(mesh,meta),knit=c.mode.startsWith('knit');
 const p=knit?new Float32Array(datum.q):Float32Array.from(mesh.position,(v,i)=>v-meta.origin[i%3]);let lo=Infinity,hi=-Infinity;for(let i=1;i<p.length;i+=3){lo=Math.min(lo,p[i]);hi=Math.max(hi,p[i]);}
 let sourceBand=knit?0:c.sourceY;const F=polarField(p,mesh.index,Math.max(lo+.0001,sourceBand-.024),hi-.00001);let ring;
 if(meta.id==='flatcap'){sourceBand=datum.frame.c+datum.ring.y;ring=Array.from({length:128},(_,i)=>datum.ring.radius(i*TAU/128));}
 else if(meta.id==='visor'){ring=Array.from({length:128},(_,i)=>datum.ring.radius(i*TAU/128));}
 else{try{ring=robustRing(F,sourceBand+.002);}catch(e){const valid=F.layers.filter(l=>Array.from(l.inner).filter(x=>Number.isFinite(x)&&x>.03).length/F.angles>.97).sort((a,b)=>Math.abs(a.y-sourceBand)-Math.abs(b.y-sourceBand));if(!valid.length)throw e;sourceBand=valid[0].y;ring=robustRing(F,sourceBand);}}
 return {p,field:F,ring,top:hi,sourceBand,construction:c,sourceDatum:knit?datum.frame:{method:'nearest actual encircling inner section, no radius from decorative brim',sourceBand}};
}
export function deform(mesh,meta,s,headProfile,src){
 if(meta.id==='cable'&&s.autoFit&&headProfile)return fitBeanie(mesh,meta,s,headProfile);
 if(meta.id==='sherpa'&&s.autoFit&&headProfile)return fitKnit(mesh,meta,s,headProfile);
 const c=src.construction,knit=c.mode.startsWith('knit'),fit=s.autoFit&&headProfile,band=s.wearBandMM/1000,thick=s.materialMM/1000,clear=(s.clearanceMM+s.hairMM)/1000,p=src.p,out=new Float32Array(p.length),colors=new Float32Array(p.length),pitch=s.wearPitchDeg*Math.PI/180,co=Math.cos(pitch),si=Math.sin(pitch),sourceH=src.top-src.sourceBand;
 let sx=1,sz=1,common=1,translation=[0,0];
 if(fit){const mm=measurements(headProfile,band);translation=sample(headProfile,band,0).center;const srcX=roundRing(src.ring,0)+roundRing(src.ring,Math.PI),srcZ=roundRing(src.ring,Math.PI/2)+roundRing(src.ring,Math.PI*1.5);sx=(mm.widthMM/1000+2*(clear+(knit?thick:1.2e-3)))/srcX;sz=(mm.depthMM/1000+2*(clear+(knit?thick:1.2e-3)))/srcZ;
  // A single transform for the complete rigid assembly preserves ribbon/crown separation.
  if(!knit){for(let j=0;j<128;j++){const a=j*TAU/128,r=roundRing(src.ring,a),dx=r*Math.cos(a)*sx,dz=r*Math.sin(a)*sz,th=Math.atan2(dz,dx),h=sample(headProfile,band,th);common=Math.max(common,(h.r+clear+.0012)/Math.hypot(dx,dz));}common=Math.min(common,1.15);sx*=common;sz*=common;}
 }
 let minGap=Infinity,maxGap=-Infinity,domain=0,regions={support:0,crown:0,brim:0,flaps:0};
 for(let i=0;i<p.length;i+=3){const x0=p[i],y0=p[i+1],z0=p[i+2],h=y0-src.sourceBand,r=Math.hypot(x0,z0),a=Math.atan2(z0,x0),t=clamp(h/sourceH),ringR=roundRing(src.ring,a);let x=x0*sx,z=z0*sz,y=fit?band+h:y0,region=h<-.015?'brim':h<.035?'support':'crown';
  if(knit&&fit){
   const H=headProfile.ymax-band,capT=clamp(h/sourceH),scalpY=band+H*capT,hs=sample(headProfile,Math.min(scalpY,headProfile.ymax-.0004),a),referenceR=polarAt(src.field,Math.max(src.field.ymin,Math.min(y0,src.top-.0005)),a),normalRad=Math.sqrt(Math.max(0,1-capT*capT)),ease=(.002+.004*smooth(capT))*normalRad,desired=hs.r+(clear+thick+ease)*normalRad;
   // Radial residual carries the actual source cuff fold / offset, never reset to zero.
   const b=Number.isFinite(referenceR)?referenceR:ringR;let radial;
   if(h>=0&&b>.022)radial=desired+(r-b);else if(h>=0)radial=r*clamp(desired/Math.max(b,.001),.55,1.65);else radial=r*(sx+sz)/2;
   const capBlend=1-smooth((-h-.008)/.045);x=mix(x,hs.center[0]+radial*Math.cos(a),capBlend);z=mix(z,hs.center[1]+radial*Math.sin(a),capBlend);
   y=band+h*((H+c.apexAir/1000+Math.max(0,s.crownMM)/1000)/sourceH);
   if(h<-.04){region='flaps';y=band+h;}
   if(c.mode==='knit-flaps'&&h<.015&&h>-.13){const wh=smooth((.015-h)/.025)*(1-smooth((-h-.085)/.045)),side=Math.pow(Math.abs(Math.cos(a)),6),dx=.018*wh*side;x+=Math.sign(x)*dx;}
   const bulge=(s.crownFullness-1)*.03*smooth(capT)*normalRad;x+=bulge*Math.cos(a);z+=bulge*Math.sin(a)-s.backLeanMM/1000*smooth(capT);
  }else{
   const full=1+(s.crownFullness-1)*smooth(t),bw=smooth((r-ringR-.003)/.02)*(1-smooth((h+.010)/.05));
   x*=full;z*=full;x+=(s.brimFactor-1)*Math.max(0,r-ringR)*Math.cos(a)*bw;z+=(s.brimFactor-1)*Math.max(0,r-ringR)*Math.sin(a)*bw;
   y+=s.crownMM/1000*smooth(t)+s.brimCurve/1000*bw;z-=s.backLeanMM/1000*smooth(t);
   if(fit){x+=translation[0];z+=translation[1];}
  }
  if(fit){const ry=y-band,rz=z-translation[1];y=band+co*ry-si*rz;z=translation[1]+si*ry+co*rz;}
  out[i]=x;out[i+1]=y;out[i+2]=z;regions[region]++;
  const col=region==='support'?[.12,.68,.64]:region==='crown'?[.80,.53,.27]:region==='flaps'?[.45,.56,.72]:[.54,.57,.60];colors.set(col,i);
  if(fit&&y>=band-.006&&y<headProfile.ymax-.0005){const mid=sample(headProfile,y,0).center,ang=Math.atan2(z-mid[1],x-mid[0]),hs=sample(headProfile,y,ang);if(hs.valid){const gap=Math.hypot(x-hs.center[0],z-hs.center[1])-hs.r;minGap=Math.min(minGap,gap);maxGap=Math.max(maxGap,gap);domain++;}}
 }
 const m=fit?measurements(headProfile,band):null;
 return {position:out,normal:normals(mesh,out),colors,measurement:m,diagnostics:{mode:c.mode,regions,fitTransform:knit?'continuous cross-section displacement with retained cuff residual':'one affine oval fit shared by crown, ribbon, brim and lining',scales:[sx,1,sz],sourceBandMM:src.sourceBand*1000,wearBandMM:s.wearBandMM,pitchDeg:s.wearPitchDeg,materialThicknessMM:s.materialMM,thicknessHasGeometry:knit,pointwiseScalpClamp:false,sampledVertices:domain,minimumRadialClearanceMM:domain?minGap*1000:null,maximumRadialClearanceMM:domain?maxGap*1000:null,bandMedianMM:null,bandSampleBins:0,restCircumferenceMM:m?m.headCircumferenceMM*(knit?1-s.negativeEase:1):null,requiredCircumferentialStretch:knit?1/(1-s.negativeEase)-1:0,scope:'static engineering candidate; inner thickness geometry and support regions separately tested; no pressure or dynamic collision claim',physicalValidated:false}};
}
