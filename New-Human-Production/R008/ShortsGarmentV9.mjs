import * as THREE from 'three';
import {createShortsPattern} from './ShortsGarmentDraft.mjs';
import {compilePaperSurfaceModel,auditRiseBudget} from './ShortsPaperSurfaceModel.mjs';
import {sourceBoundaryArcFractions,initialLegContourAngles,initialBoundaryRowPoint} from './ShortsSurfaceTransport.mjs';
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k])),mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
const clamp=t=>Math.max(0,Math.min(1,t));
function arcPoint(points,t){const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+distance(points[i-1],points[i]));const s=clamp(t)*lengths.at(-1);let i=1;while(i<lengths.length-1&&lengths[i]<s)i++;return mix(points[i-1],points[i],(s-lengths[i-1])/(lengths[i]-lengths[i-1]));}
// Circumferential locations use the measured source surface loop. This is only
// an INITIAL embedding; no 3D point supplies any UV/rest/area/mass reference.
function sector(s,side,front,t,pad=0,leg=false,startPoint=null){
 const loop=s.loop,centerX=s.centerX??s.cx,centerZ=s.centerZ??s.cz;
 const nearest=theta=>{const d=[Math.sin(theta),Math.cos(theta)];let i=0,best=-Infinity;loop.forEach((p,j)=>{const dx=p[0]-centerX,dz=p[2]-centerZ,l=Math.hypot(dx,dz),score=(d[0]*dx+d[1]*dz)/l;if(score>best){best=score;i=j;}});return i;};
 const chart=leg&&startPoint?initialLegContourAngles({side,front,startPoint,centerX,centerZ}):null;
 const from=chart?.from??(leg?(side==='left'?Math.PI/2:3*Math.PI/2):(front?0:Math.PI)),to=chart?.to??(leg?(side==='left'?(front?-Math.PI/2:3*Math.PI/2):(front?5*Math.PI/2:Math.PI/2)):(side==='left'?(front?-Math.PI/2:3*Math.PI/2):Math.PI/2)),start=nearest(from),end=nearest(to),step=to>=from?1:-1,points=[];
 for(let k=0,i=start;k<=loop.length;k++,i=(i+step+loop.length)%loop.length){const p=loop[i].slice(),dx=p[0]-centerX,dz=p[2]-centerZ,l=Math.hypot(dx,dz);p[0]+=pad*dx/l;p[2]+=pad*dz/l;points.push(p);if(i===end&&k>0)break;}
 return arcPoint(points,t);
}

