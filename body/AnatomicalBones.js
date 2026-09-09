// Authored anatomical construction in metres. Relations: OpenStax 7.4, 8.1, 8.3.
// These functions change rest geometry only; they never change live joint transforms.
function boneCurve(a,v,b,t){return add(add(mul(a,(1-t)**2),mul(v,2*t*(1-t))),mul(b,t*t));}
function boneCurveField(p,a,v,b,r0,r1,steps=12){
  let d=Infinity,previous=a;
  for(let i=1;i<=steps;i++){const t=i/steps,next=boneCurve(a,v,b,t);
    d=Math.min(d,sdCaps(p,previous,next,r0+(r1-r0)*(i-1)/steps,r0+(r1-r0)*t));previous=next;}
  return d;
}
// Field gradients guide shading, but cannot independently decide winding at a
// subtraction crease. Propagate orientation through shared edges first.
function orientClosedAnatomicalMesh(g){
  const I=Array.from(g.i),edges=new Map(),links=Array.from({length:I.length/3},()=>[]);
  for(let t=0;t<I.length;t+=3)for(let k=0;k<3;k++){
    const a=I[t+k],b=I[t+(k+1)%3],key=a<b?a+':'+b:b+':'+a;
    if(!edges.has(key))edges.set(key,[]);edges.get(key).push({face:t/3,direction:a<b});
  }
  for(const e of edges.values()){
    if(e.length!==2)throw Error('Open anatomical bone field');const [a,b]=e;
    links[a.face].push([b.face,a.direction===b.direction]);links[b.face].push([a.face,a.direction===b.direction]);
  }
  const flipped=new Int8Array(links.length).fill(-1),queue=[0];flipped[0]=0;
  for(let k=0;k<queue.length;k++){const f=queue[k];for(const [j,different] of links[f]){
    const value=flipped[f]^(different?1:0);if(flipped[j]<0){flipped[j]=value;queue.push(j);}else if(flipped[j]!==value)throw Error('Non-orientable bone field');
  }}
  if(queue.length!==links.length)throw Error('Disconnected anatomical bone field');
  for(let k=0;k<flipped.length;k++)if(flipped[k])[I[k*3+1],I[k*3+2]]=[I[k*3+2],I[k*3+1]];
  let volume=0;for(let t=0;t<I.length;t+=3){const [a,b,c]=I.slice(t,t+3).map(i=>Array.from(g.p.subarray(i*3,i*3+3)));volume+=dot(a,cross(b,c))/6;}
  if(volume<0)for(let t=0;t<I.length;t+=3)[I[t+1],I[t+2]]=[I[t+2],I[t+1]];
  return mesh(Array.from(g.p),I);
}

