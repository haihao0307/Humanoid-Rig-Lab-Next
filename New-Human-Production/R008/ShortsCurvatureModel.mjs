// Source-owned thin-paper bending, separate from membrane and source seams.
// Principle: Discrete Shells, https://multires.caltech.edu/pubs/ds.pdf .
// No solved XYZ is rest curvature. This operator does not fit or move clothing.
const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=v=>Math.hypot(...v);
export function evaluateShortsPaperCurvature(points,{restEdgeLengthM,sourceAreaAM2,sourceAreaBM2,bendingStiffnessNm,kind='within-piece-flat',seamLaw=null}={}){
 if(points?.length!==4||points.some(p=>p.length!==3||!p.every(Number.isFinite)))throw Error('Four finite positions [oppositeA,oppositeB,edgeU,edgeV] required');
 if(![restEdgeLengthM,sourceAreaAM2,sourceAreaBM2].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(bendingStiffnessNm)||bendingStiffnessNm<0)throw Error('Explicit positive source edge/areas and nonnegative N m bending stiffness required');
 if(!['within-piece-flat','across-seam'].includes(kind)||kind==='across-seam'&&seamLaw!=='free-rotation')throw Error('Across-seam bending law must be explicit; no automatic flat seam rest');
 const[a,b,u,v]=points,e=sub(v,u),el=length(e),au=sub(u,a),av=sub(v,a),bv=sub(v,b),bu=sub(u,b),na=cross(au,av),nb=cross(bv,bu),na2=dot(na,na),nb2=dot(nb,nb),scale=Math.max(el,length(au),length(av),length(bu),length(bv));
 if(el<=1e-10||na2<=1e-20*scale**4||nb2<=1e-20*scale**4)return{status:'HOLD_DEGENERATE_HINGE',wearingAccepted:false};
 // h is one third of the average SOURCE altitudes: (A1+A2)/(3*l).
 const angleRadians=Math.atan2(dot(cross(nb,na),e)/el,dot(na,nb)),dualWidthM=(sourceAreaAM2+sourceAreaBM2)/(3*restEdgeLengthM),weight=restEdgeLengthM/dualWidthM,coefficient=kind==='across-seam'?0:bendingStiffnessNm*weight;
 const a2=-dot(av,e)/el,b2=-dot(bv,e)/el,a3=dot(au,e)/el,b3=dot(bu,e)/el,angleGradients=[na.map(n=>n*el/na2),nb.map(n=>n*el/nb2),na.map((n,k)=>n*a2/na2+nb[k]*b2/nb2),na.map((n,k)=>n*a3/na2+nb[k]*b3/nb2)],energyJ=.5*coefficient*angleRadians**2,gradients=angleGradients.map(g=>g.map(v=>coefficient*angleRadians*v));
 if(![angleRadians,dualWidthM,weight,coefficient,energyJ,...gradients.flat()].every(Number.isFinite))return{status:'HOLD_NONFINITE_HINGE',wearingAccepted:false};
 return{status:'CURVATURE_OPERATOR_ONLY',kind,seamLaw,angleRadians,angleGradients,restAngleRadians:kind==='within-piece-flat'?0:null,dualWidthM,normalCurvatureProxyPerM:angleRadians/dualWidthM,energyJ,gradients,stiffnessUnits:'N m',sourceReference:'independent flat source paper edge/areas; never posed XYZ',sourceRestChanged:false,physicalCalibrated:false,clothMoved:false,wearingAccepted:false};
}

// Source model owns adjacency/areas. Sewn q gradients sum; they are not averaged.
export function evaluateShortsSourceCurvature(model,positions,sourceToDof,{bendingStiffnessNm}={}){
 if(model?.status!=='SOURCE_METRIC_VALID'||!Array.isArray(positions)||sourceToDof.length!==model.sourceVertices)throw Error('Validated source model and exact source quotient required');
 const gradients=positions.map(()=>[0,0,0]),rows=[];let energyJ=0;
 for(const hinge of model.hinges){if(hinge.kind!=='within-piece-flat-paper')continue;const[u,v]=hinge.sourceEdge.split(':').map(Number),[fa,fb]=hinge.faces,ta=model.triangles[fa.triangle],tb=model.triangles[fb.triangle],ids=[fa.opposite,fb.opposite,u,v],q=ids.map(id=>sourceToDof[id]),uvU=ta.reference.uv[ta.ids.indexOf(u)],uvV=ta.reference.uv[ta.ids.indexOf(v)],r=evaluateShortsPaperCurvature(q.map(id=>positions[id]),{restEdgeLengthM:Math.hypot(...sub(uvU,uvV)),sourceAreaAM2:ta.reference.areaM2,sourceAreaBM2:tb.reference.areaM2,bendingStiffnessNm});if(r.status!=='CURVATURE_OPERATOR_ONLY')return{status:'HOLD',hinge:hinge.sourceEdge,reason:r.status,wearingAccepted:false};energyJ+=r.energyJ;r.gradients.forEach((g,i)=>g.forEach((value,k)=>gradients[q[i]][k]+=value));rows.push({sourceEdge:hinge.sourceEdge,sourceIndices:ids,actualDOFs:q,angleRadians:r.angleRadians,normalCurvatureProxyPerM:r.normalCurvatureProxyPerM,energyJ:r.energyJ});}
 return{status:'WITHIN_PAPER_CURVATURE_ONLY',energyJ,gradients,rows,acrossSeamLaws:model.hinges.filter(h=>h.kind==='across-piece-seam').map(h=>({id:h.seamId,law:h.law,restAngleRadians:h.restAngleRadians})),sourceRestChanged:false,formingSolverIntegrated:false,physicalCalibrated:false,wearingAccepted:false};
}
