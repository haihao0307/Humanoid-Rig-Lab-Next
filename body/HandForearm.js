/*
 * Hand / forearm R5, authored numeric surface and bind data, 2026-09-06.
 * No loaded mesh, traced vertices, raster surface maps, or animation assets.
 * Coordinates: +X radial on right hand, -Y distal, +Z palmar. Units: metres.
 * References and the scope of approximation are recorded in docs/WRIST_PALM_R5_SOURCES.md.
 */
const HAND_SHAPE_DEFAULT=Object.freeze({forearmLengthMm:247,forearmGirth:1,wristWidthMm:58,wristThicknessMm:36,
  palmLengthMm:91,palmWidthMm:80,palmThicknessMm:30,fingerLength:1,fingerWidth:1,littleFingerLength:1.08,thumbSize:1,thumbLength:1,thumbWidth:1,softness:.40});
const HAND_SHAPE_LIMITS=Object.freeze({forearmLengthMm:[195,305],forearmGirth:[.76,1.3],wristWidthMm:[44,66],wristThicknessMm:[28,46],
  palmLengthMm:[76,108],palmWidthMm:[66,96],palmThicknessMm:[23,42],fingerLength:[.8,1.2],fingerWidth:[.8,1.2],littleFingerLength:[.90,1.20],thumbSize:[.82,1.18],thumbLength:[.85,1.15],thumbWidth:[.85,1.15],softness:[0,1]});
