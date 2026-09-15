/* Dense, source-fitted facial skin with authored secondary anatomical forms.
 * The temporary grid and fibres are generated at upload; only these parameters
 * persist. This is a geometric refinement, not measured anatomy or a scan. */
const COMPACT_FACE_ANATOMY={revision:'r12-perioral-chin-continuity',columns:160,rows:176,
  bounds:[-.073,.072,1.425,1.579],ellipse:[-.0005,1.503,.069,.073],
  smoothingRadiusM:.0045,nostrils:{x:.0090,y:1.4778,rx:.00345,ry:.00205,tilt:.16,depth:.0052},
  lips:{centreX:-.0006,halfWidth:.0244,seamY:1.4587,apron:1.36,innerDepth:.0027,columns:160,rings:36,
    // Authored landmarks and sectional rails, visually informed by VAA and Ten24.
    // Rows: abs(horizontal parameter), fissure, upper border, lower border (m).
    outline:[[0,-.00035,.00325,-.00460],[.18,.00015,.00395,-.00475],[.38,.00045,.00355,-.00420],[.62,.00015,.00245,-.00320],[.82,-.00010,.00110,-.00190],[.94,-.00022,.00018,-.00065],[1,-.00028,-.00028,-.00028]],
    upperSection:[[0,.00155],[.18,.00175],[.45,.00162],[.78,.00130],[1,.00100],[1.08,.00100],[1.20,.00050],[1.36,0]],
    lowerSection:[[0,.00155],[.20,.00195],[.48,.00220],[.75,.00205],[1,.00145],[1.10,.00078],[1.24,.00032],[1.36,0]],
    whiteRollUpper:.00012,whiteRollLower:.00005,whiteRollCentre:1.045,whiteRollWidth:.065},
  perioral:{philtrumY:1.4690,ridgeX:.0032,ridgeRx:.0021,ridgeRy:.0090,ridgeHeight:.00030,grooveRx:.0035,grooveRy:.0095,grooveDepth:.00022,
    labiomentalY:1.4450,labiomentalRx:.0230,labiomentalRy:.0048,labiomentalDepth:.00038,
    mentalisY:1.4355,mentalisRx:.0210,mentalisRy:.0060,mentalisHeight:.00072},
  nose:{knots:[[1.465,.1900,.0135],[1.471,.1905,.0125],[1.476,.1930,.0100],[1.481,.1990,.0088],[1.486,.2035,.0088],[1.490,.2025,.0092],[1.496,.1985,.0102],[1.506,.1930,.0115],[1.518,.1870,.0125],[1.530,.1810,.0150],[1.538,.1780,.0190]],
    underturn:[[1.465,0],[1.471,.0004],[1.476,.0014],[1.480,-.0021],[1.486,-.0008],[1.494,0]],underturnWidth:.0225,underturnCentreWeight:.30,columellaDrop:.0016,
    tipY:1.486,tipRx:.0105,tipRy:.0072,tipHeight:.00035,domeX:.0046,domeRx:.0048,domeRy:.0058,domeHeight:.00125,
    alarX:.0140,alarY:1.4805,alarRx:.0058,alarRy:.0056,alarHeight:.0018,alarGrooveX:.0170,alarGrooveY:1.4870,alarGrooveRx:.0048,alarGrooveRy:.0085,alarGrooveDepth:.00072,
    sidewallX:.0145,sidewallY:1.503,sidewallRx:.0090,sidewallRy:.0180,sidewallHeight:.00030,columellaHeight:.00155},
  forms:[
    ...[-1,1].flatMap(side=>[
      {id:'orbitalTransition',x:side*.030,y:1.532,rx:.029,ry:.018,z:-.00032},
      {id:'upperLidSulcus',x:side*.030,y:1.538,rx:.021,ry:.0075,z:-.00012},
      {id:'infraorbitalTransition',x:side*.030,y:1.505,rx:.028,ry:.017,z:-.00022},
      {id:'lowerLidTransition',x:side*.030,y:1.500,rx:.023,ry:.0075,z:-.00006},
      {id:'malarVolume',x:side*.037,y:1.493,rx:.023,ry:.016,z:.00055},
      {id:'philtralColumn',x:side*.0028,y:1.470,rx:.0025,ry:.007,z:.00020}
    ])],brow:{strandsPerSide:900,segments:4,widthM:.00009}};
