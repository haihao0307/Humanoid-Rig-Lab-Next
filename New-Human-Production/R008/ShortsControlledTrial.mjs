import * as THREE from 'three';
import {createBasicShortsPaper,placeBasicShortsPaper} from './ShortsBasicBlock.mjs';
import {ShortsClothRuntime} from './ShortsClothRuntime.mjs';
import {inspectShortsTriangleCrossings} from './ShortsCoverageIntersection.mjs';
import {scSolveBending} from './ShortsBending.mjs';
import {ShortsProjectiveAssembly} from './ShortsProjectiveAssembly.mjs';
import {developShortsStrips,flatShortsStrips} from './ShortsDevelopablePanels.mjs';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createShortsTestMannequin(){
 const ellipsoid=(p,c,r)=>{const q=p.map((v,k)=>(v-c[k])/r[k]),k0=Math.hypot(...q),k1=Math.hypot(...q.map((v,k)=>v/r[k]));return k1?(k0*(k0-1)/k1):-Math.min(...r);};
 const sdf=p=>Math.min(ellipsoid(p,[0,.94,0],[.18,.14,.115]),Math.max((Math.hypot(p[0]/.16,p[2]/.105)-1)*.105,.97-p[1],p[1]-1.18),...[-1,1].map(s=>Math.hypot(p[0]-s*.095,p[1]-clamp(p[1],.48,.895),p[2])-.075));
 const body={sdf,collide(point,margin=.004){const p=point.toArray(),d=sdf(p);if(d>=margin)return null;const e=1e-5,n=p.map((_,k)=>{const a=p.slice(),b=p.slice();a[k]+=e;b[k]-=e;return(sdf(a)-sdf(b))/(2*e);});let l=Math.hypot(...n);if(l<1e-8){n[2]=1;l=1;}const normal=new THREE.Vector3(...n.map(v=>v/l));return{point:point.clone().addScaledVector(normal,margin-d),normal,penetration:margin-d};},snapshot(){return null;},update(){}};
 const sectionAt=(y,side)=>side==='hip'?{radiusX:y>=.94?.18-Math.min(.02,(y-.94)*.21):.18,radiusZ:y>=.94?.115-Math.min(.010,(y-.94)*.106):.115,centerZ:0}:{centerX:(side==='left'?-1:1)*.095,centerZ:0,radiusX:.075,radiusZ:.075};
 const circumference=(a,b)=>{let total=0,prev=[0,b];for(let i=1;i<=1024;i++){const t=2*Math.PI*i/1024,p=[a*Math.sin(t),b*Math.cos(t)];total+=Math.hypot(p[0]-prev[0],p[1]-prev[1]);prev=p;}return total;};
 const m={unit:'m',waistFrontArc:circumference(.16,.105)/2,waistBackArc:circumference(.16,.105)/2,hipFrontArc:circumference(.18,.115)/2,hipBackArc:circumference(.18,.115)/2,waistToHip:.095,crotchDepth:.235,frontRiseLength:.31,backRiseLength:.31,thighCircumference:{left:2*Math.PI*.075,right:2*Math.PI*.075}};
 return{body,sectionAt,measurements:m,waistY:1.035,crotchY:.8,addTo(scene){const material=new THREE.MeshStandardMaterial({color:0xbba48b,roughness:.8});const sphere=(c,r)=>{const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,40,32),material);mesh.position.set(...c);mesh.scale.set(...r);scene.add(mesh);};sphere([0,.94,0],[.18,.14,.115]);for(const s of[-1,1]){const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(.075,.415,10,32),material);mesh.position.set(s*.095,.6875,0);scene.add(mesh);}const trunk=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.21,48),material);trunk.scale.set(.16,1,.105);trunk.position.y=1.075;scene.add(trunk);}};
}

