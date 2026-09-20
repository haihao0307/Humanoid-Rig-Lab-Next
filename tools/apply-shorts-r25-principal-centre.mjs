// Replace the incomplete radial-only gusset-centre fit with the same full
// original-UV principal-stretch metric used by the cloth acceptance report.
// Source paper, boundary stitches, mass, topology and the 5% gate are unchanged.
import fs from 'node:fs';
const path='clothing/ShortsGussetAssemblyR2.js';
let source=fs.readFileSync(path,'utf8');
const replaceOnce=(from,to,label)=>{
  if(source.includes(to))return;
  const first=source.indexOf(from),last=source.lastIndexOf(from);
  if(first<0||first!==last)throw Error('Ambiguous R2.5 principal-centre anchor: '+label);
  source=source.replace(from,to);
};
replaceOnce(
  'the ninth original centre vertex is fitted by a bounded minimax search over\n * the original radial material lengths.',
  'the ninth original centre vertex is fitted by a bounded minimax search over\n * the full original triangle principal-stretch metric.',
  'module description'
);
replaceOnce(
  "  const anchor=boundaryCentroid.map((value,k)=>value-frame.up[k]*sagM),restRadii=gussetPiece.materialCoordinates.slice(0,8).map(uv=>Math.hypot(uv[0],uv[1]));\n  const centreFit=sr25FitCentreMinimax(anchor,gussetPositions.slice(0,8),restRadii,{iterations:options.centreFitIterations??220,initialStepM:options.centreFitStepM});",
  "  const anchor=boundaryCentroid.map((value,k)=>value-frame.up[k]*sagM);\n  const centreFit=sr25FitCentrePrincipalMinimax(anchor,gussetPiece,gussetPositions.slice(0,8),{iterations:options.centreFitIterations??320,initialStepM:options.centreFitStepM});",
  'centre fit call'
);
replaceOnce(
  "  const geometryAtPlacement=sr25GussetGeometry(gussetPiece,gussetPositions,frame),placementRadialLimit=options.placementRadialLimit??.08;\n  if(!geometryAtPlacement.landmarkOrderValid||!geometryAtPlacement.boundarySelfIntersectionFree||geometryAtPlacement.minimumTriangleAreaM2<=1e-8||geometryAtPlacement.maximumBoundaryEdgeStrain>.05||geometryAtPlacement.maximumRadialStrain>placementRadialLimit)\n    fail('accepted R2.4 opening cannot receive the source gusset without an invalid fold or excessive material error');",
  "  const geometryAtPlacement=sr25GussetGeometry(gussetPiece,gussetPositions,frame),placementRadialLimit=options.placementRadialLimit??.08,placementMaterialLimit=options.placementMaterialLimit??.05;\n  if(!Number.isFinite(placementMaterialLimit)||placementMaterialLimit<=0||placementMaterialLimit>.05)fail('invalid gusset placement material limit');\n  if(!geometryAtPlacement.landmarkOrderValid||!geometryAtPlacement.boundarySelfIntersectionFree||geometryAtPlacement.minimumTriangleAreaM2<=1e-8||geometryAtPlacement.maximumBoundaryEdgeStrain>.05||geometryAtPlacement.maximumRadialStrain>placementRadialLimit||centreFit.maximumPrincipalStrain>placementMaterialLimit)\n    fail('accepted R2.4 opening cannot receive the source gusset without an invalid fold or excessive material error');",
  'placement gate'
);
replaceOnce(
  'closedSeams:closed,junctionReports,centreFit,geometryAtPlacement,placementRadialLimit,stageTransitionInputRiseValid:',
  'closedSeams:closed,junctionReports,centreFit,geometryAtPlacement,placementRadialLimit,placementMaterialLimit,stageTransitionInputRiseValid:',
  'placement report'
);
const start=source.indexOf('function sr25FitCentreMinimax('),end=source.indexOf('function sr25Finite3(',start);
if(start>=0){
  if(end<0||source.indexOf('function sr25FitCentreMinimax(',start+1)>=0)throw Error('Ambiguous old R2.5 centre fitter');
  const next=`function sr25FitCentrePrincipalMinimax(anchor,piece,boundary,options={}){
  const iterations=options.iterations??320,uv=piece?.materialCoordinates,triangles=piece?.triangles,meanRest=uv?.slice(0,8).reduce((sum,p)=>sum+Math.hypot(p[0],p[1]),0)/8,step=options.initialStepM??Math.max(.004,meanRest*.45);
  if(!sr25Finite3(anchor)||!Array.isArray(boundary)||boundary.length!==8||boundary.some(point=>!sr25Finite3(point))||!Array.isArray(uv)||uv.length!==9||!Array.isArray(triangles)||triangles.length!==8||!Number.isInteger(iterations)||iterations<16||iterations>1200||!(step>0))throw Error('shorts-r2.5-gusset: invalid principal centre-fit inputs');
  const evaluateTriangle=(point,triangle)=>{
    const positions=[...boundary,point],[i0,i1,i2]=triangle,a=uv[i0],b=uv[i1],c=uv[i2],x=b[0]-a[0],y=b[1]-a[1],u=c[0]-a[0],v=c[1]-a[1],det=x*v-y*u;
    if(!Number.isFinite(det)||Math.abs(det)<1e-16)throw Error('shorts-r2.5-gusset: degenerate source triangle in centre fit');
    const gu=[(y-v)/det,v/det,-y/det],gv=[(u-x)/det,-u/det,x/det],origin=positions[i0],fu=[0,0,0],fv=[0,0,0];
    for(let j=1;j<3;j++){const index=j===1?i1:i2,p=positions[index],dx=p[0]-origin[0],dy=p[1]-origin[1],dz=p[2]-origin[2],gU=gu[j],gV=gv[j];fu[0]+=gU*dx;fu[1]+=gU*dy;fu[2]+=gU*dz;fv[0]+=gV*dx;fv[1]+=gV*dy;fv[2]+=gV*dz;}
    const aa=sr25Dot(fu,fu),bb=sr25Dot(fu,fv),dd=sr25Dot(fv,fv),disc=Math.hypot(aa-dd,2*bb),maxEigen=(aa+dd+disc)/2,cross=sr25Cross(fu,fv),areaSquared=sr25Dot(cross,cross),maximum=Math.sqrt(Math.max(0,maxEigen)),minimum=maximum>0?Math.sqrt(Math.max(0,areaSquared/maxEigen)):0,strain=Math.max(Math.abs(minimum-1),Math.abs(maximum-1));
    return {minimumStretch:minimum,maximumStretch:maximum,maxAbsPrincipalStrain:strain,areaRatio:Math.sqrt(Math.max(0,areaSquared))};
  };
  const objective=point=>{const triangleMetrics=triangles.map(triangle=>evaluateTriangle(point,triangle)),maximum=Math.max(...triangleMetrics.map(metric=>metric.maxAbsPrincipalStrain)),radialStrains=boundary.map((target,i)=>Math.abs(sr25Distance(point,target)/Math.hypot(uv[i][0],uv[i][1])-1)),maximumRadialStrain=Math.max(...radialStrains),anchorPenalty=1e-6*(sr25Distance(point,anchor)/meanRest)**2,radialTieBreak=1e-8*maximumRadialStrain;return {value:maximum+anchorPenalty+radialTieBreak,maximum,maximumRadialStrain,radialStrains,triangleMetrics};};
  let simplex=[[...anchor],[anchor[0]+step,anchor[1],anchor[2]],[anchor[0],anchor[1]+step,anchor[2]],[anchor[0],anchor[1],anchor[2]+step]].map(point=>({point,score:objective(point)}));
  for(let iteration=0;iteration<iterations;iteration++){
    simplex.sort((a,b)=>a.score.value-b.score.value);const best=simplex[0],second=simplex[1],third=simplex[2],worst=simplex[3],centroid=[0,1,2].map(k=>(best.point[k]+second.point[k]+third.point[k])/3),reflected=centroid.map((value,k)=>value+(value-worst.point[k])),r={point:reflected,score:objective(reflected)};
    if(r.score.value<best.score.value){const expanded=centroid.map((value,k)=>value+2*(r.point[k]-value)),e={point:expanded,score:objective(expanded)};simplex[3]=e.score.value<r.score.value?e:r;}
    else if(r.score.value<third.score.value)simplex[3]=r;
    else{const outside=r.score.value<worst.score.value,contracted=outside?centroid.map((value,k)=>value+.5*(r.point[k]-value)):centroid.map((value,k)=>value+.5*(worst.point[k]-value)),c={point:contracted,score:objective(contracted)};
      if(c.score.value<(outside?r.score.value:worst.score.value))simplex[3]=c;else for(let i=1;i<4;i++){simplex[i].point=best.point.map((value,k)=>value+.5*(simplex[i].point[k]-value));simplex[i].score=objective(simplex[i].point);}}
    simplex.sort((a,b)=>a.score.value-b.score.value);const diameter=Math.max(...simplex.slice(1).map(item=>sr25Distance(item.point,simplex[0].point)));if(diameter<1e-10)break;
  }
  simplex.sort((a,b)=>a.score.value-b.score.value);const result=simplex[0];return {method:'deterministic_nelder_mead_minimax_original_triangle_principal_strain',point:[...result.point],maximumPrincipalStrain:result.score.maximum,maximumRadialStrain:result.score.maximumRadialStrain,radialStrains:[...result.score.radialStrains],triangleMetrics:result.score.triangleMetrics.map(metric=>({...metric})),anchor:[...anchor],iterations};
}
`;
  source=source.slice(0,start)+next+source.slice(end);
}else if(!source.includes('function sr25FitCentrePrincipalMinimax('))throw Error('No R2.5 centre fitter found');
fs.writeFileSync(path,source);
console.log('R2.5 centre now minimizes the full original triangle principal-strain gate.');
