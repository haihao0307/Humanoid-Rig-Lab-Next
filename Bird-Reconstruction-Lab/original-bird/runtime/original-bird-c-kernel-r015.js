const TAU = Math.PI * 2;
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
const mix = (a,b,t)=>a+(b-a)*t;
const smooth = t=>t*t*(3-2*t);
const signPow=(x,p)=>Math.sign(x)*Math.pow(Math.abs(x),p);

export const QUALITY = Object.freeze({
  preview:{positionTolerance:.026,angularToleranceDegrees:16},
  balanced:{positionTolerance:.013,angularToleranceDegrees:9},
  close:{positionTolerance:.006,angularToleranceDegrees:5}
});

export const DEFAULT_LARID_C_PROFILE = Object.freeze({
  schema:'kaopu/original-bird-c-profile@1.0',
  revision:'Larid-C-Draft-R0.15',
  safeSpeciesLabel:'Laridae seagull candidate',
  exactSpecies:'UNRESOLVED',
  scale:{mode:'normalized-body-length',realScaleStatus:'UNKNOWN'},
  body:{
    uKnots:[0,.10,.28,.50,.68,.82,.94,1],
    z:[-.48,-.40,-.26,0,.19,.34,.46,.53],
    centerY:[.02,.025,.04,.065,.09,.135,.16,.145],
    halfWidth:[.045,.09,.145,.17,.145,.085,.105,.07],
    halfHeight:[.05,.10,.165,.205,.17,.10,.115,.075],
    sectionExponent:[2,2.1,2.35,2.55,2.35,2.05,2,2]
  },
  wing:{
    halfSpan:1.06,rootX:.115,rootY:.105,rootZ:.12,sweep:.34,dihedral:.055,tipDrop:.03,
    chordKnots:[0,.18,.45,.72,.90,1],
    chord:[.30,.36,.34,.255,.14,.035],
    camber:.026,thickness:.016,twistTipRadians:-.10,
    primaryCount:8,secondaryCount:9
  },
  tail:{rectrixCount:10,length:.31,fanRadians:.36,baseZ:-.43,baseY:.035},
  beak:{length:.13,baseWidth:.045,baseHeight:.04,baseZ:.525,baseY:.15},
  eye:{radius:.016,lateralOffset:.083,z:.485,y:.182},
  palette:{
    body:0xf2eee4,mantle:0xb8bdc1,wing:0xc8cbcd,primary:0x3e454b,
    tail:0xe7e4dc,beak:0xd7a23c,eye:0x15130f,iris:0x7b5c2b
  },
  pose:{flapRadians:0,tailFanScale:1}
});

export function cloneProfile(profile=DEFAULT_LARID_C_PROFILE){
  return JSON.parse(JSON.stringify(profile));
}

function hermite(knots,values,u){
  if(u<=knots[0])return values[0];
  const n=knots.length;
  if(u>=knots[n-1])return values[n-1];
  let i=0;
  while(i<n-2&&u>knots[i+1])i++;
  const a=knots[i],b=knots[i+1],t=(u-a)/(b-a);
  const im=Math.max(0,i-1),ip=Math.min(n-1,i+2);
  const m0=(values[i+1]-values[im])/(knots[i+1]-knots[im]||1);
  const m1=(values[ip]-values[i])/(knots[ip]-knots[i]||1);
  const t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*values[i]+(t3-2*t2+t)*(b-a)*m0+
    (-2*t3+3*t2)*values[i+1]+(t3-t2)*(b-a)*m1;
}

function bodyFields(profile,u){
  const b=profile.body,k=b.uKnots;
  return {
    z:hermite(k,b.z,u),
    y:hermite(k,b.centerY,u),
    w:Math.max(.001,hermite(k,b.halfWidth,u)),
    h:Math.max(.001,hermite(k,b.halfHeight,u)),
    n:Math.max(1.6,hermite(k,b.sectionExponent,u))
  };
}