export function auditBasicShorts(c,body,{sectionY=.73,axes=[-.095,.095],sampleDivisions=8}={}){
 let minimumDistance=Infinity,samples=0;for(const t of c.triangles){const p=t.q.map(i=>c.positions[i]);for(let i=0;i<=sampleDivisions;i++)for(let j=0;j<=sampleDivisions-i;j++){const a=i/sampleDivisions,b=j/sampleDivisions,v=p[0].map((x,k)=>x*(1-a-b)+p[1][k]*a+p[2][k]*b);minimumDistance=Math.min(minimumDistance,body.sdf(v));samples++;}}
 const graph=new Map(),points=new Map(),key=p=>p.map(v=>Math.round(v/1e-6)).join(':');
 for(const t of c.triangles){const p=t.q.map(i=>c.positions[i]),hits=[];for(let i=0;i<3;i++){const a=p[i],b=p[(i+1)%3],da=a[1]-sectionY,db=b[1]-sectionY;if(da*db<0){const f=da/(da-db);hits.push(a.map((v,k)=>v+(b[k]-v)*f));}}if(hits.length!==2)continue;const[a,b]=hits.map(key);if(a===b)continue;points.set(a,hits[0]);points.set(b,hits[1]);for(const[i,j]of[[a,b],[b,a]]){if(!graph.has(i))graph.set(i,new Set());graph.get(i).add(j);}}
 const seen=new Set(),loops=[];for(const first of graph.keys()){if(seen.has(first))continue;const loop=[],stack=[first];while(stack.length){const v=stack.pop();if(seen.has(v))continue;seen.add(v);loop.push(points.get(v));for(const j of graph.get(v))if(!seen.has(j))stack.push(j);}loops.push(loop);}
 const contains=(poly,x)=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[2]>0)!==(b[2]>0)&&x<(b[0]-a[0])*(-a[2])/(b[2]-a[2])+a[0])inside=!inside;}return inside;};
 const counts=axes.map(x=>loops.filter(p=>contains(p,x)).length),twoLegs=loops.length===2&&[...graph.values()].every(x=>x.size===2)&&counts.every(n=>n===1)&&loops.every(p=>axes.filter(x=>contains(p,x)).length===1);
 const proxy={triangles:c.triangles.map((t,id)=>({id,indices:t.q,part:'cloth'})),positions:Float64Array.from(c.positions.flat()),snapshot:()=>({revision:0,time:0,contactExcludedParts:[]})},cross=inspectShortsTriangleCrossings(c,proxy,{queryAPI:{positions:new Float64Array(),indices:new Uint32Array()}}),selfCrossings=cross.exactcrossings.filter(x=>x.clothTriangle<x.bodyTriangle&&!x.clothDOFs.some(id=>x.bodyIndices.includes(id))).length;
 const a=c.audit(false);return{strain:a.mainStrain,worst:a.worstMaterialTriangle,minimumBodyDistanceM:minimumDistance,bodySamples:samples,bodyVerification:'dense analytic signed-distance samples on complete triangles; no continuous proof',selfCrossings,twoLegs,section:{y:sectionY,loops:loops.length,axisLoopCounts:counts},finite:a.finite,seamGapM:0,passed:a.finite&&a.mainStrain<.05&&minimumDistance>=-.001&&selfCrossings===0&&twoLegs};
}

