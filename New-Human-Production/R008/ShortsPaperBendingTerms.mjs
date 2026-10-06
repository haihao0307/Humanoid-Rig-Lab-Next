import {evaluateShortsPaperCurvature} from './ShortsCurvatureModel.mjs';
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
// Authoring energy is in m^2. Convert explicit bending J with a declared N/m
// membrane scale; adding unconverted joules to this objective is invalid.
export function compilePaperBendingTopology(model,map,bending){
 if(bending===null)return[];
 if(!(Number.isFinite(bending.stiffnessNm)&&bending.stiffnessNm>0&&Number.isFinite(bending.membraneScaleNPerM)&&bending.membraneScaleNPerM>0)||bending.seamLaw!=='free-rotation')throw Error('Explicit N m stiffness, N/m membrane normalization and source seam rotation law required');
 return model.hinges.filter(h=>h.kind==='within-piece-flat-paper').map(h=>{
  const[u,v]=h.sourceEdge.split(':').map(Number),[fa,fb]=h.faces,ta=model.triangles[fa.triangle],tb=model.triangles[fb.triangle],uvA=ta.reference.uv[ta.ids.indexOf(u)],uvB=ta.reference.uv[ta.ids.indexOf(v)];
  return{sourceEdge:h.sourceEdge,indices:[fa.opposite,fb.opposite,u,v].map(i=>map[i]),reference:{restEdgeLengthM:Math.hypot(...uvA.map((x,k)=>x-uvB[k])),sourceAreaAM2:ta.reference.areaM2,sourceAreaBM2:tb.reference.areaM2,bendingStiffnessNm:bending.stiffnessNm},normalizationNPerM:bending.membraneScaleNPerM};
 });
}
export function paperFormingBendingTerms(positions,topology,{withRows=true}={}){
 const gradients=positions.map(()=>[0,0,0]),diagonalXYZ=new Float64Array(positions.length*3),rows=[];let energyM2=0,maximumAbsoluteAngleRadians=0,worst=null;
 for(const hinge of topology){const r=evaluateShortsPaperCurvature(hinge.indices.map(i=>positions[i]),hinge.reference);if(r.status!=='CURVATURE_OPERATOR_ONLY')return{status:'HOLD',reason:'degenerate or nonfinite actual bending hinge',sourceEdge:hinge.sourceEdge,hinge:r};
  energyM2+=r.energyJ/hinge.normalizationNPerM;if(Math.abs(r.angleRadians)>maximumAbsoluteAngleRadians){maximumAbsoluteAngleRadians=Math.abs(r.angleRadians);worst={sourceEdge:hinge.sourceEdge,indices:hinge.indices,angleRadians:r.angleRadians};}
  if(withRows){const combined=new Map();hinge.indices.forEach((id,i)=>{const g=combined.get(id)??[0,0,0];r.angleGradients[i].forEach((v,k)=>g[k]+=v);combined.set(id,g);});
   const entries=[...combined],coefficient=hinge.reference.bendingStiffnessNm*(hinge.reference.restEdgeLengthM/r.dualWidthM)/hinge.normalizationNPerM;
   for(const[id,g]of entries)for(let k=0;k<3;k++){gradients[id][k]+=coefficient*r.angleRadians*g[k];diagonalXYZ[id*3+k]+=coefficient*g[k]*g[k];}rows.push({entries,coefficient});
  }
 }
 return{status:'BENDING_TERMS_VALID',energyM2,gradients,diagonalXYZ,rows,hinges:topology.length,maximumAbsoluteAngleRadians,worst,matrixAuthority:'PSD dihedral Gauss Newton; not exact XYZ Hessian',physicalCalibrated:false};
}
export function paperFormingBendingProduct(rows,vector){const out=new Float64Array(vector.length);for(const r of rows){const d=r.entries.reduce((s,[id,g])=>s+dot(g,Array.from(vector.slice(id*3,id*3+3))),0);for(const[id,g]of r.entries)for(let k=0;k<3;k++)out[id*3+k]+=r.coefficient*d*g[k];}return out;}
