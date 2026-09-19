/* Parameter-generated eyelid tissue fitted to the current neutral skin aperture.
 * No captured mesh is saved. Eye frames come from the existing source surfaces.
 * Inspired by spherical-coordinate lid sliding, not a tissue simulation:
 * https://disneyanimation.com/publications/realistic-eye-motion-using-procedural-geometric-methods/
 * R24 uses the paper's separately fitted neutral/closed curve principle.
 * Orbital support and pretarsal/preseptal plane separation were studied in
 * Proko's author-written lesson notes (no images or geometry incorporated):
 * https://www.proko.com/course-lesson/how-to-draw-eyes-anatomy-and-structure/
 */
// The superior limbus is covered by the upper lid. The highest upper arc is
// medial and the lowest lower arc temporal; mirroring one symmetric ellipse
// put both anatomical extrema on the wrong side of the pupil.
// https://eyewiki.aao.org/Eyelid_Reconstruction
// Register the optical globe against the source-fitted orbital skin. The old
// 2 mm posterior shift left the free margin 5-6 mm behind the adjacent skin,
// creating a concave bowl instead of a lid lying over the globe.
const COMPACT_EYE_ANATOMY={revision:'r25b-canthus-owned-aperture-family',baselineRevision:'r24-span-aware-lid-return',recess:-.0025,blinkRetractionM:.0010,segments:96,rings:48,
  fissure:{halfWidth:.0133,upperHeight:.00405,lowerHeight:.00425,lateralCanthusLift:.00070,upperTemporalBias:-.10,lowerTemporalBias:-.07,verticalRoundness:.22,canthusAttachmentStart:.38,upperFoldM:.00020,lowerSulcusM:.00007},
  closure:{centreY:-.00240,envelopePower:2},
  outerBand:{canthus:.00180,upper:.00850,lower:.00460,marginRadial:.016,marginOffset:0},
  rim:{upperDepthM:.00095,lowerDepthM:.00065,upperWidthM:.00030,lowerWidthM:.00034,upperLiftM:.00078,lowerLiftM:.00047,closedDepthM:.00004,wetFraction:.22},
  tissue:{upperFoldDistanceM:.00315,lowerFoldDistanceM:.00175,upperTurnSpanM:.00300,lowerTurnSpanM:.00180,upperMinimumPlateM:.00100,lowerMinimumPlateM:.00075,upperMinimumTurnM:.00120,lowerMinimumTurnM:.00090,upperReturnAllowanceM:.00055,lowerReturnAllowanceM:.00016,plateExcessM:.00032,supportBlendM:.00080},
  cornea:{curvatureRadiusM:.00772,asphericity:-.26,apexOffsetM:.00450,shellExtentM:.00850},
  iris:{outerRadius:.00585,pupilRadius:.00210,planeOffset:.00065,curve:.00055,segments:128,rings:24},
  lashes:{upperCount:68,lowerCount:28,segments:9,sides:6,upperLength:.0033,lowerLength:.0016,rootRadius:.000026,tipRadius:.000003,upperBlinkTurnRad:-.18,lowerBlinkTurnRad:.06},
  left:{centre:[.029181616,1.518095373,.152055491],radius:.012623681},
  right:{centre:[-.030466569,1.518094244,.151979130],radius:.012591195}};
