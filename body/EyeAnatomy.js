/* Parameter-generated eyelid tissue fitted to the current neutral skin aperture.
 * No captured mesh is saved. Eye frames come from the existing source surfaces.
 * Inspired by spherical-coordinate lid sliding, not a tissue simulation:
 * https://disneyanimation.com/publications/realistic-eye-motion-using-procedural-geometric-methods/
 */
const COMPACT_EYE_ANATOMY={revision:'r12-neutral-fissure-orbital-continuity',recess:.0002,blinkRetractionM:.0010,segments:96,rings:24,
  fissure:{halfWidth:.0128,upperHeight:.00415,lowerHeight:.00315,lateralCanthusLift:.00070,upperTemporalBias:.08,lowerTemporalBias:.04,verticalRoundness:.16,lowerSulcusM:.00030},
  left:{centre:[.029181616,1.518095373,.152055491],radius:.012623681},
  right:{centre:[-.030466569,1.518094244,.151979130],radius:.012591195}};
function compactEyeNeutralFissure(angle,side){
  const p=COMPACT_EYE_ANATOMY.fissure,c=Math.cos(angle),s=Math.sin(angle),vertical=Math.abs(s),lateral=c*(side==='left'?1:-1),canthus=vertical*vertical;
  const height=s>=0?p.upperHeight*(1+p.upperTemporalBias*lateral):p.lowerHeight*(1-p.lowerTemporalBias*lateral);
  const y=(s>=0?1:-1)*height*vertical*(1-p.verticalRoundness+p.verticalRoundness*vertical)+p.lateralCanthusLift*lateral*(1-canthus);
  return [p.halfWidth*c,y];
}
function compactEyeSkinSampler(meshes,frame){
  const triangles=[];
  for(const mesh of meshes){if(mesh.name!=='skin'&&mesh.name!=='faceSkin')continue;const coords=mesh.canonicalPositions;
    for(let k=0;k<mesh.indices.length;k+=3){const points=[];
      const ia=mesh.indices[k]*3,ib=mesh.indices[k+1]*3,ic=mesh.indices[k+2]*3;
      if(Math.max(coords[ia+1],coords[ib+1],coords[ic+1])<1.49||Math.min(coords[ia+1],coords[ib+1],coords[ic+1])>1.55||Math.max(coords[ia+2],coords[ib+2],coords[ic+2])<.13)continue;
      for(let j=0;j<3;j++){const at=mesh.indices[k+j]*3,p=[coords[at],coords[at+1],coords[at+2]],q=sub(p,frame.centre);points.push([dot(q,frame.u),dot(q,frame.v),dot(q,frame.n)]);}
      const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),zs=points.map(p=>p[2]);
      if(Math.max(...xs)<-.027||Math.min(...xs)>.027||Math.max(...ys)<-.023||Math.min(...ys)>.023||Math.max(...zs)<-.018)continue;
      const [a,b,c]=points,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
      if(Math.abs(den)<1e-13)continue;
      triangles.push({a,b,c,den,loX:Math.min(...xs),hiX:Math.max(...xs),loY:Math.min(...ys),hiY:Math.max(...ys)});
    }
  }
  return (x,y)=>{let z=null;for(const t of triangles){if(x<t.loX||x>t.hiX||y<t.loY||y>t.hiY)continue;
    const u=((t.b[1]-t.c[1])*(x-t.c[0])+(t.c[0]-t.b[0])*(y-t.c[1]))/t.den;
    const v=((t.c[1]-t.a[1])*(x-t.c[0])+(t.a[0]-t.c[0])*(y-t.c[1]))/t.den;
    if(u<-.00001||v<-.00001||u+v>1.00001)continue;
    const w=u*t.a[2]+v*t.b[2]+(1-u-v)*t.c[2];if(w>-.014)z=Math.max(z??-Infinity,w);
  }return z;};
}
function compactEyeEncodeNormal(n){const inv=1/(Math.abs(n[0])+Math.abs(n[1])+Math.abs(n[2]));let x=n[0]*inv,y=n[1]*inv;
  if(n[2]<0){const ox=x;x=(1-Math.abs(y))*(ox<0?-1:1);y=(1-Math.abs(ox))*(y<0?-1:1);}return [Math.round(x*32767),Math.round(y*32767)];}