function validateHandShape(input){
  const out={...HAND_SHAPE_DEFAULT};
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('尺寸数据必须是对象');
  for(const key of Object.keys(input)){
    if(!(key in HAND_SHAPE_LIMITS))throw Error('未知尺寸参数：'+key);
    const value=input[key],range=HAND_SHAPE_LIMITS[key];
    if(typeof value!=='number'||!Number.isFinite(value)||value<range[0]||value>range[1])throw Error('尺寸超出安全编辑区间：'+key);
    out[key]=value;
  }
  if(out.fingerWidth>1.08*out.palmWidthMm/80)throw Error('手指粗细与掌宽冲突，请加宽手掌或减小手指粗细');
  return out;
}
function handRatios(h){const p=h.handShape||HAND_SHAPE_DEFAULT;return {p,px:p.palmWidthMm/80,py:p.palmLengthMm/91,pz:p.palmThicknessMm/30,wx:p.wristWidthMm/54,wz:p.wristThicknessMm/36,fl:p.fingerLength,fw:p.fingerWidth};}
// R4 uses distinct thumb length and breadth. None of these edit pose-time scale.
function handFingerRadius(h,f){const r=handRatios(h);return [.0104,.0090,.0093,.00865,.00745][f.f]*r.fw*(f.thumb?r.p.thumbSize*r.p.thumbWidth:1);}
function handThumbCMC(s,opposition=0){
  // Thumb ray lies outside the plane of the other metacarpals and rotates
  // about its own long axis; its pad can face the other digits.
  return qm(qz(s*(.58-.72*opposition)),qm(qx(-.10-.16*opposition),qy(-s*(.50+.12*opposition))));
}
function handRigDimensions(h,f,s){
  const r=handRatios(h),thumb=f===0,scale=thumb?r.p.thumbSize*r.p.thumbLength:1;
  return {base:[s*[.021,.0275,.0073,-.0125,-.030][f]*r.px,-(thumb?.018:.030)*r.py,thumb?.002*r.pz:0],
    mcLength:[.041,.055,.061,.057,.046][f]*r.py*(thumb?r.p.thumbSize:1),
    phLengths:(thumb?[.030,.022]:ADULT_SPEC.hand.phalangesM[f]).map(v=>v*r.fl*scale*(f===4?r.p.littleFingerLength:1)),thumb};
}
// Monotone cubic Hermite sections have a continuous slope through the stations.
// The old per-interval smoothstep stopped the slope at every station.
function handProfile(rows,t){
  const out=[];let i=0;while(i<rows.length-2&&t>rows[i+1][0])i++;
  const x0=rows[i][0],x1=rows[i+1][0],h=x1-x0,u=clamp((t-x0)/h,0,1);
  for(let c=1;c<rows[0].length;c++){
    const slope=k=>(rows[k+1][c]-rows[k][c])/(rows[k+1][0]-rows[k][0]);
    const tangent=k=>{if(k===0)return slope(0);if(k===rows.length-1)return slope(k-1);
      const a=slope(k-1),b=slope(k);return a*b<=0?0:2*a*b/(a+b);};
    const m0=tangent(i)*h,m1=tangent(i+1)*h;
    out.push((2*u*u*u-3*u*u+1)*rows[i][c]+(u*u*u-2*u*u+u)*m0+(-2*u*u*u+3*u*u)*rows[i+1][c]+(u*u*u-u*u)*m1);
  }return out;
}
function handForearmBaseSection(tissue,side,t){
  const arm=tissue.human.arms[side],r=handRatios(tissue.human),s=arm.s,L=arm.L2;
  const u=clamp((t-arm.L1)/L,0,1),q=tissueProfile([
    [0,.0295,.030,.030,0,0],[.16,.034,.033,.033,0,0],[.33,.0334,.0317,.0323,0,0],
    [.53,.0296,.0262,.0275,0,0],[.75,.027,.0234,.023,0,0],[.91,.027,.0202,.0189,0,0],[1,.027,.0188,.0172,0,0]
  ])(u);
  const g=r.p.forearmGirth,w=tissueSmooth(.64,1,u);q[0]*=g*(1-w)+r.wx*w;
  q[1]*=g*(1-w)+r.wz*w;q[2]*=g*(1-w)+r.wz*w;
  return q;
}
// R5 wrist section. Signed t in metres: proximal forearm < 0, wrist = 0.
// Width/depth values are construction parameters, not clinical measurements.
function handWristPalmSection(tissue,t){
  const r=handRatios(tissue.human),a=tissue.human.arms.right,L=a.L2;
  const near=-.27*L,far=-.36*L;
  const q0=handForearmBaseSection(tissue,'right',a.L1+L+far);
  const q1=handForearmBaseSection(tissue,'right',a.L1+L+near);
  return handProfile([
    [far,...q0.slice(0,3)], [near,...q1.slice(0,3)],
    [-.030*L/.247,.0270*r.wx,.0210*r.wz,.0202*r.wz],
    [0,.0270*r.wx,.0188*r.wz,.0172*r.wz],
    [.014*r.py,.0320*r.px,.0160*r.pz,.01445*r.pz],
    [.035*r.py,.0370*r.px,.0123*r.pz,.0109*r.pz],
    [.056*r.py,.0398*r.px,.0118*r.pz,.0101*r.pz],
    [.074*r.py,.0390*r.px,.0120*r.pz,.0092*r.pz],
    [.095*r.py,.0374*r.px,.0108*r.pz,.0080*r.pz]
  ],t);
}
function handForearmSection(tissue,side,t){
  const a=tissue.human.arms[side],signed=t-a.L1-a.L2;
  const base=handForearmBaseSection(tissue,side,t);
  if(signed<=-.36*a.L2)return base;
  const blend=tissueSmooth(-.36*a.L2,-.27*a.L2,signed),q=handWristPalmSection(tissue,signed);
  for(let i=0;i<3;i++)base[i]+=(q[i]-base[i])*blend;
  return base;
}
function handWristSkinWeight(tissue,t){
  const r=handRatios(tissue.human);
  // The skin blend spans both sides of the joint. It never resets at the seam.
  return tissueSmooth(-.028*(r.p.forearmLengthMm/247),.020*r.py,t);
}
// R3 volume-bearing anatomical surface fields. +Z is volar/palmar, -Z is dorsal.
// These amplitudes are authored visual approximations, not patient measurements.
function handPalmCrease(x,t){
  const G=(v,w)=>Math.exp(-((v/w)**2)),edge=tissueSmooth(.007,.016,t)*(1-tissueSmooth(.070,.080,t));
  // Fine superficial furrows. The thenar volume exists independently of this line.
  const lifeX=.0015+.030*clamp((t-.012)/.063,0,1)**1.60;
  const life=.00014*G(x-lifeX,.0010)*G(t-.043,.031);
  const transverse=.048+.30*x+2.2*x*x,distal=.073+.07*x-3*x*x;
  return edge*(life+.00012*G(t-transverse,.0009)*G(x+.010,.028)+.00010*G(t-distal,.0009)*G(x+.006,.030));
}
function handPalmLocal(tissue,t,theta){
  const r=handRatios(tissue.human),q=handWristPalmSection(tissue,t*r.py);
  const rx=q[0]/r.px,volar=q[1]/r.pz,dorsal=q[2]/r.pz;
  const sn=Math.sin(theta),cs=Math.cos(theta),x=sn*rx,gate=tissueSmooth(.002,.023,t);
  const G=(v,w)=>Math.exp(-((v/w)**2)),soft=.84+.40*r.p.softness;
  // Oblique, elongated thenar eminence following the first metacarpal.
  // Its ridge turns toward the thumb rather than forming a round central bump.
  const axis=.009+.015*Math.sin(clamp(t/.077,0,1)*Math.PI*.65);
  const thenar=.0067*G(x-axis,.0170)*G(t-.033,.030);
  const hypothenar=.0035*G(x+.027,.014)*G(t-.040,.027);
  // A shallow arch of fibro-fatty pads beneath the four MCP heads.
  // This surface zone is not represented as one extra intrinsic muscle.
  const distalAxis=.069+.14*x-.002*(x/.040)**2;
  const distalPad=.00225*G(t-distalAxis,.014)*G(x,.036);
  const hollow=.00085*G(x+.001,.015)*G(t-.045,.022);
  let depth=cs>=0?volar+gate*((thenar+hypothenar+distalPad)*soft-hollow):dorsal;
  if(cs<0){
    const fan=.37+.63*tissueSmooth(.010,.092,t);
    for(const digit of [1,2,3,4]){
      const D=handRigDimensions(tissue.human,digit,1),cx=D.base[0]/r.px*fan;
      depth+=.00048*(1-.45*r.p.softness)*G(x-cx,.0034)*G(t-.053,.029);
    }
    depth+=.00065*G(x-.028,.013)*G(t-.044,.022);
  }
  const oval=1-tissueSmooth(0,.025,t)*(cs>=0?.32:.41);
  return [x*r.px,-t*r.py,Math.sign(cs)*Math.abs(cs)**oval*depth*r.pz];
}
function handPalmPoint(tissue,side,t,theta){
  const s=side==='right'?1:-1,r=handRatios(tissue.human);
  // Mirror the complete asymmetric anatomical field, not only its vertices.
  const p=handPalmLocal(tissue,t/r.py,s*theta);p[0]*=s;
  return point(tissue.bind.get(side+'_hand'),p);
}
function handFingerSection(radius,lengths,t){
  const total=lengths.reduce((a,b)=>a+b,0),starts=[0];for(const L of lengths)starts.push(starts.at(-1)+L);
  const G=(x,w)=>Math.exp(-((x/w)**2)),u=clamp(t/total,0,1),distalStart=total-lengths.at(-1);
  const du=clamp((t-distalStart)/lengths.at(-1),0,1),distal=tissueSmooth(distalStart-.003,distalStart+.004,t),end=total+.0004;
  const capStart=total-radius*.77,cap=t>capStart?Math.sqrt(Math.max(.000001,1-((t-capStart)/(end-capStart))**2)):1;
  // Phalangeal shafts taper; broad, low joint changes replace ring-like lumps.
  let width=radius*(1-.275*u);
  for(const h of starts.slice(1,-1))width+=radius*.040*G(t-h,.0060);
  width+=radius*.045*G(du-.47,.30)*distal;
  width*=cap;
  const pad=width*(.91+.15*G(du-.51,.34)*distal);
  const dorsal=width*(.81-.14*distal);
  let crease=0,knuckle=0;
  for(const h of starts.slice(1,-1)){crease+=.00016*G(t-h+.0011,.0012);knuckle+=.00020*G(t-h,.0055);}
  return {width,pad,dorsal:dorsal+knuckle,center:.00060*G(du-.54,.35)*distal*cap,crease,exponent:.76-.28*distal,total,end};
}
function handFingerPoint(radius,lengths,t,angle){
  const q=handFingerSection(radius,lengths,t),cs=Math.cos(angle),sn=Math.sin(angle);
  const z=q.center+(cs>=0?q.pad*Math.abs(cs)**.91-q.crease*cs*cs:-q.dorsal*Math.abs(cs)**q.exponent);
  return [sn*q.width,-t,z];
}
function handSurfaceFinger(cage,tissue,f,boundary,{entryFrame=null}={}){
  const frames=f.ph.map(j=>tissue.bind.get(j.id)),lengths=f.ph.map(j=>j.segmentLength),total=lengths.reduce((a,b)=>a+b,0),starts=[0];
  for(const L of lengths)starts.push(starts.at(-1)+L);
  const radius=handFingerRadius(tissue.human,f),r=handRatios(tissue.human),base=frames[0];
  let A;
  if(f.thumb){
    const ids=surfaceLoopOrder(cage,boundary,entryFrame||base),q=inv((entryFrame||base).q),Q=ids.map(id=>rotate(q,cage.v[id].p));
    const dist=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]),arc=[0];
    for(let k=1;k<Q.length;k++)arc.push(arc.at(-1)+dist(Q[k-1],Q[k]));
    const L=arc.at(-1)+dist(Q.at(-1),Q[0]);
    A={ids,angles:arc.map(v=>v/L*2*Math.PI)};
  }else A=surfaceAngularLoop(cage,boundary,base);
  const angles=A.angles;
  let previous=A.ids;
  function weightsAt(t){
    const span=Math.min(.0090,radius*.95);let k=0;while(k<lengths.length-1&&t>starts[k+1])k++;
    let w=f.thumb&&t<.013?tissueBlendWeights(f.mc.id,f.ph[0].id,tissueSmooth(-.008,.013,t)):[[f.ph[k].id,1]];
    for(let j=1;j<lengths.length;j++)if(Math.abs(t-starts[j])<span)w=tissueBlendWeights(f.ph[j-1].id,f.ph[j].id,tissueSmooth(starts[j]-span,starts[j]+span,t));
    return w;
  }
  const start=f.thumb?.005:.021*r.fl;
  // Boundary-matched longitudinal quads: no angular triangle fans at the roots.
  // Hermite control directions approach the finger along its own axis.
  for(let step=1;step<=9;step++){
    const u=step/9,blend=smooth(u),pts=A.ids.map((id,k)=>{
      const origin=cage.v[id].p,target=point(base,handFingerPoint(radius,lengths,start,angles[k]));
      const distance=len(sub(target,origin));
      let p1,p2;
      if(f.thumb){
        const palm=tissue.bind.get(f.side+'_hand'),s=f.side==='right'?1:-1;
        p1=add(origin,rotate(palm.q,[s*Math.min(.009,distance*.30),-.0025,0]));
        p2=add(target,rotate(base.q,[0,Math.min(.009,distance*.32),0]));
      }else{
        p1=add(origin,rotate(base.q,[0,-distance*.30,0]));
        p2=add(target,rotate(base.q,[0,distance*.30,0]));
      }
      const result=surfaceBezier(origin,p1,p2,target,u);
      if(f.thumb){
        const palm=tissue.bind.get(f.side+'_hand'),crest=Math.max(0,Math.cos(angles[k]))**2;
        return add(result,rotate(palm.q,[0,0,.0015*crest*Math.sin(Math.PI*u)**1.5]));
      }return result;
    });
    const next=cage.ring(pts,(k,p)=>{
      const w=[...cage.v[A.ids[k]].w.map(([id,w])=>[id,w*(1-blend)])];
      if(f.thumb){
        // Thenar skin travels with the first METACARPAL. Driving the whole
        // bridge from the MCP phalanx balloons its base during opposition.
        const local=rotate(inv(base.q),sub(p,base.p)),v=tissueSmooth(-.008,.013,-local[1]);
        w.push([f.mc.id,blend*(1-v)],[f.ph[0].id,blend*v]);
      }else w.push([f.ph[0].id,blend]);
      return w;
    });
    cage.join(previous,next);previous=next;
  }
  // Uniform spacing has no close duplicate rings at the interphalangeal joints.
  const count=Math.ceil((total-start)/.0020);
  for(let k=1;k<count;k++){
    const t=start+(total+.0002-start)*k/count;
    const next=cage.ring(angles.map(a=>point(base,handFingerPoint(radius,lengths,t,a))),weightsAt(t));
    cage.join(previous,next);previous=next;
  }
  const t=total+.00012;
  const tip=cage.ring(angles.map(a=>point(base,handFingerPoint(radius,lengths,t,a))),[[f.ph.at(-1).id,1]]);
  cage.join(previous,tip);cage.cap(tip,point(base,[0,-total-.0004,0]),[[f.ph.at(-1).id,1]]);
}
function handPalmAndSockets(cage,tissue,side,wristRing,fingers){
  const owner=side+'_hand',F=tissue.bind.get(owner),r=handRatios(tissue.human),toLocal=p=>rotate(inv(F.q),sub(p,F.p));
  const slots=fingers.map(f=>({...f,local:toLocal(tissue.bind.get(f.ph[0].id).p),radius:handFingerRadius(tissue.human,f)})).sort((a,b)=>a.local[0]-b.local[0]);
  const borders=[slots[0].local[0]-slots[0].radius*1.06,...slots.slice(1).map((f,k)=>(f.local[0]+slots[k].local[0])/2),slots.at(-1).local[0]+slots.at(-1).radius*1.06];
  const crossbars=[],front=[],back=[];
  for(let c=0;c<=4;c++){
    const A=slots[Math.max(0,c-1)],B=slots[Math.min(3,c)],outer=c===0||c===4;
    const t0=(-A.local[1]-B.local[1])*.5+(outer?.002:.011)*r.fl;
    const z=(outer?.0068:.0046)*r.pz;
    const w=outer?[[owner,.50],[A.ph[0].id,.50]]:[[owner,.64],[A.ph[0].id,.18],[B.ph[0].id,.18]];
    crossbars.push(Array.from({length:7},(_,k)=>{const u=k/6;return cage.vertex(point(F,[borders[c],-t0-(outer?0:.0035)*Math.sin(Math.PI*u)*r.fl,z*Math.cos(Math.PI*u)]),w);}));
  }
  for(let c=0;c<4;c++){
    const a=crossbars[c],b=crossbars[c+1],f=slots[c],fr=[a[0]],bk=[a[6]],mcp=-f.local[1];
    for(let k=1;k<6;k++){
      const u=k/6,x=borders[c]+(borders[c+1]-borders[c])*u,bulge=Math.sin(Math.PI*u)**.75;
      for(const [list,A,B,sign] of [[fr,a[0],b[0],1],[bk,a[6],b[6],-1]]){
        const pa=toLocal(cage.v[A].p),pb=toLocal(cage.v[B].p),p=mix(pa,pb,u);
        p[0]=x;p[1]=p[1]*(1-bulge)-(mcp+.004*r.fl)*bulge;
        p[2]=p[2]*(1-bulge)+(sign>0?f.radius*.97+.00065*r.pz:-f.radius*.84)*bulge;
        list.push(cage.vertex(point(F,p),[[owner,.30],[f.ph[0].id,.70]]));
      }
    }
    fr.push(b[0]);bk.push(b[6]);front.push(fr);back.push(bk);
  }
  const perimeter=[...front.flatMap(f=>f.slice(0,-1)),crossbars.at(-1)[0],...crossbars.at(-1).slice(1),
    ...back.slice().reverse().flatMap(b=>b.slice(0,-1).reverse()),...crossbars[0].slice(1,-1).reverse()];
  // Single chart from wrist to the finger-root scallops. No constant-height
  // terminal ring crosses the descending fifth ray, so there is no transverse shelf.
  const thumb=tissue.human.fingers.find(f=>f.side===side&&f.thumb),s=side==='right'?1:-1;
  const ordered=surfaceLoopOrder(cage,perimeter,F),endLocal=ordered.map(id=>toLocal(cage.v[id].p));
  const midX=(borders[0]+borders.at(-1))*.5,halfX=(borders.at(-1)-borders[0])*.5;
  // A monotonically parametrized ellipse preserves adjacency even though the
  // distal outline has varying MCP heights and volar pad depths.
  const raw=endLocal.map(p=>Math.atan2((p[0]-midX)/halfX,p[2]/(.009*r.pz)));
  let idx=raw.reduce((best,v,k)=>Math.abs(v)<Math.abs(raw[best])?k:best,0);
  const ids=ordered.map((_,k)=>ordered[(idx+k)%ordered.length]);
  const loop=ids.map(id=>toLocal(cage.v[id].p));
  const dist=(a,b)=>Math.hypot((a[0]-b[0])/halfX,(a[2]-b[2])/(.009*r.pz));
  const arcs=[0];for(let k=1;k<loop.length;k++)arcs.push(arcs.at(-1)+dist(loop[k-1],loop[k]));
  const perimeterLength=arcs.at(-1)+dist(loop.at(-1),loop[0]);
  const A=arcs.map(v=>v/perimeterLength*2*Math.PI);
  const D=ids.map(id=>toLocal(cage.v[id].p)),rows=[];
  const totalRows=25;
  for(let row=1;row<totalRows;row++){
    const u=row/totalRows;
    const next=cage.ring(D.map((end,k)=>{
      const t=-end[1]*u,base=toLocal(handPalmPoint(tissue,side,t,A[k]));
      const blend=tissueSmooth(.44,1,u);
      // Target each scallop with a C1 height transition. End profile flattens
      // towards the phalangeal axis instead of forming a fan of triangular caps.
      const terminal=toLocal(handPalmPoint(tissue,side,-end[1],A[k]));
      base[0]+=(end[0]-terminal[0])*blend;
      base[2]+=(end[2]-terminal[2])*blend;
      return point(F,base);
    }),(k,p)=>{
      const l=toLocal(p),t=-l[1],radial=Math.max(0,s*Math.sin(A[k]));
      const thenar=.23*radial**2*Math.exp(-Math.pow((t/r.py-.034)/.025,2))*tissueSmooth(.006*r.py,.025*r.py,t);
      const distal=tissueSmooth(.50,1,u),wrist=handWristSkinWeight(tissue,t);
      return [[owner,(1-distal)*(1-thenar)*wrist],
        [side+'_radiusRotation',(1-distal)*(1-thenar)*(1-wrist)],
        [thumb.mc.id,(1-distal)*thenar],...cage.v[ids[k]].w.map(([id,w])=>[id,w*distal])];
    });
    if(row===1)surfaceAngularJoin(cage,surfaceAngularLoop(cage,wristRing,F),surfaceAngularLoop(cage,next,F));
    rows.push(next);
  }
  rows.push(ids);
  const center=s>0?Math.PI/2:Math.PI*1.5;
  let c0=A.findIndex(a=>a>center-.62),c1=A.findIndex(a=>a>center+.62);
  if(c0<0||c1<=c0)throw Error('Invalid thumb socket meridians');
  const hole=cage.tube(rows,[{name:side+'_thumb_continuous_root_R4',r0:2,r1:12,c0,width:c1-c0}])[0];
  for(let c=0;c<4;c++){
    const loop=[...front[c].slice(0,-1),...crossbars[c+1].slice(0,-1),...back[c].slice(1).reverse(),...crossbars[c].slice(1).reverse()];
    handSurfaceFinger(cage,tissue,slots[c],loop);
  }
  handSurfaceFinger(cage,tissue,thumb,hole,{entryFrame:{q:qm(F.q,qz(s*Math.PI/2))}});
}
function buildRefinedHandSurface(cage,tissue,side,wristRing){
  handPalmAndSockets(cage,tissue,side,wristRing,tissue.human.fingers.filter(f=>f.side===side&&!f.thumb));
}
function refineHandSurfaceVertices(tissue,cage){
  const r=handRatios(tissue.human),G=(x,w)=>Math.exp(-Math.pow(x/w,2));
  for(const side of ['left','right']){
    const a=side+'_',s=side==='right'?1:-1,F=tissue.bind.get(a+'hand'),Q=inv(F.q);
    for(const v of cage.v){
      if(!v.w.some(([id,w])=>w>.02&&id.startsWith(a)&&(id.includes('hand')||id.includes('finger')||id.includes('metacarpal')||id.includes('radiusRotation'))))continue;
      let local=rotate(Q,sub(v.p,F.p)),[x,y,z]=local,t=-y/r.py,xr=x*s/r.px;
      // Wrist already uses a shared C1 section field. Keep the subdivided
      // wrist vertices; do not force them onto a second circular cuff.
      // Keep the subdivided volume here. Reprojecting finger sockets onto a
      // constant terminal section used to create a transverse shelf at 68 mm.
      // Creases mark the eminence boundary and two distinct palmar flexion folds.
      // They are evaluated after subdivision, so a smooth cage cannot erase them.
      if(t>.004&&t<.079&&z>.002){
        const edge=Math.max(0,1-(x/(.039*r.px))**8)*tissueSmooth(.002,.009,z);
        local[2]-=handPalmCrease(xr,t)*edge*r.pz;
        v.p=point(F,local);
      }

    }
  }
}
function colorHandSurface(tissue,g){
  const r=handRatios(tissue.human),frames={},sides=tissue.human.joints.map(j=>{
    if(!/_(hand|finger_|metacarpal_|radiusRotation|forearm)/.test(j.id))return null;
    return j.id.startsWith('left_')?'left':j.id.startsWith('right_')?'right':null;
  });
  for(const side of ['left','right']){const F=tissue.bind.get(side+'_hand');frames[side]={F,Q:inv(F.q)};}
  g.c=new Float32Array(g.p.length);
  for(let v=0;v<g.p.length/3;v++){
    const c=tissue.skinColor.slice();let side=null;
    for(let k=0;k<4;k++)if(g.skinWeights[v*4+k]>.25&&sides[g.skinJoints[v*4+k]]){side=sides[g.skinJoints[v*4+k]];break;}
    if(side){
      const {F,Q}=frames[side],p=rotate(Q,sub(Array.from(g.p.subarray(v*3,v*3+3)),F.p)),t=-p[1]/r.py,x=p[0]*(side==='right'?1:-1)/r.px;
      const local=tissueSmooth(-.035,.006,t),palmar=tissueSmooth(-.002,.007,p[2])*local;
      const crease=t<.080?clamp(handPalmCrease(x,t)/.0005,0,1)*palmar:0;
      c[0]+=.048*palmar-.024*crease;c[1]+=.029*palmar-.029*crease;c[2]+=.025*palmar-.022*crease;
    }
    g.c.set(c,v*3);
  }
}
function makeHandNails(tissue){
  const result=[],skin=tissue.skin.g,charts=new Map();
  const audit=tissue.handSurfaceAudit={nailSurfaceSamples:0,nailProjectionFallbacks:0,nailLiftMinM:Infinity,nailLiftMaxM:0};
  for(const f of tissue.human.fingers){
    const joint=f.ph.at(-1),jointIndex=tissue.human.joints.indexOf(joint),F=tissue.bind.get(joint.id),Q=inv(F.q),verts=new Map();
    for(let i=0;i<skin.p.length/3;i++){
      let related=false;for(let k=0;k<4;k++)if(skin.skinJoints[i*4+k]===jointIndex&&skin.skinWeights[i*4+k]>.25)related=true;
      if(related)verts.set(i,rotate(Q,sub(Array.from(skin.p.subarray(i*3,i*3+3)),F.p)));
    }
    const triangles=[];
    for(let i=0;i<skin.i.length;i+=3){const a=verts.get(skin.i[i]),b=verts.get(skin.i[i+1]),c=verts.get(skin.i[i+2]);
      if(a&&b&&c&&Math.min(a[2],b[2],c[2])<0){const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)>1e-13)triangles.push({a,b,c,den,minX:Math.min(a[0],b[0],c[0]),maxX:Math.max(a[0],b[0],c[0]),minY:Math.min(a[1],b[1],c[1]),maxY:Math.max(a[1],b[1],c[1])});}}
    charts.set(joint.id,triangles);
  }
  const dorsalSurface=(f,x,y,fallback)=>{let z=Infinity;for(const t of charts.get(f.ph.at(-1).id)){
    if(x<t.minX||x>t.maxX||y<t.minY||y>t.maxY)continue;
    const {a,b,c,den}=t,u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den;
    if(u>=-1e-5&&v>=-1e-5&&u+v<=1.00001)z=Math.min(z,u*a[2]+v*b[2]+(1-u-v)*c[2]);
  }audit.nailSurfaceSamples++;if(!Number.isFinite(z))audit.nailProjectionFallbacks++;return Number.isFinite(z)?z:fallback;};
  for(const f of tissue.human.fingers){
    const lengths=f.ph.map(j=>j.segmentLength),total=lengths.reduce((a,b)=>a+b,0),start=total-lengths.at(-1),rad=handFingerRadius(tissue.human,f),tip=lengths.at(-1);
    const rows=22,cols=24,p=[],c=[],ix=[],r=handRatios(tissue.human);
    const nailLength=Math.min(tip*.78,(f.thumb?.017:.0135)*r.fl*(f.thumb?r.p.thumbSize:1)),end=tip-.0011;
    for(let j=0;j<=rows;j++)for(let k=0;k<=cols;k++){
      const v=j/rows,u=2*k/cols-1;
      // Both proximal and free corners are rounded in plan, not a rectangle laid on a tube.
      const t=end-nailLength+nailLength*v+.0016*Math.abs(u)**4*(1-v)**3-.0014*Math.abs(u)**4*v**3;
      const sec=handFingerSection(rad,lengths,start+t),corner=.86+.14*Math.sin(Math.PI*v)**.55;
      const width=Math.min(rad*.62*corner,sec.width*.86),x=u*width;
      const z=sec.center-sec.dorsal*Math.max(.02,1-(x/Math.max(sec.width,.0001))**2)**(sec.exponent/2);
      const edgeMask=tissueSmooth(0,.12,v)*tissueSmooth(0,.13,1-Math.abs(u));
      const lift=.00010+.00022*edgeMask;
      audit.nailLiftMinM=Math.min(audit.nailLiftMinM,lift);audit.nailLiftMaxM=Math.max(audit.nailLiftMaxM,lift);
      p.push(x,-t,dorsalSurface(f,x,-t,z)-lift);
      const free=tissueSmooth(.90,.99,v),lunula=(f.thumb?.18:.06)*Math.exp(-(((v-.11)/.07)**2))*(1-u*u);
      const fold=(1-tissueSmooth(.01,.07,v))*.24+(Math.abs(u)**20)*.18;
      c.push(.61+.13*free+.16*lunula-.17*fold,.385+.25*free+.18*lunula-.095*fold,.315+.24*free+.17*lunula-.085*fold);
      if(j<rows&&k<cols){const a=j*(cols+1)+k,b=a+cols+1;ix.push(a,b,a+1,a+1,b,b+1);}
    }
    const g=mesh(p,ix);g.c=Float32Array.from(c);
    result.push({id:f.side+'_nail_'+(f.f+1),joint:f.ph.at(-1),g,materialKind:4,color:[.54,.34,.28],visible:true,handDetail:true,castShadow:true});
  }
  return result;
}

