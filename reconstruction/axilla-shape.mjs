// The fitted arms-down envelope joins the lateral chest far below the GH
// centre. Relocate that connected skin before computing its binding weights.
// These are engineering parameters; they are not anatomical measurements.
export const AXILLA_SHAPE_PARAMETERS=Object.freeze({
  version:'r2/axilla-shape@1',liftM:.09,lowerOffsetM:-.30,peakOffsetM:-.20,upperOffsetM:.015,
  lateralCoreM:.022,lateralOuterM:.065,depthCoreM:.05,depthOuterM:.11,
  maximumSourceEdgeM:.005,positionToleranceM:.0003,refinementBudget:65000
});
const ramp=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return [t*t*(3-2*t),6*t*(1-t)/(b-a)];};
export function createAxillaShape(reference,options={}){
  const parameters={...AXILLA_SHAPE_PARAMETERS,...options},p=parameters;
  for(const key of Object.keys(AXILLA_SHAPE_PARAMETERS).filter(k=>k!=='version'))if(!Number.isFinite(p[key]))throw Error('Invalid axilla parameter '+key);
  if(!(p.liftM>0&&p.lowerOffsetM<p.peakOffsetM&&p.peakOffsetM<p.upperOffsetM&&p.lateralCoreM>0&&p.lateralOuterM>p.lateralCoreM&&p.depthCoreM>0&&p.depthOuterM>p.depthCoreM&&p.maximumSourceEdgeM>0&&p.positionToleranceM>0&&Number.isSafeInteger(p.refinementBudget)&&p.refinementBudget>=0))throw Error('Invalid axilla support');
  const determinantLowerBound=1-1.5*p.liftM/(p.upperOffsetM-p.peakOffsetM);
  if(determinantLowerBound<.2)throw Error('Axilla lift would overcompress the skin');
  const centres=Object.fromEntries(['left','right'].map(side=>{
    const point=reference.nodes?.[side+'_upperArm']?.positionM;
    if(point?.length!==3||!point.every(Number.isFinite))throw Error('Missing shoulder centre '+side);
    // Fitted surface coordinates reflect source X exactly once.
    return [side,[-point[0],point[1],point[2]]];
  }));
  const legal=mask=>!(mask&~54)&&!!(mask&54);
  function inverseSource(point,mask,normal=null){
    const unchanged=()=>({point:point.slice(),normal:normal?.slice(),jacobian:1,minimumLocalJacobian:1,changed:false});
    if(!legal(mask))return unchanged();
    const centre=centres[point[0]>0?'left':'right'],x=point[0]-centre[0],z=point[2]-centre[2],y=point[1]-centre[1];
    // The map fixes the support boundary and is strictly increasing in Y.
    // Outside it the inverse is identity; avoid a solve for most vertices.
    if(Math.abs(x)>=p.lateralOuterM||Math.abs(z)>=p.depthOuterM||y<=p.lowerOffsetM||y>=p.upperOffsetM)return unchanged();
    const [sx,dx]=ramp(p.lateralCoreM,p.lateralOuterM,Math.abs(x)),[sz,dz]=ramp(p.depthCoreM,p.depthOuterM,Math.abs(z)),gx=1-sx,gz=1-sz;
    const amplitude=p.liftM*gx*gz;if(amplitude===0)return unchanged();
    let lo=Math.max(p.lowerOffsetM,y-amplitude),hi=y;
    for(let step=0;step<40;step++){
      const at=(lo+hi)*.5,up=ramp(p.lowerOffsetM,p.peakOffsetM,at)[0],down=ramp(p.peakOffsetM,p.upperOffsetM,at)[0];
      if(at+amplitude*up*(1-down)<y)lo=at;else hi=at;
    }
    const original=(lo+hi)*.5,[up,du]=ramp(p.lowerOffsetM,p.peakOffsetM,original),[down,dd]=ramp(p.peakOffsetM,p.upperOffsetM,original),gy=up*(1-down);
    const gradient=[-p.liftM*dx*Math.sign(x)*gz*gy,amplitude*(du*(1-down)-up*dd),-p.liftM*gx*dz*Math.sign(z)*gy],determinant=1+gradient[1];
    const result=[point[0],centre[1]+original,point[2]];if(Math.abs(result[1]-point[1])<=1e-12)return unchanged();let n=normal?.slice();
    // Undo J^-T from evaluateSource with J^T, then normalize its direction.
    if(n){const ny=n[1];n=[n[0]+gradient[0]*ny,determinant*ny,n[2]+gradient[2]*ny];const length=Math.hypot(...n);if(!(length>0))throw Error('Invalid inverse axilla normal');n=n.map(v=>v/length);}
    return {point:result,normal:n,jacobian:1/determinant,minimumLocalJacobian:1/determinant,changed:true};
  }
  function evaluateSource(point,mask,normal=null){
    let result=point.slice(),n=normal?.slice();
    if(!legal(mask))return {point:result,normal:n,jacobian:1,minimumLocalJacobian:1,changed:false};
    const centre=centres[point[0]>0?'left':'right'],x=point[0]-centre[0],z=point[2]-centre[2],y=point[1]-centre[1];
    const [sx,dx]=ramp(p.lateralCoreM,p.lateralOuterM,Math.abs(x)),[sz,dz]=ramp(p.depthCoreM,p.depthOuterM,Math.abs(z));
    const [up,du]=ramp(p.lowerOffsetM,p.peakOffsetM,y),[down,dd]=ramp(p.peakOffsetM,p.upperOffsetM,y);
    const gx=1-sx,gz=1-sz,gy=up*(1-down),amount=p.liftM*gx*gz*gy;
    const gradient=[-p.liftM*dx*Math.sign(x)*gz*gy,p.liftM*gx*gz*(du*(1-down)-up*dd),-p.liftM*gx*dz*Math.sign(z)*gy];
    const determinant=1+gradient[1];result[1]+=amount;
    if(n){const ny=n[1]/determinant;n=[n[0]-gradient[0]*ny,ny,n[2]-gradient[2]*ny];const length=Math.hypot(...n);if(!(length>0))throw Error('Invalid axilla normal');n=n.map(v=>v/length);}
    return {point:result,normal:n,jacobian:determinant,minimumLocalJacobian:determinant,changed:amount>1e-12};
  }
  function affectsSourceTriangle(points,mask){
    if(!legal(mask))return false;
    return Object.values(centres).some(c=>[0,1,2].every(k=>{
      const lo=c[k]+(k===1?p.lowerOffsetM:k===0?-p.lateralOuterM:-p.depthOuterM),hi=c[k]+(k===1?p.upperOffsetM:k===0?p.lateralOuterM:p.depthOuterM);
      return Math.max(...points.map(v=>v[k]))>=lo&&Math.min(...points.map(v=>v[k]))<=hi;
    }));
  }
  function affectsChart(chart){
    if(!['torso','shoulder_neck','left_arm','right_arm'].includes(chart.semanticRegion))return false;
    return Object.values(centres).some(c=>chart.projectionAxes.every((axis,i)=>{
      const lo=c[axis]+(axis===1?p.lowerOffsetM:axis===0?-p.lateralOuterM:-p.depthOuterM),hi=c[axis]+(axis===1?p.upperOffsetM:axis===0?p.lateralOuterM:p.depthOuterM);
      return chart.uvBoundsMetres[1][i]>=lo&&chart.uvBoundsMetres[0][i]<=hi;
    }));
  }
  return {parameters:Object.freeze(parameters),centres,evaluateSource,inverseSource,affectsSourceTriangle,affectsChart,
    report:{version:p.version,method:'monotone-reference-axilla-lift',engineeringCorrective:true,biologicalCalibration:false,
      sourceCoefficientsModified:false,facesDeleted:false,normalMethod:'analytic-inverse-transpose',liftM:p.liftM,determinantLowerBound}};
}