export function createShortsGarmentV9(tapes,legacyDraft,{padM=.004}={}){
 const old=legacyDraft.receipt,lowerY=old.lowerY,upperY=old.upperY,middleY=old.middleY,hemY=old.hem.y,crotch=tapes.crotch;
 const hip=tapes.hip,lower=tapes.waist.lower,upper=tapes.waist.upper;
 if(!Array.isArray(crotch)||!(lowerY>hip.y&&hip.y>crotch[1]&&crotch[1]>hemY))throw Error('HOLD_V9: actual skin planes or fixed hem are not ordered');
 const design={...old.design,finalRiseBudget:true,backWaistRaise:0};
 // Same requested hem HEIGHT. Source inseam is re-cut from the new actual
// skin crotch; it is not the old hidden-clothing crotch minus a fixed length.
 const clothCrotchY=crotch[1]-design.crotchDrop,verticalInseamM=clothCrotchY-hemY;
 if(!(verticalInseamM>0))throw Error('HOLD_V9: cloth crotch below requested hem');
 design.inseamLength=Math.hypot(verticalInseamM,design.inseamTaper);
 design.hemCircumference=Math.max(tapes.legs.hem.left.circumferenceM,tapes.legs.hem.right.circumferenceM)+design.thighEase;
 const m={unit:'m',waistFrontArc:lower.frontM,waistBackArc:lower.backM,waistTopFrontArc:upper.frontM,waistTopBackArc:upper.backM,hipFrontArc:hip.frontM,hipBackArc:hip.backM,waistToHip:lowerY-hip.y,crotchDepth:lowerY-crotch[1],frontRiseLength:tapes.rise.frontM,backRiseLength:tapes.rise.backM,thighCircumference:{left:tapes.legs.upperThigh.left.circumferenceM,right:tapes.legs.upperThigh.right.circumferenceM},waistCenter:[lower.centerX,lowerY,lower.centerZ],metadata:{waistY:lowerY,waistTopY:upperY,hipY:hip.y,crotchY:crotch[1],centerZ:lower.centerZ,bounds:{minZ:hip.minZ,maxZ:hip.maxZ},sourceSurfaceScope:tapes.receipt.scope}};
 const pattern=createShortsPattern(m,design),ranges=[];let count=0;
 for(const p of pattern.pieces){ranges.push({pieceId:p.id,offset:count,count:p.materialCoordinates.length});count+=p.materialCoordinates.length;}
 const byId=new Map(pattern.pieces.map(p=>[p.id,p])),offsets=new Map(ranges.map(r=>[r.pieceId,r.offset])),positions=new Float64Array(count*3),sourceUV=new Float64Array(count*2),triangles=[];
 for(const p of pattern.pieces){const off=offsets.get(p.id);p.materialCoordinates.forEach((u,i)=>sourceUV.set(u,2*(off+i)));p.triangles.forEach(t=>triangles.push(...t.map(i=>off+i)));}
 const g=byId.get('G'),gCenter=[crotch[0],clothCrotchY-padM,crotch[2]],normalPad=p=>{
  const v=new THREE.Vector3(...p),world=v.applyMatrix4(tapes.frame),hit=tapes.closestPointWorld(world);
  if(!hit||hit.signAmbiguous)throw Error('HOLD_V9: ambiguous measured skin initial point');return hit.point.clone().addScaledVector(hit.normal,padM).applyMatrix4(tapes.inverseFrame).toArray();
 };
 const paths={front:tapes.rise.frontPath,back:tapes.rise.backPath};
 const riseAt=(kind,d)=>arcPoint(paths[kind],clamp(d/tapes.rise[kind+'M']));
 const frontFraction=g.sourceContour.frontHeight/(m.frontRiseLength+design.frontRiseEase),backFraction=g.sourceContour.backHeight/(m.backRiseLength+design.backRiseEase);
 const frontCorner=normalPad(riseAt('front',frontFraction*m.frontRiseLength)),backCorner=normalPad(riseAt('back',backFraction*m.backRiseLength));
 const tipY=clothCrotchY-padM,leftSection=tapes.guideSectionAtY(tipY,{side:'left'}),rightSection=tapes.guideSectionAtY(tipY,{side:'right'}),leftCorner=sector(leftSection,'left',true,0,padM,true),rightCorner=sector(rightSection,'right',true,0,padM,true),corners=[frontCorner,rightCorner,backCorner,leftCorner];
 const write=(id,p)=>positions.set(p,3*id);
 for(let i=0;i<8;i++)write(offsets.get('G')+i,i%2?mix(corners[(i-1)/2],corners[((i-1)/2+1)%4],.5):corners[i/2]);write(offsets.get('G')+8,gCenter);
 // These are INITIAL contour charts, not paper isometries. Nearest-feature
 // stepping had left its local chart and produced a witnessed source-edge
 // jump; the measured shared meridian now determines each leg's start angle.
 const boundaryMapping={};
 for(const p of pattern.pieces.filter(p=>p.kind==='leg-panel')){
  const off=offsets.get(p.id),front=p.bodySide==='front',side=p.side,kind=front?'front':'back',innerIndices=p.boundaries.rise.slice().reverse(),prefix=[0];for(let i=1;i<innerIndices.length;i++)prefix.push(prefix.at(-1)+distance(p.materialCoordinates[innerIndices[i-1]],p.materialCoordinates[innerIndices[i]]));
  const outerArc=sourceBoundaryArcFractions(p.boundaries.outseam.map(i=>p.materialCoordinates[i])),inseamArc=sourceBoundaryArcFractions([9,10,11,12,13].map(r=>p.materialCoordinates[r*8]));
  boundaryMapping[p.id]={sourceSideArcM:outerArc.lengthM,sourceInseamArcM:inseamArc.lengthM,sourceSideFractions:outerArc.fractions.slice(),sourceInseamFractions:inseamArc.fractions.slice(),outerEndpointY:[lowerY,hemY],innerEndpointY:[tipY,hemY],authority:'initial intrinsic paper-boundary coordinate mapped between explicit style planes; UV length is not world-Y height',interiorChart:'boundary-first transfinite loft of fixed waist/hip/hem curves; no per-column torso-to-leg chart switch',exactSharedMeridian:true,sourceRestChanged:false};
  const mainLength=prefix.at(-1),bodyLength=m[kind+'RiseLength'],gFraction=front?frontFraction:backFraction,gIndices=front?(side==='left'?[0,7,6]:[0,1,2]):(side==='left'?[4,5,6]:[4,3,2]);
  const centers=[];
  for(let r=0;r<=13;r++){
   let center;if(r===0)center=sector(lower,side,front,0,padM);else if(r<=7){const consumed=prefix[r]/mainLength;center=normalPad(riseAt(kind,bodyLength*(1-(1-gFraction)*consumed)));}
   else if(r<=9)center=Array.from(positions.subarray(3*(offsets.get('G')+gIndices[r-7]),3*(offsets.get('G')+gIndices[r-7])+3));
   else center=sector(tapes.guideSectionAtY(tipY+(hemY-tipY)*inseamArc.fractions[r-9],{side}),side,front,0,padM,true);
   centers.push(center);
  }
  const sourceSideY0=p.materialCoordinates[p.boundaries.outseam[0]][1];
  // This draft explicitly authors its side ordinate from measured vertical
  // depth (raise=0), including the fixed hem depth. It is not a generic claim
  // that material arclength is world height. Check its inverse endpoints.
  const sideY=r=>lowerY-(p.materialCoordinates[p.boundaries.outseam[r]][1]-sourceSideY0);
  if(Math.abs(sideY(5)-hip.y)>1e-10||Math.abs(sideY(13)-hemY)>1e-10)throw Error('HOLD_V9: authored side-depth planes disagree');
  boundaryMapping[p.id].interiorChart='actual source section at each authored side-depth plane; leg chart starts at the shared meridian; exact transfinite seam correction';
  boundaryMapping[p.id].sideHeightAuthority='inverse of this cut explicit measured vertical-depth ordinate, not side arclength';
  boundaryMapping[p.id].chartStartPointsUsed=0;
  for(let r=0;r<=13;r++){
   const center=centers[r],outerY=sideY(r),blend=r<=5?(lowerY-outerY)/(lowerY-hip.y):(hip.y-outerY)/(hip.y-hemY);
   const outerWhole=tapes.guideSectionAtY(outerY),outerIsLeg=outerWhole.distinctLegs===true,outerSection=outerIsLeg?outerWhole[side==='left'?'negativeX':'positiveX']:outerWhole;
   const reference=t=>sector(outerSection,side,front,t,padM,outerIsLeg,outerIsLeg?center:null);
   if(outerIsLeg)boundaryMapping[p.id].chartStartPointsUsed++;
   const baseStart=reference(0),baseEnd=reference(1),referencePole=[outerSection.centerX,outerY,outerSection.centerZ];
   const easeCircumference=r<=5?design.hipEase*blend:design.hipEase+(design.thighEase-design.hipEase)*blend;
   const outer=sector(outerSection,side,front,1,padM+easeCircumference/(2*Math.PI),outerIsLeg,outerIsLeg?center:null);
   for(let c=0;c<=7;c++){
    const t=c/7,q=reference(t),radial=[q[0]-referencePole[0],0,q[2]-referencePole[2]],length=Math.hypot(...radial);
    if(!(length>0))throw Error('HOLD_V9: singular initial row reference');
    const ease=16*t*t*(1-t)*(1-t)*easeCircumference/(2*Math.PI);q[0]+=ease*radial[0]/length;q[2]+=ease*radial[2]/length;
    write(off+r*8+c,initialBoundaryRowPoint({point:q,referenceStart:baseStart,referenceEnd:baseEnd,start:center,end:outer,t}));
   }
  }
 }
 // Shared waist positions are generated from one loop and one source pairing.
 for(const p of pattern.pieces.filter(p=>p.kind==='waistband')){const off=offsets.get(p.id),main=byId.get(p.parentPanel),reverse=['FL','BR'].includes(main.id);for(let r=0;r<=2;r++)for(let c=0;c<=7;c++){const t=reverse?1-c/7:c/7,y=lowerY+(upperY-lowerY)*r/2,q=sector(tapes.guideSectionAtY(y),main.side,main.bodySide==='front',t,padM+(r===1?.0015:0));write(off+r*8+c,q);}}
 const seams=pattern.seams.map(s=>({...s,pairs:s.pairs.map(p=>({...p,a:p.a+offsets.get(s.a.pieceId),b:p.b+offsets.get(s.b.pieceId)}))}));
 const maximumInitialWaistSeamGapM=Math.max(0,...seams.filter(s=>s.id.startsWith('waist-')).flatMap(s=>s.pairs.map(p=>distance(Array.from(positions.subarray(3*p.a,3*p.a+3)),Array.from(positions.subarray(3*p.b,3*p.b+3))))));
 if(maximumInitialWaistSeamGapM>1e-10)throw Error('HOLD_V9: waistband and main waist INITIAL curves disagree');
 boundaryMapping.sharedWaist={maximumInitialSeamGapM:maximumInitialWaistSeamGapM,checkedBeforeQuotientAveraging:true,authority:'main row0 and waistband lower use the identical common lower-waist curve'};
 const model=compilePaperSurfaceModel({sourceUV,triangles,ranges,seams}),masses=model.sourceMass;
 if(model.status!=='SOURCE_METRIC_VALID')throw Error('HOLD_V9: source seam/area invalid');
 const parent=Array.from({length:count},(_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));for(const s of seams)for(const p of s.pairs)parent[find(p.b)]=find(p.a);
 const roots=[...new Set(parent.map((_,i)=>find(i)))],map=new Map(roots.map((id,i)=>[id,i])),groups=roots.map(()=>[]),quotientMap=new Uint32Array(count);for(let i=0;i<count;i++){quotientMap[i]=map.get(find(i));groups[quotientMap[i]].push(i);}
 // Initial seam targets may not agree yet. Explicit mass-mean is INITIAL state
// only; the real metric/contact solve determines the final sewn garment.
 let maximumInitialSeamTargetGapM=0;for(const group of groups){let mass=0,mean=[0,0,0];for(const i of group){mass+=masses[i];for(let k=0;k<3;k++)mean[k]+=masses[i]*positions[i*3+k];}mean=mean.map(x=>x/mass);for(const i of group){maximumInitialSeamTargetGapM=Math.max(maximumInitialSeamTargetGapM,distance(mean,Array.from(positions.subarray(i*3,i*3+3))));write(i,mean);}}
 const ring=['FL','FR','BR','BL'],waistIndices=[],middleIndices=[],lowerIndices=[];for(const id of ring){const off=offsets.get('W'+id);for(let c=0;c<7;c++){lowerIndices.push(off+c);middleIndices.push(off+8+c);waistIndices.push(off+16+c);}}
 // Tape rest is independent measured waist minus declared elastic shrink. Do
// not use the 2D distance between separate paper chart origins at seam jumps.
 const middleCircumferenceM=tapes.waist.middle.circumferenceM,elasticRestM=middleCircumferenceM*.90;
 const sectorLengths=pattern.pieces.filter(p=>p.kind==='waistband').flatMap(p=>Array.from({length:7},(_,c)=>distance(p.materialCoordinates[8+c],p.materialCoordinates[9+c]))),total=sectorLengths.reduce((s,v)=>s+v,0);
 const elasticEdges=middleIndices.map((a,i)=>{const restLengthM=elasticRestM*sectorLengths[i]/total;return {a,b:middleIndices[(i+1)%middleIndices.length],restLengthM,rest:restLengthM,compliance:restLengthM/100,axialRigidityN:100,maximumExtension:.35,tensionOnly:true};});
 const riseBudget={front:auditRiseBudget({bodyTapeM:m.frontRiseLength,easeM:design.frontRiseEase,remainingMainRiseM:pattern.draft.frontRiseLength,gussetHeightM:g.sourceContour.frontHeight}),back:auditRiseBudget({bodyTapeM:m.backRiseLength,easeM:design.backRiseEase,remainingMainRiseM:pattern.draft.backRiseLength,gussetHeightM:g.sourceContour.backHeight})};
 if(Object.values(riseBudget).some(r=>r.status==='HOLD'))throw Error('HOLD_V9: final rise budget failed independent measurement');
 const material=legacyDraft.material;
 // Manufacturing consumes an independent rigid source-paper holding frame.
 // The source pattern's sagittal G frame cannot provide an orthogonal upward
 // fold: adding world-up to its edge tangent would shear the flat panels.
 const manufacturingSource={commit:'V9 source manifest; not the preserved A paper commit',sha256:null,sourceFile:'ShortsGarmentDraft.mjs',authority:'fresh final-rise-budget source2D from current actual-skin scalar recipe; source-code SHA is recorded by BUILD.json',sourceRestFromXYZ:false};
 const manufacturingG={origin:gCenter.slice(),basisU:[1,0,0],basisV:[0,0,-1],purpose:'independent rigid horizontal paper holding seed; no fitted XYZ rest or accepted wearing'};
 return {version:'actual-skin-budget-closed-shorts-v9',positions,sourceUV,uvs:sourceUV,triangles:Uint32Array.from(triangles),pieces:pattern.pieces,pattern,ranges,seams,seamGroups:groups,quotientMap,masses,mass:masses,densityKgM2:.22,waistIndices:Uint32Array.from(waistIndices),elasticEdges,material,casing:{finishedWidthM:upperY-lowerY,channelBulgeM:.0015,middleIndices:Uint32Array.from(middleIndices),independentElastic:true,stitchPaths:[{edge:'upper',indices:waistIndices},{edge:'lower',indices:lowerIndices}]},receipt:{version:'actual-skin-budget-closed-shorts-v9',authority:'current measured native-visible skin plus explicitly authored hidden-skin estimate',paperSource:manufacturingSource,gussetInitialAssembly:manufacturingG,initialBoundaryMapping:boundaryMapping,upperY,lowerY,middleY,waistDropM:old.waistDropM,waistbandWidthM:upperY-lowerY,actualHeightM:old.actualHeightM,measurements:m,design,hem:{y:hemY,independentOfWaistDrop:true,fixedByUser:true},areaM2:model.areaM2,massKg:model.massKg,sourceCounts:{pieces:9,particles:count,triangles:triangles.length/3,seams:seams.length,quotientDofs:roots.length},riseBudget,measurementsAuthority:tapes.receipt,maximumInitialSeamTargetGapM,sourceUVRestFromXYZ:false,materialCalibrated:false,visualAcceptance:false,motionValidated:false,productionReady:false,initialG:{center:gCenter,corners,frontFraction,backFraction}}};
}