function compactEyeOuterOverlap(angle){
  const p=COMPACT_EYE_ANATOMY.outerBand,s=Math.sin(angle),vertical=Math.abs(s),pole=s>=0?p.upper:p.lower;
  return p.canthus+(pole-p.canthus)*vertical*vertical;
}
function compactEyeSmooth01(value){const t=clamp(value,0,1);return t*t*(3-2*t);}
function compactEyeRestApertureY(angle,side,state=[0,0,0]){
  const p=COMPACT_EYE_ANATOMY.fissure,c=Math.cos(angle),s=Math.sin(angle),vertical=Math.abs(s),sideSign=side==='left'?1:-1,lateral=c*sideSign,canthus=vertical*vertical;
  const height=s>=0?p.upperHeight*(1+p.upperTemporalBias*lateral):p.lowerHeight*(1-p.lowerTemporalBias*lateral);
  const neutral=(s>=0?1:-1)*height*vertical*(1-p.verticalRoundness+p.verticalRoundness*vertical)+p.lateralCanthusLift*lateral*(1-canthus);
  const narrow=state[0]||0,wide=state[1]||0;
  return neutral+((s>=0?-.0022:.0014)*narrow+(s>=0?.0019:-.0004)*wide)*canthus;
}
function compactEyeClosedApertureY(angle,side,canthusSlopes=[0,0]){
  const p=COMPACT_EYE_ANATOMY.fissure,c=Math.cos(angle),u=(c+1)*.5,u2=u*u,u3=u2*u,sideSign=side==='left'?1:-1;
  const left=-p.lateralCanthusLift*sideSign,right=p.lateralCanthusLift*sideSign,m0=(canthusSlopes[0]||0)*2*p.halfWidth,m1=(canthusSlopes[1]||0)*2*p.halfWidth;
  const base=(2*u3-3*u2+1)*left+(u3-2*u2+u)*m0+(-2*u3+3*u2)*right+(u3-u2)*m1;
  // Endpoint slopes are boundary conditions only. The quartic envelope has
  // zero value and derivative at both canthi and restores the authored centre.
  const centreFromTangents=(m0-m1)*.125,envelope=Math.pow(Math.max(0,1-c*c),COMPACT_EYE_ANATOMY.closure.envelopePower);
  return base+(COMPACT_EYE_ANATOMY.closure.centreY-centreFromTangents)*envelope;
}
// One aperture family owns both open and closed free margins. The canthi are
// invariant endpoints and keep the fitted attachment tangent; blink moves only
// the interior of the shared curve.
function compactEyeAperturePoint(angle,side,state=[0,0,0],canthusSlopes=[0,0]){
  const p=COMPACT_EYE_ANATOMY.fissure,c=Math.cos(angle),restY=compactEyeRestApertureY(angle,side,state),closedY=compactEyeClosedApertureY(angle,side,canthusSlopes),closing=compactEyeSmooth01(state[2]||0);
  return [p.halfWidth*c,restY+(closedY-restY)*closing];
}
function compactEyeNeutralFissure(angle,side){return compactEyeAperturePoint(angle,side,[0,0,0]);}
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
// A shared conic surface owns both the visible cornea and tissue contact.
// Navarro et al. (1985), https://doi.org/10.1364/JOSAA.2.001273,
// motivates an aspheric anterior surface, not an individual anatomical fit.
// The 7.0 mm registered apex and iris placement are authored calibration.
function compactEyeCorneaDepth(x,y){
  const p=COMPACT_EYE_ANATOMY.cornea,r2=x*x+y*y,root=Math.sqrt(Math.max(1e-12,p.curvatureRadiusM*p.curvatureRadiusM-(1+p.asphericity)*r2));
  return p.apexOffsetM-COMPACT_EYE_ANATOMY.recess-r2/(p.curvatureRadiusM+root);
}
function compactEyeContactDepth(x,y,globe,blink=0){
  const q=clamp((blink-.35)/.65,0,1),retraction=COMPACT_EYE_ANATOMY.blinkRetractionM*q*q*(3-2*q);
  const [sx,sy,sz,radius]=globe,sclera=sz-retraction+Math.sqrt(Math.max(.000002,radius*radius-(x-sx)*(x-sx)-(y-sy)*(y-sy)));
  const corneal=COMPACT_EYE_ANATOMY.cornea,participation=x*x+y*y<corneal.shellExtentM*corneal.shellExtentM?1:0,cornea=compactEyeCorneaDepth(x,y)-retraction;
  const h=clamp(.5+.5*(sclera-cornea)/.0003,0,1);
  return sclera+.00028+participation*((cornea-sclera)*(1-h)+.0003*h*(1-h));
}
// C2 Hermite sections separate the thin moving pretarsal surface from the
// preseptal skin. They share a depth, tangent and zero meridional curvature at
// the fold; the fold unfolds without deleting the entire support profile.
function compactEyeSectionDepth(t,z0,z1,m0,m1,knot,knotZ,knotSlope){
  const first=t<knot,span=first?knot:1-knot,u=first?t/span:(t-knot)/span;
  const a=first?z0:knotZ,b=first?knotZ:z1,da=(first?m0:knotSlope)*span,db=(first?knotSlope:m1)*span;
  const u2=u*u,u3=u2*u,u4=u3*u,u5=u4*u;
  return a*(1-10*u3+15*u4-6*u5)+da*(u-6*u3+8*u4-3*u5)+b*(10*u3-15*u4+6*u5)+db*(-4*u3+7*u4-3*u5);
}
// The closed lid is a complete attachment curve, not a neutral fold pushed
// forwards and joined back through a second hollow. Integrating endpoint
// slopes avoids a secondary extremum for compatible fitted depth/tangent
// budgets. Actual outer depth AND tangent survive; no rim collar or
// additive fat pad hides a mismatch. The broader orbital root supplies room
// for that transition. The relaxed basis has zero endpoint curvature; it is
// an authored curve, not a tissue simulation or measured soft-tissue model.
function compactEyeClosedDepth(t,z0,z1,m0,m1){
  const q=clamp(t,0,1),delta=z1-z0,total=Math.abs(m0)+Math.abs(m1),opposed=(m0*delta<=0?Math.abs(m0):0)+(m1*delta<=0?Math.abs(m1):0);
  const power=clamp(Math.max(total/Math.max(Math.abs(delta),.00025)*2.5-2,2*opposed/.0006-2),2,120),order=power+2,remainder=delta-2*(m0+m1)/order;
  return z0+m0*(2-Math.pow(1-q,power+1)*(2+power*q))/order+m1*Math.pow(q,power+1)*(order-power*q)/order+remainder*q*q*q*(10-15*q+6*q*q);
}
// Three physical sections share endpoint depth and tangent. The moving plate
// rests on the globe; its return ends at the sampled facial support, rather
// than at an arbitrary percentage of the inner-to-outer depth difference.
function compactEyeTissueDepth(t,z0,z1,m0,m1,a,za,ma,b,zb,mb){
  const first=t<a,last=t>=b,lo=first?0:last?b:a,hi=first?a:last?1:b;
  const span=hi-lo,u=(t-lo)/span,p=first?z0:last?zb:za,q=first?za:last?z1:zb,dp=(first?m0:last?mb:ma)*span,dq=(first?ma:last?m1:mb)*span;
  const u2=u*u,u3=u2*u,u4=u3*u,u5=u4*u;
  return p*(1-10*u3+15*u4-6*u5)+dp*(u-6*u3+8*u4-3*u5)+q*(10*u3-15*u4+6*u5)+dq*(-4*u3+7*u4-3*u5);
}
function compactEyeRimSection(angle,blink){
  const p=COMPACT_EYE_ANATOMY.rim,s=Math.sin(angle),taper=s*s,closing=blink*blink*(3-2*blink),open=1-closing;
  return {width:(s>=0?p.upperWidthM:p.lowerWidthM)*taper*open,depth:((s>=0?p.upperDepthM:p.lowerDepthM)*open+p.closedDepthM*closing)*taper,lift:(s>=0?p.upperLiftM:p.lowerLiftM)*taper*open};
}
function compactEyeRimDirection(angle){
  const p=COMPACT_EYE_ANATOMY.fissure,x=Math.cos(angle)*(Math.sin(angle)>=0?p.upperHeight:p.lowerHeight),y=Math.sin(angle)*p.halfWidth,d=Math.hypot(x,y);
  return [x/d,y/d];
}
function compactEyeRimSurface(angle,u,side,outer,gradient,globe,corners,state,section){
  const base=compactEyePatchPoint(angle,0,side,outer,gradient,globe,corners,state,0,section),rim=compactEyeRimSection(angle,state[2]),direction=compactEyeRimDirection(angle),q=clamp(u,0,1);
  const backX=base[0]-direction[0]*rim.width,backY=base[1]-direction[1]*rim.width;
  const backZ=Math.max(base[2]-rim.depth,compactEyeContactDepth(backX,backY,globe,state[2])-.00028+.000045);
  return [backX+(base[0]-backX)*q,backY+(base[1]-backY)*q,backZ+(base[2]-backZ)*q];
}
// Every pose reconstructs the whole meridian. The outer position and tangent
// remain fixed; the free inner margin travels across the eye contact surface.
function compactEyePatchPoint(angle,t,side,outer,gradient,globe,corners,state=[0,0,0],margin=0,section=null){
  if(t<0){const p=COMPACT_EYE_ANATOMY;return compactEyeRimSurface(angle,p.rim.wetFraction+(1-p.rim.wetFraction)*(t+p.outerBand.marginRadial)/p.outerBand.marginRadial,side,outer,gradient,globe,corners,state,section);}
  const c=Math.cos(angle),s=Math.sin(angle),neutral=compactEyeNeutralFissure(angle,side),aperture=compactEyeAperturePoint(angle,side,state,corners.slopes||[0,0]);
  const restY=neutral[1],rim=compactEyeRimSection(angle,state[2]),rimDirection=compactEyeRimDirection(angle),ex=aperture[0]+rimDirection[0]*rim.width;
  // The free margin and the closed seam now come from the same canthus-owned
  // curve family. Source-skin slopes are confined to canthus endpoint tangents and depth attachments.
  const closureU=(c+1)*.5,ey=aperture[1]+rimDirection[1]*rim.width;
  const x=ex+(outer[0]-ex)*t,y=ey+(outer[1]-ey)*t,dx=outer[0]-ex,dyRadial=outer[1]-ey;
  const base=compactEyeContactDepth(ex,ey,globe,state[2]),corner=c<0?corners[0]:corners[1];
  // The nasal skin lies far ahead of the lateral globe in this source. Its
  // attachment must spread across the medial lid, not start beyond x=9.3 mm
  // and force a six-millimetre wall into the next few radial cells.
  const cornerStart=COMPACT_EYE_ANATOMY.fissure.canthusAttachmentStart,a=clamp((Math.abs(c)-.70)/.30,0,1),endWeight=a*a*(3-2*a);
  const cu=clamp((Math.abs(c)-cornerStart)/(.72-cornerStart),0,1),cv=clamp((Math.abs(c)-.72)/.22,0,1),cu2=cu*cu,cu3=cu2*cu,cv2=cv*cv,cv3=cv2*cv;
  const spreadWeight=.5*(-2*cu3+3*cu2)+1.3*(.72-cornerStart)*(cu3-cu2),joinWeight=.5*(2*cv3-3*cv2+1)+.286*(cv3-2*cv2+cv)+.896*(-2*cv3+3*cv2)+.704*(cv3-cv2);
  const cornerWeight=Math.abs(c)<.72?spreadWeight:Math.abs(c)<.94?joinWeight:endWeight,restInner=base+(Math.max(base,corner)-base)*cornerWeight;
  const closing=state[2]*state[2]*(3-2*state[2]),closedBridge=corners[0]+(corners[1]-corners[0])*closureU;
  const bridgeWeight=closing*(1-cornerWeight*cornerWeight*cornerWeight),inner=restInner+(Math.max(base,closedBridge)-restInner)*bridgeWeight+rim.lift;
  const eps=.0001,slope=((compactEyeContactDepth(ex+eps,ey,globe,state[2])-compactEyeContactDepth(ex-eps,ey,globe,state[2]))*dx+(compactEyeContactDepth(ex,ey+eps,globe,state[2])-compactEyeContactDepth(ex,ey-eps,globe,state[2]))*dyRadial)/(2*eps);
  const delta=outer[2]+.00004-inner,m1=clamp(gradient[0]*dx+gradient[1]*dyRadial,-.020,.020);
  // Near an attached canthus use the skin tangent; where the free margin is
  // supported by the optical envelope retain its spherical tangent at blink.
  // The old closed m0=0 followed by max(contact) created a second cap boundary.
  const gap=clamp((inner-base-.00004)/.00060,0,1),contactWeight=1-gap*gap*(3-2*gap);
  const bridgeSlope=(corners[1]-corners[0])/(2*COMPACT_EYE_ANATOMY.fissure.halfWidth)*dx;
  const m0=clamp((slope*contactWeight+bridgeSlope*(1-contactWeight))*(1-cornerWeight)+m1*cornerWeight,-.020,.020);
  const p=COMPACT_EYE_ANATOMY.fissure,foldStrength=(s>=0?1-.92*closing:1-.55*closing)*Math.abs(s);
  const foldDepth=(s>=0?p.upperFoldM:p.lowerSulcusM)*foldStrength;
  // A steep inherited attachment is confined to its outer section, rather
  // than forcing a new .82..1 rim blend into every otherwise smooth meridian.
  const authored=section&&section[0]>0,restFraction=authored?section[0]:.48;
  const restKnotX=neutral[0]+(outer[0]-neutral[0])*restFraction,restKnotY=restY+(outer[1]-restY)*restFraction;
  const projected=((restKnotX-ex)*dx+(restKnotY-ey)*dyRadial)/Math.max(1e-10,dx*dx+dyRadial*dyRadial);
  const knot=authored?clamp(projected,.12,.92):Math.max(s>=0?.48+.15*closing:.48,1-.0034/Math.max(.0034,Math.abs(m1)));
  const restKnotZ=authored?section[1]+section[2]*(ex+dx*knot-restKnotX)+section[3]*(ey+dyRadial*knot-restKnotY)-foldDepth:inner+delta*knot-foldDepth;
  const restKnotSlope=authored?clamp(section[2]*dx+section[3]*dyRadial,-.020,.020):delta*(1-foldStrength*.75);
  // The anatomical support is not the exposed tissue surface: a continuous
  // layer spans the plate and folds onto it. The E experiment copied optical
  // slopes into the plate, then turned them around in 1.6 mm: a visible bright
  // disc and hard gutter. Here the plate has its own section and the optical
  // envelope is only a constraint. All allowances are authored, not measured.
  const tissue=COMPACT_EYE_ANATOMY.tissue,radialLength=Math.max(.001,Math.hypot(dx,dyRadial));
  // A 1.0 mm nasal support interval cannot contain a 1.8 mm return. G forced
  // its plate into a 0.15 mm interval while retaining a 2.1 mm height gain.
  // Allocate physical space before constructing the stations, and smoothly
  // suppress an independent fold where there is only room for attachment.
  const requestedTurn=s>=0?tissue.upperTurnSpanM:tissue.lowerTurnSpanM,sourceDistance=knot*radialLength;
  const minimumPlate=s>=0?tissue.upperMinimumPlateM:tissue.lowerMinimumPlateM,minimumTurn=s>=0?tissue.upperMinimumTurnM:tissue.lowerMinimumTurnM;
  const allocation=clamp((sourceDistance-minimumPlate-minimumTurn)/(requestedTurn-minimumTurn),0,1),allocationWeight=allocation*allocation*allocation*(10-15*allocation+6*allocation*allocation);
  const turnSpan=Math.min(requestedTurn,sourceDistance*.55)/radialLength;
  const plate=knot-turnSpan,plateX=ex+dx*plate,plateY=ey+dyRadial*plate;
  const returnAllowance=(s>=0?tissue.upperReturnAllowanceM:tissue.lowerReturnAllowanceM)*(.4+.6*closing);
  const returnX=ex+dx*knot,returnY=ey+dyRadial*knot,returnSource=restKnotZ+foldDepth+.00004+returnAllowance;
  const returnContact=compactEyeContactDepth(returnX,returnY,globe,state[2])+tissue.plateExcessM;
  const returnH=clamp(.5+.5*(returnSource-returnContact)/tissue.supportBlendM,0,1);
  const returnZ=returnContact+(returnSource-returnContact)*returnH+tissue.supportBlendM*returnH*(1-returnH);
  const returnContactSlope=((compactEyeContactDepth(returnX+eps,returnY,globe,state[2])-compactEyeContactDepth(returnX-eps,returnY,globe,state[2]))*dx+(compactEyeContactDepth(returnX,returnY+eps,globe,state[2])-compactEyeContactDepth(returnX,returnY-eps,globe,state[2]))*dyRadial)/(2*eps);
  const tissueReturnSlope=restKnotSlope*(s>=0?.32:.75),returnSlope=clamp(returnContactSlope+(tissueReturnSlope-returnContactSlope)*returnH,-.020,.020);
  // This station belongs to the tarsal sheet, so it is not forced to inherit
  // the much tighter corneal radius. A bounded contact correction supplies
  // thickness only where the actual globe needs it.
  const plateSource=inner+(returnZ-inner)*(s>=0?.30:.55),plateSourceSlope=(returnZ-inner)/Math.max(.05,knot)*.55;
  const plateContact=compactEyeContactDepth(plateX,plateY,globe,state[2])+tissue.plateExcessM;
  const plateH=clamp(.5+.5*(plateSource-plateContact)/tissue.supportBlendM,0,1);
  const plateZ=plateContact+(plateSource-plateContact)*plateH+tissue.supportBlendM*plateH*(1-plateH);
  const plateContactSlope=((compactEyeContactDepth(plateX+eps,plateY,globe,state[2])-compactEyeContactDepth(plateX-eps,plateY,globe,state[2]))*dx+(compactEyeContactDepth(plateX,plateY+eps,globe,state[2])-compactEyeContactDepth(plateX,plateY-eps,globe,state[2]))*dyRadial)/(2*eps);
  const plateSlope=clamp(plateContactSlope+(plateSourceSlope-plateContactSlope)*plateH,-.020,.020);
  const fittedDepth=compactEyeTissueDepth(t,inner,outer[2]+.00004,m0,m1,plate,plateZ,plateSlope,knot,returnZ,returnSlope);
  const fallbackDepth=compactEyeClosedDepth(t,inner,outer[2]+.00004,m0,m1);
  const canthalReturn=clamp(Math.abs(s)/.55,0,1),canthalWeight=canthalReturn*canthalReturn*canthalReturn*(10-15*canthalReturn+6*canthalReturn*canthalReturn);
  let depth=fallbackDepth+(fittedDepth-fallbackDepth)*(authored?canthalWeight*allocationWeight:0);
  const contact=compactEyeContactDepth(x,y,globe,state[2]),h=clamp(.5+.5*(depth-contact)/.00008,0,1),supported=contact+(depth-contact)*h+.00008*h*(1-h);
  const q=clamp((t-.80)/.20,0,1),q3=q*q*q;depth+=(supported-depth)*(1-q3*(10-15*q+6*q*q));
  return [x,y,depth+margin];
}
// The mucocutaneous edge has a cross-section: the rounded anterior edge meets
// the skin while its posterior side rests against the globe. It must not be
// represented by a second coplanar painted ring. Its physical width remains
// stable when the surrounding orbital support band changes width.
function compactEyeMarginPoint(angle,t,side,outer,gradient,globe,corners,state=[0,0,0],section=null){
  const p=COMPACT_EYE_ANATOMY;return compactEyeRimSurface(angle,clamp(t/p.outerBand.marginRadial,0,1)*p.rim.wetFraction,side,outer,gradient,globe,corners,state,section);
}
// The caruncle/plica occupy a thin bed inside the medial convergence of the
// margins. Both borders derive from that same posed edge, rather than placing
// a small disconnected pink ellipsoid at a fixed world position.
// https://kellogg.umich.edu/theeyeshaveit/anatomy/external-eye.html
function compactEyeTearPoint(angle,v,side,globe,corners,state=[0,0,0]){
  const upper=compactEyePatchPoint(angle,0,side,[0,0,0],[0,0],globe,corners,state),lower=compactEyePatchPoint(-angle,0,side,[0,0,0],[0,0],globe,corners,state);
  const p=lower.map((value,i)=>value+(upper[i]-value)*v),envelope=4*v*(1-v),inset=.00012+.00016*envelope;
  p[2]-=inset;return p;
}
function compactEyeIrisDepth(radial,angle){
  const p=COMPACT_EYE_ANATOMY.iris,envelope=Math.sin(Math.PI*radial)**2;
  const collarette=.00010*Math.exp(-(((radial-.28)/.13)**2));
  const fibres=.000027*Math.sin(57*angle+1.3*Math.sin(13*angle)+9*radial)*envelope;
  // Recess the pupillary region behind the limbus: the iris is a concave
  // tissue dish under a separate convex cornea, not another convex eyeball.
  // Sorici's authored-eye breakdown motivates this layer separation; this
  // shape and its microscopic relief are generated here without baked maps.
  return p.planeOffset-COMPACT_EYE_ANATOMY.recess+p.curve*radial*radial+collarette+fibres;
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
      const r=Math.hypot(x,y),overlap=compactEyeOuterOverlap(angle),ox=x*(1+overlap/r),oy=y*(1+overlap/r),z=sample(ox,oy);
      const eps=.00025,zx1=sample(ox+eps,oy),zx0=sample(ox-eps,oy),zy1=sample(ox,oy+eps),zy0=sample(ox,oy-eps);
      outer.push([ox,oy,z??.008,zx1!==null&&zx0!==null?(zx1-zx0)/(2*eps):0,zy1!==null&&zy0!==null?(zy1-zy0)/(2*eps):0]);
    }
    // Regularize the fitted closed boundary before taking angular derivatives.
    const original=outer.map(row=>row.slice());
    for(let i=0;i<count;i++)for(let k=0;k<5;k++){let sum=0,weight=0;for(let d=-5;d<=5;d++){const w=Math.exp(-d*d/8);sum+=original[(i+d+count)%count][k]*w;weight+=w;}outer[i][k]=sum/weight;}
    for(const o of outer){const e=.001,z=sample(o[0],o[1]),xp=sample(o[0]+e,o[1]),xm=sample(o[0]-e,o[1]),yp=sample(o[0],o[1]+e),ym=sample(o[0],o[1]-e);if(z!==null)o[2]=z;if(xp!==null&&xm!==null)o[3]=(xp-xm)/(2*e);if(yp!==null&&ym!==null)o[4]=(yp-ym)/(2*e);}
    // Sample the actual orbital skin at the pretarsal/preseptal junction.
    // Interpolating its depth from the free edge and outer rim put the R19
    // junction ~1.5 mm in front of the available source support: a fake mound.
    const sections=outer.map((o,i)=>{const e=edge[i],angle=i/count*Math.PI*2,s=Math.sin(angle),span=Math.hypot(o[0]-e[0],o[1]-e[1]);
      // The fold has a physical distance from the free edge. Expanding the
      // orbital attachment must not drag the tarsal/fold landmark upwards.
      const distance=s>=0?COMPACT_EYE_ANATOMY.tissue.upperFoldDistanceM:COMPACT_EYE_ANATOMY.tissue.lowerFoldDistanceM;
      let fraction=clamp(distance/Math.max(.001,span),.18,.70),z=null,x,y;
      for(;fraction<.89;fraction+=.04){x=e[0]+(o[0]-e[0])*fraction;y=e[1]+(o[1]-e[1])*fraction;z=sample(x,y);if(z!==null)break;}
      fraction=Math.min(fraction,.88);x=e[0]+(o[0]-e[0])*fraction;y=e[1]+(o[1]-e[1])*fraction;
      z=sample(x,y);if(z===null)return [0,0,0,0];
      const eps=.0005,xp=sample(x+eps,y),xm=sample(x-eps,y),yp=sample(x,y+eps),ym=sample(x,y-eps);
      return [fraction,z,xp!==null&&xm!==null?(xp-xm)/(2*eps):o[3],yp!==null&&ym!==null?(yp-ym)/(2*eps):o[4]];
    });
    const interpolate=(rows,angle)=>{const f=((angle/(2*Math.PI)%1)+1)%1*count,i=Math.floor(f),t=f-i;return rows[i].map((x,j)=>x+(rows[(i+1)%count][j]-x)*t);};
    const sphereLocal=sub(sphere.centre,frame.centre),globe=[dot(sphereLocal,frame.u),dot(sphereLocal,frame.v),dot(sphereLocal,frame.n)-COMPACT_EYE_ANATOMY.recess,sphere.radius];
    const contactDepth=(x,y)=>compactEyeContactDepth(x,y,globe);
    // A canthus is attached to orbital/nasal skin, not the equator of a sphere.
    // Capping it to sphere-contact + 2.5 mm placed the medial attachment over
    // 20 mm behind the source skin. Extrapolate the fitted local skin tangent
    // to the authored fissure end instead; the globe remains a contact floor.
    const cornerDepth=[count/2,0].map(i=>{const o=outer[i],e=edge[i],skin=o[2]+o[3]*(e[0]-o[0])+o[4]*(e[1]-o[1]);return Math.max(contactDepth(...e),skin);});
    cornerDepth.slopes=[count/2,0].map(i=>(outer[i][1]-edge[i][1])/(outer[i][0]-edge[i][0]));
    canthusDepths[side]=cornerDepth;
    const localPoint=(angle,t,margin=false)=>{const o=interpolate(outer,angle),section=interpolate(sections,angle);return margin?compactEyeMarginPoint(angle,t,side,o,o.slice(3),globe,cornerDepth,[0,0,0],section):compactEyePatchPoint(angle,t,side,o,o.slice(3),globe,cornerDepth,[0,0,0],0,section);};
    const point=(angle,t,margin=false)=>{const p=localPoint(angle,t,margin);return add(frame.centre,add(mul(frame.u,p[0]),add(mul(frame.v,p[1]),mul(frame.n,p[2]))));};
    function meshPart(name,radialStart,radialEnd,nr){
      const positions=[],normals=[],params=[],tangentU=[],tangentV=[],outerPosition=[],outerTangentU=[],outerGradient=[],outerGradientU=[],eyeSection=[],indices=[],epsilon=.002;
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
        outerPosition.push(...o.slice(0,3));outerTangentU.push(...du.slice(0,3));outerGradient.push(...o.slice(3));outerGradientU.push(...du.slice(3));eyeSection.push(...interpolate(sections,angle));
      }
      // The physical cross-section converges to a point at each canthus.
      // Keep the valid fan triangles, omitting only zero-area corner cells.
      for(let i=0;i<count;i++)for(let j=0;j<nr;j++){const a=i*(nr+1)+j,b=a+nr+1;for(const tri of [[a,a+1,b],[a+1,b+1,b]]){const [p,q,r]=tri.map(id=>positions.slice(id*3,id*3+3));if(Math.hypot(...cross(sub(q,p),sub(r,p)))>1e-15)indices.push(...tri);}}
      const vertices=positions.length/3,ids=new Uint16Array(vertices*COMPACT_INFLUENCES),weights=new Uint16Array(ids.length),colors=new Uint8Array(vertices*3);
      for(let i=0;i<vertices;i++){ids[i*COMPACT_INFLUENCES]=head;weights[i*COMPACT_INFLUENCES]=65535;colors.set([190,160,132],i*3);}
      const canonicalPositions=Float32Array.from(positions);
      output.push({name,eyeSide:side,eyeLid:true,sourceGroup:'procedural-eye-tissue',origin:[0,0,0],extent:[1,1,1],vertices,triangles:indices.length/3,
        canonicalPositions,positions:Float32Array.from(positions,p=>p*statureScale),normals:Int16Array.from(normals),indices:Uint16Array.from(indices),
        eyeParams:Float32Array.from(params),eyeTangentU:Float32Array.from(tangentU),eyeTangentV:Float32Array.from(tangentV),
        eyeOuterPosition:Float32Array.from(outerPosition),eyeOuterTangentU:Float32Array.from(outerTangentU),eyeOuterGradient:Float32Array.from(outerGradient),eyeOuterGradientU:Float32Array.from(outerGradientU),
        eyeSection:Float32Array.from(eyeSection),
        binding:{ids,weights,colors,groupCounts:{head:vertices},maximumWeightError:0}});
      report.triangles+=indices.length/3;
    }
    meshPart('eyeLidSkin',0,1,rings);
    // An anterior skin-coloured face turns down (upper lid) or up (lower).
    // Its posterior edge meets a separate narrow wet band. Negative radial
    // parameters select the skin cross-section without a new material class.
    meshPart('eyeLidSkin',-COMPACT_EYE_ANATOMY.outerBand.marginRadial,-1e-9,4);
    meshPart('eyeLidMargin',0,COMPACT_EYE_ANATOMY.outerBand.marginRadial,4);
    // Individual tapered curved fibres, rooted in the anterior lid margin.
    // For this mesh only, tangentU/V carry offset/normal coordinates in the
    // root's moving lid frame. The shader rebuilds that frame for every blink;
    // no static lash card, texture, or painted eyeliner is involved.
    const lashes=COMPACT_EYE_ANATOMY.lashes,lashPositions=[],lashNormals=[],lashParams=[],lashOffsets=[],lashLocalNormals=[],lashOuter=[],lashOuterU=[],lashGradient=[],lashGradientU=[],lashSections=[],lashIndices=[];
    const random=seed=>{const v=Math.sin(seed*127.1+91.7)*43758.5453123;return v-Math.floor(v);};
    const lift=(p,u,v,n)=>add(mul(u,p[0]),add(mul(v,p[1]),mul(n,p[2])));
    for(const upper of [true,false])for(let strand=0;strand<(upper?lashes.upperCount:lashes.lowerCount);strand++){
      const seed=strand+1+(upper?0:271)+(side==='left'?0:641),total=upper?lashes.upperCount:lashes.lowerCount;
      const across=(strand+.5+(random(seed)-.5)*.55)/total,lo=side==='left'?-.84:-.94,hi=side==='left'?.94:.84,x=lo+(hi-lo)*across,angle=(upper?1:-1)*Math.acos(x);
      const o=interpolate(outer,angle),e=compactEyeNeutralFissure(angle,side),span=Math.hypot(o[0]-e[0],o[1]-e[1]),rootT=clamp((.00018+.00018*random(seed+10))/Math.max(.001,span),.012,.10);
      const root=localPoint(angle,rootT),eps=.001,u=norm(sub(localPoint(angle+eps,rootT),localPoint(angle-eps,rootT))),radial=sub(localPoint(angle,rootT+eps),localPoint(angle,rootT-eps));
      let n=norm(cross(radial,u));if(n[2]<0)n=mul(n,-1);const v=norm(cross(u,n));
      const group=Math.floor(strand/4),groupSeed=group+39+(upper?0:131)+(side==='left'?0:347),groupCentre=(group*4+1.6+random(groupSeed))/total;
      const groupX=lo+(hi-lo)*groupCentre,length=(upper?lashes.upperLength:lashes.lowerLength)*(.70+.30*Math.abs(Math.sin(angle)))*(.76+.28*random(groupSeed+5))*(.76+.38*random(seed+20));
      const sideSign=side==='left'?1:-1,lateral=x*sideSign;
      const targetX=(groupX-x)*COMPACT_EYE_ANATOMY.fissure.halfWidth*.72+sideSign*length*(.12+.12*(.5+.5*lateral))+.00012*(random(seed+30)-.5);
      // Author the groom in the eye frame, then express it in the attachment
      // basis. Using the tilted skin normal as "forward" pointed every lash
      // upwards in a frontal view. Fibres now emerge anteriorly, curl modestly
      // away from the fissure, and converge toward shared temporal guide tips.
      // Curved natural shafts: Tohmyoh et al., 2018, PMID 30078421 (abstract).
      const riseA=upper?-.07:-.025,riseB=(upper?.24:.15)+.09*random(groupSeed+31),forwardA=.96+.06*random(groupSeed+37),forwardB=.10+.08*random(groupSeed+41),verticalSign=upper?1:-1;
      const rootRadius=lashes.rootRadius*(upper?1:.68)*(.78+.30*random(seed+40)),first=lashPositions.length/3;
      const op=interpolate(outer,angle+eps),om=interpolate(outer,angle-eps),du=op.map((value,i)=>(value-om[i])/(2*eps));
      for(let j=0;j<=lashes.segments;j++){
        const t=j/lashes.segments,eyeCentre=[targetX*(.30*t+.70*t*t),verticalSign*length*(riseA*t+riseB*t*t),length*(forwardA*t-forwardB*t*t)],eyeTangent=[targetX*(.3+1.4*t),verticalSign*length*(riseA+2*riseB*t),length*(forwardA-2*forwardB*t)];
        const centre=[dot(eyeCentre,u),dot(eyeCentre,v),dot(eyeCentre,n)],tangent=norm([dot(eyeTangent,u),dot(eyeTangent,v),dot(eyeTangent,n)]);
        const axisU=norm(sub([1,0,0],mul(tangent,tangent[0]))),axisV=norm(cross(tangent,axisU)),radius=lashes.tipRadius+(rootRadius-lashes.tipRadius)*(1-t)**.8;
        for(let k=0;k<=lashes.sides;k++){
          const theta=k/lashes.sides*2*Math.PI,normal=add(mul(axisU,Math.cos(theta)),mul(axisV,Math.sin(theta))),offset=add(centre,mul(normal,radius)),local=add(root,lift(offset,u,v,n));
          const world=add(frame.centre,add(mul(frame.u,local[0]),add(mul(frame.v,local[1]),mul(frame.n,local[2])))),localNormal=lift(normal,u,v,n),worldNormal=add(mul(frame.u,localNormal[0]),add(mul(frame.v,localNormal[1]),mul(frame.n,localNormal[2])));
          lashPositions.push(...world);lashNormals.push(...compactEyeEncodeNormal(worldNormal));lashParams.push(angle,rootT);lashOffsets.push(...offset);lashLocalNormals.push(...normal);
          lashOuter.push(...o.slice(0,3));lashOuterU.push(...du.slice(0,3));lashGradient.push(...o.slice(3));lashGradientU.push(...du.slice(3));lashSections.push(...interpolate(sections,angle));
        }
      }
      for(let j=0;j<lashes.segments;j++)for(let k=0;k<lashes.sides;k++){const a=first+j*(lashes.sides+1)+k,b=a+lashes.sides+1;lashIndices.push(a,b,a+1,a+1,b,b+1);}
    }
    const lashCount=lashPositions.length/3,lashIds=new Uint16Array(lashCount*COMPACT_INFLUENCES),lashWeights=new Uint16Array(lashIds.length);
    for(let i=0;i<lashCount;i++){lashIds[i*COMPACT_INFLUENCES]=head;lashWeights[i*COMPACT_INFLUENCES]=65535;}
    output.push({name:'eyeLash',eyeSide:side,eyeLid:true,sourceGroup:'procedural-eye-fibres',origin:[0,0,0],extent:[1,1,1],vertices:lashCount,triangles:lashIndices.length/3,
      canonicalPositions:Float32Array.from(lashPositions),positions:Float32Array.from(lashPositions,p=>p*statureScale),normals:Int16Array.from(lashNormals),indices:Uint16Array.from(lashIndices),
      eyeParams:Float32Array.from(lashParams),eyeTangentU:Float32Array.from(lashOffsets),eyeTangentV:Float32Array.from(lashLocalNormals),eyeOuterPosition:Float32Array.from(lashOuter),eyeOuterTangentU:Float32Array.from(lashOuterU),eyeOuterGradient:Float32Array.from(lashGradient),eyeOuterGradientU:Float32Array.from(lashGradientU),
      eyeSection:Float32Array.from(lashSections),
      binding:{ids:lashIds,weights:lashWeights,colors:new Uint8Array(lashCount*3),groupCounts:{head:lashCount},maximumWeightError:0}});
    report.triangles+=lashIndices.length/3;report.lashStrands=(report.lashStrands||0)+lashes.upperCount+lashes.lowerCount;
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

    // The optical shell and the lid support use the same conic. Normals are
    // the derivative of its sag, not normals borrowed from a sphere.
    const corneaP=[],corneaN=[],corneaI=[],corneaSegments=96,corneaRings=24;
    for(let j=0;j<=corneaRings;j++)for(let i=0;i<=corneaSegments;i++){
      const corneal=COMPACT_EYE_ANATOMY.cornea,r=corneal.shellExtentM*j/corneaRings,a=i/corneaSegments*Math.PI*2,x=r*Math.cos(a),y=r*Math.sin(a),z=compactEyeCorneaDepth(x,y);
      const denominator=Math.sqrt(Math.max(1e-12,corneal.curvatureRadiusM*corneal.curvatureRadiusM-(1+corneal.asphericity)*r*r));
      const normal=norm(add(mul(frame.u,x/denominator),add(mul(frame.v,y/denominator),frame.n)));
      corneaP.push(...add(frame.centre,add(mul(frame.u,x),add(mul(frame.v,y),mul(frame.n,z)))));
      corneaN.push(...compactEyeEncodeNormal(normal));
    }
    for(let j=0;j<corneaRings;j++)for(let i=0;i<corneaSegments;i++){
      const a=j*(corneaSegments+1)+i,b=a+corneaSegments+1;
      if(j>0)corneaI.push(a,b,a+1);corneaI.push(a+1,b,b+1);
    }
    const corneaCount=corneaP.length/3,corneaIds=new Uint16Array(corneaCount*COMPACT_INFLUENCES),corneaWeights=new Uint16Array(corneaIds.length);
    for(let i=0;i<corneaCount;i++){corneaIds[i*COMPACT_INFLUENCES]=head;corneaWeights[i*COMPACT_INFLUENCES]=65535;}
    output.push({name:'eyeCornea',eyeSide:side,sourceGroup:'procedural-eye-tissue',origin:[0,0,0],extent:[1,1,1],vertices:corneaCount,triangles:corneaI.length/3,
      canonicalPositions:Float32Array.from(corneaP),positions:Float32Array.from(corneaP,p=>p*statureScale),normals:Int16Array.from(corneaN),indices:Uint16Array.from(corneaI),
      binding:{ids:corneaIds,weights:corneaWeights,colors:new Uint8Array(corneaCount*3),groupCounts:{head:corneaCount},maximumWeightError:0}});
    report.triangles+=corneaI.length/3;report.analyticCornea=true;

    // Replace the low-resolution source iris with one parameter-generated
    // annulus in the same eye frame. The corneal shell remains independent.
    const iris=COMPACT_EYE_ANATOMY.iris,irisPositions=[],irisNormals=[],irisIndices=[];
    for(let j=0;j<=iris.rings;j++)for(let i=0;i<=iris.segments;i++){
      const radial=j/iris.rings,r=iris.pupilRadius+(iris.outerRadius-iris.pupilRadius)*radial,angle=i/iris.segments*2*Math.PI;
      const ca=Math.cos(angle),sa=Math.sin(angle),direction=add(mul(frame.u,ca),mul(frame.v,sa)),depth=compactEyeIrisDepth(radial,angle),eps=.0005;
      const radialSlope=(compactEyeIrisDepth(radial+eps,angle)-compactEyeIrisDepth(radial-eps,angle))/(2*eps*(iris.outerRadius-iris.pupilRadius));
      const angularSlope=(compactEyeIrisDepth(radial,angle+eps)-compactEyeIrisDepth(radial,angle-eps))/(2*eps*r);
      const n=norm(add(frame.n,add(mul(frame.u,-radialSlope*ca+angularSlope*sa),mul(frame.v,-radialSlope*sa-angularSlope*ca))));
      irisPositions.push(...add(frame.centre,add(mul(direction,r),mul(frame.n,depth))));irisNormals.push(...compactEyeEncodeNormal(n));
    }
    for(let j=0;j<iris.rings;j++)for(let i=0;i<iris.segments;i++){const a=j*(iris.segments+1)+i,b=a+iris.segments+1;irisIndices.push(a,b,a+1,a+1,b,b+1);}
    const irisCount=irisPositions.length/3,irisIds=new Uint16Array(irisCount*COMPACT_INFLUENCES),irisWeights=new Uint16Array(irisIds.length);
    for(let i=0;i<irisCount;i++){irisIds[i*COMPACT_INFLUENCES]=head;irisWeights[i*COMPACT_INFLUENCES]=65535;}
    output.push({name:'eyeIris',eyeSide:side,sourceGroup:'procedural-eye-tissue',origin:[0,0,0],extent:[1,1,1],vertices:irisCount,triangles:irisIndices.length/3,
      canonicalPositions:Float32Array.from(irisPositions),positions:Float32Array.from(irisPositions,p=>p*statureScale),normals:Int16Array.from(irisNormals),indices:Uint16Array.from(irisIndices),
      binding:{ids:irisIds,weights:irisWeights,colors:new Uint8Array(irisCount*3),groupCounts:{head:irisCount},maximumWeightError:0}});
    report.triangles+=irisIndices.length/3;
    // A separate pupil sits slightly behind the generated iris plane.
    const pupilPositions=[],pupilNormals=[],pupilIndices=[];
    for(let i=0;i<=64;i++){const angle=i/64*2*Math.PI,r=i===64?0:iris.pupilRadius;
      pupilPositions.push(...add(frame.centre,add(mul(frame.u,r*Math.cos(angle)),add(mul(frame.v,r*Math.sin(angle)),mul(frame.n,iris.planeOffset-.00035-COMPACT_EYE_ANATOMY.recess)))));
      pupilNormals.push(...compactEyeEncodeNormal(frame.n));if(i<64)pupilIndices.push(64,i,(i+1)%64);
    }
    const pupilIds=new Uint16Array(65*COMPACT_INFLUENCES),pupilWeights=new Uint16Array(pupilIds.length);
    for(let i=0;i<65;i++){pupilIds[i*COMPACT_INFLUENCES]=head;pupilWeights[i*COMPACT_INFLUENCES]=65535;}
    output.push({name:'eyePupil',eyeSide:side,sourceGroup:'procedural-eye-tissue',origin:[0,0,0],extent:[1,1,1],vertices:65,triangles:64,
      canonicalPositions:Float32Array.from(pupilPositions),positions:Float32Array.from(pupilPositions,p=>p*statureScale),normals:Int16Array.from(pupilNormals),indices:Uint16Array.from(pupilIndices),
      binding:{ids:pupilIds,weights:pupilWeights,colors:new Uint8Array(65*3),groupCounts:{head:65},maximumWeightError:0}});
    report.triangles+=64;
    // A curved conjunctival bed meets both medial margins and is tucked under
    // them by a tenth of a millimetre. Closing the lids closes its exposed area.
    const medial=side==='left'?-1:1,tearPositions=[],tearNormals=[],tearIndices=[],tearParams=[],tearOuter=[],tearOuterU=[],tearGradient=[],tearGradientU=[],nu=24,nv=10;
    const tearPoint=(angle,v)=>compactEyeTearPoint(angle,v,side,globe,cornerDepth);
    for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
      const u=i/nu,v=j/nv,x=medial*(COMPACT_EYE_ANATOMY.fissure.halfWidth-.00004-.00125*u*(.35+.65*Math.sin(Math.PI*v))),angle=Math.acos(x/COMPACT_EYE_ANATOMY.fissure.halfWidth),local=tearPoint(angle,v),eps=.0002;
      let localNormal=norm(cross(sub(tearPoint(angle+eps,v),tearPoint(angle-eps,v)),sub(tearPoint(angle,v+eps),tearPoint(angle,v-eps))));if(localNormal[2]<0)localNormal=mul(localNormal,-1);
      const n=add(mul(frame.u,localNormal[0]),add(mul(frame.v,localNormal[1]),mul(frame.n,localNormal[2])));
      tearPositions.push(...add(frame.centre,add(mul(frame.u,local[0]),add(mul(frame.v,local[1]),mul(frame.n,local[2])))));
      tearNormals.push(...compactEyeEncodeNormal(n));tearParams.push(angle,v);tearOuter.push(0,0,0);tearOuterU.push(0,0,0);tearGradient.push(0,0);tearGradientU.push(0,0);
    }
    for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+nu+1;if(medial<0)tearIndices.push(a,a+1,b,a+1,b+1,b);else tearIndices.push(a,b,a+1,a+1,b,b+1);}
    const tearCount=tearPositions.length/3,tearIds=new Uint16Array(tearCount*COMPACT_INFLUENCES),tearWeights=new Uint16Array(tearIds.length);
    for(let i=0;i<tearCount;i++){tearIds[i*COMPACT_INFLUENCES]=head;tearWeights[i*COMPACT_INFLUENCES]=65535;}
    output.push({name:'eyeTearDuct',eyeSide:side,eyeLid:true,sourceGroup:'procedural-eye-tissue',origin:[0,0,0],extent:[1,1,1],vertices:tearCount,triangles:tearIndices.length/3,
      canonicalPositions:Float32Array.from(tearPositions),positions:Float32Array.from(tearPositions,p=>p*statureScale),normals:Int16Array.from(tearNormals),indices:Uint16Array.from(tearIndices),
      eyeParams:Float32Array.from(tearParams),eyeTangentU:new Float32Array(tearCount*3),eyeTangentV:new Float32Array(tearCount*3),eyeOuterPosition:Float32Array.from(tearOuter),eyeOuterTangentU:Float32Array.from(tearOuterU),eyeOuterGradient:Float32Array.from(tearGradient),eyeOuterGradientU:Float32Array.from(tearGradientU),
      eyeSection:new Float32Array(tearCount*4),
      binding:{ids:tearIds,weights:tearWeights,colors:new Uint8Array(tearCount*3),groupCounts:{head:tearCount},maximumWeightError:0}});
    report.triangles+=tearIndices.length/3;
    report.sides[side]={fittedRays:fitted,totalRays:count,sourceSupportedSections:sections.filter(s=>s[0]>0).length,canthusDepthMm:cornerDepth.map(v=>v*1000),horizontalOpeningMm:[Math.min(...edge.map(p=>p[0]))*1000,Math.max(...edge.map(p=>p[0]))*1000],verticalOpeningMm:[Math.min(...edge.map(p=>p[1]))*1000,Math.max(...edge.map(p=>p[1]))*1000],attachmentDiagnostics:Object.fromEntries([['temporal',0],['superior',count/4],['medial',count/2],['inferior',count*3/4]].map(([name,i])=>[name,{outerMm:outer[i].slice(0,3).map(v=>v*1000),gradient:outer[i].slice(3),section:sections[i],contactMm:contactDepth(...edge[i])*1000}]))};
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
uniform vec2 compactCanthusDepth,compactCanthusSlope;
float compactLidContact(float x,float y){
  int sideOffset=compactEyeSide<.5?0:3;
  float blinkQ=clamp((compactLidState[sideOffset+2]-.35)/.65,0.,1.),retraction=${COMPACT_EYE_ANATOMY.blinkRetractionM}*blinkQ*blinkQ*(3.-2.*blinkQ);
  float sx=compactEyeGlobe.x,sy=compactEyeGlobe.y,sz=compactEyeGlobe.z,radius=compactEyeGlobe.w;
  float sclera=sz-retraction+sqrt(max(.000002,radius*radius-(x-sx)*(x-sx)-(y-sy)*(y-sy)));
  float cornealRadius=${COMPACT_EYE_ANATOMY.cornea.curvatureRadiusM},cornealQ=${COMPACT_EYE_ANATOMY.cornea.asphericity},cornealExtent=${COMPACT_EYE_ANATOMY.cornea.shellExtentM},r2=x*x+y*y;
  float cornealRoot=sqrt(max(1e-12,cornealRadius*cornealRadius-(1.+cornealQ)*r2)),participation=r2<cornealExtent*cornealExtent?1.:0.;
  float cornea=${COMPACT_EYE_ANATOMY.cornea.apexOffsetM}-(${COMPACT_EYE_ANATOMY.recess.toFixed(6)})-retraction-r2/(cornealRadius+cornealRoot);
  float h=clamp(.5+.5*(sclera-cornea)/.0003,0.,1.);
  return sclera+.00028+participation*((cornea-sclera)*(1.-h)+.0003*h*(1.-h));
}
float compactLidSmooth01(float value){float t=clamp(value,0.,1.);return t*t*(3.-2.*t);}
float compactLidRestApertureY(float angle,float sideSign,float narrow,float wide){
  float c=cos(angle),s=sin(angle),vertical=abs(s),lateral=c*sideSign,canthus=s*s;
  float height=s>=0.?${COMPACT_EYE_ANATOMY.fissure.upperHeight.toFixed(6)}*(1.+(${COMPACT_EYE_ANATOMY.fissure.upperTemporalBias.toFixed(6)})*lateral):${COMPACT_EYE_ANATOMY.fissure.lowerHeight.toFixed(6)}*(1.-(${COMPACT_EYE_ANATOMY.fissure.lowerTemporalBias.toFixed(6)})*lateral);
  float neutral=(s>=0.?1.:-1.)*height*vertical*(${(1-COMPACT_EYE_ANATOMY.fissure.verticalRoundness).toFixed(6)}+${COMPACT_EYE_ANATOMY.fissure.verticalRoundness.toFixed(6)}*vertical)+${COMPACT_EYE_ANATOMY.fissure.lateralCanthusLift.toFixed(6)}*lateral*(1.-canthus);
  return neutral+((s>=0.?-.0022:.0014)*narrow+(s>=0.?.0019:-.0004)*wide)*canthus;
}
float compactLidClosedApertureY(float angle,float sideSign,vec2 canthusSlopes){
  float c=cos(angle),u=(c+1.)*.5,u2=u*u,u3=u2*u,left=-${COMPACT_EYE_ANATOMY.fissure.lateralCanthusLift.toFixed(6)}*sideSign,right=${COMPACT_EYE_ANATOMY.fissure.lateralCanthusLift.toFixed(6)}*sideSign;
  float m0=canthusSlopes.x*2.*${COMPACT_EYE_ANATOMY.fissure.halfWidth.toFixed(6)},m1=canthusSlopes.y*2.*${COMPACT_EYE_ANATOMY.fissure.halfWidth.toFixed(6)};
  float base=(2.*u3-3.*u2+1.)*left+(u3-2.*u2+u)*m0+(-2.*u3+3.*u2)*right+(u3-u2)*m1;
  float centreFromTangents=(m0-m1)*.125,envelope=pow(max(0.,1.-c*c),${COMPACT_EYE_ANATOMY.closure.envelopePower.toFixed(1)});
  return base+((${COMPACT_EYE_ANATOMY.closure.centreY.toFixed(6)})-centreFromTangents)*envelope;
}
vec2 compactLidAperture(float angle,float sideSign,float narrow,float wide,float blink,vec2 canthusSlopes){
  float restY=compactLidRestApertureY(angle,sideSign,narrow,wide),closedY=compactLidClosedApertureY(angle,sideSign,canthusSlopes),closing=compactLidSmooth01(blink);
  return vec2(${COMPACT_EYE_ANATOMY.fissure.halfWidth.toFixed(6)}*cos(angle),mix(restY,closedY,closing));
}
float compactLidSectionDepth(float t,float z0,float z1,float m0,float m1,float knot,float knotZ,float knotSlope){
  float first=t<knot?1.:0.,span=first>.5?knot:1.-knot,u=first>.5?t/span:(t-knot)/span;
  float a=first>.5?z0:knotZ,b=first>.5?knotZ:z1,da=(first>.5?m0:knotSlope)*span,db=(first>.5?knotSlope:m1)*span;
  float u2=u*u,u3=u2*u,u4=u3*u,u5=u4*u;
  return a*(1.-10.*u3+15.*u4-6.*u5)+da*(u-6.*u3+8.*u4-3.*u5)+b*(10.*u3-15.*u4+6.*u5)+db*(-4.*u3+7.*u4-3.*u5);
}
float compactLidClosedDepth(float t,float z0,float z1,float m0,float m1){
  float q=clamp(t,0.,1.),delta=z1-z0,total=abs(m0)+abs(m1),opposed=(m0*delta<=0.?abs(m0):0.)+(m1*delta<=0.?abs(m1):0.);
  float power=clamp(max(total/max(abs(delta),.00025)*2.5-2.,2.*opposed/.0006-2.),2.,120.),order=power+2.,remainder=delta-2.*(m0+m1)/order;
  return z0+m0*(2.-pow(1.-q,power+1.)*(2.+power*q))/order+m1*pow(q,power+1.)*(order-power*q)/order+remainder*q*q*q*(10.-15.*q+6.*q*q);
}
float compactLidTissueDepth(float t,float z0,float z1,float m0,float m1,float a,float za,float ma,float b,float zb,float mb){
  float first=t<a?1.:0.,last=t>=b?1.:0.,lo=first>.5?0.:last>.5?b:a,hi=first>.5?a:last>.5?1.:b;
  float span=hi-lo,u=(t-lo)/span,p=first>.5?z0:last>.5?zb:za,q=first>.5?za:last>.5?z1:zb,dp=(first>.5?m0:last>.5?mb:ma)*span,dq=(first>.5?ma:last>.5?m1:mb)*span;
  float u2=u*u,u3=u2*u,u4=u3*u,u5=u4*u;
  return p*(1.-10.*u3+15.*u4-6.*u5)+dp*(u-6.*u3+8.*u4-3.*u5)+q*(10.*u3-15.*u4+6.*u5)+dq*(-4.*u3+7.*u4-3.*u5);
}
vec3 compactLidPatchLocal(float angle,float t,vec3 outer,vec2 gradient){
  int offset=compactEyeSide<.5?0:3;
  float narrow=compactLidState[offset],wide=compactLidState[offset+1],blink=compactLidState[offset+2];
  float c=cos(angle),s=sin(angle),vertical=abs(s),canthus=vertical*vertical,sideSign=compactEyeSide<.5?1.:-1.,lateral=c*sideSign;
  float height=s>=0.?${COMPACT_EYE_ANATOMY.fissure.upperHeight.toFixed(6)}*(1.+(${COMPACT_EYE_ANATOMY.fissure.upperTemporalBias.toFixed(6)})*lateral):${COMPACT_EYE_ANATOMY.fissure.lowerHeight.toFixed(6)}*(1.-(${COMPACT_EYE_ANATOMY.fissure.lowerTemporalBias.toFixed(6)})*lateral);
  float closing=blink*blink*(3.-2.*blink),rimWidth=(s>=0.?${COMPACT_EYE_ANATOMY.rim.upperWidthM}:${COMPACT_EYE_ANATOMY.rim.lowerWidthM})*canthus*(1.-closing),rimLift=(s>=0.?${COMPACT_EYE_ANATOMY.rim.upperLiftM}:${COMPACT_EYE_ANATOMY.rim.lowerLiftM})*canthus*(1.-closing);
  float rimDX=c*(s>=0.?${COMPACT_EYE_ANATOMY.fissure.upperHeight}:${COMPACT_EYE_ANATOMY.fissure.lowerHeight}),rimDY=s*${COMPACT_EYE_ANATOMY.fissure.halfWidth},rimLength=sqrt(rimDX*rimDX+rimDY*rimDY);
  float restY=compactLidRestApertureY(angle,sideSign,0.,0.),openY=compactLidRestApertureY(angle,sideSign,narrow,wide),closedY=compactLidClosedApertureY(angle,sideSign,compactCanthusSlope);
  float apertureY=mix(openY,closedY,compactLidSmooth01(blink)),ex=${COMPACT_EYE_ANATOMY.fissure.halfWidth.toFixed(6)}*c+rimDX/rimLength*rimWidth,closureU=(c+1.)*.5;
  float ey=apertureY+rimDY/rimLength*rimWidth;
  float x=mix(ex,outer.x,t),y=mix(ey,outer.y,t),dx=outer.x-ex,dyRadial=outer.y-ey;
  float base=compactLidContact(ex,ey),corner=c<0.?compactCanthusDepth.x:compactCanthusDepth.y;
  float cornerStart=${COMPACT_EYE_ANATOMY.fissure.canthusAttachmentStart},a=clamp((abs(c)-.70)/.30,0.,1.),endWeight=a*a*(3.-2.*a);
  float cu=clamp((abs(c)-cornerStart)/(.72-cornerStart),0.,1.),cv=clamp((abs(c)-.72)/.22,0.,1.),cu2=cu*cu,cu3=cu2*cu,cv2=cv*cv,cv3=cv2*cv;
  float spreadWeight=.5*(-2.*cu3+3.*cu2)+1.3*(.72-cornerStart)*(cu3-cu2),joinWeight=.5*(2.*cv3-3.*cv2+1.)+.286*(cv3-2.*cv2+cv)+.896*(-2.*cv3+3.*cv2)+.704*(cv3-cv2);
  float cornerWeight=abs(c)<.72?spreadWeight:abs(c)<.94?joinWeight:endWeight,restInner=mix(base,max(base,corner),cornerWeight);
  float closedBridge=mix(compactCanthusDepth.x,compactCanthusDepth.y,closureU),bridgeWeight=closing*(1.-cornerWeight*cornerWeight*cornerWeight),inner=mix(restInner,max(base,closedBridge),bridgeWeight)+rimLift;
  float eps=.0001,slope=((compactLidContact(ex+eps,ey)-compactLidContact(ex-eps,ey))*dx+(compactLidContact(ex,ey+eps)-compactLidContact(ex,ey-eps))*dyRadial)/(2.*eps);
  float delta=outer.z+.00004-inner,m1=clamp(gradient.x*dx+gradient.y*dyRadial,-.020,.020);
  float gap=clamp((inner-base-.00004)/.00060,0.,1.),contactWeight=1.-gap*gap*(3.-2.*gap);
  float bridgeSlope=(compactCanthusDepth.y-compactCanthusDepth.x)/(2.*${COMPACT_EYE_ANATOMY.fissure.halfWidth.toFixed(6)})*dx;
  float m0=clamp((slope*contactWeight+bridgeSlope*(1.-contactWeight))*(1.-cornerWeight)+m1*cornerWeight,-.020,.020);
  float foldStrength=(s>=0.?1.-.92*closing:1.-.55*closing)*abs(s);
  float foldDepth=(s>=0.?${COMPACT_EYE_ANATOMY.fissure.upperFoldM.toFixed(6)}:${COMPACT_EYE_ANATOMY.fissure.lowerSulcusM.toFixed(6)})*foldStrength;
  // Slot 15 belongs to axillary corrective data on body skin. Eyelid chunks
  // have compactMuscleEnabled=0 and use those same four uint bits for their
  // source-supported section. No seventeenth vertex attribute is required.
  float sectionFraction=uintBitsToFloat(axillaCorrective.x),sectionDepth=uintBitsToFloat(axillaCorrective.y),sectionGX=uintBitsToFloat(axillaCorrective.z),sectionGY=uintBitsToFloat(axillaCorrective.w);
  float restFraction=sectionFraction>0.?sectionFraction:.48,seamX=${COMPACT_EYE_ANATOMY.fissure.halfWidth}*c,restKnotX=seamX+(outer.x-seamX)*restFraction,restKnotY=restY+(outer.y-restY)*restFraction;
  float projected=((restKnotX-ex)*dx+(restKnotY-ey)*dyRadial)/max(1e-10,dx*dx+dyRadial*dyRadial);
  float knot=sectionFraction>0.?clamp(projected,.12,.92):max(s>=0.?.48+.15*closing:.48,1.-.0034/max(.0034,abs(m1)));
  float lateralDerivative=-s*(compactEyeSide<.5?1.:-1.);
  float heightDerivative=s>=0.?${COMPACT_EYE_ANATOMY.fissure.upperHeight.toFixed(6)}*(${COMPACT_EYE_ANATOMY.fissure.upperTemporalBias.toFixed(6)})*lateralDerivative:-${COMPACT_EYE_ANATOMY.fissure.lowerHeight.toFixed(6)}*(${COMPACT_EYE_ANATOMY.fissure.lowerTemporalBias.toFixed(6)})*lateralDerivative;
  float restYDerivative=heightDerivative*s*(${(1-COMPACT_EYE_ANATOMY.fissure.verticalRoundness).toFixed(6)}+${COMPACT_EYE_ANATOMY.fissure.verticalRoundness.toFixed(6)}*vertical)+height*c*(${(1-COMPACT_EYE_ANATOMY.fissure.verticalRoundness).toFixed(6)}+${(2*COMPACT_EYE_ANATOMY.fissure.verticalRoundness).toFixed(6)}*vertical)+${COMPACT_EYE_ANATOMY.fissure.lateralCanthusLift.toFixed(6)}*(lateralDerivative*(1.-canthus)-2.*lateral*s*c);
  float sectionAngle=angle-eyeLidParam.x,anchorDX=-${COMPACT_EYE_ANATOMY.fissure.halfWidth.toFixed(6)}*s*(1.-restFraction)+eyeOuterTangentU.x*restFraction,anchorDY=restYDerivative*(1.-restFraction)+eyeOuterTangentU.y*restFraction;
  float sourceDepth=sectionDepth+(sectionGX*anchorDX+sectionGY*anchorDY)*sectionAngle;
  float restKnotZ=sectionFraction>0.?sourceDepth+sectionGX*(ex+dx*knot-restKnotX)+sectionGY*(ey+dyRadial*knot-restKnotY)-foldDepth:inner+delta*knot-foldDepth;
  float restKnotSlope=sectionFraction>0.?clamp(sectionGX*dx+sectionGY*dyRadial,-.020,.020):delta*(1.-foldStrength*.75);
  float radialLength=max(.001,sqrt(dx*dx+dyRadial*dyRadial)),requestedTurn=s>=0.?${COMPACT_EYE_ANATOMY.tissue.upperTurnSpanM}:${COMPACT_EYE_ANATOMY.tissue.lowerTurnSpanM},sourceDistance=knot*radialLength;
  float minimumPlate=s>=0.?${COMPACT_EYE_ANATOMY.tissue.upperMinimumPlateM}:${COMPACT_EYE_ANATOMY.tissue.lowerMinimumPlateM},minimumTurn=s>=0.?${COMPACT_EYE_ANATOMY.tissue.upperMinimumTurnM}:${COMPACT_EYE_ANATOMY.tissue.lowerMinimumTurnM};
  float allocation=clamp((sourceDistance-minimumPlate-minimumTurn)/(requestedTurn-minimumTurn),0.,1.),allocationWeight=allocation*allocation*allocation*(10.-15.*allocation+6.*allocation*allocation);
  float turnSpan=min(requestedTurn,sourceDistance*.55)/radialLength,plate=knot-turnSpan,plateX=ex+dx*plate,plateY=ey+dyRadial*plate;
  float returnAllowance=(s>=0.?${COMPACT_EYE_ANATOMY.tissue.upperReturnAllowanceM}:${COMPACT_EYE_ANATOMY.tissue.lowerReturnAllowanceM})*(.4+.6*closing);
  float returnX=ex+dx*knot,returnY=ey+dyRadial*knot,returnSource=restKnotZ+foldDepth+.00004+returnAllowance,returnContact=compactLidContact(returnX,returnY)+${COMPACT_EYE_ANATOMY.tissue.plateExcessM};
  float returnH=clamp(.5+.5*(returnSource-returnContact)/${COMPACT_EYE_ANATOMY.tissue.supportBlendM},0.,1.);
  float returnZ=mix(returnContact,returnSource,returnH)+${COMPACT_EYE_ANATOMY.tissue.supportBlendM}*returnH*(1.-returnH);
  float returnContactSlope=((compactLidContact(returnX+eps,returnY)-compactLidContact(returnX-eps,returnY))*dx+(compactLidContact(returnX,returnY+eps)-compactLidContact(returnX,returnY-eps))*dyRadial)/(2.*eps);
  float tissueReturnSlope=restKnotSlope*(s>=0.?.32:.75),returnSlope=clamp(mix(returnContactSlope,tissueReturnSlope,returnH),-.020,.020);
  float plateSource=inner+(returnZ-inner)*(s>=0.?.30:.55),plateSourceSlope=(returnZ-inner)/max(.05,knot)*.55;
  float plateContact=compactLidContact(plateX,plateY)+${COMPACT_EYE_ANATOMY.tissue.plateExcessM};
  float plateH=clamp(.5+.5*(plateSource-plateContact)/${COMPACT_EYE_ANATOMY.tissue.supportBlendM},0.,1.);
  float plateZ=mix(plateContact,plateSource,plateH)+${COMPACT_EYE_ANATOMY.tissue.supportBlendM}*plateH*(1.-plateH);
  float plateContactSlope=((compactLidContact(plateX+eps,plateY)-compactLidContact(plateX-eps,plateY))*dx+(compactLidContact(plateX,plateY+eps)-compactLidContact(plateX,plateY-eps))*dyRadial)/(2.*eps);
  float plateSlope=clamp(mix(plateContactSlope,plateSourceSlope,plateH),-.020,.020);
  float fittedDepth=compactLidTissueDepth(t,inner,outer.z+.00004,m0,m1,plate,plateZ,plateSlope,knot,returnZ,returnSlope);
  float fallbackDepth=compactLidClosedDepth(t,inner,outer.z+.00004,m0,m1),canthalReturn=clamp(abs(s)/.55,0.,1.),canthalWeight=canthalReturn*canthalReturn*canthalReturn*(10.-15.*canthalReturn+6.*canthalReturn*canthalReturn);
  float depth=mix(fallbackDepth,fittedDepth,sectionFraction>0.?canthalWeight*allocationWeight:0.);
  float contact=compactLidContact(x,y),h=clamp(.5+.5*(depth-contact)/.00008,0.,1.),supported=mix(contact,depth,h)+.00008*h*(1.-h);
  float q=clamp((t-.80)/.20,0.,1.),q3=q*q*q,finalRimDepth=depth+(supported-depth)*(1.-q3*(10.-15.*q+6.*q*q))+((compactEyeLid>1.5&&compactEyeLid<2.5)?${COMPACT_EYE_ANATOMY.outerBand.marginOffset.toFixed(6)}:0.);
  return vec3(x,y,finalRimDepth);
}
vec3 compactLidRimSurface(float angle,float u,vec3 base){
  int sideOffset=compactEyeSide<.5?0:3;
  float blink=compactLidState[sideOffset+2],closing=blink*blink*(3.-2.*blink),s=sin(angle),q=clamp(u,0.,1.);
  float width=(s>=0.?${COMPACT_EYE_ANATOMY.rim.upperWidthM}:${COMPACT_EYE_ANATOMY.rim.lowerWidthM})*s*s*(1.-closing),depth=((s>=0.?${COMPACT_EYE_ANATOMY.rim.upperDepthM}:${COMPACT_EYE_ANATOMY.rim.lowerDepthM})*(1.-closing)+${COMPACT_EYE_ANATOMY.rim.closedDepthM}*closing)*s*s;
  float dx=cos(angle)*(s>=0.?${COMPACT_EYE_ANATOMY.fissure.upperHeight}:${COMPACT_EYE_ANATOMY.fissure.lowerHeight}),dy=s*${COMPACT_EYE_ANATOMY.fissure.halfWidth},lengthXY=sqrt(dx*dx+dy*dy);
  float backX=base.x-dx/lengthXY*width,backY=base.y-dy/lengthXY*width,backZ=max(base.z-depth,compactLidContact(backX,backY)-.00028+.000045);
  return vec3(mix(backX,base.x,q),mix(backY,base.y,q),mix(backZ,base.z,q));
}
vec3 compactLidLocalPoint(vec2 param){
  float da=param.x-eyeLidParam.x;
  vec3 outer=eyeOuterPosition+eyeOuterTangentU*da;vec2 gradient=eyeOuterGradient+eyeOuterGradientU*da;
  if(compactEyeLid<1.5&&param.y<0.)return compactLidRimSurface(param.x,${COMPACT_EYE_ANATOMY.rim.wetFraction}+(1.-${COMPACT_EYE_ANATOMY.rim.wetFraction})*(param.y+${COMPACT_EYE_ANATOMY.outerBand.marginRadial})/${COMPACT_EYE_ANATOMY.outerBand.marginRadial},compactLidPatchLocal(param.x,0.,outer,gradient));
  if(compactEyeLid<1.5||compactEyeLid>2.5)return compactLidPatchLocal(param.x,param.y,outer,gradient);
  return compactLidRimSurface(param.x,clamp(param.y/${COMPACT_EYE_ANATOMY.outerBand.marginRadial},0.,1.)*${COMPACT_EYE_ANATOMY.rim.wetFraction},compactLidPatchLocal(param.x,0.,outer,gradient));
}
vec3 compactLidLocalNormal(vec2 param){
  // Use the displayed grid's neighbours. Infinitesimal normals can turn away
  // from the actual coarse triangle where the closed contact curve bends.
  bool skinRim=compactEyeLid<1.5&&eyeLidParam.y<0.;
  float da=6.28318530718/${COMPACT_EYE_ANATOMY.segments}.,dr=compactEyeLid>1.5||skinRim?${(COMPACT_EYE_ANATOMY.outerBand.marginRadial/4).toFixed(6)}:1./${COMPACT_EYE_ANATOMY.rings}.;
  float low=skinRim?-${COMPACT_EYE_ANATOMY.outerBand.marginRadial}:0.,limit=skinRim?0.:compactEyeLid>1.5?${COMPACT_EYE_ANATOMY.outerBand.marginRadial.toFixed(6)}:1.;
  vec3 tu=compactLidLocalPoint(param+vec2(da,0.))-compactLidLocalPoint(param-vec2(da,0.));
  vec3 tv=compactLidLocalPoint(vec2(param.x,min(limit,param.y+dr)))-compactLidLocalPoint(vec2(param.x,max(low,param.y-dr)));
  return cross(tv,tu);
}
vec3 compactLidPosition(vec3 p,vec2 param){
  vec3 local=compactLidLocalPoint(param);
  return compactEyeCentre+compactEyeU*local.x+compactEyeV*local.y+compactEyeNormal*local.z;
}
vec3 compactTearLocalPoint(vec2 param){
  vec3 upper=compactLidPatchLocal(param.x,0.,vec3(0.),vec2(0.)),lower=compactLidPatchLocal(-param.x,0.,vec3(0.),vec2(0.));
  vec3 p=mix(lower,upper,param.y);p.z-=.00012+.00016*4.*param.y*(1.-param.y);return p;
}
void compactLid(inout vec3 p,inout vec3 n){
  if(compactEyeLid<.5)return;
  if(compactEyeLid>3.5){
    vec2 param=eyeLidParam;float eps=.0002;vec3 local=compactTearLocalPoint(param);
    vec3 localNormal=cross(compactTearLocalPoint(param+vec2(eps,0.))-compactTearLocalPoint(param-vec2(eps,0.)),compactTearLocalPoint(param+vec2(0.,eps))-compactTearLocalPoint(param-vec2(0.,eps)));
    if(localNormal.z<0.)localNormal=-localNormal;if(dot(localNormal,localNormal)<1e-22)localNormal=vec3(0.,0.,1.);localNormal=normalize(localNormal);
    p=compactEyeCentre+compactEyeU*local.x+compactEyeV*local.y+compactEyeNormal*local.z;
    n=normalize(compactEyeU*localNormal.x+compactEyeV*localNormal.y+compactEyeNormal*localNormal.z);return;
  }
  if(compactEyeLid>2.5){
    float eps=.001;vec2 param=eyeLidParam;vec3 root=compactLidLocalPoint(param);
    vec3 u=normalize(compactLidLocalPoint(param+vec2(eps,0.))-compactLidLocalPoint(param-vec2(eps,0.)));
    vec3 radial=compactLidLocalPoint(param+vec2(0.,eps))-compactLidLocalPoint(param-vec2(0.,eps)),normal=normalize(cross(radial,u));
    if(normal.z<0.)normal=-normal;vec3 v=normalize(cross(u,normal));
    int sideOffset=compactEyeSide<.5?0:3;float blink=compactLidState[sideOffset+2],turn=(sin(param.x)>0.?${COMPACT_EYE_ANATOMY.lashes.upperBlinkTurnRad}:${COMPACT_EYE_ANATOMY.lashes.lowerBlinkTurnRad})*blink,ct=cos(turn),st=sin(turn);
    vec3 offset=eyeLidTangentU,fibreNormal=eyeLidTangentV;
    offset.yz=mat2(ct,-st,st,ct)*offset.yz;fibreNormal.yz=mat2(ct,-st,st,ct)*fibreNormal.yz;
    vec3 local=root+u*offset.x+v*offset.y+normal*offset.z,localNormal=normalize(u*fibreNormal.x+v*fibreNormal.y+normal*fibreNormal.z);
    p=compactEyeCentre+compactEyeU*local.x+compactEyeV*local.y+compactEyeNormal*local.z;
    n=normalize(compactEyeU*localNormal.x+compactEyeV*localNormal.y+compactEyeNormal*localNormal.z);return;
  }
  vec3 normal=compactLidLocalNormal(eyeLidParam);
  if(dot(normal,normal)<1e-22){
    // The closed margin has zero angular speed at a canthus. Average its two
    // posed side limits; do not reuse an unrelated undeformed surface normal.
    vec2 at=vec2(eyeLidParam.x,eyeLidParam.y<0.?max(eyeLidParam.y,-.014):max(eyeLidParam.y,.003));
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
// Fragment contact visibility uses the exact posed free-margin math authored
// by the vertex deformer. Extracting this prefix avoids maintaining a second
// ellipse that would lag behind narrowing, widening, or blinking.
function compactEyeOcclusionShader(){
  const shader=COMPACT_EYE_LID_GLSL,contactStart=shader.indexOf('float compactLidContact('),contactEnd=shader.indexOf('\n}',contactStart)+2;
  const apertureStart=shader.indexOf('float compactLidSmooth01('),apertureEnd=shader.indexOf('\nfloat compactLidSectionDepth(',apertureStart);
  const rimStart=shader.indexOf('vec3 compactLidRimSurface('),rimEnd=shader.indexOf('\n}',rimStart)+2;
  const patchStart=shader.indexOf('vec3 compactLidPatchLocal('),bodyStart=shader.indexOf('{',patchStart)+1,bodyEnd=shader.indexOf('  float eps=.0001,slope=',bodyStart);
  if(contactStart<0||contactEnd<2||apertureStart<0||apertureEnd<=apertureStart||patchStart<0||bodyEnd<bodyStart)throw Error('眼部遮蔽缺少共享睑缘定义');
  return `uniform float compactEyeSide,compactLidState[6];
uniform vec3 compactEyeNormal;uniform vec4 compactEyeGlobe;uniform vec2 compactCanthusDepth,compactCanthusSlope;
${shader.slice(contactStart,contactEnd)}
${shader.slice(apertureStart,apertureEnd)}
${shader.slice(rimStart,rimEnd)}
vec3 compactEyeOcclusionMargin(float angle){
  vec3 outer=vec3(0.);float t=0.;
${shader.slice(bodyStart,bodyEnd)}
  float contactBlend=clamp(.5+.5*(inner-base)/.00008,0.,1.),marginZ=mix(base,inner,contactBlend)+.00008*contactBlend*(1.-contactBlend);
  return compactLidRimSurface(angle,0.,vec3(x,y,marginZ));
}
float compactEyeMarginDistance(vec3 receiver,float sideSign){
  float a=acos(clamp(receiver.x/${COMPACT_EYE_ANATOMY.fissure.halfWidth.toFixed(6)},-.99999,.99999))*sideSign;
  for(int i=0;i<2;i++){
    vec3 edge=compactEyeOcclusionMargin(a),slope=(compactEyeOcclusionMargin(a+.004)-compactEyeOcclusionMargin(a-.004))/.008;
    a+=clamp(dot(receiver-edge,slope)/max(dot(slope,slope),1e-10),-.22,.22);
    a=sideSign>0.?clamp(a,.002,3.13959265):clamp(a,-3.13959265,-.002);
  }
  return length(receiver-compactEyeOcclusionMargin(a));
}
float compactEyeContactVisibility(vec3 posedPosition){
  vec3 q=posedPosition-compactEyeCentre,receiver=vec3(dot(q,compactEyeU),dot(q,compactEyeV),dot(q,compactEyeNormal));
  // The transparent cornea transmits a lid's nearby occlusion to the iris.
  // Measure on the optical envelope, not the iris plane several mm behind it.
  receiver.z=compactLidContact(receiver.x,receiver.y)-.00028;
  float upper=compactEyeMarginDistance(receiver,1.),lower=compactEyeMarginDistance(receiver,-1.);
  // The thicker upper lid has a broader proximity footprint than the lower
  // wet margin. This authored local visibility approximation follows the posed
  // rim; it is not a painted scleral gradient or a replacement for cast shadow.
  float upperBlock=.62*exp(-.5*pow(upper/.00210,2.)),lowerBlock=.22*exp(-.5*pow(lower/.00090,2.));
  return clamp(1.-upperBlock-lowerBlock,.35,1.);
}`;
}
