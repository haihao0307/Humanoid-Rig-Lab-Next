/* Procedural soft-tissue approximation, evaluated before rigid skinning.
 * A shortening muscle belly expands transversely. Its ends remain attached.
 * This is an engineered volume constraint, not measured muscle activation.
 * Sources: OpenStax A&P 2e 10.3 and 11.5; Disney Enhanced DQS (2013).
 */
const COMPACT_MUSCLE_MODEL=Object.freeze({version:'r2/muscle-bellies@2',maximumArmStrain:.14,maximumDeltoidStrain:.10,shoulderCapLiftLengthRatio:.08,calibrated:false});
function r2MuscleFrames(human,frames=null){
 const world=id=>frames?frames.get(id):human.byId.get(id).world;
 const chest=world('T1'),chestRest=human.sourceBind.get('T1'),chestQ=qm(chest.q,inv(chestRest.q)),down=rotate(chestQ,[0,-1,0]);
 return ['left','right'].map(side=>{
  const rest=human.sourceBind.get(side+'_upperArm').p,end=human.sourceBind.get(side+'_forearm').p,axis=norm(sub(end,rest)),length=dist(rest,end);
  const a=world(side+'_upperArm').p,b=world(side+'_forearm').p,c=world(side+'_hand').p,upper=norm(sub(b,a)),lower=norm(sub(c,b));
  const bend=Math.acos(clamp(dot(upper,lower),-1,1)),elevation=Math.acos(clamp(dot(upper,down),-1,1)),restElevation=Math.acos(clamp(-axis[1],-1,1));
  const restLower=norm(sub(human.sourceBind.get(side+'_hand').p,end)),restBend=Math.acos(clamp(dot(axis,restLower),-1,1));
  const folded=smooth(clamp((bend-restBend)/(Math.PI*.75-restBend),0,1)),raised=smooth(clamp((elevation-restElevation)/(Math.PI*.5-restElevation),0,1));
  return {origin:rest,axis,length,axillaWeight:raised,armStrain:COMPACT_MUSCLE_MODEL.maximumArmStrain*folded,deltoidStrain:COMPACT_MUSCLE_MODEL.maximumDeltoidStrain*raised};
 });
}
function r2MusclePoint(point,frames){
 let p=point;
 for(const f of frames){
  if(f.armStrain===0&&f.deltoidStrain===0&&!(f.axillaWeight>0))continue;
  // Continuous superior cap support follows arm elevation relative to the
  // chest. This engineering corrective is zero at rest and below the cap;
  // it does not change the source skeleton or invent a clavicle capture track.
  const L=f.length,capY=p[1]-f.origin[1],capX=Math.abs(p[0])-Math.abs(f.origin[0])-.10*L,capZ=Math.abs(p[2]-f.origin[2]);
  if(p[0]*f.origin[0]>0&&f.axillaWeight>0&&capY>-.18*L&&capY<.36*L&&capX>-.18*L&&capX<.28*L&&capZ<.40*L){
   const ramp=(a,b,v)=>smooth(clamp((v-a)/(b-a),0,1));
   let cap=ramp(-.18*L,-.02*L,capX)*(1-ramp(.07*L,.28*L,capX));
   cap*=ramp(-.18*L,.07*L,capY)*(1-ramp(.16*L,.36*L,capY));
   cap*=1-ramp(.16*L,.40*L,capZ);
   p=[p[0],p[1]+COMPACT_MUSCLE_MODEL.shoulderCapLiftLengthRatio*L*f.axillaWeight*cap,p[2]];
  }
  const dx=p[0]-f.origin[0],dy=p[1]-f.origin[1],dz=p[2]-f.origin[2];
  if(dx*dx+dy*dy+dz*dz>(f.length*1.12)**2)continue;
  for(const [lo,hi,strain]of [[-.10,.28,f.deltoidStrain],[.16,.88,f.armStrain]]){
   if(strain<=1e-9)continue;
   const rel=sub(p,f.origin),along=dot(rel,f.axis),v=sub(rel,mul(f.axis,along)),radius=len(v),t=(along/f.length-lo)/(hi-lo);
   if(t<=0||t>=1||radius>=f.length*.36)continue;
   const gate=1-smooth(clamp((radius/f.length-.27)/.09,0,1)),b=16*t*t*(1-t)*(1-t),db=32*t*(1-t)*(1-2*t);
   const axial=-strain*f.length*(hi-lo)*(t-.5)*b,lambda=1-strain*(b+(t-.5)*db),radial=1/Math.sqrt(lambda)-1;
   p=add(p,add(mul(f.axis,axial*gate),mul(v,radial*gate)));
  }
 }
 return p;
}
function r2ShoulderLbsWeight(point,stature=1){
 const p=mul(point,1/stature),s=(a,b,v)=>smooth((v-a)/(b-a));
 return .8*s(1.08,1.16,p[1])*(1-s(1.35,1.42,p[1]))*s(.07,.11,Math.abs(p[0]))*(1-s(.25,.30,Math.abs(p[0])));
}
// Both the renderer and support probes start from the neutral personal surface.
// The precomputed lift is activated by arm elevation relative to the chest.
function r2AxillaPoint(point,delta,muscles){
 if(!delta||(delta[0]===0&&delta[1]===0&&delta[2]===0))return point;
 const weight=muscles[point[0]<0?0:1]?.axillaWeight||0;
 return weight===0?point:[point[0]+delta[0]*weight,point[1]+delta[1]*weight,point[2]+delta[2]*weight];
}
// One integer attribute preserves all Float32 delta bits and both oct16 values.
// Locations 8..14 belong to eyelids; stay within WebGL 2's 16 attribute minimum.
function r2PackAxillaAttribute(mesh){
 if(!(mesh.axillaDelta instanceof Float32Array)||mesh.axillaDelta.length!==mesh.vertices*3||!(mesh.axillaNormals instanceof Int16Array)||mesh.axillaNormals.length!==mesh.vertices*2)throw Error('Invalid axilla pose corrective');
 const packed=new Uint32Array(mesh.vertices*4),bits=new Uint32Array(mesh.axillaDelta.buffer,mesh.axillaDelta.byteOffset,mesh.axillaDelta.length);
 for(let i=0;i<mesh.vertices;i++){
  packed[i*4]=bits[i*3];packed[i*4+1]=bits[i*3+1];packed[i*4+2]=bits[i*3+2];
  packed[i*4+3]=(mesh.axillaNormals[i*2]&65535)|((mesh.axillaNormals[i*2+1]&65535)<<16);
 }
 return packed;
}
function r2DeformTissuePoint(point,influences,transforms,muscles,stature=1,axillaDelta=null){
 point=r2AxillaPoint(point,axillaDelta,muscles);
 const weight=r2ShoulderLbsWeight(point,stature),p=r2MusclePoint(point,muscles),dq=r2DeformPoint(p,influences,transforms);
 if(weight===0)return dq;
 let linear=[0,0,0];
 for(const [id,w]of influences){const {q,d}=transforms[id],t=mul(add(sub(mul(d.slice(0,3),q[3]),mul(q.slice(0,3),d[3])),cross(q.slice(0,3),d.slice(0,3))),2);linear=add(linear,mul(add(rotate(q,p),t),w));}
 return mix(dq,linear,weight);
}
const COMPACT_MUSCLE_GLSL=`
uniform vec4 compactMuscleOrigin[2],compactMuscleAxis[2];
uniform vec2 compactMuscleStrain[2];
uniform vec2 compactAxillaWeight;
uniform float compactMuscleEnabled;
float compactShoulderLbsWeight(vec3 p){
 p/=compactStatureScale;return .8*smoothstep(1.08,1.16,p.y)*(1.-smoothstep(1.35,1.42,p.y))*smoothstep(.07,.11,abs(p.x))*(1.-smoothstep(.25,.30,abs(p.x)));
}
vec3 compactMusclePoint(vec3 p){
 if(compactMuscleEnabled<.5)return p;
 for(int side=0;side<2;side++){
  vec3 origin=compactMuscleOrigin[side].xyz,axis=compactMuscleAxis[side].xyz;float L=compactMuscleOrigin[side].w;
  float capY=p.y-origin.y,capX=abs(p.x)-abs(origin.x)-.10*L,capZ=abs(p.z-origin.z);
  if(p.x*origin.x>0.&&compactAxillaWeight[side]>0.&&capY>-.18*L&&capY<.36*L&&capX>-.18*L&&capX<.28*L&&capZ<.40*L){
   float cap=smoothstep(-.18*L,-.02*L,capX)*(1.-smoothstep(.07*L,.28*L,capX));
   cap*=smoothstep(-.18*L,.07*L,capY)*(1.-smoothstep(.16*L,.36*L,capY));
   cap*=1.-smoothstep(.16*L,.40*L,capZ);
   p.y+=${COMPACT_MUSCLE_MODEL.shoulderCapLiftLengthRatio.toFixed(8)}*L*compactAxillaWeight[side]*cap;
  }
  if(distance(p,origin)>L*1.12)continue;
  for(int belly=0;belly<2;belly++){
   float lo=belly==0?-.10:.16,hi=belly==0?.28:.88,strain=belly==0?compactMuscleStrain[side].y:compactMuscleStrain[side].x;
   if(strain<1e-9)continue;
   vec3 rel=p-origin;float along=dot(rel,axis),t=(along/L-lo)/(hi-lo);vec3 v=rel-axis*along;float radius=length(v);
   if(t<=0.||t>=1.||radius>=L*.36)continue;
   float gate=1.-smoothstep(.27,.36,radius/L),b=16.*t*t*(1.-t)*(1.-t),db=32.*t*(1.-t)*(1.-2.*t);
   float axial=-strain*L*(hi-lo)*(t-.5)*b,lambda=1.-strain*(b+(t-.5)*db),radial=inversesqrt(lambda)-1.;
   p+=axis*(axial*gate)+v*(radial*gate);
  }
 }
 return p;
}
void compactMuscles(inout vec3 p,inout vec3 n){
 if(compactMuscleEnabled<.5)return;
 vec3 result=compactMusclePoint(p);if(distance(result,p)<1e-10)return;
 float e=.00002*compactStatureScale;
 vec3 a=(compactMusclePoint(p+vec3(e,0.,0.))-compactMusclePoint(p-vec3(e,0.,0.)))/(2.*e);
 vec3 b=(compactMusclePoint(p+vec3(0.,e,0.))-compactMusclePoint(p-vec3(0.,e,0.)))/(2.*e);
 vec3 c=(compactMusclePoint(p+vec3(0.,0.,e))-compactMusclePoint(p-vec3(0.,0.,e)))/(2.*e);
 n=normalize(mat3(cross(b,c),cross(c,a),cross(a,b))*n);p=result;
}`;