let ANATOMICAL_PELVIS_CANONICAL=null;
function mirrorAnatomicalBone(source,side){
  const g=mesh(Array.from(source.p),Array.from(source.i),Array.from(source.n));
  if(side<0){for(let k=0;k<g.p.length;k+=3){g.p[k]*=-1;g.n[k]*=-1;}for(let k=0;k<g.i.length;k+=3)[g.i[k+1],g.i[k+2]]=[g.i[k+2],g.i[k+1]];}
  return g;
}
function makeAnatomicalPelvis(side){
  if(ANATOMICAL_PELVIS_CANONICAL)return mirrorAnatomicalBone(ANATOMICAL_PELVIS_CANONICAL,side);
  const female=BODY_SEX==='female',h=ANATOMY.hipSpacing/2,outline=[[.045,.105],[.075,.129],[.114,.129],[.145,.100],
    [.139,.065],[.120,.029],[.071,.026],[.047,.058]].map(([x,y])=>[x*(female?1.075:1),y]),boundary=[];
  for(let k=0;k<outline.length;k++)for(let i=0;i<6;i++){
    const a=outline[(k+outline.length-1)%outline.length],b=outline[k],c=outline[(k+1)%outline.length],d=outline[(k+2)%outline.length],u=i/6;
    boundary.push(b.map((v,j)=>.5*(2*v+(-a[j]+c[j])*u+(2*a[j]-5*v+4*c[j]-d[j])*u*u+(-a[j]+3*v-3*c[j]+d[j])*u*u*u)));
  }
  const wingZ=(x,y)=>-.047+.065*((x-.045)/(female?.119:.108))**2-.010*Math.sin(Math.PI*clamp((y-.026)/.105,0,1));
  const segments=[];
  const arch=(a,v,b,r0,r1)=>{let p=a;for(let k=1;k<=12;k++){const t=k/12,q=boneCurve(a,v,b,t),D=sub(q,p);segments.push({p,D,inv:1/dot(D,D),r:r0+(r1-r0)*(k-1)/12,dr:(r1-r0)/12});p=q;}};
  arch([.047,.090,-.047],[.055,.015,-.049],[h-.004,-.024,-.027],.011,.016);
  arch([h-.004,-.014,-.024],[h+.004,-.061,-.044],[h-.020,-.082,-.031],.015,.016);
  arch([h-.020,-.082,-.031],[female?.049:.042,-.091,.027],[.008,-.071,.061],.010,.009);
  arch([h-.012,-.012,.014],[female?.052:.046,-.020,.056],[.008,-.051,.063],.015,.009);
  const field=p=>{
    let inside=false,edge=Infinity;
    for(let k=0,j=boundary.length-1;k<boundary.length;j=k++){
      const A=boundary[j],B=boundary[k],dx=B[0]-A[0],dy=B[1]-A[1],u=clamp(((p[0]-A[0])*dx+(p[1]-A[1])*dy)/(dx*dx+dy*dy),0,1);
      edge=Math.min(edge,Math.hypot(p[0]-A[0]-u*dx,p[1]-A[1]-u*dy));
      if((A[1]>p[1])!==(B[1]>p[1])&&p[0]<(B[0]-A[0])*(p[1]-A[1])/(B[1]-A[1])+A[0])inside=!inside;
    }
    // A bent fan-shaped plate, with distributed cortical thickness. The crest,
    // iliac body and rami are one field, so there are no intersecting tube caps.
    const thickness=.0036+.0022*Math.exp(-(((p[1]-.118)/.016)**2));
    let d=Math.max(inside?-edge:edge,Math.abs(p[2]-wingZ(p[0],p[1]))-thickness);
    for(const a of segments){const t=clamp(((p[0]-a.p[0])*a.D[0]+(p[1]-a.p[1])*a.D[1]+(p[2]-a.p[2])*a.D[2])*a.inv,0,1);
      const c=Math.hypot(p[0]-a.p[0]-t*a.D[0],p[1]-a.p[1]-t*a.D[1],(p[2]-a.p[2]-t*a.D[2])*.90)-a.r-a.dr*t;d=smin(d,c,.006);}
    d=smin(d,sdEll(p,[h-.015,.011,-.007],[.031,.039,.035]),.009);
    d=smin(d,sdEll(p,[.007,-.061,.062],[.007,.019,.011]),.006);
    // Socket shares the hip centre with the existing femoral head. Its open
    // lateral rim is carved from the continuous coxal body, not added as a cup.
    d=-smin(-d,sdEll(p,[h,0,0],[.0262,.0262,.0262]),.0015);
    d=Math.max(d,-sdEll(p,[female?.051:.046,-.053,.021],[female?.026:.022,.026,.056]));
    return d;
  };
  const g=orientClosedAnatomicalMesh(fieldMesh(field,[-.003,-.105,-.079],[.174,.142,.081],[66,100,64]));
  ANATOMICAL_PELVIS_CANONICAL=g;return mirrorAnatomicalBone(g,side);
}

// An analytic concave articular surface with a connected smooth rim.
// Its resolution is independent of the old voxel grid, so the opening cannot stair-step.
function boneArticularCup(center,axis,radius,depth,thickness){
  axis=norm(axis);const x=norm(cross(Math.abs(axis[1])<.9?[0,1,0]:[0,0,1],axis)),y=cross(axis,x);
  const p=[],indices=[],rings=20,sides=64,faces=[];
  for(let surface=0;surface<2;surface++){
    const outer=surface===1,R=radius+(outer?thickness:0),D=depth+(outer?thickness:0),base=p.length/3;
    p.push(...sub(center,mul(axis,D)));const rows=[];
    for(let r=1;r<=rings;r++){const a=r/rings*Math.PI*.5,row=[];
      for(let k=0;k<sides;k++){const theta=k/sides*Math.PI*2;row.push(p.length/3);
        p.push(...add(sub(center,mul(axis,D*Math.cos(a))),add(mul(x,R*Math.sin(a)*Math.cos(theta)),mul(y,R*Math.sin(a)*Math.sin(theta)))));}
      rows.push(row);
    }
    const tri=(a,b,c)=>outer?indices.push(a,c,b):indices.push(a,b,c);
    for(let k=0;k<sides;k++)tri(base,rows[0][k],rows[0][(k+1)%sides]);
    for(let r=0;r<rings-1;r++)for(let k=0;k<sides;k++){const n=(k+1)%sides,A=rows[r],B=rows[r+1];tri(A[k],B[k],B[n]);tri(A[k],B[n],A[n]);}
    faces.push(rows.at(-1));
  }
  for(let k=0;k<sides;k++){const n=(k+1)%sides,A=faces[0],B=faces[1];indices.push(A[k],B[k],B[n],A[k],B[n],A[n]);}
  return mesh(p,indices);
}

