// Original metric profiles, informed by anatomy references and Fab basemesh design.
// No downloaded vertices, model weights, UV maps or image assets.
// Rows: axial distance, half width, anterior depth, posterior depth, lateral/forward centre.
const ANATOMICAL_PROFILES=Object.freeze(ADULT_SPEC.profiles);

// Shape-preserving Hermite interpolation avoids radius overshoot between landmarks.
function tissueProfile(rows){
  if(rows.length<2||rows.some((r,i)=>r.length!==6||!r.every(Number.isFinite)||r.slice(1,4).some(v=>v<=0)||(i>0&&r[0]<=rows[i-1][0])))throw Error('人体截面参数必须有限、半径为正且按轴向递增');
  const slopes=rows.map(()=>new Float64Array(5));
  for(let k=1;k<6;k++)for(let i=0;i<rows.length;i++){
    const before=i? (rows[i][k]-rows[i-1][k])/(rows[i][0]-rows[i-1][0]):null;
    const after=i+1<rows.length? (rows[i+1][k]-rows[i][k])/(rows[i+1][0]-rows[i][0]):null;
    if(before===null)slopes[i][k-1]=after;
    else if(after===null)slopes[i][k-1]=before;
    else if(before*after<=0)slopes[i][k-1]=0;
    else {
      const h0=rows[i][0]-rows[i-1][0],h1=rows[i+1][0]-rows[i][0],w0=2*h1+h0,w1=h1+2*h0;
      slopes[i][k-1]=(w0+w1)/(w0/before+w1/after);
    }
  }
  return t=>{
    let i=0;while(i<rows.length-2&&t>rows[i+1][0])i++;
    const a=rows[i],b=rows[i+1],h=b[0]-a[0],u=clamp((t-a[0])/h,0,1),u2=u*u,u3=u2*u;
    return a.slice(1).map((v,k)=>(2*u3-3*u2+1)*v+(u3-2*u2+u)*h*slopes[i][k]
      +(-2*u3+3*u2)*b[k+1]+(u3-u2)*h*slopes[i+1][k]);
  };
}

function tissueBlendWeights(a,b,t){const w=clamp(t,0,1);return [[a,1-w],[b,w]].filter(x=>x[1]>.0001);}
const tissueSmooth=(lo,hi,x)=>{const t=clamp((x-lo)/(hi-lo),0,1);return t*t*(3-2*t);};
function tissueCrossDistance(x,z,rx,rz){
  const q=Math.hypot(x/rx,z/rz),g=Math.hypot(x/(rx*rx),z/(rz*rz));
  return g>1e-9?q*(q-1)/g:-Math.min(rx,rz);
}

function tissueDigit(tissue,joints,lengths,radius,{side=0,toe=false}={}){
  const starts=[0];for(const L of lengths)starts.push(starts.at(-1)+L);
  const total=starts.at(-1),weights=t=>{
    let i=0;while(i<joints.length-2&&t>starts[i+1]+.003)i++;
    if(i>=joints.length-1)return [[joints.at(-1).id,1]];
    return tissueBlendWeights(joints[i].id,joints[i+1].id,tissueSmooth(starts[i+1]-.004,starts[i+1]+.004,t));
  };
  const rows=[[-.007,radius*.65,radius*.60,radius*.60,0,0]];
  for(let k=0;k<=12;k++){
    const t=(total-.004)*k/12,r=radius*(1-.28*t/total);
    rows.push([t,r,r*(toe?.78:.86),r*.88,0,0]);
  }
  rows.push([total+.0015,.001,.001,.001,0,0]);
  return tissueLoft(tissue,joints[0].id,rows,{direction:-1,blend:toe?.0016:.0024,region:'finger',side,weights});
}