export function evaluateBody(profile,u,theta){
  const f=bodyFields(profile,clamp(u,0,1));
  const p=2/f.n;
  return [
    f.w*signPow(Math.cos(theta),p),
    f.y+f.h*signPow(Math.sin(theta),p),
    f.z
  ];
}

function wingFields(profile,s){
  const w=profile.wing;
  const chord=hermite(w.chordKnots,w.chord,clamp(s,0,1));
  const x=w.rootX+w.halfSpan*s;
  const z=w.rootZ-w.sweep*Math.pow(s,1.35);
  const y=w.rootY+w.dihedral*Math.sin(Math.PI*s)-w.tipDrop*s*s;
  const twist=w.twistTipRadians*s*s;
  return {x,y,z,chord,twist};
}

export function evaluateWing(profile,side,s,c,surface=1){
  const w=profile.wing,f=wingFields(profile,clamp(s,0,1));
  const chordOffset=(.43-c)*f.chord;
  const camber=w.camber*Math.sin(Math.PI*c)*(1-.28*s);
  const thick=w.thickness*Math.pow(1-s,.35)*Math.sin(Math.PI*c);
  const ct=Math.cos(f.twist),st=Math.sin(f.twist);
  const zOff=chordOffset*ct-camber*st;
  const yOff=chordOffset*st+camber*ct;
  const flap=profile.pose?.flapRadians||0;
  const relX=side*(f.x-w.rootX);
  const yFlap=Math.sin(flap)*Math.abs(relX);
  const xFlap=side*(w.rootX+Math.cos(flap)*Math.abs(relX));
  return [xFlap,f.y+yOff+yFlap+surface*thick,f.z+zOff];
}

function vecError(a,b,c){
  let e=0;
  for(let i=0;i<a.length;i++){
    const d=b[i]-(a[i]+c[i])*.5;e+=d*d;
  }
  return Math.sqrt(e);
}

function adaptiveParameters(fn,tol,maxDepth=11){
  const out=[0];
  function split(a,b,fa,fb,depth){
    const m=(a+b)/2,fm=fn(m),err=vecError(fa,fm,fb);
    if(err>tol&&depth<maxDepth){
      split(a,m,fa,fm,depth+1);
      split(m,b,fm,fb,depth+1);
    }else out.push(b);
  }
  split(0,1,fn(0),fn(1),0);
  return out;
}

function createMesh(name,material){
  return {name,material,positions:[],indices:[],doubleSided:false};
}

function addVertex(mesh,p){
  const i=mesh.positions.length/3;
  mesh.positions.push(p[0],p[1],p[2]);
  return i;
}

function addGrid(mesh,us,vs,fn,{closedV=false,flip=false}={}){
  const base=mesh.positions.length/3,cols=vs.length;
  for(const u of us)for(const v of vs)addVertex(mesh,fn(u,v));
  const rings=us.length,limitV=closedV?cols:cols-1;
  for(let i=0;i<rings-1;i++)for(let j=0;j<limitV;j++){
    const j1=(j+1)%cols;
    const a=base+i*cols+j,b=base+(i+1)*cols+j,c=base+(i+1)*cols+j1,d=base+i*cols+j1;
    if(flip)mesh.indices.push(a,c,b,a,d,c);
    else mesh.indices.push(a,b,c,a,c,d);
  }
  return {base,rows:rings,cols};
}

function capRing(mesh,base,cols,point,flip=false){
  const center=addVertex(mesh,point);
  for(let j=0;j<cols;j++){
    const a=base+j,b=base+(j+1)%cols;
    if(flip)mesh.indices.push(center,b,a); else mesh.indices.push(center,a,b);
  }
}