function fairHandCarrier(cage,tissue){
  // Low-pass carrier flow before subdivision; topology and rest-joint IDs stay fixed.
  const strength=new Map(),adj=new Map();
  for(const side of ['left','right']){
    const F=tissue.bind.get(side+'_hand'),Q=inv(F.q),r=handRatios(tissue.human);
    cage.v.forEach((v,i)=>{
      if(!v.w.some(([id,w])=>w>.02&&id.startsWith(side+'_')&&/_(hand|finger_|metacarpal_)/.test(id)))return;
      const p=rotate(Q,sub(v.p,F.p)),t=-p[1]/r.py;
      if(Math.abs(p[0])>.045*r.px||t<.052||t>.116)return;
      const w=tissueSmooth(.052,.070,t)*(1-tissueSmooth(.100,.116,t));if(w>0){strength.set(i,w);adj.set(i,new Set());}
    });
  }
  for(const f of cage.f)f.forEach((a,k)=>{const b=f[(k+1)%f.length];adj.get(a)?.add(b);adj.get(b)?.add(a);});
  for(let it=0;it<6;it++)for(const rate of [.32,-.28]){
    const changes=[];for(const [id,w]of strength){const ids=[...adj.get(id)];if(!ids.length)continue;
      const avg=mul(ids.reduce((p,i)=>add(p,cage.v[i].p),[0,0,0]),1/ids.length);
      changes.push([id,add(cage.v[id].p,mul(sub(avg,cage.v[id].p),rate*w))]);
    }for(const [id,p]of changes)cage.v[id].p=p;
  }
}