export async function runControlledShorts(scene,actor,{onProgress=()=>{},roundLimit=800}={}){
 const fixture=createShortsTestMannequin(),results=[],cloths=[],start=performance.now();
 for(const [i,config]of [{name:'不翻折的布片坐标图',ease:.03,rise:0,projective:true,chart:true},{name:'坐标图与约束残差迭代',ease:.03,rise:0,projective:true,chart:true,dual:true}].entries()){
  const m=fixture.measurements,waistEase=m.hipFrontArc+m.hipBackArc-m.waistFrontArc-m.waistBackArc+config.ease,pattern=createBasicShortsPaper(m,{hipEase:config.ease,waistEase,sideIntake:0,frontRiseEase:config.rise,backRiseEase:config.rise}),placementSection=(y,side)=>side==='hip'&&y>=.94?{radiusX:.18,radiusZ:.115,centerZ:0}:fixture.sectionAt(y,side),draft=placeBasicShortsPaper(pattern,placementSection,{...fixture,clearance:.004});
  // Initialize on the observed FRONT/BACK exterior, never by an unsigned
  // nearest-point projection through a body. The placement remains a seed.
  for(const range of draft.ranges){const sign=range.pieceId[0]==='F'?1:-1;for(let id=range.offset;id<range.offset+range.count;id++){const x=draft.positions[id*3],y=draft.positions[id*3+1];if(fixture.body.sdf([x,y,0])<0){let lo=0,hi=.3;for(let j=0;j<40;j++){const mid=(lo+hi)/2;if(fixture.body.sdf([x,y,mid])<0)lo=mid;else hi=mid;}draft.positions[id*3+2]=sign*Math.max(Math.abs(draft.positions[id*3+2]),hi+.005);}}}
  const c=new ShortsClothRuntime(draft,fixture.body,actor,scene,{elasticEnabled:false,bendTopology:'within-piece-flat',...(config.membrane?{membraneModel:'orthotropic-paper',paperMaterial:{warpNPerM:1e6,weftNPerM:1e6,shearNPerM:1e6}}:{})});c.enabled=false;cloths.push(c);for(const old of cloths.slice(0,-1))old.mesh.visible=false;
  // Assembly jig supports only the opening, never the panels or legs. This
  // experiment validates manufacture; it does not claim elastic wearing.
  // Support height only: material can slide circumferentially on the jig.
  const initial=c.audit(false).mainStrain,deadline=performance.now()+22000,pd=new ShortsProjectiveAssembly(c,{chartBarrier:config.chart,dual:config.dual});let round=0;
  for(;round<roundLimit&&performance.now()<deadline;round++){
   pd.step();
   if(round%20===0){onProgress({i,name:config.name,round,strain:c.audit(false).mainStrain});c.syncRender();await new Promise(r=>setTimeout(r,0));}
  }
  c.syncRender();const audit=auditBasicShorts(c,fixture.body),result={name:config.name,...audit,initialStrain:initial,rounds:round,elapsedMs:performance.now()-start,sourcePaperAuthority:pattern.paperAuthority,constructionJig:'waist boundary held; legs and panels free',elasticWearingValidated:false,motionValidated:false,productionReady:false};results.push(result);onProgress({i,...result});if(result.passed)break;
 }
 return{fixture,cloths,results,anyPassed:results.some(r=>r.passed),elapsedMs:performance.now()-start};
}