function buildBody(profile,q){
  const mesh=createMesh('body','body');
  const us=adaptiveParameters(u=>{
    const f=bodyFields(profile,u);return [f.z,f.y,f.w,f.h,f.n*.05];
  },q.positionTolerance*.35);
  const thetaCount=clamp(Math.ceil(360/q.angularToleranceDegrees),20,96);
  const vs=Array.from({length:thetaCount},(_,i)=>TAU*i/thetaCount);
  const grid=addGrid(mesh,us,vs,(u,t)=>evaluateBody(profile,u,t),{closedV:true});
  capRing(mesh,grid.base,thetaCount,[0,bodyFields(profile,0).y,bodyFields(profile,0).z],true);
  const endBase=grid.base+(us.length-1)*thetaCount;
  capRing(mesh,endBase,thetaCount,[0,bodyFields(profile,1).y,bodyFields(profile,1).z],false);
  return mesh;
}

function buildWing(profile,side,q){
  const mesh=createMesh(side>0?'wing_left':'wing_right','wing');
  const us=adaptiveParameters(s=>{
    const f=wingFields(profile,s);return [f.x,f.y,f.z,f.chord];
  },q.positionTolerance*.45);
  const chordCount=clamp(Math.ceil(Math.max(...profile.wing.chord)/q.positionTolerance*.8),10,42);
  const cs=Array.from({length:chordCount+1},(_,i)=>i/chordCount);
  const top=addGrid(mesh,us,cs,(s,c)=>evaluateWing(profile,side,s,c,1));
  const bottom=addGrid(mesh,us,cs,(s,c)=>evaluateWing(profile,side,s,c,-1),{flip:true});
  const cols=cs.length,rows=us.length;
  function bridge(a0,b0,a1,b1,flip=false){
    if(flip)mesh.indices.push(a0,a1,b0,a0,b1,a1);
    else mesh.indices.push(a0,b0,a1,a0,a1,b1);
  }
  for(let i=0;i<rows-1;i++){
    const at=top.base+i*cols,an=top.base+(i+1)*cols;
    const bt=bottom.base+i*cols,bn=bottom.base+(i+1)*cols;
    bridge(at,an,bt,bn,true);
    bridge(at+cols-1,bt+cols-1,an+cols-1,bn+cols-1,false);
  }
  for(let j=0;j<cols-1;j++){
    bridge(top.base+j,bottom.base+j,top.base+j+1,bottom.base+j+1,false);
    const ta=top.base+(rows-1)*cols+j,tb=bottom.base+(rows-1)*cols+j;
    bridge(ta,ta+1,tb,tb+1,true);
  }
  return mesh;
}

function buildBlade(name,material,centerFn,widthFn,lengthSegments,widthSegments=4){
  const mesh=createMesh(name,material);mesh.doubleSided=true;
  const us=Array.from({length:lengthSegments+1},(_,i)=>i/lengthSegments);
  const vs=Array.from({length:widthSegments+1},(_,i)=>-1+2*i/widthSegments);
  addGrid(mesh,us,vs,(u,v)=>{
    const c=centerFn(u),w=widthFn(u),side=c.side||[1,0,0],normal=c.normal||[0,1,0];
    const camber=.006*Math.sin(Math.PI*u)*(1-v*v);
    return [c.p[0]+side[0]*w*v+normal[0]*camber,c.p[1]+side[1]*w*v+normal[1]*camber,c.p[2]+side[2]*w*v+normal[2]*camber];
  });
  return mesh;
}