function tissueLoft(tissue,joint,rows,{direction=1,axis=1,blend=.010,region='',weights=null,side=0}={}){
  const f=tissue.bind.get(joint),sample=tissueProfile(rows);
  const footHeads=region==='foot'?tissue.human.legs[side<0?'left':'right'].footRays
    .map(r=>[side*r.head[0],r.head[2]]).sort((a,b)=>a[0]-b[0]):null;
  const basis=axis===2?[[1,0,0],[0,0,1],[0,1,0]]:[[1,0,0],[0,1,0],[0,0,1]],axes=basis.map(v=>rotate(f.q,v));
  const local=p=>{const d=sub(p,f.p);return axes.map(v=>dot(v,d));};
  const first=rows[0][0],last=rows.at(-1)[0],lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  const support=[];
  // Support bounds use the same profile as the surface, in the same bind space.
  const samples=region==='finger'?6:24;
  for(let i=0;i<=samples;i++){
    const t=first+(last-first)*i/samples,[rx,rf,rb,cx,cz]=sample(t),rz=(rf+rb)/2;
    const center=add(f.p,add(mul(axes[0],cx),add(mul(axes[1],direction*t),mul(axes[2],cz+(rf-rb)/2))));
    const axial=(last-first)/(2*samples)+.002,extent=[0,1,2].map(k=>Math.abs(axes[0][k])*rx+Math.abs(axes[1][k])*axial+Math.abs(axes[2][k])*rz+.05);
    for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],center[k]-extent[k]);hi[k]=Math.max(hi[k],center[k]+extent[k]);}
    support.push({p:center,radii:[rx,axial,rz],axes,weights:weights?weights(t):[[joint,1]]});
  }
  const field={kind:'loft',joint,blend,region,side,lo,hi,support,
    influence:p=>weights?weights(direction*local(p)[1]):[[joint,1]],
    distance:p=>{
      const q=local(p),t=direction*q[1],[rx,rf,rb,cx,cz]=sample(t),x=q[0]-cx,z=q[2]-cz,rz=z>=0?rf:rb;
      let d=tissueCrossDistance(x,z,rx,rz);
      d=Math.max(d,first-t,t-last);
      // Broad anatomical masses and shallow landmarks, rather than bead-shaped lobes.
      const gauss=(v,s)=>Math.exp(-((v/s)**2)),front=tissueSmooth(0,.06,z);
      if(region==='torso'){
        d-=.0065*gauss(Math.abs(x)-.076,.058)*gauss(t-.360,.072)*front;
        d+=.0011*gauss(x,.012)*gauss(t-.31,.14)*front;
        d+=.0018*gauss(x,.010)*gauss(t-.178,.012)*front;
        const back=tissueSmooth(0,.06,-z);
        d-=.011*gauss(Math.abs(x)-.076,.052)*gauss(t+.008,.068)*back;
        d+=.0075*gauss(x,.012)*gauss(t+.024,.046)*back;
        d-=.003*gauss(Math.abs(x)-.065,.040)*gauss(t-.37,.085)*back;
        d-=.0015*gauss(Math.abs(x)-.070,.050)*gauss(t-.470,.020)*front;
      }else if(region==='head'){
        // Zygomatic and brow planes are shallow variations in the same surface.
        d-=.0030*gauss(Math.abs(x)-.046,.022)*gauss(t+.003,.026)*front;
        d-=.0015*gauss(Math.abs(x)-.028,.023)*gauss(t-.047,.014)*front;
        d+=.0018*gauss(Math.abs(x)-.043,.020)*gauss(t+.039,.018)*front;
      }else if(region==='leg'){
        const f=ADULT_RIG.femurLengthM,b=ADULT_RIG.tibiaLengthM;
        d-=.004*gauss(x,.022)*gauss(t-f,.027)*front;
        d-=.002*gauss(x,.012)*gauss(t-f-b*.35,b*.25)*front;
        d-=.003*gauss(x+side*.012,.026)*gauss(t-f-b*.27,b*.15)*tissueSmooth(0,.025,-z);
      }else if(region==='foot'){
        // Medial arch and a staggered metatarsal boundary avoid a shoe-shaped lump.
        const medial=tissueSmooth(-.004,.021,-side*x),plantar=tissueSmooth(.006,.026,-z);
        d+=.007*gauss(t-.048,.030)*medial*plantar;
        const footX=side*q[0];let i=0;while(i<footHeads.length-2&&footX>footHeads[i+1][0])i++;
        const A=footHeads[i],B=footHeads[i+1],u=tissueSmooth(A[0],B[0],footX);
        d=Math.max(d,t-(A[1]+(B[1]-A[1])*u+.009));
        d=Math.max(d,-ADULT_STANCE.ankleHeightM-q[2]);
      }
      return d;
    }};
  tissue.fields.push(field);return field;
}