export async function runDevelopedShorts(scene,actor,{onProgress=()=>{},roundLimit=100}={}){
 const fixture=createShortsTestMannequin(),m=fixture.measurements,pattern=createBasicShortsPaper(m,{hipEase:.03,waistEase:m.hipFrontArc+m.hipBackArc-m.waistFrontArc-m.waistBackArc+.03,sideIntake:0,frontRiseEase:0,backRiseEase:0}),start=performance.now(),results=[],cloths=[];
 for(const clearance of [.008,.014,.022]){
  const section=(y,side)=>side==='hip'&&y>=.94?{radiusX:.18,radiusZ:.115,centerZ:0}:fixture.sectionAt(y,side),design=placeBasicShortsPaper(pattern,section,{...fixture,clearance});
  for(const range of design.ranges){const sign=range.pieceId[0]==='F'?1:-1;for(let id=range.offset;id<range.offset+range.count;id++){const x=design.positions[id*3],y=design.positions[id*3+1];if(fixture.body.sdf([x,y,0])<0){let lo=0,hi=.3;for(let j=0;j<40;j++){const mid=(lo+hi)/2;if(fixture.body.sdf([x,y,mid])<0)lo=mid;else hi=mid;}design.positions[id*3+2]=sign*Math.max(Math.abs(design.positions[id*3+2]),hi+clearance);}}}
  // First identify design seam copies, then cut NEW independent flat panels.
  const reference=new ShortsClothRuntime(design,fixture.body,actor,scene,{elasticEnabled:false});for(let i=0;i<reference.quotient.length;i++)design.positions.set(reference.positions[reference.quotient[i]],i*3);reference.dispose();
  const draft=developShortsStrips(design),c=new ShortsClothRuntime(draft,fixture.body,actor,scene,{elasticEnabled:false,bendTopology:'within-piece-flat'});c.enabled=false;cloths.push(c);for(const old of cloths.slice(0,-1))old.mesh.visible=false;
  const manufactured=auditBasicShorts(c,fixture.body),flat=flatShortsStrips(draft),proxy={positions:Float64Array.from(flat.positions.flat()),triangles:flat.triangles.map((t,id)=>({id,indices:t.q,part:'paper'})),snapshot:()=>({revision:0,time:0,contactExcludedParts:[]})},flatCross=inspectShortsTriangleCrossings(flat,proxy,{queryAPI:{positions:new Float64Array(),indices:new Uint32Array()}}).exactcrossings.filter(x=>x.clothTriangle<x.bodyTriangle&&!x.clothDOFs.some(id=>x.bodyIndices.includes(id))),withinPiece=flatCross.filter(x=>draft.ranges.find(r=>x.clothDOFs[0]>=r.offset&&x.clothDOFs[0]<r.offset+r.count)===draft.ranges.find(r=>x.bodyIndices[0]>=r.offset&&x.bodyIndices[0]<r.offset+r.count));
  const intrinsicIdentity=()=>JSON.stringify({uv:Array.from(draft.sourceUV),triangles:Array.from(draft.triangles),mass:c.mass,edges:c.edges.map(e=>e.rest),bends:c.bends.map(e=>e.restAngle)}),paperIdentity=intrinsicIdentity(),supports=new Map(c.waist.map(id=>[id,c.positions[id].slice()]));for(const id of c.waist){c.invMass[id]=0;c.bendParticles[id].invMass=0;}
  const perturbed=c.positions.findIndex((p,id)=>!supports.has(id)&&p[1]<.9&&p[2]>.05);c.positions[perturbed][2]+=.001;c.positions[perturbed][1]-=.001;
  for(let step=0;step<240;step++){c.fixedStep(1/240);for(const [id,p]of supports){c.positions[id].splice(0,3,...p);c.velocity[id].fill(0);}if(step%60===0){onProgress({name:'布片缝合后重力松弛',round:step,strain:c.audit(false).mainStrain});await new Promise(r=>setTimeout(r,0));}}
  c.syncRender();const settled=auditBasicShorts(c,fixture.body),restUnchanged=intrinsicIdentity()===paperIdentity;
  const name=`可展开布片 · ${Math.round(clearance*1000)}毫米余量`,r={name,...settled,manufactured,flatPaperSelfOverlaps:withinPiece.length,panels:draft.pieces.length,seams:draft.seams.length,sourceUnfoldingEdgeErrorM:draft.receipt.maximumUnfoldingEdgeErrorM,maximumSeamFeedMismatchM:draft.receipt.maximumSeamFeedMismatchM,maximumIndependentFoldReconstructionErrorM:draft.receipt.maximumIndependentFoldReconstructionErrorM,flatToCurvedKinematicConstructionValidated:draft.receipt.flatToCurvedKinematicConstructionValidated,inverseDesign:true,gravityTestSeconds:1,perturbationM:.001,sourceRestAndMassPreserved:restUnchanged,constructionJig:'opening held only; panels and legs free; not an elastic wearing claim',waistbandPending:true,elasticWearingValidated:false,motionValidated:false,productionReady:false,elapsedMs:performance.now()-start,passed:manufactured.passed&&settled.passed&&withinPiece.length===0&&restUnchanged&&draft.receipt.flatToCurvedKinematicConstructionValidated};results.push(r);onProgress(r);if(r.passed)break;
 }
 return{fixture,cloths,results,anyPassed:results.some(r=>r.passed),elapsedMs:performance.now()-start};
}