function buildPrimaries(profile,side,q){
  const parts=[],count=profile.wing.primaryCount||8;
  const seg=clamp(Math.ceil(.45/q.positionTolerance),8,40);
  for(let i=0;i<count;i++){
    const s0=.54+i*(.38/(count-1));
    const fan=(i-(count-1)/2)/(count-1);
    const start=evaluateWing(profile,side,s0,.70,1);
    const end=evaluateWing(profile,side,1,.58,1);
    end[0]+=side*(.05+.04*(i/(count-1)));
    end[2]-=.06+.055*(1-i/(count-1))+fan*.015;
    end[1]-=.008*i/count;
    const part=buildBlade(`primary_${side>0?'L':'R'}_${i}`,'primary',u=>{
      const t=smooth(u),p=[mix(start[0],end[0],t),mix(start[1],end[1],t),mix(start[2],end[2],t)-.015*Math.sin(Math.PI*u)];
      return {p,side:[0,0,1],normal:[0,1,0]};
    },u=>.026*Math.sin(Math.PI*Math.pow(u,.75))*(1-.22*u)+.002,seg,3);
    parts.push(part);
  }
  return parts;
}

function buildSecondaries(profile,side,q){
  const parts=[],count=profile.wing.secondaryCount||9;
  const seg=clamp(Math.ceil(.32/q.positionTolerance),7,32);
  for(let i=0;i<count;i++){
    const s0=.08+i*(.52/(count-1)),start=evaluateWing(profile,side,s0,.78,1);
    const chord=wingFields(profile,s0).chord;
    const end=[start[0]+side*.015*(i/count),start[1]-.006,start[2]-.32*chord-.025];
    parts.push(buildBlade(`secondary_${side>0?'L':'R'}_${i}`,'wing',u=>({
      p:[mix(start[0],end[0],smooth(u)),mix(start[1],end[1],u),mix(start[2],end[2],smooth(u))],
      side:[1,0,0],normal:[0,1,0]
    }),u=>.018*Math.sin(Math.PI*u)+.002,seg,3));
  }
  return parts;
}

function buildTail(profile,q){
  const parts=[],t=profile.tail,count=t.rectrixCount;
  const seg=clamp(Math.ceil(t.length/q.positionTolerance),8,42);
  for(let i=0;i<count;i++){
    const a=(i-(count-1)/2)/(count-1),angle=a*t.fanRadians*(profile.pose?.tailFanScale||1);
    const root=[a*.055,t.baseY,t.baseZ];
    const tip=[Math.sin(angle)*t.length,t.baseY-.015*Math.abs(a),t.baseZ-Math.cos(angle)*t.length];
    parts.push(buildBlade(`rectrix_${i}`,'tail',u=>({
      p:[mix(root[0],tip[0],smooth(u)),mix(root[1],tip[1],u)-.01*Math.sin(Math.PI*u),mix(root[2],tip[2],smooth(u))],
      side:[1,0,0],normal:[0,1,0]
    }),u=>.024*Math.sin(Math.PI*Math.pow(u,.8))*(1-.18*u)+.002,seg,4));
  }
  return parts;
}

function buildHalfBeak(profile,upper,q){
  const b=profile.beak,mesh=createMesh(upper?'beak_upper':'beak_lower','beak');
  const us=adaptiveParameters(u=>[u,b.baseWidth*(1-u),b.baseHeight*(1-u)],q.positionTolerance*.35);
  const thetaCount=clamp(Math.ceil(180/q.angularToleranceDegrees)+1,8,40);
  const vs=Array.from({length:thetaCount},(_,i)=>(upper?0:Math.PI)+Math.PI*i/(thetaCount-1));
  addGrid(mesh,us,vs,(u,t)=>{
    const taper=Math.pow(1-u,.72),x=b.baseWidth*taper*Math.cos(t);
    const y=b.baseY+b.baseHeight*taper*Math.sin(t)+(upper?.004:-.004)*(1-u);
    const z=b.baseZ+b.length*u;
    return [x,y,z];
  },{flip:!upper});
  return mesh;
}

function buildEllipsoid(name,material,center,radii,q){
  const mesh=createMesh(name,material);
  const uCount=clamp(Math.ceil(180/q.angularToleranceDegrees),10,44);
  const vCount=clamp(Math.ceil(360/q.angularToleranceDegrees),18,88);
  const us=Array.from({length:uCount+1},(_,i)=>Math.PI*i/uCount);
  const vs=Array.from({length:vCount},(_,i)=>TAU*i/vCount);
  addGrid(mesh,us,vs,(u,v)=>[
    center[0]+radii[0]*Math.sin(u)*Math.cos(v),
    center[1]+radii[1]*Math.cos(u),
    center[2]+radii[2]*Math.sin(u)*Math.sin(v)
  ],{closedV:true});
  return mesh;
}

