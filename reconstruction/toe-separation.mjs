// Engineered distal-foot shape repair. The locked source coefficients contain
// thick continuous surfaces between the toe rays; these parameters are not a
// measured anatomical reconstruction. No faces, vertices or source arrays live here.
export const TOE_SEPARATION_PARAMETERS=Object.freeze({
  version:'r2/toe-separation@1',gapHalfWidthM:.00065,minimumOuterWidthM:.0025,
  outerWidthFraction:.25,compressionLengthM:.0012,maximumSourceEdgeM:.004,
  positionToleranceM:.00025,refinementBudget:110000
});
const dot=(a,b)=>a.reduce((sum,v,k)=>sum+v*b[k],0),sub=(a,b)=>a.map((v,k)=>v-b[k]);
const add=(a,b)=>a.map((v,k)=>v+b[k]),mul=(a,s)=>a.map(v=>v*s),length=a=>Math.hypot(...a);
const norm=a=>{const n=length(a);if(!(n>1e-12))throw Error('Degenerate toe corridor');return mul(a,1/n);};
const mirror=p=>[-p[0],p[1],p[2]];
export function createToeSeparation(reference,options={}){
  const parameters={...TOE_SEPARATION_PARAMETERS,...options};
  for(const name of ['gapHalfWidthM','minimumOuterWidthM','outerWidthFraction','compressionLengthM','maximumSourceEdgeM','positionToleranceM'])if(!(Number.isFinite(parameters[name])&&parameters[name]>0))throw Error('Invalid toe separation parameter '+name);
  if(parameters.minimumOuterWidthM<=parameters.gapHalfWidthM||!Number.isSafeInteger(parameters.refinementBudget)||parameters.refinementBudget<0)throw Error('Invalid toe separation support or budget');
  const position=id=>{const p=reference.nodes[id]?.positionM;if(p?.length!==3||!p.every(Number.isFinite))throw Error('Missing toe landmark '+id);return p;};
  const corridors=new Map();
  for(const side of ['left','right']){
    const rays=Array.from({length:5},(_,i)=>{
      const root=position(side+'_toe_'+(i+1)+'_1'),tip=reference.nodes[side+'_toe_'+(i+1)+'_'+(i===0?2:3)]?.tipM;
      if(tip?.length!==3||!tip.every(Number.isFinite))throw Error('Missing toe terminal tip');return {root,tip};
    });
    corridors.set(side,rays.slice(0,-1).map((a,i)=>{
      const b=rays[i+1],origin=mul(add(a.root,b.root),.5),end=mul(add(a.tip,b.tip),.5),axis=norm(sub(end,origin));
      const across=sub(b.root,a.root),lateral=norm(sub(across,mul(axis,dot(across,axis))));
      const outerWidth=Math.max(parameters.minimumOuterWidthM,length(across)*parameters.outerWidthFraction);
      return {side,pair:[i+1,i+2],origin,axis,lateral,outerWidth};
    }));
  }
  const sideForMask=mask=>(mask&1024)&&!(mask&2048)?'left':(mask&2048)&&!(mask&1024)?'right':null;
  function evaluate(point,mask,normal=null){
    const side=sideForMask(mask);let p=point.slice(),n=normal?.slice(),jacobian=1,minimumLocalJacobian=1,changed=false;
    if(!side)return {point:p,normal:n,jacobian,minimumLocalJacobian,changed};
    for(const c of corridors.get(side)){
      const rel=sub(p,c.origin),along=dot(rel,c.axis),across=dot(rel,c.lateral),av=Math.abs(across);
      if(along<=0||av>=c.outerWidth)continue;
      let gate=1,gateDerivative=0;
      if(av>parameters.gapHalfWidthM){
        const width=c.outerWidth-parameters.gapHalfWidthM,t=(av-parameters.gapHalfWidthM)/width;
        gate=1-t*t*(3-2*t);gateDerivative=-6*t*(1-t)*Math.sign(across)/width;
      }
      // h'(along)=e/(e+along)>0. With gate independent of along, this
      // rank-one deformation has positive determinant everywhere in its domain.
      const e=parameters.compressionLengthM,h=e*Math.log1p(along/e),f=gate*(h-along),du=gate*(e/(e+along)-1),dv=gateDerivative*(h-along),det=1+du;
      if(!(det>0&&Number.isFinite(det)))throw Error('Invalid toe separation Jacobian');
      if(n){const gradient=add(mul(c.axis,du),mul(c.lateral,dv));n=sub(n,mul(gradient,dot(c.axis,n)/det));}
      p=add(p,mul(c.axis,f));jacobian*=det;minimumLocalJacobian=Math.min(minimumLocalJacobian,det);changed||=Math.abs(f)>1e-12;
    }
    if(n){const size=length(n);if(!(size>0&&Number.isFinite(size)))throw Error('Invalid separated toe normal');n=mul(n,1/size);}
    return {point:p,normal:n,jacobian,minimumLocalJacobian,changed};
  }
  function evaluateSource(point,mask,normal=null){
    const result=evaluate(mirror(point),mask,normal?mirror(normal):null);
    return {...result,point:mirror(result.point),normal:result.normal?mirror(result.normal):null};
  }
  function affectsSourceTriangle(points,mask){
    const side=sideForMask(mask);if(!side)return false;
    const p=points.map(mirror);
    return corridors.get(side).some(c=>{
      const rel=p.map(point=>sub(point,c.origin)),u=rel.map(v=>dot(v,c.axis)),v=rel.map(p=>dot(p,c.lateral));
      return Math.max(...u)>0&&Math.min(...v)<c.outerWidth&&Math.max(...v)>-c.outerWidth;
    });
  }
  function affectsChart(chart){
    const side=chart.semanticRegion==='left_foot_toes'?'left':chart.semanticRegion==='right_foot_toes'?'right':null;if(!side)return false;
    const forward=chart.projectionAxes.indexOf(2);return forward<0||chart.uvBoundsMetres[1][forward]>Math.min(...corridors.get(side).map(c=>c.origin[2]))-.005;
  }
  return {parameters:Object.freeze(parameters),corridors,evaluate,evaluateSource,affectsSourceTriangle,affectsChart,
    report:{version:parameters.version,method:'monotone-interdigital-corridor-retraction',engineeringCorrective:true,biologicalCalibration:false,
      sourceCoefficientsModified:false,facesDeleted:false,normalMethod:'analytic-inverse-transpose',gapHalfWidthM:parameters.gapHalfWidthM,
      compressionLengthM:parameters.compressionLengthM,maximumSourceEdgeM:parameters.maximumSourceEdgeM,positionToleranceM:parameters.positionToleranceM}};
}