function makeAnatomicalCarpal(index,side){
  // Scaphoid/lunate/triquetrum/pisiform, then trapezium/trapezoid/capitate/hamate.
  // Nonuniform positions, rounded wedge sections and the hamate hook replace a ball grid.
  const shapes=[
    [[.018,-.011,-.001],[.0085,.012,.0065],.85,-.35],[[.003,-.009,0],[.008,.0075,.007],.78,0],
    [[-.013,-.011,-.001],[.008,.008,.006],.69,.18],[[-.018,-.009,.009],[.0048,.0055,.0045],1,0],
    [[.026,-.026,.001],[.0085,.008,.0065],.65,-.20],[[.012,-.026,-.001],[.006,.0065,.006],.64,.10],
    [[-.001,-.025,0],[.007,.011,.007],.81,0],[[-.017,-.027,.001],[.009,.009,.0065],.66,.15]
  ];
  const [center,radii,power,angle]=shapes[index],p=[],indices=[],rings=16,sides=24;
  const signed=(x,e)=>Math.sign(x)*Math.abs(x)**e;
  const vertex=(lat,theta)=>{
    const y=Math.cos(lat),width=1+(index===2||index===5||index===7?.18*y:0),sn=signed(Math.sin(lat),power);
    const local=[radii[0]*sn*signed(Math.cos(theta),power)*width,radii[1]*signed(y,power),radii[2]*sn*signed(Math.sin(theta),power)];
    return mirrorBodyPoint(add(center,rotate(qz(angle),local)),side);
  };
  p.push(...vertex(0,0));
  for(let r=1;r<rings;r++)for(let k=0;k<sides;k++)p.push(...vertex(r/rings*Math.PI,k/sides*Math.PI*2));
  const bottom=p.length/3;p.push(...vertex(Math.PI,0));
  for(let k=0;k<sides;k++){const n=(k+1)%sides;indices.push(0,1+n,1+k);const a=1+(rings-2)*sides;indices.push(bottom,a+k,a+n);}
  for(let r=0;r<rings-2;r++)for(let k=0;k<sides;k++){const a=1+r*sides+k,b=1+r*sides+(k+1)%sides;indices.push(a,b,b+sides,a,b+sides,a+sides);}
  if(side<0)for(let k=0;k<indices.length;k+=3)[indices[k+1],indices[k+2]]=[indices[k+2],indices[k+1]];
  const g=mesh(p,indices);
  return index===7?combine([g,sweep(t=>mirrorBodyPoint(boneCurve([-.019,-.026,.005],[-.023,-.026,.017],[-.015,-.029,.018],t),side),.0027,24,12)]):g;
}

function makeAnatomicalSacrum(){
  const field=p=>{
    const u=clamp((p[1]+.018)/.114,0,1),width=.010+.043*u**.78;
    const centerZ=-.063+.020*u+.007*Math.sin(Math.PI*u),thickness=.009+.009*u;
    let d=(Math.hypot(p[0]/width,(p[2]-centerZ)/thickness)-1)*thickness;
    d=Math.max(d,-.018-p[1],p[1]-.096);
    // Rounded alae form the matching surfaces for the paired iliac buttresses.
    for(const s of [-1,1])d=smin(d,sdEll(p,[s*.038,.080,-.045],[.015,.028,.017]),.007);
    for(let k=0;k<4;k++)for(const s of [-1,1]){
      const y=.079-k*.022,x=s*(.021-k*.0025);
      d=Math.max(d,-sdEll(p,[x,y,-.053],[.0035,.0043,.036]));
    }
    return d;
  };
  const g=fieldMesh(field,[-.060,-.024,-.087],[.060,.119,-.012],[48,58,30]);
  return BODY_SEX==='female'?remapBoneGeometry(g,[1.075,1,1]):g;
}

