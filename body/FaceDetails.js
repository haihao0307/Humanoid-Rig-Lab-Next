// Small surfaces are generated from the same head profile as the skin envelope.
// Open edges end inside that envelope; eyelids and lips are surfaces, not round wires.
const FACE_PROFILE=tissueProfile(ADULT_SPEC.profiles.head);
function tissueHeadFront(x,y){
  const [rx,rf,,cx,cz]=FACE_PROFILE(y),q=(x-cx)/rx;
  const gauss=(v,s)=>Math.exp(-((v/s)**2));
  return cz+rf*Math.sqrt(Math.max(0,1-q*q))
    +.0040*gauss(Math.abs(x)-.046,.022)*gauss(y+.003,.026)
    +.0020*gauss(Math.abs(x)-.028,.023)*gauss(y-.047,.014)
    -.0024*gauss(Math.abs(x)-.031,.019)*gauss(y-.027,.013)
    -.0018*gauss(Math.abs(x)-.043,.020)*gauss(y+.039,.018)
    +tissueNasalRelief(x,y);
}
function tissueEyeFront(side,x,y){
  const [cx,cy]=mirrorBodyPoint(ADULT_SPEC.head.eyeCenterM,side),[w,h]=ADULT_SPEC.head.eyeOpeningM;
  const radius2=((x-cx)/w)**2+((y-cy)/h)**2;
  // The exposed surface follows the facial envelope. A bounded corneal dome
  // replaces the former floating sphere; the lid uses this exact boundary.
  return tissueHeadFront(x,y)+.0006+.0017*Math.max(0,1-radius2);
}
function tissueNasalRelief(x,y){
  const g=(v,s)=>Math.exp(-((v/s)**2));
  const bridge=.011*g(x,.0075)*g(y-.016,.027);
  const tip=.019*g(x,.0095)*g(y+.008,.010);
  const alae=.007*g(Math.abs(x)-.010,.005)*g(y+.014,.007);
  // An unbounded smooth field decays into the same facial surface; no rectangular
  // overlay, duplicated depth layer or clipped normal along a patch boundary.
  return bridge+tip+alae;
}
function tissueNoseFront(x,y){return tissueHeadFront(x,y);}
function tissueAuricle(side){
  const [cx,cy,cz]=mirrorBodyPoint(ADULT_SPEC.head.earCenterM,side),p=[],ix=[],rings=22,sides=64;
  const value=(r,a,back=false)=>{
    const y=Math.cos(a),z=Math.sin(a),height=.024*(1+.10*y),width=.013*(.85+.15*y);
    const concha=-.0030*Math.exp(-(((r-.38)/.26)**2)),helix=.0025*Math.exp(-(((r-.84)/.10)**2));
    return[cx+side*((back?-.003:.002)+.007*(1-r*r)+(back?0:concha+helix)),cy+r*height*y,cz+r*width*z+.003*r*y];
  };
  const loops=[[],[]];
  for(let face=0;face<2;face++){
    const push=(r,a)=>{const id=p.length/3;p.push(...value(r,a,!!face));return id;};
    loops[face].push([push(0,0)]);
    for(let r=1;r<=rings;r++)loops[face].push(Array.from({length:sides},(_,k)=>push(r/rings,k/sides*Math.PI*2)));
    const tri=(a,b,c)=>((side>0)!==!!face)?ix.push(a,b,c):ix.push(a,c,b);
    for(let k=0;k<sides;k++)tri(loops[face][0][0],loops[face][1][k],loops[face][1][(k+1)%sides]);
    for(let r=1;r<rings;r++)for(let k=0;k<sides;k++){const A=loops[face][r],B=loops[face][r+1],n=(k+1)%sides;tri(A[k],B[k],B[n]);tri(A[k],B[n],A[n]);}
  }
  for(let k=0;k<sides;k++){const A=loops[0].at(-1),B=loops[1].at(-1),n=(k+1)%sides;
    side>0?ix.push(A[k],B[k],B[n],A[k],B[n],A[n]):ix.push(A[k],B[n],B[k],A[k],A[n],B[n]);}
  return mesh(p,ix);
}
function tissueFacePatch(fn,along=48,across=8){
  const p=[],indices=[];
  for(let j=0;j<=across;j++)for(let i=0;i<=along;i++)p.push(...fn(i/along,j/across));
  for(let j=0;j<across;j++)for(let i=0;i<along;i++){
    const a=j*(along+1)+i,b=a+1,c=a+along+1;
    indices.push(a,b,c,b,c+1,c);
  }
  const g=mesh(p,indices),sumZ=g.n.reduce((sum,v,k)=>sum+(k%3===2?v:0),0);
  if(sumZ<0){for(let i=0;i<g.i.length;i+=3)[g.i[i+1],g.i[i+2]]=[g.i[i+2],g.i[i+1]];for(let i=0;i<g.n.length;i++)g.n[i]*=-1;}
  return g;
}
function makeAnatomicalFace(tissue){
  const joint=tissue.human.byId.get('head'),items=[],face=ADULT_SPEC.head;
  const addDetail=(id,g,color=tissue.skinColor,materialKind=0)=>items.push({id,joint,g,color,materialKind});
  for(const s of [-1,1]){
    const [cx,cy,cz]=mirrorBodyPoint(face.eyeCenterM,s),[rx,ry,rz]=face.eyeRadiiM,[w,h]=face.eyeOpeningM;
    addDetail(`eye_${s}`,tissueEyePatch(s),[.51,.49,.44],4);
    addDetail(`iris_${s}`,tissueEyePatch(s,face.irisRadiusM,.00012),[.045,.033,.023],4);
    addDetail(`pupil_${s}`,tissueEyePatch(s,face.pupilRadiusM,.00024),[.004,.004,.004],4);
    for(const upper of [-1,1])addDetail(`lid_${s}_${upper}`,tissueFacePatch((t,u)=>{
      const a=Math.PI*t,ex=w*Math.cos(a),ey=upper*h*Math.sin(a);
      const x=cx+(w+.004*u)*Math.cos(a),y=cy+upper*(h+.006*u)*Math.sin(a);
      const edge=tissueEyeFront(s,cx+ex,cy+ey)+.00015;
      const outer=tissueHeadFront(x,y)-.00025;
      return [x,y,edge*(1-u)+outer*u+.00035*Math.sin(Math.PI*u)];
    }));
    addDetail(`brow_${s}`,tissueFacePatch((t,u)=>{
      const x=s*(.014+.034*t),arch=Math.sin(Math.PI*t),y=.048+.004*arch+(u-.5)*.0024*arch;
      return[x,y,tissueHeadFront(x,y)+.00035];
    },36,4),[.065,.046,.034]);
    addDetail(`nostril_${s}`,ellipsoid([s*.008,-.018,tissueNoseFront(s*.008,-.018)+.00015],[.0027,.0014,.0005],22,12),[.10,.049,.038]);
    const [ex,ey,ez]=mirrorBodyPoint(face.earCenterM,s),[erx,ery,erz]=face.earRadiiM;
    addDetail(`ear_concha_helix_${s}`,tissueAuricle(s));
    addDetail(`ear_antihelix_${s}`,sweep(t=>[ex+s*erx*.56,ey-.007+.019*t,ez-.001+.004*Math.sin(Math.PI*t)],.0012,24,10));
    addDetail(`ear_tragus_${s}`,ellipsoid([ex+s*erx*.55,ey-.004,ez+.008],[.0028,.0040,.0027],20,12));
  }
  const [mx,my]=face.mouthCenterM,w=face.mouthHalfWidthM;
  for(const upper of [true,false])addDetail(`lip_${upper?'upper':'lower'}`,tissueFacePatch((t,u)=>{
    const x=mx+(2*t-1)*w,arc=Math.sin(Math.PI*t);
    const cupid=upper?(.76+.24*Math.cos((Math.abs(x-mx)/w-.30)*Math.PI*2)):1;
    const height=face.lipHeightsM[upper?0:1]*arc*cupid;
    const y=my+(upper?1:-1)*(.00035*arc+height*u);
    const z=tissueHeadFront(x,y)+.0022*arc*(1-u)+.0021*arc*Math.sin(Math.PI*u)-.0009*u;
    return [x,y,z];
  }),[.40,.21,.17]);
  // Closed mouth seam sits behind both vermilion surfaces.
  addDetail('mouth_seam',tissueFacePatch((t,u)=>{
    const x=mx+(2*t-1)*w*.98,arc=Math.sin(Math.PI*t),y=my+(u-.5)*.0012*arc;
    return[x,y,tissueHeadFront(x,y)+.0008*arc];
  },48,2),[.15,.065,.047]);
  return items;
}
