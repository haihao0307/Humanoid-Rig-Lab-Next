import {normalizeCharacterShape,characterShapeParameterKey,hasRegionalCharacterShape} from './shape-contract.mjs';
import {createCharacterShapeField} from './shape-deform.mjs';
import {COMPACT_INFLUENCES,COMPACT_WEIGHT_SCALE} from './binding.mjs';
import {createAxillaShape} from './axilla-shape.mjs';

// Sampling, topology and binding stay in the reference atlas. The same F used
// to assemble the personal rig transforms the transient display surface once.
export const resolveCompactShape=normalizeCharacterShape;
const reflect=p=>[-p[0],p[1],p[2]];
const normalized=p=>{const length=Math.hypot(...p);if(!(length>0))throw Error('Invalid personal surface normal');return p.map(x=>x/length);};
function decodeNormal(encoded,i){
 let x=encoded[2*i]/32767,y=encoded[2*i+1]/32767,z=1-Math.abs(x)-Math.abs(y);
 if(z<0){const ox=x;x=(1-Math.abs(y))*(ox>=0?1:-1);y=(1-Math.abs(ox))*(y>=0?1:-1);}
 return normalized([x,y,z]);
}
function encodeNormal(encoded,i,normal){
 const n=normalized(normal),l1=Math.abs(n[0])+Math.abs(n[1])+Math.abs(n[2]);let x=n[0]/l1,y=n[1]/l1;
 if(n[2]<0){const ox=x;x=(1-Math.abs(y))*(ox>=0?1:-1);y=(1-Math.abs(ox))*(y>=0?1:-1);}
 encoded[2*i]=Math.round(x*32767);encoded[2*i+1]=Math.round(y*32767);
}
function rotateInverse(q,p){
 const x=-q[0],y=-q[1],z=-q[2],w=q[3],tx=2*(y*p[2]-z*p[1]),ty=2*(z*p[0]-x*p[2]),tz=2*(x*p[1]-y*p[0]);
 return [p[0]+w*tx+y*tz-z*ty,p[1]+w*ty+z*tx-x*tz,p[2]+w*tz+x*ty-y*tx];
}
function collectPersonalSupport(mesh,rig,candidates){
 if(mesh.name!=='skin')return;
 const directions=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)directions.push([x,y,z]);
 for(let v=0;v<mesh.vertices;v++){
  const binding=mesh.binding,dominant=binding.ids[v*COMPACT_INFLUENCES],frame=rig.personalFrames.get(rig.jointNames[dominant]);
  if(!frame)throw Error('Missing personal support frame');
  const p=reflect(Array.from(mesh.positions.subarray(v*3,v*3+3))),axillaDelta=mesh.axillaDelta?reflect(Array.from(mesh.axillaDelta.subarray(v*3,v*3+3))):[0,0,0];
  const local=rotateInverse(frame.q,p.map((value,k)=>value-frame.p[k])),deltaLocal=axillaDelta.some(v=>v!==0)?rotateInverse(frame.q,axillaDelta):axillaDelta;let probe=null;
  // Keep independent extrema for both endpoints. Taking only the maximum of
  // their scores can discard a vertex that supports the neutral endpoint.
  for(let endpoint=0;endpoint<2;endpoint++)for(let k=0;k<directions.length;k++){
   const key=dominant+'/'+endpoint+'/'+k,score=local.reduce((sum,value,axis)=>sum+(value+endpoint*deltaLocal[axis])*directions[k][axis],0),old=candidates.get(key);
   if(!old||score>old.score){
    probe??={p,axillaDelta,canonicalP:reflect(Array.from(mesh.canonicalPositions.subarray(v*3,v*3+3))),influences:Array.from({length:COMPACT_INFLUENCES},(_,i)=>[binding.ids[v*COMPACT_INFLUENCES+i],binding.weights[v*COMPACT_INFLUENCES+i]/COMPACT_WEIGHT_SCALE]).filter(row=>row[1]>0)};
    candidates.set(key,{score,probe});
   }
  }
 }
}
export function attachHairStature(hair,input){
 const shape=normalizeCharacterShape(input),s=shape.statureScale;
 // The regional field is exactly s*p throughout the head. Hairline masks and
 // procedural grain therefore keep their canonical coordinates unchanged.
 hair.report={...hair.report,shape:{...shape},shapeKey:characterShapeParameterKey(shape),statureScale:s,
  geometryCoordinateSpace:'canonical-r2-reference-metres',displayTransform:'uniform stature in preserved head domain before personal head joint delta',
  resolvedScalpCenter:hair.report.scalpCenter.map(v=>v*s),resolvedHeadDiameterMetres:hair.report.headDiameterMetres*s};
 return hair;
}
export function applyCompactStature(result,input,rig,progress=()=>{}){
 const shape=normalizeCharacterShape(input),s=shape.statureScale,regional=hasRegionalCharacterShape(shape);
 if(!(rig?.personalFrames instanceof Map)||!rig.shapeReference?.nodes)throw Error('Missing personal bind frames or reference shape landmarks');
 const field=createCharacterShapeField(rig.shapeReference,shape),candidates=new Map();let maximumDisplayFloat32ErrorM=0,canonicalAttributeBytes=0,axillaAttributeBytes=0,axillaChangedVertices=0,maximumAxillaDeltaM=0;
 // Only invert a surface whose generator reports this actual static map.
 // Synthetic meshes and future reference surfaces must never be unwarped.
 const staticAxilla=result.report.surfaceCorrections?.find(c=>c.version==='r2/axilla-shape@1'),axilla=staticAxilla?createAxillaShape(rig.shapeReference,{liftM:staticAxilla.liftM}):null;
 for(let m=0;m<result.meshes.length;m++){
  const mesh=result.meshes[m],correctAxilla=!!axilla&&mesh.name==='skin',canonical=new Float32Array(mesh.positions.length),personal=new Float32Array(mesh.positions.length),normals=regional||correctAxilla?new Int16Array(mesh.normals.length):mesh.normals;
  const axillaDelta=correctAxilla?new Float32Array(mesh.positions.length):null,axillaNormals=correctAxilla?new Int16Array(mesh.normals.length):null;
  for(let i=0;i<mesh.vertices;i++){
   const source=[0,1,2].map(k=>mesh.positions[i*3+k]*mesh.extent[k]+mesh.origin[k]);canonical.set(source,i*3);
   // B is the atlas/workbench X reflection. Normals use B J^-T B n.
   const p=reflect(source),deformed=regional?field.pointNormal(p,reflect(decodeNormal(mesh.normals,i))):{point:field.point(p)};
   const target=reflect(deformed.point);if(!target.every(Number.isFinite))throw Error('Non-finite personal surface position');
   personal.set(target,i*3);maximumDisplayFloat32ErrorM=Math.max(maximumDisplayFloat32ErrorM,Math.hypot(...target.map((value,k)=>personal[i*3+k]-value)));
   if(regional)encodeNormal(normals,i,reflect(deformed.normal));
   if(correctAxilla){
    // canonicalPositions intentionally retains the lifted provenance for
    // appearance masks. Both geometric endpoints use the same personal F.
    const liftedNormal=decodeNormal(mesh.normals,i),neutral=axilla.inverseSource(source,mesh.regionMasks[i],liftedNormal);
    if(!regional)normals.set(mesh.normals.subarray(i*2,i*2+2),i*2);
    axillaNormals.set(normals.subarray(i*2,i*2+2),i*2);
    if(neutral.changed){
     const unlifted=regional?field.pointNormal(reflect(neutral.point),reflect(neutral.normal)):{point:field.point(reflect(neutral.point)),normal:reflect(neutral.normal)},neutralTarget=reflect(unlifted.point);
     personal.set(neutralTarget,i*3);encodeNormal(normals,i,reflect(unlifted.normal));
     let length2=0;for(let k=0;k<3;k++){const delta=target[k]-neutralTarget[k];axillaDelta[i*3+k]=delta;length2+=delta*delta;}
     maximumDisplayFloat32ErrorM=Math.max(maximumDisplayFloat32ErrorM,Math.hypot(...neutralTarget.map((value,k)=>personal[i*3+k]-value)));
     maximumAxillaDeltaM=Math.max(maximumAxillaDeltaM,Math.sqrt(length2));axillaChangedVertices++;
    }
   }
  }
  // Absolute Float32 positions keep duplicate seam vertices identical across
  // chunks; per-chunk bounding-box quantization would not preserve this.
  mesh.canonicalPositions=canonical;mesh.positions=personal;mesh.normals=normals;mesh.origin=[0,0,0];mesh.extent=[1,1,1];mesh.positionEncoding='personal-float32';
  if(correctAxilla){mesh.axillaDelta=axillaDelta;mesh.axillaNormals=axillaNormals;axillaAttributeBytes+=axillaDelta.byteLength+axillaNormals.byteLength;}
  canonicalAttributeBytes+=canonical.byteLength;collectPersonalSupport(mesh,rig,candidates);
  progress({group:'binding',phase:'personal-shape',domain:m+1,total:result.meshes.length});
 }
 result.supportProbes=[...new Set([...candidates.values()].map(value=>value.probe))];candidates.clear();
 if(result.hair)attachHairStature(result.hair,shape);
 const source=result.report,derivedErrors=regional?null:axilla?null:{maximumPositionQuantizationMm:source.maximumPositionQuantizationMm*s,
  groups:source.groups.map(g=>({name:g.name,maximumSampledInterpolationError:g.maximumSampledInterpolationError*s,maximumBoundaryApproximation:g.maximumBoundaryApproximation*s,maximumCanonicalFlattenBound:g.maximumCanonicalFlattenBound*s}))};
 result.shape={...shape};result.report={...source,shape:{...shape},shapeKey:characterShapeParameterKey(shape),hair:result.hair?.report||null,
  attributeBytes:source.attributeBytes+canonicalAttributeBytes+axillaAttributeBytes,positionEncoding:'personal-float32',canonicalAttributeBytes,axillaAttributeBytes,
  axillaPoseCorrective:{enabled:!!axilla,method:'neutral-to-lifted-reference-endpoints-before-muscle-and-skinning',sourceStaticMap:staticAxilla?.version||null,
   changedVertexOccurrences:axillaChangedVertices,maximumPersonalDeltaM:maximumAxillaDeltaM,attributeBytes:axillaAttributeBytes,
   position:'neutral personal position plus per-side elevation weight times axillaDelta',weightRange:[0,1],normal:'normalized endpoint-normal interpolation before muscle and skinning',
   deltaCoordinateSpace:'personal fitted coordinates; reflect X once for workbench',probeDeltaCoordinateSpace:'personal workbench coordinates',
   canonicalAppearanceCoordinates:'unchanged lifted source',bindingField:'unchanged lifted canonical binding',engineeringCorrective:true,anatomicalCalibration:false,
   neutralSurfaceErrorInherited:false,posedSurfaceErrorMeasured:false,selfCollisionImplemented:false,visualAcceptance:false},
  sourceErrorCoordinateSpace:'canonical-r2-reference-metres',displayCoordinateSpace:'personal-bind-metres',
  statureTransform:{method:regional?'shared-regional-field-after-canonical-binding':'uniform-scale-after-canonical-binding',scale:s,pivotMetres:[0,0,0],
   bindingCoordinateSpace:'canonical-r2-reference-metres',supportCoordinateSpace:'personal-bind-metres',supportSelection:'union of neutral and lifted endpoint extrema, 26 directions per dominant joint in personal joint frames',
   normalDirectionsUnchanged:!regional&&!axilla,normalMethod:axilla?'inverse axilla Jacobian then personal inverse transpose; both endpoint oct normals':regional?'inverse-transpose analytic Jacobian; decoded reference oct normals re-encoded':'reference normal direction',sourceErrorsRetainedInReferenceSpace:true,
   derivedErrors,derivedErrorRule:axilla?'Source errors describe the lifted reference only. Inverse-map neutral and interpolated endpoint surface errors have not been measured.':regional?'Reference error measurements do not certify the regional surface; personal interpolation, boundary and normal errors have not been measured.':'Reference length errors multiply by statureScale; sampled errors are not global bounds.',
   maximumDisplayFloat32RoundoffMm:maximumDisplayFloat32ErrorM*1000,displayTransformRoundoffIncluded:false,fullPositionCertificateInherited:false,visualAcceptance:false},
  personalPrecision:{state:regional?'unmeasured-regional-surface':'uniform-reference-error-scaling-only',axillaEndpointErrors:axilla?'unmeasured-neutral-and-interpolated-surface':null,maximumDisplayFloat32RoundoffMm:maximumDisplayFloat32ErrorM*1000,
   surfaceInterpolationMeasured:false,boundaryApproximationMeasured:false,normalErrorMeasured:false,fullPositionCertificate:false,visualAcceptance:false}};
 return result;
}