function compactEyeContactDepth(x,y,globe,blink=0){
  const q=clamp((blink-.35)/.65,0,1),retraction=COMPACT_EYE_ANATOMY.blinkRetractionM*q*q*(3-2*q);
  const [sx,sy,sz,radius]=globe,sclera=sz-retraction+Math.sqrt(Math.max(.000002,radius*radius-(x-sx)*(x-sx)-(y-sy)*(y-sy)));
  const cornea=x*x+y*y<.0093*.0093?-.0048-COMPACT_EYE_ANATOMY.recess-retraction+Math.sqrt(Math.max(0,.0096*.0096-x*x-y*y)):sclera;
  const h=clamp(.5+.5*(sclera-cornea)/.0003,0,1);
  return cornea+(sclera-cornea)*h+.0003*h*(1-h)+.00028;
}
// Every pose reconstructs the whole meridian. The outer position and tangent
// remain fixed; the free inner margin travels across the eye contact surface.
function compactEyePatchPoint(angle,t,side,outer,gradient,globe,corners,state=[0,0,0],margin=0){
  const c=Math.cos(angle),s=Math.sin(angle),canthus=s*s,lateral=c*(side==='left'?1:-1),neutral=compactEyeNeutralFissure(angle,side);
  const ex=neutral[0],restY=neutral[1];
  const dy=((s>=0?-.0022:.0014)*state[0]+(s>=0?.0019:-.0004)*state[1])*canthus;
  const blinkCanthus=COMPACT_EYE_ANATOMY.fissure.lateralCanthusLift*lateral*(1+2*canthus*(1-canthus)**3);
  const blinkY=blinkCanthus+(.00035*lateral-.0024)*canthus*canthus;
  const ey=(restY+dy)*(1-state[2])+blinkY*state[2];
  const x=ex+(outer[0]-ex)*t,y=ey+(outer[1]-ey)*t,dx=outer[0]-ex,dyRadial=outer[1]-ey;
  const base=compactEyeContactDepth(ex,ey,globe,state[2]),corner=c<0?corners[0]:corners[1];
  const a=clamp((Math.abs(c)-.76)/.22,0,1),cornerWeight=a*a*(3-2*a),inner=base+(Math.max(base,corner)-base)*cornerWeight;
  const eps=.0001,slope=((compactEyeContactDepth(ex+eps,ey,globe,state[2])-compactEyeContactDepth(ex-eps,ey,globe,state[2]))*dx+(compactEyeContactDepth(ex,ey+eps,globe,state[2])-compactEyeContactDepth(ex,ey-eps,globe,state[2]))*dyRadial)/(2*eps);
  // Limit forward overshoot, but allow recession between similar-depth ends.
  // A fully monotone limiter flattened the closed lid and bunched its rim.
  // The contact floor below prevents the receding curve entering the optics.
  const delta=outer[2]+.00004-inner,m1=clamp(gradient[0]*dx+gradient[1]*dyRadial,-Math.min(.020,3*Math.max(0,-delta)+.0003),.020);
  const m0=clamp(slope*(1-cornerWeight)+m1*cornerWeight,-.020,Math.min(.020,3*Math.max(0,delta)+.0003)),t2=t*t,t3=t2*t;
  // The upper fold opens as the lid closes. It is a local transition outside
  // the pretarsal surface, rather than an equally thick ring around the eye.
  const p=COMPACT_EYE_ANATOMY.fissure,envelope=16*t2*(1-t)*(1-t),upperFold=-.00065*Math.max(0,s)*Math.exp(-(((t-.58)/.12)**2))*envelope*(1-state[2])**2;
  const lowerSulcus=-p.lowerSulcusM*Math.max(0,-s)*Math.exp(-(((t-.58)/.17)**2))*envelope*(1-.55*state[2]),fold=upperFold+lowerSulcus;
  let depth=(2*t3-3*t2+1)*inner+(t3-2*t2+t)*m0+(-2*t3+3*t2)*(outer[2]+.00004)+(t3-t2)*m1+.00008*envelope+fold;
  const contact=compactEyeContactDepth(x,y,globe,state[2]),h=clamp(.5+.5*(depth-contact)/.00008,0,1),supported=contact+(depth-contact)*h+.00008*h*(1-h);
  const q=clamp((t-.80)/.16,0,1);depth+=(supported-depth)*(1-q*q*(3-2*q));
  const rimT=clamp((t-.82)/.18,0,1),rimWeight=rimT*rimT*(3-2*rimT),rimSlope=clamp(gradient[0]*dx+gradient[1]*dyRadial,-.020,.020);
  depth+=(outer[2]+.00004+(t-1)*rimSlope-depth)*rimWeight;
  return [x,y,depth+margin];
}
function compactCreateEyeLids(meshes,eyeFrames,rig,statureScale){
  const output=[],socketRadii=[],canthusDepths={},report={revision:COMPACT_EYE_ANATOMY.revision,generatedFrom:'neutral skin aperture and source eye frames',sides:{},triangles:0};
  const head=rig.jointIds.get('head');if(!Number.isInteger(head))throw Error('眼睑缺少头部绑定');
  for(const side of ['left','right']){
    const base=eyeFrames[side],frame={...base,n:norm(cross(base.u,base.v))},sample=compactEyeSkinSampler(meshes,frame),sphere=COMPACT_EYE_ANATOMY[side];
    const count=COMPACT_EYE_ANATOMY.segments,rings=COMPACT_EYE_ANATOMY.rings,edge=[],outer=[];let fitted=0;
    for(let i=0;i<count;i++){
      const angle=i/count*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle),dx=.013*c,dy=.0052*s;
      let boundary=1,found=false;
      for(let r=.35;r<2.7;r+=.04){if(sample(dx*r,dy*r)!==null){boundary=r;found=true;break;}}
      if(found){fitted++;let lo=boundary-.04,hi=boundary;for(let j=0;j<9;j++){const mid=(lo+hi)/2;if(sample(dx*mid,dy*mid)===null)lo=mid;else hi=mid;}boundary=hi;}
      // The original eye opening remains the authority; only a small tissue
      // margin extends into it, creating thickness instead of a painted line.
      boundary=clamp(boundary,.65,1.75);const x=dx*boundary,y=dy*boundary;
      // The fitted source opening contains local folds. Regularize its free
      // inner tissue margin to an almond while anchoring the outer skin fit.
      edge.push(compactEyeNeutralFissure(angle,side));
      const r=Math.hypot(x,y),ox=x*(1+.0055/r),oy=y*(1+.0055/r),z=sample(ox,oy);
      const eps=.00025,zx1=sample(ox+eps,oy),zx0=sample(ox-eps,oy),zy1=sample(ox,oy+eps),zy0=sample(ox,oy-eps);
      outer.push([ox,oy,z??.008,zx1!==null&&zx0!==null?(zx1-zx0)/(2*eps):0,zy1!==null&&zy0!==null?(zy1-zy0)/(2*eps):0]);
    }
    // Regularize the fitted closed boundary before taking angular derivatives.
    const original=outer.map(row=>row.slice());
    for(let i=0;i<count;i++)for(let k=0;k<5;k++){let sum=0,weight=0;for(let d=-5;d<=5;d++){const w=Math.exp(-d*d/8);sum+=original[(i+d+count)%count][k]*w;weight+=w;}outer[i][k]=sum/weight;}
    for(const o of outer){const e=.001,z=sample(o[0],o[1]),xp=sample(o[0]+e,o[1]),xm=sample(o[0]-e,o[1]),yp=sample(o[0],o[1]+e),ym=sample(o[0],o[1]-e);if(z!==null)o[2]=z;if(xp!==null&&xm!==null)o[3]=(xp-xm)/(2*e);if(yp!==null&&ym!==null)o[4]=(yp-ym)/(2*e);}
    const interpolate=(rows,angle)=>{const f=((angle/(2*Math.PI)%1)+1)%1*count,i=Math.floor(f),t=f-i;return rows[i].map((x,j)=>x+(rows[(i+1)%count][j]-x)*t);};
    const sphereLocal=sub(sphere.centre,frame.centre),globe=[dot(sphereLocal,frame.u),dot(sphereLocal,frame.v),dot(sphereLocal,frame.n)-COMPACT_EYE_ANATOMY.recess,sphere.radius];
    const contactDepth=(x,y)=>compactEyeContactDepth(x,y,globe);
    const cornerDepth=[count/2,0].map(i=>Math.max(contactDepth(...edge[i]),Math.min(outer[i][2]+.0002,contactDepth(...edge[i])+.0025)));
    canthusDepths[side]=cornerDepth;
    const canthusBlend=angle=>{const t=clamp((Math.abs(Math.cos(angle))-.76)/.22,0,1);return t*t*(3-2*t);};
    const innerDepth=(angle,x,y)=>{const z=contactDepth(x,y),corner=cornerDepth[Math.cos(angle)<0?0:1];return z+(Math.max(z,corner)-z)*canthusBlend(angle);};
    const localPoint=(angle,t,margin=false)=>{const o=interpolate(outer,angle);return compactEyePatchPoint(angle,t,side,o,o.slice(3),globe,cornerDepth,[0,0,0],margin?.00007:0);};
    const point=(angle,t,margin=false)=>{const p=localPoint(angle,t,margin);return add(frame.centre,add(mul(frame.u,p[0]),add(mul(frame.v,p[1]),mul(frame.n,p[2]))));};
    function meshPart(name,radialStart,radialEnd,nr){
      const positions=[],normals=[],params=[],tangentU=[],tangentV=[],outerPosition=[],outerTangentU=[],outerGradient=[],outerGradientU=[],indices=[],epsilon=.002;
      for(let i=0;i<=count;i++)for(let j=0;j<=nr;j++){
        const angle=i/count*2*Math.PI,t=radialStart+(radialEnd-radialStart)*j/nr,p=point(angle,t,name==='eyeLidMargin');
        const tu=mul(sub(point(angle+epsilon,t),point(angle-epsilon,t)),1/(2*epsilon));
        const tv=mul(sub(point(angle,t+epsilon),point(angle,t-epsilon)),1/(2*epsilon));
        const da=2*Math.PI/count,dr=(radialEnd-radialStart)/nr;
        const normalU=sub(point(angle+da,t,name==='eyeLidMargin'),point(angle-da,t,name==='eyeLidMargin'));
        const normalV=sub(point(angle,Math.min(radialEnd,t+dr),name==='eyeLidMargin'),point(angle,Math.max(radialStart,t-dr),name==='eyeLidMargin'));
        let n=norm(cross(normalV,normalU));if(dot(n,frame.n)<0)n=mul(n,-1);
        positions.push(...p);normals.push(...compactEyeEncodeNormal(n));params.push(angle,t);tangentU.push(...tu);tangentV.push(...tv);
        const o=interpolate(outer,angle),op=interpolate(outer,angle+epsilon),om=interpolate(outer,angle-epsilon),du=op.map((v,k)=>(v-om[k])/(2*epsilon));
        outerPosition.push(...o.slice(0,3));outerTangentU.push(...du.slice(0,3));outerGradient.push(...o.slice(3));outerGradientU.push(...du.slice(3));
      }
      for(let i=0;i<count;i++)for(let j=0;j<nr;j++){const a=i*(nr+1)+j,b=a+nr+1;indices.push(a,a+1,b,a+1,b+1,b);}
      const vertices=positions.length/3,ids=new Uint16Array(vertices*COMPACT_INFLUENCES),weights=new Uint16Array(ids.length),colors=new Uint8Array(vertices*3);
      for(let i=0;i<vertices;i++){ids[i*COMPACT_INFLUENCES]=head;weights[i*COMPACT_INFLUENCES]=65535;colors.set([190,160,132],i*3);}
      const canonicalPositions=Float32Array.from(positions);
      output.push({name,eyeSide:side,eyeLid:true,sourceGroup:'procedural-eye-tissue',origin:[0,0,0],extent:[1,1,1],vertices,triangles:indices.length/3,
        canonicalPositions,positions:Float32Array.from(positions,p=>p*statureScale),normals:Int16Array.from(normals),indices:Uint16Array.from(indices),
        eyeParams:Float32Array.from(params),eyeTangentU:Float32Array.from(tangentU),eyeTangentV:Float32Array.from(tangentV),
        eyeOuterPosition:Float32Array.from(outerPosition),eyeOuterTangentU:Float32Array.from(outerTangentU),eyeOuterGradient:Float32Array.from(outerGradient),eyeOuterGradientU:Float32Array.from(outerGradientU),
        binding:{ids,weights,colors,groupCounts:{head:vertices},maximumWeightError:0}});
      report.triangles+=indices.length/3;
    }
    meshPart('eyeLidSkin',0,1,rings);meshPart('eyeLidMargin',0,.035,2);
    // Replace disconnected source sclera charts with a continuous optical globe.
    // Analytic normals keep the exposed white smooth without baked geometry.
    const globePositions=[],globeNormals=[],globeIndices=[],nuGlobe=96,nvGlobe=32;
    for(let j=0;j<=nvGlobe;j++)for(let i=0;i<=nuGlobe;i++){
      const u=i/nuGlobe*2*Math.PI,v=(j/nvGlobe-.5)*Math.PI,cp=Math.cos(v);
      const local=[cp*Math.cos(u),Math.sin(v),cp*Math.sin(u)];
      const n=add(mul(frame.u,local[0]),add(mul(frame.v,local[1]),mul(frame.n,local[2])));
      const centre=add(sphere.centre,mul(frame.n,-COMPACT_EYE_ANATOMY.recess));
      globePositions.push(...add(centre,mul(n,sphere.radius)));globeNormals.push(...compactEyeEncodeNormal(n));
    }
    for(let j=0;j<nvGlobe;j++)for(let i=0;i<nuGlobe;i++){
      const a=j*(nuGlobe+1)+i,b=a+nuGlobe+1;
      if(j>0)globeIndices.push(a,b,a+1);if(j<nvGlobe-1)globeIndices.push(a+1,b,b+1);
    }
    const globeCount=globePositions.length/3,globeIds=new Uint16Array(globeCount*COMPACT_INFLUENCES),globeWeights=new Uint16Array(globeIds.length);
    for(let i=0;i<globeCount;i++){globeIds[i*COMPACT_INFLUENCES]=head;globeWeights[i*COMPACT_INFLUENCES]=65535;}
    output.push({name:'eyeSclera',eyeSide:side,sourceGroup:'procedural-eye-tissue',origin:[0,0,0],extent:[1,1,1],vertices:globeCount,triangles:globeIndices.length/3,
      canonicalPositions:Float32Array.from(globePositions),positions:Float32Array.from(globePositions,p=>p*statureScale),normals:Int16Array.from(globeNormals),indices:Uint16Array.from(globeIndices),
      binding:{ids:globeIds,weights:globeWeights,colors:new Uint8Array(globeCount*3),groupCounts:{head:globeCount},maximumWeightError:0}});
    report.triangles+=globeIndices.length/3;

    // The iris is an annulus. Its pupil opening needs a dark interior behind
    // the iris plane; placing black pigment on the cornea flattens the eye.
    const pupilPositions=[],pupilNormals=[],pupilIndices=[];
    for(let i=0;i<=64;i++){const angle=i/64*2*Math.PI,r=i===64?0:.0024;
      pupilPositions.push(...add(frame.centre,add(mul(frame.u,r*Math.cos(angle)),add(mul(frame.v,r*Math.sin(angle)),mul(frame.n,-.00055-COMPACT_EYE_ANATOMY.recess)))));
      pupilNormals.push(...compactEyeEncodeNormal(frame.n));if(i<64)pupilIndices.push(64,i,(i+1)%64);
    }
    const pupilIds=new Uint16Array(65*COMPACT_INFLUENCES),pupilWeights=new Uint16Array(pupilIds.length);
    for(let i=0;i<65;i++){pupilIds[i*COMPACT_INFLUENCES]=head;pupilWeights[i*COMPACT_INFLUENCES]=65535;}
    output.push({name:'eyePupil',eyeSide:side,sourceGroup:'procedural-eye-tissue',origin:[0,0,0],extent:[1,1,1],vertices:65,triangles:64,
      canonicalPositions:Float32Array.from(pupilPositions),positions:Float32Array.from(pupilPositions,p=>p*statureScale),normals:Int16Array.from(pupilNormals),indices:Uint16Array.from(pupilIndices),
      binding:{ids:pupilIds,weights:pupilWeights,colors:new Uint8Array(65*3),groupCounts:{head:65},maximumWeightError:0}});
    report.triangles+=64;
    // A small caruncle bridges the medial canthus. It is actual curved tissue,
    // with the same head binding, rather than a red mark painted on the sclera.
    const medial=side==='left'?-1:1,tx=medial*.01055,ty=-.00030,tz=innerDepth(medial<0?Math.PI:0,tx,ty)-.00008;
    const tearPositions=[],tearNormals=[],tearIndices=[],nu=24,nv=10;
    for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
      const u=i/nu*2*Math.PI,v=(j/nv-.5)*Math.PI,cp=Math.cos(v),sp=Math.sin(v);
      const local=[.00085*cp*Math.cos(u),.00048*sp,.00035*cp*Math.sin(u)];
      const n=norm(add(mul(frame.u,cp*Math.cos(u)/.00085),add(mul(frame.v,sp/.00048),mul(frame.n,cp*Math.sin(u)/.00035))));
      tearPositions.push(...add(frame.centre,add(mul(frame.u,tx+local[0]),add(mul(frame.v,ty+local[1]),mul(frame.n,tz+local[2])))));
      tearNormals.push(...compactEyeEncodeNormal(n));
    }
    for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+nu+1;if(j>0)tearIndices.push(a,b,a+1);if(j<nv-1)tearIndices.push(a+1,b,b+1);}
    const tearCount=tearPositions.length/3,tearIds=new Uint16Array(tearCount*COMPACT_INFLUENCES),tearWeights=new Uint16Array(tearIds.length);
    for(let i=0;i<tearCount;i++){tearIds[i*COMPACT_INFLUENCES]=head;tearWeights[i*COMPACT_INFLUENCES]=65535;}
    output.push({name:'eyeTearDuct',eyeSide:side,sourceGroup:'procedural-eye-tissue',origin:[0,0,0],extent:[1,1,1],vertices:tearCount,triangles:tearIndices.length/3,
      canonicalPositions:Float32Array.from(tearPositions),positions:Float32Array.from(tearPositions,p=>p*statureScale),normals:Int16Array.from(tearNormals),indices:Uint16Array.from(tearIndices),
      binding:{ids:tearIds,weights:tearWeights,colors:new Uint8Array(tearCount*3),groupCounts:{head:tearCount},maximumWeightError:0}});
    report.triangles+=tearIndices.length/3;
    report.sides[side]={fittedRays:fitted,totalRays:count,canthusDepthMm:cornerDepth.map(v=>v*1000),horizontalOpeningMm:[Math.min(...edge.map(p=>p[0]))*1000,Math.max(...edge.map(p=>p[0]))*1000],verticalOpeningMm:[Math.min(...edge.map(p=>p[1]))*1000,Math.max(...edge.map(p=>p[1]))*1000]};
    // The smoothed outer loop is no longer sampled at exact polar angles.
    // Intersect each mask ray with that loop rather than indexing by row.
    for(let i=0;i<count;i++){const angle=i/count*2*Math.PI,d=[.013*Math.cos(angle),.0052*Math.sin(angle)];let radius=0;
      for(let j=0;j<count;j++){const a=outer[j],b=outer[(j+1)%count],e=[b[0]-a[0],b[1]-a[1]],den=d[0]*e[1]-d[1]*e[0];if(Math.abs(den)<1e-14)continue;
        const t=(a[0]*d[1]-a[1]*d[0])/den,r=(a[0]*e[1]-a[1]*e[0])/den;if(t>=-1e-6&&t<=1.000001&&r>0)radius=Math.max(radius,r);}
      socketRadii.push(radius||Math.hypot(outer[i][0]/.013,outer[i][1]/.0052));}
  }
  return {meshes:output,report,canthusDepths,socketRadii:Float32Array.from(socketRadii)};
}
const COMPACT_EYE_LID_GLSL=`
layout(location=8)in vec2 eyeLidParam;
layout(location=9)in vec3 eyeLidTangentU;
layout(location=10)in vec3 eyeLidTangentV;
layout(location=11)in vec3 eyeOuterPosition;
layout(location=12)in vec3 eyeOuterTangentU;
layout(location=13)in vec2 eyeOuterGradient;
layout(location=14)in vec2 eyeOuterGradientU;
uniform float compactEyeLid,compactEyeSide,compactSourceEye,compactLidState[6];
uniform vec3 compactEyeCentre,compactEyeU,compactEyeV,compactEyeNormal;
uniform vec4 compactEyeGlobe;
uniform vec2 compactCanthusDepth;
float compactLidContact(float x,float y){
  int sideOffset=compactEyeSide<.5?0:3;
  float blinkQ=clamp((compactLidState[sideOffset+2]-.35)/.65,0.,1.),retraction=${COMPACT_EYE_ANATOMY.blinkRetractionM}*blinkQ*blinkQ*(3.-2.*blinkQ);
  float sx=compactEyeGlobe.x,sy=compactEyeGlobe.y,sz=compactEyeGlobe.z,radius=compactEyeGlobe.w;
  float sclera=sz-retraction+sqrt(max(.000002,radius*radius-(x-sx)*(x-sx)-(y-sy)*(y-sy)));
  float cornea=x*x+y*y<.0093*.0093?-.0048-(${COMPACT_EYE_ANATOMY.recess.toFixed(6)})-retraction+sqrt(max(0.,.0096*.0096-x*x-y*y)):sclera;
  float h=clamp(.5+.5*(sclera-cornea)/.0003,0.,1.);
  return mix(cornea,sclera,h)+.0003*h*(1.-h)+.00028;
}
vec3 compactLidPatchLocal(float angle,float t,vec3 outer,vec2 gradient){
  int offset=compactEyeSide<.5?0:3;
  float narrow=compactLidState[offset],wide=compactLidState[offset+1],blink=compactLidState[offset+2];
  float c=cos(angle),s=sin(angle),vertical=abs(s),canthus=vertical*vertical,lateral=c*(compactEyeSide<.5?1.:-1.);
  float cornerLift=${COMPACT_EYE_ANATOMY.fissure.lateralCanthusLift.toFixed(6)}*lateral*(1.-canthus);
  float height=s>=0.?${COMPACT_EYE_ANATOMY.fissure.upperHeight.toFixed(6)}*(1.+${COMPACT_EYE_ANATOMY.fissure.upperTemporalBias.toFixed(6)}*lateral):${COMPACT_EYE_ANATOMY.fissure.lowerHeight.toFixed(6)}*(1.-${COMPACT_EYE_ANATOMY.fissure.lowerTemporalBias.toFixed(6)}*lateral);
  float ex=${COMPACT_EYE_ANATOMY.fissure.halfWidth.toFixed(6)}*c,restY=(s>=0.?1.:-1.)*height*vertical*(${(1-COMPACT_EYE_ANATOMY.fissure.verticalRoundness).toFixed(6)}+${COMPACT_EYE_ANATOMY.fissure.verticalRoundness.toFixed(6)}*vertical)+cornerLift;
  float dy=((s>=0.?-.0022:.0014)*narrow+(s>=0.?.0019:-.0004)*wide)*canthus;
  float blinkCanthus=${COMPACT_EYE_ANATOMY.fissure.lateralCanthusLift.toFixed(6)}*lateral*(1.+2.*canthus*pow(1.-canthus,3.));
  float blinkY=blinkCanthus+(.00035*lateral-.0024)*canthus*canthus;
  float ey=mix(restY+dy,blinkY,blink);
  float x=mix(ex,outer.x,t),y=mix(ey,outer.y,t),dx=outer.x-ex,dyRadial=outer.y-ey;
  float base=compactLidContact(ex,ey),corner=c<0.?compactCanthusDepth.x:compactCanthusDepth.y;
  float a=clamp((abs(c)-.76)/.22,0.,1.),cornerWeight=a*a*(3.-2.*a),inner=mix(base,max(base,corner),cornerWeight);
  float eps=.0001,slope=((compactLidContact(ex+eps,ey)-compactLidContact(ex-eps,ey))*dx+(compactLidContact(ex,ey+eps)-compactLidContact(ex,ey-eps))*dyRadial)/(2.*eps);
  float delta=outer.z+.00004-inner,m1=clamp(gradient.x*dx+gradient.y*dyRadial,-min(.020,3.*max(0.,-delta)+.0003),.020);
  float m0=clamp(mix(slope,m1,cornerWeight),-.020,min(.020,3.*max(0.,delta)+.0003)),t2=t*t,t3=t2*t;
  float envelope=16.*t2*(1.-t)*(1.-t),upperFold=-.00065*max(0.,s)*exp(-pow((t-.58)/.12,2.))*envelope*(1.-blink)*(1.-blink);
  float lowerSulcus=-${COMPACT_EYE_ANATOMY.fissure.lowerSulcusM.toFixed(6)}*max(0.,-s)*exp(-pow((t-.58)/.17,2.))*envelope*(1.-.55*blink),fold=upperFold+lowerSulcus;
  float depth=(2.*t3-3.*t2+1.)*inner+(t3-2.*t2+t)*m0+(-2.*t3+3.*t2)*(outer.z+.00004)+(t3-t2)*m1+.00008*envelope+fold;
  float contact=compactLidContact(x,y),h=clamp(.5+.5*(depth-contact)/.00008,0.,1.),supported=mix(contact,depth,h)+.00008*h*(1.-h);
  float q=clamp((t-.80)/.16,0.,1.),finalDepth=depth+(supported-depth)*(1.-q*q*(3.-2.*q))+(compactEyeLid>1.5?.00007:0.);
  float rimT=clamp((t-.82)/.18,0.,1.),rimWeight=rimT*rimT*(3.-2.*rimT),rimSlope=clamp(gradient.x*dx+gradient.y*dyRadial,-.020,.020);
  float rimDepth=outer.z+.00004+(t-1.)*rimSlope+(compactEyeLid>1.5?.00007:0.);
  float finalRimDepth=mix(finalDepth,rimDepth,rimWeight);
  return vec3(x,y,finalRimDepth);
}
vec3 compactLidLocalPoint(vec2 param){
  float da=param.x-eyeLidParam.x;
  return compactLidPatchLocal(param.x,param.y,eyeOuterPosition+eyeOuterTangentU*da,eyeOuterGradient+eyeOuterGradientU*da);
}
vec3 compactLidLocalNormal(vec2 param){
  // Use the displayed grid's neighbours. Infinitesimal normals can turn away
  // from the actual coarse triangle where the closed contact curve bends.
  float da=6.28318530718/${COMPACT_EYE_ANATOMY.segments}.,dr=compactEyeLid>1.5?.0175:1./${COMPACT_EYE_ANATOMY.rings}.;
  float limit=compactEyeLid>1.5?.035:1.;
  vec3 tu=compactLidLocalPoint(param+vec2(da,0.))-compactLidLocalPoint(param-vec2(da,0.));
  vec3 tv=compactLidLocalPoint(vec2(param.x,min(limit,param.y+dr)))-compactLidLocalPoint(vec2(param.x,max(0.,param.y-dr)));
  return cross(tv,tu);
}
vec3 compactLidPosition(vec3 p,vec2 param){
  vec3 local=compactLidLocalPoint(param);
  return compactEyeCentre+compactEyeU*local.x+compactEyeV*local.y+compactEyeNormal*local.z;
}
void compactLid(inout vec3 p,inout vec3 n){
  if(compactEyeLid<.5)return;
  vec3 normal=compactLidLocalNormal(eyeLidParam);
  if(dot(normal,normal)<1e-22){
    // The closed margin has zero angular speed at a canthus. Average its two
    // posed side limits; do not reuse an unrelated undeformed surface normal.
    vec2 at=vec2(eyeLidParam.x,max(eyeLidParam.y,.003));
    vec3 a=compactLidLocalNormal(at+vec2(.008,0.)),b=compactLidLocalNormal(at-vec2(.008,0.));
    if(a.z<0.)a=-a;if(b.z<0.)b=-b;
    normal=a/max(length(a),1e-20)+b/max(length(b),1e-20);
  }
  if(normal.z<0.)normal=-normal;
  if(dot(normal,normal)<1e-22)normal=vec3(-eyeOuterGradient,1.);
  normal=normalize(normal);n=normalize(compactEyeU*normal.x+compactEyeV*normal.y+compactEyeNormal*normal.z);
  p=compactLidPosition(p,eyeLidParam);
}`;
function compactEyeSocketSource(){
  const frame=side=>{const f=COMPACT_EYES[side],n=norm(f.normal),u=norm(cross([0,1,0],n));return {centre:f.centre,u,v:norm(cross(n,u)),n};};
  const left=frame('left'),right=frame('right'),vector=v=>'vec3('+v.map(x=>x.toFixed(9)).join(',')+')';
  return `uniform float compactSkinSocket;uniform vec4 compactSocketRadii[48];
  float compactSocketValue(int i){return compactSocketRadii[i/4][i%4];}
  void compactEyeSocket(vec3 source){
    if(compactSkinSocket<.5||source.y<1.491||source.y>1.546||source.z<.139||abs(source.x)<.008||abs(source.x)>.057)return;
    bool left=source.x>0.;vec3 q=source-(left?${vector(left.centre)}:${vector(right.centre)});
    vec3 u=left?${vector(left.u)}:${vector(right.u)},v=left?${vector(left.v)}:${vector(right.v)},n=left?${vector(left.n)}:${vector(right.n)};
    if(dot(q,n)<-.010)return;vec2 uv=vec2(dot(q,u)/.013,dot(q,v)/.0052);
    float angle=atan(uv.y,uv.x);if(angle<0.)angle+=6.28318530718;
    float f=angle/6.28318530718*96.;int i=int(f),base=left?0:96;
    float outer=mix(compactSocketValue(base+i),compactSocketValue(base+(i+1)%96),fract(f));
    // Replace only the skin covered by the fitted annular tissue. Both colour
    // and depth use this exact boundary; a narrow outer overlap seals the join.
    if(length(uv)<outer*.97)discard;
  }`;
}