function compactFaceRaySampler(meshes){
  const bins=new Map(),size=.004;
  for(const m of meshes){if(m.name!=='skin')continue;const p=m.canonicalPositions;
    for(let k=0;k<m.indices.length;k+=3){const ia=m.indices[k]*3,ib=m.indices[k+1]*3,ic=m.indices[k+2]*3;if(Math.max(p[ia+1],p[ib+1],p[ic+1])<1.420||Math.min(p[ia+1],p[ib+1],p[ic+1])>1.58||Math.max(p[ia+2],p[ib+2],p[ic+2])<.12)continue;const a=Array.from(p.subarray(ia,ia+3)),b=Array.from(p.subarray(m.indices[k+1]*3,m.indices[k+1]*3+3)),c=Array.from(p.subarray(m.indices[k+2]*3,m.indices[k+2]*3+3));
      const loX=Math.min(a[0],b[0],c[0]),hiX=Math.max(a[0],b[0],c[0]),loY=Math.min(a[1],b[1],c[1]),hiY=Math.max(a[1],b[1],c[1]);
      if(loX>.08||hiX<-.08||loY>1.58||hiY<1.420||Math.max(a[2],b[2],c[2])<.12)continue;
      const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-13)continue;
      const tri={a,b,c,den};for(let i=Math.floor(Math.max(-.08,loX)/size);i<=Math.floor(Math.min(.08,hiX)/size);i++)for(let j=Math.floor(Math.max(1.420,loY)/size);j<=Math.floor(Math.min(1.58,hiY)/size);j++){const key=i+'/'+j,list=bins.get(key)||[];list.push(tri);bins.set(key,list);}
    }
  }
  return (x,y)=>{let best=null;for(const {a,b,c,den} of bins.get(Math.floor(x/size)+'/'+Math.floor(y/size))||[]){const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den;if(u<-.000001||v<-.000001||u+v>1.000001)continue;const z=u*a[2]+v*b[2]+(1-u-v)*c[2];if(z>.12)best=Math.max(best??-Infinity,z);}return best;};
}
function compactFaceFormDepth(x,y){
  let depth=0;for(const f of COMPACT_FACE_ANATOMY.forms){const r=Math.hypot((x-f.x)/f.rx,(y-f.y)/f.ry);if(r<1)depth+=f.z*(1-r)**4*(1+4*r);}
  const n=COMPACT_FACE_ANATOMY.nostrils;for(const side of [-1,1]){const r=Math.hypot((x-side*n.x)/n.rx,(y-n.y-n.tilt*(side*x-n.x))/n.ry);if(r<2.5)depth+=.00040*Math.exp(-(((r-1.18)/.48)**2));}
  return depth;
}
function compactFaceBump(x,y,cx,cy,rx,ry,amplitude){
  const r=Math.hypot((x-cx)/rx,(y-cy)/ry);return r<1?amplitude*(1-r)**4*(1+4*r):0;
}
function compactPerioralDepth(x,y){
  const p=COMPACT_FACE_ANATOMY.perioral;
  const ridges=compactFaceBump(x,y,-p.ridgeX,p.philtrumY,p.ridgeRx,p.ridgeRy,p.ridgeHeight)+compactFaceBump(x,y,p.ridgeX,p.philtrumY,p.ridgeRx,p.ridgeRy,p.ridgeHeight);
  const groove=compactFaceBump(x,y,0,p.philtrumY,p.grooveRx,p.grooveRy,-p.grooveDepth);
  const crease=compactFaceBump(x,y,0,p.labiomentalY,p.labiomentalRx,p.labiomentalRy,-p.labiomentalDepth);
  const chin=compactFaceBump(x,y,0,p.mentalisY,p.mentalisRx,p.mentalisRy,p.mentalisHeight);
  return ridges+groove+crease+chin;
}
// Shape-preserving cubic rails retain the intended peaks without overshoot.
function compactLipTangent(rows,i,k,freeSlope=false,endSlope=false){
  if(i===0)return freeSlope?(rows[1][k]-rows[0][k])/(rows[1][0]-rows[0][0]):0;
  if(i===rows.length-1)return endSlope?(rows[i][k]-rows[i-1][k])/(rows[i][0]-rows[i-1][0]):0;
  const a=rows[i-1],b=rows[i],c=rows[i+1],h0=b[0]-a[0],h1=c[0]-b[0],d0=(b[k]-a[k])/h0,d1=(c[k]-b[k])/h1;
  if(d0*d1<=0)return 0;
  const w0=2*h1+h0,w1=h1+2*h0;return (w0+w1)/(w0/d0+w1/d1);
}
function compactLipCurve(rows,x,k=1,freeSlope=false,endSlope=false){
  if(x<=rows[0][0])return rows[0][k];if(x>=rows[rows.length-1][0])return rows[rows.length-1][k];
  let i=0;while(i<rows.length-2&&x>rows[i+1][0])i++;
  const a=rows[i],b=rows[i+1],span=b[0]-a[0],t=(x-a[0])/span,t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*a[k]+(t3-2*t2+t)*span*compactLipTangent(rows,i,k,freeSlope,endSlope)+(-2*t3+3*t2)*b[k]+(t3-t2)*span*compactLipTangent(rows,i+1,k,freeSlope,endSlope);
}
function compactLipOutline(x){
  const p=COMPACT_FACE_ANATOMY.lips,u=clamp((x-p.centreX)/p.halfWidth,-1,1),envelope=Math.max(0,1-u*u),a=Math.abs(u),asym=.00010*u*envelope;
  return {u,envelope,seam:p.seamY+compactLipCurve(p.outline,a,1,false,true)+asym,top:p.seamY+compactLipCurve(p.outline,a,2,false,true)+asym,bottom:p.seamY+compactLipCurve(p.outline,a,3,false,true)+asym};
}
// The first section turns around the free edge in 3D: dy/dr reaches zero at
// contact, while dz/dr stays positive. It joins the returning inner lip.
function compactLipRadial(r){const width=.16;if(r>=width)return r;const t=r/width;return width*(2*t*t-t*t*t);}
function compactLipReliefDepth(u,t,upper){
  const p=COMPACT_FACE_ANATOMY.lips,r=t*p.apron,envelope=Math.pow(Math.max(0,1-u*u),.82);
  const base=compactLipCurve(upper?p.upperSection:p.lowerSection,r,1,true);
  const pad=upper?Math.exp(-((u/.22)**2)):Math.exp(-(((Math.abs(u)-.28)/.25)**2));
  const swell=(upper?.00034:.00018)*pad*Math.sin(Math.PI*Math.min(1,r))*Math.max(0,1-r);
  const attach=clamp((p.apron-r)/(p.apron-p.whiteRollCentre),0,1),attachGate=attach*attach*(3-2*attach);
  const whiteRoll=(upper?p.whiteRollUpper:p.whiteRollLower)*Math.exp(-(((r-p.whiteRollCentre)/p.whiteRollWidth)**2))*Math.pow(Math.max(0,1-u*u),1.25)*attachGate;
  return envelope*(base+swell)+whiteRoll;
}
// The nasal base turns beneath the tip. Its parameter y is deliberately not
// the displayed y: an undercut can have several depths at one front projection.
function compactNasalUnderturn(x,y){
  const p=COMPACT_FACE_ANATOMY.nose,k=p.underturn;if(y<=k[0][0]||y>=k[k.length-1][0])return 0;
  let i=0;while(i<k.length-2&&y>k[i+1][0])i++;const a=k[i],b=k[i+1],t=clamp((y-a[0])/(b[0]-a[0]),0,1);
  const sideWeight=p.underturnCentreWeight+(1-p.underturnCentreWeight)*Math.exp(-(((Math.abs(x)-.0095)/.0055)**2));
  return (a[1]+(b[1]-a[1])*t*t*(3-2*t))*Math.max(0,1-(x/p.underturnWidth)**2)**2*sideWeight-p.columellaDrop*Math.exp(-((x/.0045)**2)-((y-1.480)/.0045)**2);
}
function compactFaceGeneratedMesh(name,positions,normals,indices,head,scale){
  const vertices=positions.length/3,ids=new Uint16Array(vertices*COMPACT_INFLUENCES),weights=new Uint16Array(ids.length);
  for(let i=0;i<vertices;i++){ids[i*COMPACT_INFLUENCES]=head;weights[i*COMPACT_INFLUENCES]=65535;}
  return {name,sourceGroup:'procedural-facial-anatomy',origin:[0,0,0],extent:[1,1,1],vertices,triangles:indices.length/3,
    canonicalPositions:Float32Array.from(positions),positions:Float32Array.from(positions,p=>p*scale),normals:Int16Array.from(normals),indices:Uint16Array.from(indices),
    binding:{ids,weights,colors:new Uint8Array(vertices*3),groupCounts:{head:vertices},maximumWeightError:0}};
}
function compactCreateFaceAnatomy(meshes,rig,scale){
  const p=COMPACT_FACE_ANATOMY,nx=p.columns,ny=p.rows,[x0,x1,y0,y1]=p.bounds,dx=(x1-x0)/nx,dy=(y1-y0)/ny,head=rig.jointIds.get('head');
  if(!Number.isInteger(head))throw Error('面部结构缺少头部绑定');
  const sample=compactFaceRaySampler(meshes),raw=new Float64Array((nx+1)*(ny+1)),valid=new Uint8Array(raw.length),height=new Float64Array(raw.length);let observed=0;
  const at=(i,j)=>j*(nx+1)+i;
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const z=sample(x0+i*dx,y0+j*dy),k=at(i,j);raw[k]=z??NaN;if(z!==null){valid[k]=1;observed++;}}
  // Fill only derivative support inside source apertures. Triangles touching
  // missing samples remain omitted, preserving the eye and mouth openings.
  for(let pass=0;pass<24;pass++){const next=raw.slice();let missing=0;for(let j=1;j<ny;j++)for(let i=1;i<nx;i++){const k=at(i,j);if(Number.isFinite(raw[k]))continue;const near=[raw[k-1],raw[k+1],raw[k-nx-1],raw[k+nx+1]].filter(Number.isFinite);if(near.length)next[k]=near.reduce((a,b)=>a+b,0)/near.length;else missing++;}raw.set(next);if(!missing)break;}
  const [cx,cy,rx,ry]=p.ellipse;
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const k=at(i,j),x=x0+i*dx,y=y0+j*dy,z=Number.isFinite(raw[k])?raw[k]:.16;let sum=0,total=0;
    for(let v=-7;v<=7;v++)for(let u=-7;u<=7;u++){const ii=clamp(i+u,0,nx),jj=clamp(j+v,0,ny),q=raw[at(ii,jj)];if(!Number.isFinite(q))continue;const w=Math.exp(-((u*dx)**2+(v*dy)**2)/(2*p.smoothingRadiusM**2)-(q-z)**2/(2*.010**2));sum+=q*w;total+=w;}
    const r=Math.hypot((x-cx)/rx,(y-cy)/ry),t=clamp((1-r)/.22,0,1),blend=t*t*(3-2*t);
    height[k]=z+blend*((total?sum/total:z)-z+compactFaceFormDepth(x,y))+.00010;
  }
  // Reconstruct the primary nose profile instead of preserving the old slab.
  const nose=p.nose,originalHeight=height.slice(),gridAt=(x,y)=>{const i=clamp(Math.round((x-x0)/dx),0,nx),j=clamp(Math.round((y-y0)/dy),0,ny);return originalHeight[at(i,j)];};
  const profile=y=>{const knots=nose.knots;let i=0;while(i<knots.length-2&&y>knots[i+1][0])i++;const a=knots[i],b=knots[i+1],u=clamp((y-a[0])/(b[0]-a[0]),0,1),prev=knots[Math.max(0,i-1)],next=knots[Math.min(knots.length-1,i+2)],out=[];
    for(let k=1;k<3;k++){const m0=(b[k]-prev[k])/(b[0]-prev[0])*(b[0]-a[0]),m1=(next[k]-a[k])/(next[0]-a[0])*(b[0]-a[0]);out.push((2*u*u*u-3*u*u+1)*a[k]+(u*u*u-2*u*u+u)*m0+(-2*u*u*u+3*u*u)*b[k]+(u*u*u-u*u)*m1);}return out;};
  for(let j=0;j<=ny;j++){const y=y0+j*dy;if(y<=1.465||y>=1.538)continue;const [center,width]=profile(y);let baseline=0,total=0;for(let v=-4;v<=4;v++){const w=Math.exp(-v*v/8);baseline+=(gridAt(-.027,y+v*dy)+gridAt(.027,y+v*dy))*.5*w;total+=w;}baseline/=total;
    for(let i=0;i<=nx;i++){const x=x0+i*dx;if(Math.abs(x)>=.027)continue;const tx=clamp((.027-Math.abs(x))/.008,0,1),ty=clamp(Math.min((y-1.465)/.008,(1.538-y)/.010),0,1),blend=tx*tx*(3-2*tx)*ty*ty*(3-2*ty);
      const ax=Math.abs(x),ridge=(center-baseline)*Math.exp(-.5*(x/width)**2);
      const tip=nose.tipHeight*Math.exp(-((x/nose.tipRx)**2)-(((y-nose.tipY)/nose.tipRy)**2));
      const domes=nose.domeHeight*(Math.exp(-(((x-nose.domeX)/nose.domeRx)**2)-(((y-nose.tipY)/nose.domeRy)**2))+Math.exp(-(((x+nose.domeX)/nose.domeRx)**2)-(((y-nose.tipY)/nose.domeRy)**2)));
      const alar=nose.alarHeight*Math.exp(-(((ax-nose.alarX)/nose.alarRx)**2)-(((y-nose.alarY)/nose.alarRy)**2));
      const groove=-nose.alarGrooveDepth*Math.exp(-(((ax-nose.alarGrooveX)/nose.alarGrooveRx)**2)-(((y-nose.alarGrooveY)/nose.alarGrooveRy)**2));
      const sidewall=nose.sidewallHeight*Math.exp(-(((ax-nose.sidewallX)/nose.sidewallRx)**2)-(((y-nose.sidewallY)/nose.sidewallRy)**2));
      const columella=nose.columellaHeight*Math.exp(-((x/.0032)**2)-(((y-1.4775)/.0042)**2));
      height[at(i,j)]+=(baseline+ridge+tip+domes+alar+groove+sidewall+columella-height[at(i,j)])*blend;}}
  // Remove the inherited lip ridge before constructing vermilion. A bounded
  // Hermite bed preserves the top/bottom skin tangents and the lateral face.
  const oralHeight=height.slice(),readOral=(x,y)=>{const u=clamp((x-x0)/dx,0,nx-.00001),v=clamp((y-y0)/dy,0,ny-.00001),i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j;return (oralHeight[at(i,j)]*(1-a)+oralHeight[at(i+1,j)]*a)*(1-b)+(oralHeight[at(i,j+1)]*(1-a)+oralHeight[at(i+1,j+1)]*a)*b;};
  const oralLo=1.433,oralHi=1.476,oralSpan=oralHi-oralLo;
  // Average the attachment profiles laterally so source triangle gradients do
  // not become vertical bands across the new perioral support.
  const oralProfile=x=>{const row=[0,0,0,0];let total=0;for(let k=-5;k<=5;k++){const xx=x+k*dx,w=Math.exp(-.5*(k*dx/.0023)**2),e=.001;
    const values=[readOral(xx,oralLo),readOral(xx,oralHi),(readOral(xx,oralLo+e)-readOral(xx,oralLo-e))/(2*e),(readOral(xx,oralHi+e)-readOral(xx,oralHi-e))/(2*e)];
    for(let q=0;q<4;q++)row[q]+=values[q]*w;total+=w;}return row.map(v=>v/total);};
  const oralProfiles=Array.from({length:nx+1},(_,i)=>oralProfile(x0+i*dx));
  for(let j=0;j<=ny;j++){const y=y0+j*dy;if(y<=oralLo||y>=oralHi)continue;const t=(y-oralLo)/oralSpan,t2=t*t,t3=t2*t;
    for(let i=0;i<=nx;i++){const x=x0+i*dx,u=clamp((.034-Math.abs(x-p.lips.centreX))/.012,0,1);if(!u)continue;
      const [a,b,d0,d1]=oralProfiles[i],m0=clamp(d0,-.35,.65)*oralSpan,m1=clamp(d1,-.35,.65)*oralSpan;
      const bed=(2*t3-3*t2+1)*a+(t3-2*t2+t)*m0+(-2*t3+3*t2)*b+(t3-t2)*m1;
      const v=clamp(Math.min((y-oralLo)/.011,(oralHi-y)/.011),0,1),blend=u*u*(3-2*u)*v*v*(3-2*v);
      height[at(i,j)]+=(bed-height[at(i,j)])*blend;
    }}
  // Reapply bounded philtral, labiomental and mentalis volumes after the
  // inherited oral ridge has been replaced by its smooth attachment bed.
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const x=x0+i*dx,y=y0+j*dy;height[at(i,j)]+=compactPerioralDepth(x,y);}
  // The oral commissures are shallow three-dimensional insertions, not two
  // sharp lip wedges meeting at a black point.
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    const x=x0+i*dx,y=y0+j*dy,q=compactLipOutline(x),r=Math.hypot((Math.abs(x-p.lips.centreX)-p.lips.halfWidth*.975)/.0044,(y-q.seam)/.0033);
    if(r<1)height[at(i,j)]-=.00034*Math.pow(1-r,4)*(1+4*r);
  }
  const surface=(x,y)=>{const u=clamp((x-x0)/dx,0,nx-.00001),v=clamp((y-y0)/dy,0,ny-.00001),i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j;return (height[at(i,j)]*(1-a)+height[at(i+1,j)]*a)*(1-b)+(height[at(i,j+1)]*(1-a)+height[at(i+1,j+1)]*a)*b;};
  const facePoint=(x,y)=>[x,y+compactNasalUnderturn(x,y),surface(x,y)],faceNormal=(x,y)=>{const e=.00012;return norm(cross(sub(facePoint(x+e,y),facePoint(x-e,y)),sub(facePoint(x,y+e),facePoint(x,y-e))));};
  const positions=[],normals=[],indices=[],parameters=[],vertexMap=new Map(),key=(x,y)=>x.toFixed(10)+'/'+y.toFixed(10),n=p.nostrils;
  const vertex=(x,y)=>{const id=vertexMap.get(key(x,y));if(id!==undefined)return id;const k=positions.length/3;vertexMap.set(key(x,y),k);parameters.push([x,y]);positions.push(...facePoint(x,y));normals.push(...compactEyeEncodeNormal(faceNormal(x,y)));return k;};
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)vertex(x0+i*dx,y0+j*dy);
  const apertures=[-1,1].map(side=>({side,rim:new Map(),distance:q=>((q[0]-side*n.x)/n.rx)**2+((q[1]-n.y-n.tilt*(side*q[0]-n.x))/n.ry)**2-1}));
  function clipAperture(poly,hole){
    const out=[];for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length],da=hole.distance(a),db=hole.distance(b);if(da>=0)out.push(a);
      if((da<0)!==(db<0)){let lo=0,hi=1;for(let k=0;k<36;k++){const t=(lo+hi)/2,q=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];if((hole.distance(q)<0)===(da<0))lo=t;else hi=t;}
        const t=(lo+hi)/2,q=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];out.push(q);hole.rim.set(key(...q),q);}}
    return out;
  }
  // Clip geometry in its original parameter domain. A screen-space discard
  // would cut the returning underside a second time and leave a floating rim.
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=at(i,j),b=a+nx+1;for(const tri of [[a,a+1,b],[a+1,b+1,b]])if(tri.every(k=>valid[k])){
    let poly=tri.map(k=>parameters[k]);for(const hole of apertures)if(poly.length)poly=clipAperture(poly,hole);
    for(let k=1;k<poly.length-1;k++)indices.push(vertex(...poly[0]),vertex(...poly[k]),vertex(...poly[k+1]));}}
  const output=[compactFaceGeneratedMesh('faceSkin',positions,normals,indices,head,scale)];
  const cavityP=[],cavityN=[],cavityI=[],nostrilFrames=[];
  for(const hole of apertures){const side=hole.side,start=cavityP.length/3,rings=10,cx=side*n.x,cy=n.y,axis=faceNormal(cx,cy),centre=facePoint(cx,cy);
    const angles=[...hole.rim.values()].map(q=>Math.atan2((q[1]-cy-n.tilt*(side*q[0]-n.x))/n.ry,(q[0]-cx)/n.rx)).sort((a,b)=>a-b),segments=angles.length;
    const point=(a,t)=>{const x=cx+n.rx*Math.cos(a)*t,y=cy+n.ry*Math.sin(a)*t+n.tilt*(side*x-n.x);return sub(facePoint(x,y),mul(axis,n.depth*(1-t*t)**.65));};
    for(let i=0;i<=segments;i++)for(let j=0;j<=rings;j++){const a=angles[i%segments],t=.035+.965*j/rings,q=point(a,t),u=sub(point(a+.001,t),point(a-.001,t)),v=sub(point(a,Math.min(1,t+.001)),point(a,Math.max(0,t-.001)));cavityP.push(...q);cavityN.push(...compactEyeEncodeNormal(norm(cross(v,u))));}
    for(let i=0;i<segments;i++)for(let j=0;j<rings;j++){const a=start+i*(rings+1)+j,b=a+rings+1;cavityI.push(a,a+1,b,a+1,b+1,b);}
    const center=cavityP.length/3;cavityP.push(...point(0,0));cavityN.push(...compactEyeEncodeNormal(axis));
    for(let i=0;i<segments;i++)cavityI.push(center,start+i*(rings+1),start+(i+1)*(rings+1));
    nostrilFrames.push({side,centre,normal:axis,floorVertex:center,rimVertices:segments,depth:n.depth});
  }
  output.push(compactFaceGeneratedMesh('noseInterior',cavityP,cavityN,cavityI,head,scale));
  // Continuous upper and lower vermilion, with a narrow recessed closure line.
  const lp=p.lips,lipP=[],lipN=[],lipI=[],mouthP=[],mouthN=[],mouthI=[];
  const lipSurface=(x,upper,t)=>{const q=compactLipOutline(x),edge=upper?q.top:q.bottom,r=compactLipRadial(lp.apron*t),y=q.seam+(edge-q.seam)*r+(upper?1:-1)*.000008*Math.min(1,(q.top-q.bottom)/.004)*(1-3*t*t+2*t*t*t);
    const z=surface(x,y)+compactLipReliefDepth(q.u,t,upper)+.000015;
    return [x,y,z];};
  for(const upper of [true,false]){const start=lipP.length/3;
    for(let i=0;i<=lp.columns;i++)for(let j=0;j<=lp.rings;j++){const x=lp.centreX+lp.halfWidth*(-.998+1.996*i/lp.columns),t=j/lp.rings,point=lipSurface(x,upper,t),e=.00008;
      const a=sub(lipSurface(x+e,upper,t),lipSurface(x-e,upper,t)),b=sub(lipSurface(x,upper,Math.min(1,t+.001)),lipSurface(x,upper,Math.max(0,t-.001)));let normal=norm(cross(a,b));if(normal[2]<0)normal=mul(normal,-1);
      lipP.push(...point);lipN.push(...compactEyeEncodeNormal(normal));}
    for(let i=0;i<lp.columns;i++)for(let j=0;j<lp.rings;j++){const a=start+i*(lp.rings+1)+j,b=a+lp.rings+1;const tri=[a,b,a+1,a+1,b,b+1];if(!upper)for(let k=0;k<6;k+=3)[tri[k+1],tri[k+2]]=[tri[k+2],tri[k+1]];lipI.push(...tri);}
  }
  // The inner return follows a quarter-ellipse, with geometric normals and a
  // shared free-edge tangent instead of the former flat, constant-normal strip.
  for(const upper of [true,false]){const start=lipP.length/3,rows=10;
    const innerPoint=(x,t)=>{const q=compactLipOutline(x),a=lipSurface(x,upper,0),angle=t*Math.PI/2,sign=upper?1:-1;return [x,a[1]+sign*.00055*q.envelope*(1-Math.cos(angle)),a[2]-lp.innerDepth*q.envelope*Math.sin(angle)];};
    for(let i=0;i<=lp.columns;i++)for(let j=0;j<=rows;j++){
      const x=lp.centreX+lp.halfWidth*(-.998+1.996*i/lp.columns),t=j/rows,e=.00005,a=sub(innerPoint(x+e,t),innerPoint(x-e,t)),b=sub(innerPoint(x,Math.min(1,t+.0001)),innerPoint(x,Math.max(0,t-.0001)));
      let normal=norm(cross(b,a));if(!upper)normal=mul(normal,-1);lipP.push(...innerPoint(x,t));lipN.push(...compactEyeEncodeNormal(normal));
    }
    for(let i=0;i<lp.columns;i++)for(let j=0;j<rows;j++){const a=start+i*(rows+1)+j,b=a+rows+1,tri=[a,a+1,b,a+1,b+1,b];if(!upper)for(let k=0;k<6;k+=3)[tri[k+1],tri[k+2]]=[tri[k+2],tri[k+1]];lipI.push(...tri);}
  }
  const mouthRings=10,mouthSegments=128;
  const mouthPoint=(a,t)=>{const x=lp.centreX+lp.halfWidth*.998*Math.cos(a)*(1-.38*t),q=compactLipOutline(x),seam=lipSurface(x,true,0)[2];return [x,q.seam+.0007*Math.sin(a)*(1+3*t),seam-.0020-.010*t];};
  for(let i=0;i<=mouthSegments;i++)for(let j=0;j<=mouthRings;j++){const a=i/mouthSegments*2*Math.PI,t=j/mouthRings,e=.0001,du=sub(mouthPoint(a+e,t),mouthPoint(a-e,t)),dv=sub(mouthPoint(a,Math.min(1,t+e)),mouthPoint(a,Math.max(0,t-e)));
    mouthP.push(...mouthPoint(a,t));mouthN.push(...compactEyeEncodeNormal(norm(cross(du,dv))));}
  for(let i=0;i<mouthSegments;i++)for(let j=0;j<mouthRings;j++){const a=i*(mouthRings+1)+j,b=a+mouthRings+1;mouthI.push(a,b,a+1,a+1,b,b+1);}
  const mouthFloor=mouthP.length/3;mouthP.push(lp.centreX,lp.seamY,surface(lp.centreX,lp.seamY)-.013);mouthN.push(...compactEyeEncodeNormal([0,0,1]));for(let i=0;i<mouthSegments;i++)mouthI.push(mouthFloor,i*(mouthRings+1)+mouthRings,(i+1)*(mouthRings+1)+mouthRings);
  output.push(compactFaceGeneratedMesh('faceLip',lipP,lipN,lipI,head,scale),compactFaceGeneratedMesh('mouthInterior',mouthP,mouthN,mouthI,head,scale));
  const browP=[],browN=[],browI=[],b=p.brow;let seed=91637;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(const side of [-1,1])for(let strand=0;strand<b.strandsPerSide;strand++){
    const t=random(),band=(random()-.5)*.0033*Math.sin(Math.PI*(.08+.84*t)),x=side*(.010+.042*t),y=1.536+.005*Math.sin(Math.PI*t*.91)-.0035*t+band,len=.0023+random()*.0027,lean=side*(.5+.4*t),lift=.00025;
    const base=browP.length/3;
    for(let k=0;k<=b.segments;k++){const q=k/b.segments,px=x+lean*len*q,py=y+len*(.55-.9*t)*q,w=b.widthM*(1-.90*q)*(.75+.5*random());
      for(const edge of [-1,1]){const xx=px+edge*w*.5*(.55-.9*t)/Math.hypot(lean,.55-.9*t),yy=py-edge*w*.5*lean/Math.hypot(lean,.55-.9*t);const z=surface(xx,yy)+lift+Math.sin(q*Math.PI)*.0002;browP.push(xx,yy,z);browN.push(...compactEyeEncodeNormal([0,0,1]));}
    }
    for(let k=0;k<b.segments;k++){const a=base+k*2;browI.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  output.push(compactFaceGeneratedMesh('faceBrow',browP,browN,browI,head,scale));
  return {meshes:output,report:{revision:p.revision,grid:[nx+1,ny+1],sourceSamples:observed,forms:p.forms.length,nostrilFrames,nasalUnderturn:true,innerVermilion:true,lipSectionRails:true,roundedInnerReturn:true,perioralContinuity:true,philtrum:true,labiomentalCrease:true,mentalisPad:true,triangles:output.reduce((s,m)=>s+m.triangles,0),sourceCoefficientsModified:false,measuredAnatomy:false}};
}
function compactLipShapeShader(){
  const p=COMPACT_FACE_ANATOMY.lips,rows=p.outline,vec=a=>'vec3('+a.map(v=>v.toFixed(9)).join(',')+')';
  const pieces=rows.slice(0,-1).map((a,i)=>{const b=rows[i+1],span=b[0]-a[0],m0=[1,2,3].map(k=>compactLipTangent(rows,i,k,false,true)*span),m1=[1,2,3].map(k=>compactLipTangent(rows,i+1,k,false,true)*span);
    return 'if(a<='+b[0].toFixed(9)+'){float t=(a-'+a[0].toFixed(9)+')/'+span.toFixed(9)+';float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*'+vec(a.slice(1))+'+(t3-2.*t2+t)*'+vec(m0)+'+(-2.*t3+3.*t2)*'+vec(b.slice(1))+'+(t3-t2)*'+vec(m1)+';}';});
  return 'vec3 compactLipLandmarks(float a){'+pieces.join('')+'return '+vec(rows[rows.length-1].slice(1))+';}\nvec4 compactLipShape(vec3 p){float u=(p.x-('+p.centreX+'))/'+p.halfWidth+';vec3 landmarks=compactLipLandmarks(abs(u));float seam='+p.seamY+'+landmarks.x+.00010*u*max(0.,1.-u*u);return vec4(u,seam,landmarks.y-landmarks.x,landmarks.x-landmarks.z);}';
}
function compactLipOpening(point,amount){
  const p=COMPACT_FACE_ANATOMY.lips,q=compactLipOutline(point[0]),u=(point[0]-p.centreX)/p.halfWidth,v=(point[1]-q.seam)/.019,w=(point[2]-.188)/.040;
  if(Math.abs(u)>=1||Math.abs(v)>=1||Math.abs(w)>=1)return 0;
  return amount*(v>=0?.0015:-.0035)*(1-u*u)**2*(1-v*v)**3*(1-w*w)**2;
}
function compactLipMotionShader(){
  const p=COMPACT_FACE_ANATOMY.lips;
  return `${compactLipShapeShader()}
  uniform float compactLipOpen;
  float compactLipShift(vec3 p){
    vec4 shape=compactLipShape(p);vec3 q=vec3(shape.x,(p.y-shape.y)/.019,(p.z-.188)/.040);
    if(any(greaterThanEqual(abs(q),vec3(1.))))return 0.;
    vec3 e=1.-q*q;return compactLipOpen*(q.y>=0.?.0015:-.0035)*e.x*e.x*e.y*e.y*e.y*e.z*e.z;
  }
  void compactLipMotion(inout vec3 p,inout vec3 n){
    if(faceEligible<.5||compactLipOpen<.00001||abs(p.x-(${p.centreX}))>=${p.halfWidth}||abs(p.y-${p.seamY})>=.020||abs(p.z-.188)>=.040)return;
    // Different free-edge sides are separated by the mouth aperture. Sample
    // derivatives on the same side so the closure discontinuity is never
    // mistaken for a skin tangent or averaged across touching lips.
    float d=compactLipShift(p),e=.000015,seam=compactLipShape(p).y;
    float ey=min(e,max(abs(p.y-seam)*.25,.0000001));
    vec3 g=vec3((compactLipShift(p+vec3(e,0.,0.))-compactLipShift(p-vec3(e,0.,0.)))/(2.*e),
      (compactLipShift(p+vec3(0.,ey,0.))-compactLipShift(p-vec3(0.,ey,0.)))/(2.*ey),
      (compactLipShift(p+vec3(0.,0.,e))-compactLipShift(p-vec3(0.,0.,e)))/(2.*e));
    float ny=n.y/max(.25,1.+g.y);n=normalize(vec3(n.x-g.x*ny,ny,n.z-g.z*ny));p.y+=d;
  }`;
}
function compactFaceSurfaceShader(){
  const p=COMPACT_FACE_ANATOMY,[x,y,rx,ry]=p.ellipse;
  return `uniform float compactFaceSkinMode;
  ${compactLipShapeShader()}
  float compactLipPigment(vec3 p){
    vec4 q=compactLipShape(p);float extent=p.y>q.y?q.z:q.w,radial=abs(p.y-q.y)/max(extent,.00001);
    return (1.-smoothstep(.88,1.08,radial))*smoothstep(0.,.24,1.-abs(q.x));
  }
  float compactLipHash(float n){return fract(sin(n*127.1+311.7)*43758.5453);}
  float compactLipMottle(vec2 p){
    vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    float id=cell.x+cell.y*57.;
    return mix(mix(compactLipHash(id),compactLipHash(id+1.),f.x),mix(compactLipHash(id+57.),compactLipHash(id+58.),f.x),f.y)-.5;
  }
  vec3 compactLipTint(vec3 p){
    vec4 q=compactLipShape(p);float t=abs(p.y-q.y)/max(p.y>q.y?q.z:q.w,.00001);
    float variation=compactLipMottle(vec2(q.x*8.,t*3.));
    float planeTone=p.y>q.y?.92:1.02;
    return vec3(.90,.68,.77)*(planeTone+.045*variation);
  }
  float compactLipMoisture(vec3 p){
    vec4 q=compactLipShape(p);float t=abs(p.y-q.y)/max(p.y>q.y?q.z:q.w,.00001);
    float zone=smoothstep(.03,.25,t)*(1.-smoothstep(.60,.95,t))*(1.-smoothstep(.65,.95,abs(q.x)));
    return zone*(p.y>q.y?.28:1.);
  }
  float compactLipGrooves(vec2 uv,float count,float seed){
    float phase=(uv.x+1.)*.5*count,cell=floor(phase),grooves=0.;
    for(int i=-1;i<=1;i++){
      float id=cell+float(i),h=compactLipHash(id+seed),h2=compactLipHash(id+seed+71.);
      float centre=id+.18+.64*h+(.05+.12*h2)*sin(uv.y*(2.+h*3.)+h2*6.28);
      float d=(phase-centre)/(.060+.050*h2);
      float lengthMask=smoothstep(.015+.12*h,.16+.15*h,uv.y)*(1.-smoothstep(.52+.20*h2,.82+.16*h2,uv.y));
      grooves+=exp(-.5*d*d)*lengthMask*(.35+.65*h);
    }
    return grooves*(1.-smoothstep(.18,.80,fwidth(phase)));
  }
  float compactLipMicrorelief(vec3 p){
    vec4 q=compactLipShape(p);bool upper=p.y>q.y;
    float t=abs(p.y-q.y)/max(upper?q.z:q.w,.00001),seed=upper?19.:83.;
    vec2 uv=vec2(q.x,t);
    return -.000075*(compactLipGrooves(uv,23.,seed)+.22*compactLipGrooves(uv,47.,seed+31.))*compactLipPigment(p);
  }
  void compactFaceSurfaceMask(vec3 p){
    if(compactFaceSkinMode<.5||p.z<.13)return;
    float r=length((p.xy-vec2(${x},${y}))/vec2(${rx},${ry}));
    if(compactFaceSkinMode<1.5&&r<.985)discard;
    if(compactFaceSkinMode>1.5&&r>1.)discard;
    vec4 q=compactLipShape(p);
    if(abs(q.x)<1.&&p.z>.16&&p.y<q.y+q.z*${p.lips.apron}&&p.y>q.y-q.w*${p.lips.apron})discard;
  }`;
}