// A closed, curved plate with rounded contour and distributed interior vertices.
// Unlike a centre-fan polygon this supports smooth normals over the whole scapula.
function curvedBonePlate(outline,thickness=.005,bulge=.008){
  const sides=64,rings=14,p=[],indices=[];
  const center=mul(outline.reduce((sum,v)=>add(sum,v),[0,0,0]),1/outline.length);
  const boundary=t=>{
    const f=t*outline.length,k=Math.floor(f),u=f-k,n=outline.length;
    const A=outline[(k+n-1)%n],B=outline[k%n],C=outline[(k+1)%n],D=outline[(k+2)%n];
    return B.map((v,i)=>.5*((2*v)+(-A[i]+C[i])*u+(2*A[i]-5*v+4*C[i]-D[i])*u*u+(-A[i]+3*v-3*C[i]+D[i])*u*u*u));
  };
  for(const sign of [-1,1]){
    const base=p.length/3;p.push(...add(center,[0,0,bulge+sign*thickness/2]));
    for(let r=1;r<=rings;r++)for(let k=0;k<sides;k++){
      const u=r/rings,v=mix(center,boundary(k/sides),u);
      p.push(v[0],v[1],v[2]+bulge*(1-u*u)+sign*thickness/2);
    }
    const tri=(a,b,c)=>sign>0?indices.push(a,b,c):indices.push(a,c,b);
    for(let k=0;k<sides;k++)tri(base,base+1+k,base+1+(k+1)%sides);
    for(let r=1;r<rings;r++)for(let k=0;k<sides;k++){
      const a=base+1+(r-1)*sides+k,b=base+1+(r-1)*sides+(k+1)%sides;
      tri(a,a+sides,b+sides);tri(a,b+sides,b);
    }
  }
  const stride=1+rings*sides;
  for(let k=0;k<sides;k++){const a=1+(rings-1)*sides+k,b=1+(rings-1)*sides+(k+1)%sides;
    indices.push(a,b,b+stride,a,b+stride,a+stride);}
  const g=mesh(p,indices);
  // Orient from the two plate sides, including mirrored outlines.
  if(g.n[2]>0){for(let i=0;i<g.i.length;i+=3)[g.i[i+1],g.i[i+2]]=[g.i[i+2],g.i[i+1]];for(let i=0;i<g.n.length;i++)g.n[i]*=-1;}
  return g;
}

function makeAnatomicalScapula(s){
 const t1=ADULT_RIG.thoracicY[1],ac=[s*(ADULT_RIG.scOffsetM[0]+ADULT_RIG.clavicleVectorM[0]),t1+ADULT_RIG.scOffsetM[1]+ADULT_RIG.clavicleVectorM[1],spineStationZ('T',t1)+ADULT_RIG.scOffsetM[2]+ADULT_RIG.clavicleVectorM[2]];
 const profile=tissueProfile(ADULT_SPEC.profiles.torso);
 const appose=p=>{const world=add(ac,p),r=profile(world[1]),rx=Math.max(.04,r[0]-.016),rb=Math.max(.025,r[2]-.012);
  const posterior=r[4]-rb*Math.sqrt(Math.max(.05,1-(world[0]/rx)**2))-.007;
  const w=1-tissueSmooth(.135,.175,Math.abs(world[0]));return [p[0],p[1],p[2]+(posterior-world[2])*w];};
  const plate=curvedBonePlate([[-s*.012,-.022,-.020],[-s*.058,-.021,-.092],
    [-s*.092,-.036,-.102],[-s*.089,-.080,-.105],[-s*.063,-.143,-.095],
    [-s*.050,-.115,-.096],[-s*.034,-.068,-.082],[-s*.015,-.042,-.044]].map(appose),.004,-.004);
  const spine=sweep(t=>boneCurve(appose([-s*.090,-.045,-.106]),appose([-s*.035,-.022,-.053]),[s*.004,.001,-.009],t),t=>.0035+.003*t,36,16,.8);
  const acromion=sweep(t=>boneCurve([-s*.014,-.006,-.027],[s*.012,.006,-.013],[s*.013,-.009,.008],t),t=>.006-.001*t,28,16,1.4);
  const glenoid=boneArticularCup([-s*.014,-.023,.001],norm([s,.08,.18]),.015,.004,.004);
  const coracoid=sweep(t=>boneCurve([-s*.003,-.020,.002],[s*.006,-.011,.030],[-s*.007,-.033,.026],t),t=>.0055-.0015*t,24,14);
  return combine([plate,spine,acromion,glenoid,coracoid]);
}

