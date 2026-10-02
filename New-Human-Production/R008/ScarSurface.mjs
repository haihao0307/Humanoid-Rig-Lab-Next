import * as THREE from 'three';
import {SCAR_REGIONS,sourceScarConfidence,resolveScar} from './ScarState.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const normalise=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const linear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
// Small weighted least-squares fits only; generated samples are transient.
function fit(rows,n){const matrix=Array.from({length:n},()=>new Array(n+1).fill(0));for(const {x,y,w}of rows)for(let i=0;i<n;i++){for(let j=0;j<n;j++)matrix[i][j]+=x[i]*x[j]*w;matrix[i][n]+=x[i]*y*w;}for(let i=0;i<n;i++)matrix[i][i]+=1e-6;for(let i=0;i<n;i++){let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(matrix[j][i])>Math.abs(matrix[pivot][i]))pivot=j;[matrix[i],matrix[pivot]]=[matrix[pivot],matrix[i]];const d=matrix[i][i];if(Math.abs(d)<1e-12)return new Array(n).fill(0);for(let k=i;k<=n;k++)matrix[i][k]/=d;for(let j=0;j<n;j++)if(j!==i){const a=matrix[j][i];for(let k=i;k<=n;k++)matrix[j][k]-=a*matrix[i][k];}}return matrix.map(r=>r[n]);}
const GLSL=`
uniform vec3 scarAnchors[24];uniform int scarAnchorCount;uniform vec3 scarCentre;uniform vec3 scarRadii;uniform vec3 scarColor;uniform vec3 scarHealthy[4];uniform vec4 scarShape;uniform vec4 scarTone;uniform float scarRough;
float scarRepair(vec3 p){float mask=0.;for(int i=0;i<24;i++){if(i>=scarAnchorCount)break;mask=max(mask,1.-smoothstep(.006,.016,length(p-scarAnchors[i])));}return mask;}
float scarHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float scarNoise(vec3 p){vec3 c=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(scarHash(c),scarHash(c+vec3(1,0,0)),f.x),mix(scarHash(c+vec3(0,1,0)),scarHash(c+vec3(1,1,0)),f.x),f.y),mix(mix(scarHash(c+vec3(0,0,1)),scarHash(c+vec3(1,0,1)),f.x),mix(scarHash(c+vec3(0,1,1)),scarHash(c+vec3(1,1,1)),f.x),f.y),f.z);}
float scarSmoothMask(vec3 q){return 1.-smoothstep(.28,1.,dot(q,q));}
float scarSource(vec3 colour,vec3 q){
 vec3 s=mix(colour*12.92,1.055*pow(max(colour,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),colour));
 return scarSmoothMask(q)*smoothstep(.36,.54,1.-s.g/max(s.r,.0001))*smoothstep(.65,.85,s.b/max(s.g,.0001))*smoothstep(.10,.20,s.r);
}
float scarCut(vec3 q){float line=q.x+.22*q.y+.045*sin(q.y*8.);float core=1.-smoothstep(.012,.055,abs(line));float branch=(1.-smoothstep(.012,.042,abs(q.x-.33*q.y-.16)))*(1.-smoothstep(.1,.6,abs(q.y+.20)));return max(core,branch*.72)*scarSmoothMask(q)*scarTone.w;}
vec3 scarHealthyColour(vec3 q){return clamp(scarHealthy[0]+scarHealthy[1]*q.x+scarHealthy[2]*q.y+scarHealthy[3]*q.z,vec3(.005),vec3(.90));}
vec3 scarPigment(vec3 base,vec3 healthy,float source,float wound){
 float age=scarTone.z;vec3 color=scarColor*clamp(dot(healthy,vec3(.2126,.7152,.0722))/max(.01,dot(scarHealthy[0],vec3(.2126,.7152,.0722))),.65,1.4);
 color*=1.-.24*(smoothstep(.05,.30,age)*(1.-smoothstep(.35,.60,age)));
 color=mix(color,healthy*vec3(1.025,.96,.94),smoothstep(.45,1.,age));
 vec3 target=mix(base,color,scarTone.x);target*=vec3(1.+scarTone.y*.24,1.-scarTone.y*.28,1.-scarTone.y*.24);
 return clamp(mix(base,healthy,source*(1.-scarShape.x))+(target-base)*wound*scarShape.x,vec3(0.),vec3(1.));
}
vec3 scarBump(vec3 n,float height){vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition),r1=cross(sy,n),r2=cross(n,sx);float d=dot(sx,r1);if(abs(d)<1e-12)return n;return normalize(abs(d)*n-sign(d)*(dFdx(height)*r1+dFdy(height)*r2));}
`;
export function createScarSurface({mesh,surface,data}){
 const originalP=mesh.geometry.attributes.position.array,originalN=mesh.geometry.attributes.normal.array,parts=new Map(data.charts.map(c=>[c.id,c.part])),materials=new Map(data.materials.map((m,i)=>[m.name,i]));
 const records=[],report={regions:[],persistedVertexFields:0,persistedMaps:0,maximumRepairMetres:0,generatedCacheBytes:0};
 function sample(id,part){const im=mesh.material[part].map.image,u=surface.parameters[id*2],v=surface.parameters[id*2+1],x=Math.round(clamp(u,0,1)*(im.width-1)),y=Math.round((1-clamp(v,0,1))*(im.height-1)),at=(y*im.width+x)*4,rgb=Array.from(im.data.subarray(at,at+3),v=>v/255),rough=mesh.material[part].roughnessMap.image;return {rgb,c:rgb.map(linear),rough:rough.data[at+1]/255};}
 for(const region of SCAR_REGIONS){
  const part=materials.get(region.part),all=[];
  for(let id=0;id<originalP.length/3;id++)if(parts.get(surface.chartIds[id])===part){const p=Array.from(originalP.subarray(id*3,id*3+3)),q=p.map((v,i)=>(v-region.centre[i])/region.radii[i]),d=dot(q,q);if(d>5.5)continue;const colour=sample(id,part);all.push({id,p,q,n:Array.from(originalN.subarray(id*3,id*3+3)),d,confidence:sourceScarConfidence(colour.rgb),...colour});}
  const donors=all.filter(r=>r.confidence<.12&&r.d>.30&&r.d<5.5);if(donors.length<12)throw Error('缺少邻近健康皮肤采样：'+region.label);
  const coefficients=[0,1,2].map(k=>fit(donors.map(r=>({x:[1,...r.q],y:r.c[k],w:Math.exp(-r.d*.6)})),4));
  const healthy=Array.from({length:4},(_,i)=>new THREE.Vector3(...coefficients.map(c=>c[i]))),rough=donors.reduce((s,r)=>s+r.rough,0)/donors.length;
  const avgN=normalise(donors.reduce((s,r)=>s.map((v,i)=>v+r.n[i]*Math.exp(-r.d)),[0,0,0])),t1=normalise(cross(avgN,Math.abs(avgN[1])<.8?[0,1,0]:[1,0,0])),t2=cross(avgN,t1),scale=.05;
  const uvw=p=>{const delta=sub(p,region.centre);return [dot(delta,t1)/scale,dot(delta,t2)/scale,dot(delta,avgN)];},basis=(u,v)=>[1,u,v,u*u,u*v,v*v];
  const heights=fit(donors.map(r=>{const [u,v,h]=uvw(r.p);return {x:basis(u,v),y:h,w:Math.exp(-r.d*.6)};}),6);
  const seeds=all.filter(r=>region.sourceScar).filter(r=>r.d<4.0&&(r.confidence>.035||(1-r.rgb[1]/Math.max(r.rgb[0],.001))>.40)).map(r=>r.p),anchors=[];
  if(seeds.length){const centre=seeds.reduce((sum,p)=>sum.map((v,i)=>v+p[i]/seeds.length),[0,0,0]);anchors.push(seeds.reduce((best,p)=>Math.hypot(...sub(p,centre))<Math.hypot(...sub(best,centre))?p:best,seeds[0]));while(anchors.length<24){let best=null,furthest=0;for(const p of seeds){const distance=Math.min(...anchors.map(a=>Math.hypot(...sub(p,a))));if(distance>furthest){best=p;furthest=distance;}}if(!best||furthest<.005)break;anchors.push(best);}}
  const coverage=p=>{const distance=anchors.length?Math.min(...anchors.map(a=>Math.hypot(...sub(p,a)))):1,t=clamp((distance-.006)/.01,0,1);return 1-t*t*(3-2*t);};
  const hasSource=anchors.length>0;
  const patches=all.filter(r=>hasSource&&coverage(r.p)>.001).map(r=>{const mask=coverage(r.p),[u,v,h]=uvw(r.p),target=dot(basis(u,v),heights),delta=clamp(target-h,-.002,.002),du=(heights[1]+2*heights[3]*u+heights[4]*v)/scale,dv=(heights[2]+heights[4]*u+2*heights[5]*v)/scale,fittedN=normalise(avgN.map((v,i)=>v-t1[i]*du-t2[i]*dv)),cleanN=normalise(r.n.map((v,i)=>v*.75+fittedN[i]*.25));report.maximumRepairMetres=Math.max(report.maximumRepairMetres,Math.abs(delta*mask));return {...r,mask,clean:r.p.map((v,i)=>v+avgN[i]*delta),cleanN};});
  const uniforms={scarAnchors:{value:Array.from({length:24},(_,i)=>new THREE.Vector3(...(anchors[i]||region.centre)))},scarAnchorCount:{value:anchors.length},scarCentre:{value:new THREE.Vector3(...region.centre)},scarRadii:{value:new THREE.Vector3(...region.radii)},scarColor:{value:new THREE.Color()},scarHealthy:{value:healthy},scarShape:{value:new THREE.Vector4(1,1,Number(hasSource),rough)},scarTone:{value:new THREE.Vector4()},scarRough:{value:.5}};
  const material=mesh.material[part],before=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=shader=>{before(shader);Object.assign(shader.uniforms,uniforms);shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+GLSL).replace('#include <color_fragment>',`#include <color_fragment>
   float scarSourceMask=0.,scarCleanupMask=0.,scarNewMask=0.,scarWound=0.;bool scarEdited=abs(scarShape.x-1.)>.00001||abs(scarShape.y-1.)>.00001||scarTone.x>.00001||scarTone.y>.00001||scarTone.w>.5||abs(scarRough-.5)>.00001;if(scarEdited){vec3 scarQ=(vSkinRest-scarCentre)/scarRadii;scarSourceMask=scarSource(diffuseColor.rgb,scarQ)*skinEnabled;scarCleanupMask=scarRepair(vSkinRest)*skinEnabled;scarNewMask=scarCut(scarQ)*skinEnabled;scarWound=max(scarSourceMask,scarNewMask);vec3 scarClean=scarHealthyColour(scarQ)*(1.+.045*(scarNoise(vSkinRest*150.)-.5)+.055*(scarNoise(vSkinRest*1100.)-.5));
   diffuseColor.rgb=scarPigment(diffuseColor.rgb,scarClean,scarCleanupMask,scarWound);}`).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,scarShape.w,scarCleanupMask*(1.-scarShape.x))+scarWound*scarShape.x*(scarRough-.5)*.45;').replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   if(scarEdited){if(abs(scarShape.y-1.)>.00001)normal=normalize(mix(nonPerturbedNormal,normal,1.-scarCleanupMask+scarCleanupMask*scarShape.y));
   float scarFootprint=length(fwidth(vSkinRest));float scarHeight=(-.00065*scarNewMask*scarShape.x*scarShape.y+.000016*(scarNoise(vSkinRest*2800.)-.5)*scarCleanupMask*(1.-scarShape.x))*(1.-smoothstep(.0003,.0015,scarFootprint));
   if(scarShape.x<.99999||scarTone.w>.5)normal=scarBump(normal,scarHeight);}`);};material.customProgramCacheKey=()=>key+'|r008-scar-v1';material.needsUpdate=true;
  records.push({region,patches,uniforms,lastRelief:1});report.regions.push({id:region.id,healthySamples:donors.length,sourceScarSamples:patches.length,repairAnchors:anchors.length,healthyColour:healthy[0].toArray(),sourcePart:region.part});report.generatedCacheBytes+=patches.length*(3*4*4+4);
 }
 const api={report,set(state){let changed=false;for(const row of records){const p=state.regions[row.region.id],r=resolveScar(p,state.residual),u=row.uniforms;u.scarColor.value.set(p.color);u.scarShape.value.x=r.effective;u.scarShape.value.y=r.relief;u.scarTone.value.set(r.tint,r.redness,r.progress,r.active);u.scarRough.value=p.roughness;if(Math.abs(row.lastRelief-r.relief)<1e-6)continue;row.lastRelief=r.relief;for(const v of row.patches){const pos=r.relief===1?v.p:v.p.map((a,i)=>a+(v.clean[i]-a)*v.mask*(1-r.relief)),n=r.relief===1?v.n:normalise(v.n.map((a,i)=>a+(v.cleanN[i]-a)*v.mask*(1-r.relief)));mesh.geometry.attributes.position.setXYZ(v.id,...pos);mesh.geometry.attributes.normal.setXYZ(v.id,...n);mesh.geometry.attributes.position.addUpdateRange(v.id*3,3);mesh.geometry.attributes.normal.addUpdateRange(v.id*3,3);}changed=true;}if(changed){mesh.geometry.attributes.position.needsUpdate=true;mesh.geometry.attributes.normal.needsUpdate=true;}return this.report;}};
 return api;
}
