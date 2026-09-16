import {normalizeCharacterShape,characterShapeParameterKey} from './shape-contract.mjs';

// A composition of smooth, bounded reference-space maps. Geometry and joints
// consume this same implementation. It never loads or stores a surface asset.
export const CHARACTER_DEFORMATION_RULES=Object.freeze({
 legShiftPerStature:.02,shoulderShiftM:.012,hipRadialGain:.08,waistRadialGain:.12,torsoDepthGain:.14,
 limbRadialGain:.12,limbInnerRadiusPerLength:.19,limbOuterRadiusPerLength:.38,
 limbProtectedEnd:.12,limbRampLength:.18,limbProtectedLandmarkMarginM:.01,minimumLocalDeterminant:.1,
 method:'bounded-axis-and-tube-composition',populationCalibration:false
});
function shapeSmooth(t){if(t<=0)return [0,0];if(t>=1)return [1,0];return [t*t*(3-2*t),6*t*(1-t)];}
function shapeBand(value,a,b,c,d){
 const [lo,dlo]=shapeSmooth((value-a)/(b-a)),[hi,dhi]=shapeSmooth((d-value)/(d-c));
 return [lo*hi,dlo/(b-a)*hi-lo*dhi/(d-c)];
}
function shapeCentralMask(x,inner,outer){const sign=x<0?-1:1,[v,d]=shapeSmooth((Math.abs(x)-inner)/(outer-inner));return [1-v,-d*sign/(outer-inner)];}
function shapePointInput(value,label){if(value?.length!==3||!Array.from(value).every(Number.isFinite))throw Error('Invalid shape '+label);return Array.from(value);}
function shapeAxis(state,axis,displacement,gradient){
 const determinant=1+gradient[axis];
 if(!Number.isFinite(determinant)||determinant<CHARACTER_DEFORMATION_RULES.minimumLocalDeterminant)throw Error('局部体型变换超出可逆范围');
 if(state.normal){const component=state.normal[axis]/determinant;state.normal=state.normal.map((v,k)=>v-gradient[k]*component);}
 state.point[axis]+=displacement;state.determinant*=determinant;
}
function shapeTube(state,tube,amount){
 if(amount===0)return;const p=state.point,u=tube.u,relative=p.map((v,k)=>v-tube.a[k]);
 const projection=relative.reduce((sum,v,k)=>sum+v*u[k],0),t=projection/tube.length;
 const e=CHARACTER_DEFORMATION_RULES.limbProtectedEnd,ramp=CHARACTER_DEFORMATION_RULES.limbRampLength;
 if(t<=e||t>=1-e)return;
 const [lo,dlo]=shapeSmooth((t-e)/ramp),[hi,dhi]=shapeSmooth((1-e-t)/ramp),w=lo*hi,dw=(dlo*hi-lo*dhi)/ramp;
 const r=relative.map((v,k)=>v-u[k]*projection),radius=Math.hypot(...r);
 if(radius>=tube.outer)return;
 const [radial,radialDerivative]=shapeSmooth((radius-tube.inner)/(tube.outer-tube.inner)),g=1-radial,dg=-radialDerivative/(tube.outer-tube.inner);
 const f=amount*w*g,alpha=1+f;
 const gradient=u.map((v,k)=>amount*(dw*g*v/tube.length+w*dg*(radius>1e-12?r[k]/radius:0)));
 const rg=r.reduce((sum,v,k)=>sum+v*gradient[k],0),denominator=1+rg/alpha,determinant=alpha*alpha*denominator;
 if(!Number.isFinite(determinant)||determinant<CHARACTER_DEFORMATION_RULES.minimumLocalDeterminant)throw Error('肢体丰满度超出可逆范围');
 if(state.normal){
  const n=state.normal,un=n.reduce((sum,v,k)=>sum+v*u[k],0),ug=gradient.reduce((sum,v,k)=>sum+v*u[k],0);
  const inverseN=n.map((v,k)=>u[k]*un+(v-u[k]*un)/alpha),inverseG=gradient.map((v,k)=>u[k]*ug+(v-u[k]*ug)/alpha);
  const coefficient=r.reduce((sum,v,k)=>sum+v*inverseN[k],0)/denominator;
  state.normal=inverseN.map((v,k)=>v-inverseG[k]*coefficient);
 }
 state.point=p.map((v,k)=>v+f*r[k]);state.determinant*=determinant;
}
export function createCharacterShapeField(reference,input={}){
 const shape=normalizeCharacterShape(input),rules=CHARACTER_DEFORMATION_RULES;
 if(!reference?.nodes||!Number.isFinite(reference.sourceFloorM)||!Number.isFinite(reference.sourceHeightM)||reference.sourceHeightM<=0)throw Error('缺少体型参考参数');
 const point=id=>shapePointInput(reference.nodes[id]?.positionM,'reference '+id),hips=point('hips'),l5=point('L5'),t1=point('T1');
 const mean=id=>['left','right'].map(side=>point(side+'_'+id)).reduce((a,b)=>a.map((v,k)=>(v+b[k])/2));
 const ankle=mean('foot'),knee=mean('tibia'),shoulder=mean('upperArm');
 const hipX=Math.max(...['left','right'].map(side=>Math.abs(point(side+'_femur')[0]-hips[0])));
 const armX=Math.min(...['left','right'].map(side=>Math.abs(point(side+'_upperArm')[0])));
 const acs=['left','right'].map(side=>point(side+'_AC')),acY=Math.max(...acs.map(p=>p[1]));
 const handPoints=Object.entries(reference.nodes).filter(([id])=>/^(left|right)_(?:hand|metacarpal_|finger_)/.test(id)).flatMap(([,node])=>node.tipM?[node.positionM,node.tipM]:[node.positionM]);
 const protectedArmPoints=Object.entries(reference.nodes).filter(([id])=>/^(left|right)_(?:SC|AC|upperArm|forearm|radiusRotation|hand|metacarpal_|finger_)/.test(id)).flatMap(([,node])=>node.tipM?[node.positionM,node.tipM]:[node.positionM]).map(p=>shapePointInput(p,'protected arm landmark'));
 if(!handPoints.length)throw Error('缺少手部保护参考');
 const handY=Math.min(...handPoints.map(p=>p[1])),handX=Math.min(...handPoints.map(p=>Math.abs(p[0])))-.005,acX=Math.min(...acs.map(p=>Math.abs(p[0])))-.005;
 const wristY=mean('hand')[1],centralInner=hipX+.02,centralOuter=armX-.01,torsoInner=hipX+.025,torsoOuter=torsoInner+.08;
 const l4Y=point('L4')[1],l1Y=point('L1')[1],t5Y=point('T5')[1],t9Y=point('T9')[1],t10Y=point('T10')[1],t12Y=point('T12')[1];
 if(!(ankle[1]+.08<hips[1]&&hips[1]<l5[1]&&l5[1]<t5Y&&acY<t1[1]&&centralInner<centralOuter&&acX>.06&&handX>acX))throw Error('体型参考保护区顺序无效');
 const spine=Object.entries(reference.nodes).filter(([id])=>id==='hips'||/^(?:L[1-5]|T(?:[1-9]|1[0-2])|C[1-7])$/.test(id)).map(([,node])=>shapePointInput(node.positionM,'spine')).sort((a,b)=>a[1]-b[1]);
 const centre=y=>{
  if(y<=spine[0][1])return [spine[0][0],spine[0][2],0,0];
  if(y>=spine.at(-1)[1])return [spine.at(-1)[0],spine.at(-1)[2],0,0];
  let low=0,high=spine.length-1;while(high-low>1){const mid=(low+high)>>1;if(spine[mid][1]>y)high=mid;else low=mid;}
  const a=spine[low],b=spine[high],length=b[1]-a[1],[w,dw]=shapeSmooth((y-a[1])/length);
  return [a[0]+(b[0]-a[0])*w,a[2]+(b[2]-a[2])*w,(b[0]-a[0])*dw/length,(b[2]-a[2])*dw/length];
 };
 const tubes=[];
 for(const side of ['left','right'])for(const [kind,start,end]of [['arm','upperArm','forearm'],['arm','forearm','hand'],['leg','femur','tibia'],['leg','tibia','foot']]){
  const a=point(side+'_'+start),b=point(side+'_'+end),length=Math.hypot(...b.map((v,k)=>v-a[k]));
  if(!(length>0))throw Error('体型参考骨段无效');
  const u=b.map((v,k)=>(v-a[k])/length);let outer=length*rules.limbOuterRadiusPerLength;
  if(kind==='leg')for(const protectedPoint of protectedArmPoints){
   const relative=protectedPoint.map((v,k)=>v-a[k]),projection=relative.reduce((sum,v,k)=>sum+v*u[k],0),t=projection/length;
   if(t<=rules.limbProtectedEnd||t>=1-rules.limbProtectedEnd)continue;
   const radius=Math.hypot(...relative.map((v,k)=>v-u[k]*projection));outer=Math.min(outer,radius-rules.limbProtectedLandmarkMarginM);
  }
  if(!(outer>0))throw Error('肢体参考与手臂保护区相交');
  // Keep a broad radial transition after capping a thigh tube near the hand.
  // This protects reference landmarks and tips with a 1 cm margin. It does
  // not certify every hand-surface vertex, and joints use this same field.
  const inner=Math.min(length*rules.limbInnerRadiusPerLength,outer*.5);
  tubes.push({kind,a,u,length,inner,outer});
 }
 const warp=(inputPoint,inputNormal=null)=>{
  const state={point:shapePointInput(inputPoint,'point'),normal:inputNormal===null?null:shapePointInput(inputNormal,'normal'),determinant:1};
  // Every regional map is identity in this head/face/hair half-space. All
  // current facial controls therefore retain a single affine conversion.
  if(state.point[1]<t1[1]){
   for(const tube of tubes)shapeTube(state,tube,rules.limbRadialGain*shape[tube.kind==='arm'?'armFullness':'legFullness']);
   if(shape.waistWidth!==0){
    const [x,y]=state.point,[cx,,dcx]=centre(y),dx=x-cx,[band,db]=shapeBand(y,hips[1]+.02,l4Y,l1Y,t9Y),[mask,dm]=shapeCentralMask(dx,torsoInner,torsoOuter),a=rules.waistRadialGain*shape.waistWidth;
    shapeAxis(state,0,a*band*mask*dx,[a*band*(mask+dx*dm),a*(db*mask*dx-band*dcx*(mask+dx*dm)),0]);
   }
   if(shape.torsoDepth!==0){
    const [x,y,z]=state.point,[cx,cz,dcx,dcz]=centre(y),dz=z-cz,[band,db]=shapeBand(y,hips[1]+.03,l4Y,t10Y,t5Y),[mask,dm]=shapeCentralMask(x-cx,torsoInner,torsoOuter),a=rules.torsoDepthGain*shape.torsoDepth;
    shapeAxis(state,2,a*band*mask*dz,[a*band*dm*dz,a*(db*mask*dz-band*dm*dcx*dz-band*mask*dcz),a*band*mask]);
   }
   if(shape.legProportion!==0){
    const [x,y]=state.point,[band,db]=shapeBand(y,ankle[1]+.08,hips[1],l5[1],t5Y),[mask,dm]=shapeCentralMask(x-hips[0],centralInner,centralOuter),a=reference.sourceHeightM*rules.legShiftPerStature*shape.legProportion;
    shapeAxis(state,1,a*band*mask,[a*band*dm,a*db*mask,0]);
   }
   if(shape.hipWidth!==0){
    const [x,y]=state.point,dx=x-hips[0],[band,db]=shapeBand(y,knee[1]-.05,hips[1]-.08,hips[1]+.04,t12Y),[mask,dm]=shapeCentralMask(dx,torsoInner,torsoOuter),a=rules.hipRadialGain*shape.hipWidth;
    shapeAxis(state,0,a*band*mask*dx,[a*band*(mask+dx*dm),a*db*mask*dx,0]);
   }
   if(shape.shoulderWidth!==0){
    const [x,y]=state.point,sign=x<0?-1:1,t=Math.max(0,Math.min(1,(y-wristY)/(acY-wristY))),outer=handX+(acX-handX)*t,dOuter=y>wristY&&y<acY?(acX-handX)/(acY-wristY):0;
    const [sideWeight,ds]=shapeSmooth((Math.abs(x)-(outer-.06))/.06),[band,db]=shapeBand(y,handY-.12,handY-.02,acY,t1[1]),a=rules.shoulderShiftM*shape.shoulderWidth;
    shapeAxis(state,0,a*sign*sideWeight*band,[a*ds/.06*band,a*sign*(sideWeight*db-ds/.06*dOuter*band),0]);
   }
  }
  const s=shape.statureScale;state.point=state.point.map(v=>v*s);state.determinant*=s*s*s;
  if(state.point.some(v=>!Number.isFinite(v)))throw Error('体型坐标超出有限范围');
  if(state.normal){const length=Math.hypot(...state.normal);if(!(length>1e-12))throw Error('体型法线退化');state.normal=state.normal.map(v=>v/length);}
  return {point:state.point,normal:state.normal,jacobianDeterminant:state.determinant};
 };
 return {shape,shapeKey:characterShapeParameterKey(shape),headAffineMinY:t1[1],headTransform:{scale:shape.statureScale,translation:[0,0,0]},
  point:p=>warp(p).point,pointNormal:(p,n)=>warp(p,n),
  method:rules.method,sourceHeightM:reference.sourceHeightM,referenceShoulderY:shoulder[1],
  limbProtection:{referenceArmLandmarks:true,clearanceM:rules.limbProtectedLandmarkMarginM,fullHandSurfaceCertificate:false},
  nonlinearInterpolationErrorMeasured:false,globalSurfaceCertificate:false};
}