function makeAnatomicalSternum(){
  const field=p=>{
    let d=sdEll(p,[0,.103,0],[.023,.024,.008]);
    d=smin(d,sdCaps([p[0],p[1],p[2]*1.8],[0,.088,0],[0,-.051,0],.012,.010),.006);
    d=smin(d,sdEll(p,[0,-.062,-.002],[.006,.020,.005]),.003);
    d=Math.max(d,-sdEll(p,[0,.130,.002],[.009,.009,.011]));
    for(const s of [-1,1])d=Math.max(d,-sdEll(p,[s*.025,.116,.005],[.009,.008,.010]));
    return d;
  };
  return fieldMesh(field,[-.030,-.087,-.014],[.030,.132,.014],[30,90,18]);
}

function anatomicalRib(rib,s){
  const width=[0,.058,.074,.090,.105,.117,.127,.134,.138,.137,.128,.103,.078][rib];
  const depth=[0,.095,.115,.132,.147,.160,.170,.178,.182,.180,.169,.143,.112][rib];
  const end=rib<=7?Math.PI*.92:rib<=10?Math.PI*(.93-(rib-7)*.055):Math.PI*.59;
  const station=SPINE_STATIONS.find(([type,n])=>type==='T'&&n===rib),originZ=spineStationZ('T',station[2]),profile=tissueProfile(ADULT_SPEC.profiles.torso);
  const path=t=>{const a=.025+end*t,bend=Math.sin(Math.PI*t);
    const p=[s*(.012+width*Math.sin(a)*(.91+.09*bend)),
      -.003-(.018+.002*rbClamp(rib))*Math.sin(a/2)-(.007+.0015*rib)*t+.005*Math.sin(Math.PI*t)**2,
      depth*.5*(1-Math.cos(a))-.016*Math.exp(-(((t-.13)/.14)**2))];
    const [rx,rf,rb,,cz]=profile(station[2]+p[1]),z=p[2]+originZ-cz;
    const level=Math.hypot(p[0]/(rx-.014),z/((z>=0?rf:rb)-.014));
    const limited=level-.04*Math.log1p(Math.exp((level-1)/.04)),scale=limited/Math.max(level,1e-9);
    return[p[0]*scale,p[1],cz+z*scale-originZ];
  };
  // Broad superior/inferior faces and a thin radial cross-section replace tube rings.
  const p=[],indices=[],rings=80,sides=16;
  for(let r=0;r<=rings;r++){
    const t=r/rings,center=path(t),tangent=norm(sub(path(Math.min(1,t+.001)),path(Math.max(0,t-.001))));
    const vertical=norm(sub([0,1,0],mul(tangent,dot(tangent,[0,1,0])))),radial=norm(cross(tangent,vertical));
    const belly=Math.sin(Math.PI*t),height=(.0028+.0023*belly)*(rib>10?.78:1),thick=(.0017+.0007*belly)*(rib>10?.86:1);
    for(let k=0;k<sides;k++){const a=k/sides*Math.PI*2;p.push(...add(center,add(mul(vertical,Math.cos(a)*height),mul(radial,Math.sin(a)*thick))));}
  }
  for(let r=0;r<rings;r++)for(let k=0;k<sides;k++){const a=r*sides+k,b=r*sides+(k+1)%sides;indices.push(a,b,b+sides,a,b+sides,a+sides);}
  for(const [r,t] of [[0,0],[rings,1]]){const cap=p.length/3;p.push(...path(t));for(let k=0;k<sides;k++){const a=r*sides+k,b=r*sides+(k+1)%sides;t?indices.push(cap,a,b):indices.push(cap,b,a);}}
  return {path,depth,geometry:mesh(p,indices)};
}
function rbClamp(rib){return Math.min(rib,8);}