function buildEyes(profile,q){
  const e=profile.eye,parts=[];
  for(const side of [-1,1]){
    parts.push(buildEllipsoid(`eye_${side<0?'R':'L'}`,'eye',[side*e.lateralOffset,e.y,e.z],[e.radius,e.radius,e.radius*.78],q));
    parts.push(buildEllipsoid(`iris_${side<0?'R':'L'}`,'iris',[side*(e.lateralOffset+.011),e.y,e.z+.002],[e.radius*.34,e.radius*.45,e.radius*.22],q));
  }
  return parts;
}

export function semanticAnchors(profile){
  return {
    beak_tip:[0,profile.beak.baseY,profile.beak.baseZ+profile.beak.length],
    eye_left:[profile.eye.lateralOffset,profile.eye.y,profile.eye.z],
    eye_right:[-profile.eye.lateralOffset,profile.eye.y,profile.eye.z],
    wing_root_left:evaluateWing(profile,1,0,.45,1),
    wing_root_right:evaluateWing(profile,-1,0,.45,1),
    wing_tip_left:evaluateWing(profile,1,1,.45,1),
    wing_tip_right:evaluateWing(profile,-1,1,.45,1),
    tail_tip_center:[0,profile.tail.baseY,profile.tail.baseZ-profile.tail.length],
    body_center:evaluateBody(profile,.5,Math.PI/2)
  };
}

export function buildLaridDisplay(profile=cloneProfile(),quality='balanced'){
  const q=typeof quality==='string'?QUALITY[quality]:quality;
  if(!q)throw new Error('Unknown sampling quality');
  const parts=[
    buildBody(profile,q),
    buildWing(profile,1,q),
    buildWing(profile,-1,q),
    ...buildPrimaries(profile,1,q),
    ...buildPrimaries(profile,-1,q),
    ...buildSecondaries(profile,1,q),
    ...buildSecondaries(profile,-1,q),
    ...buildTail(profile,q),
    buildHalfBeak(profile,true,q),
    buildHalfBeak(profile,false,q),
    ...buildEyes(profile,q)
  ];
  let vertices=0,triangles=0;
  for(const p of parts){vertices+=p.positions.length/3;triangles+=p.indices.length/3;}
  return {
    representation:'continuous-functions-sampled-in-memory',
    sourceTopologyDependency:false,
    quality,
    parts,
    anchors:semanticAnchors(profile),
    stats:{vertices,triangles,parts:parts.length,positionTolerance:q.positionTolerance,angularToleranceDegrees:q.angularToleranceDegrees}
  };
}

export function exportKaopuCProfile(profile=cloneProfile(),metadata={}){
  return {
    schema:'kaopu/original-bird-c-profile@1.0',
    revision:profile.revision,
    date:new Date().toISOString(),
    safeSpeciesLabel:profile.safeSpeciesLabel,
    exactSpecies:profile.exactSpecies,
    representation:{
      canonical:'continuous parametric fields and semantic anchors',
      fixedVertexArrayStored:false,
      fixedTriangleArrayStored:false,
      displayGeometry:'adaptive in-memory sampling only'
    },
    profile:cloneProfile(profile),
    anchors:semanticAnchors(profile),
    evidence:{
      primary:'BIRD-REF-004',
      secondary:'BIRD-REF-005',
      realScale:'UNKNOWN',
      exactSpecies:'UNRESOLVED',
      sourceRuntimeDependency:false
    },
    metadata,
    visualAcceptance:false,
    productionReady:false
  };
}