function makeAnatomicalEnvelope(tissue){
  const E=(...args)=>tissue.ell(...args),L=(...args)=>tissueLoft(tissue,...args);
  // Broad skin zones avoid a separate deformation band at every vertebra.
  const vertebrae=['hips','L3','T10','T5','T1','C4','head'].map(id=>[id,tissue.bind.get(id).p[1]-tissue.human.rootHeight]);
  const spineWeights=t=>{
    let i=0;while(i<vertebrae.length-2&&t>vertebrae[i+1][1])i++;
    const [a,y0]=vertebrae[i],[b,y1]=vertebrae[i+1];
    return tissueBlendWeights(a,b,tissueSmooth(y0,y1,t));
  };
  L('hips',ANATOMICAL_PROFILES.torso,{region:'torso',blend:.012,weights:spineWeights});
  L('head',ANATOMICAL_PROFILES.head,{region:'head',blend:.009});
  E('head',[0,.018,.084],[.0075,.023,.018],.004);
  E('head',[0,-.005,.099],[.010,.008,.012],.004);
  for(const side of ['left','right']){
    const s=side==='left'?-1:1,a=side+'_',arm=tissue.human.arms[side],leg=tissue.human.legs[side];
    E('head',mirrorBodyPoint(ADULT_SPEC.head.earCenterM,s),ADULT_SPEC.head.earRadiiM,.003);
    E('head',[s*.008,-.010,.097],[.005,.006,.008],.003);
    const u=arm.L1,v=arm.L2;
    const armWeights=t=>{
      const elbow=tissueSmooth(u-.043,u+.046,t),twist=tissueSmooth(u+.030,u+v-.032,t);
      const wrist=tissueSmooth(u+v-.021,u+v+.020,t);
      const shoulder=tissueSmooth(-.035,.070,t);
      return [['T1',(1-shoulder)*.55],[a+'AC',(1-shoulder)*.45],[a+'upperArm',shoulder*(1-elbow)],[a+'forearm',elbow*(1-twist)],
        [a+'radiusRotation',elbow*twist*(1-wrist)],[a+'hand',elbow*twist*wrist]].filter(x=>x[1]>.0001);
    };
    const armRows=[[-.055,.008,.012,.013,0,0],[-.025,.039,.043,.043,0,0],
      [.028,.050,.049,.048,s*.002,.001],[u*.34,.043,.045,.043,s*.001,.003],
      [u*.67,.035,.038,.038,0,.001],[u-.012,.030,.031,.032,0,0],
      [u+.042,.032,.034,.035,s*.001,0],[u+v*.43,.031,.033,.034,s*.002,0],
      [u+v*.76,.026,.027,.028,s*.001,0],[u+v,.023,.019,.020,0,0],
      [u+v+.018,.021,.017,.018,0,0],[u+v+.030,.005,.006,.006,0,0]];
    L(a+'upperArm',armRows,{direction:-1,blend:.012,region:'arm',side:s,weights:armWeights});
    L(a+'hand',[[-.013,.021,.017,.018,0,0],[.014,.027,.019,.016,0,.001],
      [.046,.036,.019,.015,s*.002,.002],[.074,.036,.017,.014,0,.001],
      [.088,.032,.012,.011,-s*.002,0],[.099,.004,.004,.004,-s*.003,0]],
      {direction:-1,blend:.005,region:'hand',side:s});
    E(a+'hand',[s*.026,-.045,.006],[.016,.026,.015],.005);
    for(const finger of tissue.human.fingers.filter(f=>f.side===side)){
      tissueDigit(tissue,finger.ph,finger.ph.map(j=>j.segmentLength),finger.thumb?.0090:.0078,{side:s});
      E(finger.mc.id,[0,-(finger.thumb?.025:.042),0],[finger.thumb?.012:.009,.024,.010],.005);
    }
    const f=leg.L1,b=leg.L2;
    const legWeights=t=>{
      const hip=tissueSmooth(-.040,.065,t),knee=tissueSmooth(f-.053,f+.056,t),ankle=tissueSmooth(f+b-.034,f+b+.018,t);
      return [['hips',1-hip],[a+'femur',hip*(1-knee)],[a+'tibia',hip*knee*(1-ankle)],[a+'foot',hip*knee*ankle]].filter(x=>x[1]>.0001);
    };
    L(a+'femur',[[-.073,.008,.016,.017,s*.006,-.012],[-.028,.062,.077,.085,s*.005,-.009],
      [.065,.073,.079,.086,s*.004,-.007],[f*.38,.066,.072,.079,s*.003,-.002],
      [f*.64,.054,.058,.062,s*.002,.001],[f-.050,.045,.048,.048,0,.002],
      [f,.043,.046,.042,0,.003],[f+.075,.039,.038,.054,s*.001,-.002],
      [f+b*.37,.041,.039,.057,s*.001,-.003],[f+b*.66,.033,.033,.043,0,-.001],
      [f+b-.052,.023,.024,.026,0,0],[f+b-.013,.027,.025,.026,0,0],[f+b+.016,.025,.024,.025,0,0],
      [f+b+.035,.005,.006,.006,0,0]],
      {direction:-1,blend:.011,region:'leg',side:s,weights:legWeights});
    // One longitudinal heel/arch/forefoot envelope, with individual anatomical toe rays.
    E(a+'tibia',[-s*.023,-b+.006,.003],[.009,.015,.011],.004);
    E(a+'tibia',[s*.023,-b-.005,-.005],[.008,.017,.010],.004);
    E(a+'foot',[0,-.003,-.025],[.009,.037,.012],.004);
    L(a+'foot',[[ADULT_SPEC.foot.heelSkinZ,.001,.002,.002,0,-.051],[-.062,.021,.018,.021,0,-.051],
      [-.040,.029,.028,.023,0,-.050],[-.005,.029,.043,.022,0,-.050],
      [.035,.030,.041,.017,-s*.001,-.045],[.080,.038,.024,.020,-s*.002,-.052],
      [.119,.046,.020,.017,-s*.001,-.055],[.141,.043,.016,.014,-s*.002,-.056],
      [.160,.036,.012,.012,-s*.004,-.056],[.172,.003,.003,.003,-s*.009,-.055]],
      {axis:2,region:'foot',blend:.004,side:s});
    for(const ray of tissue.human.legs[side].footRays){
      const lengths=ray.toes.map((j,k)=>ray.toes[k+1]?len(ray.toes[k+1].bind):ray.tipLength);
      tissueDigit(tissue,ray.toes,lengths,ray===tissue.human.legs[side].footRays[0]?.0100:.0068,{side:s,toe:true});
    }
  }
}
