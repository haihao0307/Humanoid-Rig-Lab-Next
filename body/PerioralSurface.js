/* Anatomical construction controls for the continuous perioral surface.
 * These are authored neutral-character dimensions, not a measured human scan.
 * Construction references:
 * Latham & Deaton, J Anat 1976: https://pmc.ncbi.nlm.nih.gov/articles/PMC1231826/
 * Yu et al., J Craniofac Surg 2013: https://pubmed.ncbi.nlm.nih.gov/23851821/
 * Rubin et al., Plast Reconstr Surg 1989: https://pubmed.ncbi.nlm.nih.gov/2909048/
 * Hur et al., mentalis cadaver/ultrasound study: https://pubmed.ncbi.nlm.nih.gov/33514053/
 * R24 artist-owned lesson notes (read 2026-09-18):
 * https://www.proko.com/course-lesson/how-to-draw-lips-anatomy-and-structure
 * https://www.proko.com/course-lesson/how-to-sculpt-the-mouth
 * The dental cylinder, alternating planes and five broad lip bodies guide
 * this original construction; all coordinates and amplitudes are authored.
 * Broad muscle/fat support is resolved before the vermilion roll; no detail is
 * encoded as a painted shadow, scanned mesh, or image texture.
 */
const COMPACT_PERIORAL_STRUCTURE = {
  revision: 'r24-double-vermilion-height-final',
  centreX: -.0006, seamY: 1.4587, halfWidth: .0244, attachmentRadius: 2.0,
  muzzle: { y: 1.4588, rx: .0460, ry:.0148,projection: .00270,upperTilt:.20 },
  cutaneous: { upperHeightM:.00042,upperOffsetM:.0032,upperWidthM:.0048,
    lowerHeightM:.00028,lowerY:1.4486,lowerWidthM:.0045,pillarX:.0092,pillarWidthM:.0085 },
  philtrum: { lowerY: 1.4625, upperY: 1.4770, lowerX: .0048, upperX: .0023,
    lowerWidth: .0031, upperWidth: .0027, columnHeight: .00046, grooveDepth: .00021 },
  commissure: { x: .0251, y: 1.4583, rx: .0057, ry: .0048, depth: .00017,
    supportX:.0263,supportY:1.4568,supportWidthM:.0093,supportHeightM:.0079,projectionM:.00057 },
  // Neutral contact is a narrow authored clearance, independent of the tissue
  // surrounding the corner. Corner curvature is retained as clearance changes.
  neutralHalfGapM:.000060,
  commissureCap: { lengthM:.0018,contactCurvatureScale:.030,lateralM:.00028,
    verticalTangentM:.0034 },
  nasolabialSupport: { lowerY:1.4510,upperY:1.4860,lowerX:.0295,upperX:.0165,width:.0088,projection:.00055 },
  labiomental: { y:1.4450,rx:.0190,ry:.0037,depth:.00094 },
  mentalis: { y: 1.4348, rx: .0200, ry: .0096, projection: .00145 },
  // x magnitude, fissure offset, superior/inferior vermilion borders in metres.
  // The central tubercle participates in the fissure as well as in projection.
  // User art direction: twice the visible upper/lower red height, measured
  // from the unchanged contact seam. Width, cap and section depth stay fixed.
  outline: [
    [0, -0.0004, 0.0069, -0.0094],
    [0.2, -0.00002, 0.00782, -0.01038],
    [0.4, 0.0001, 0.00694, -0.0103],
    [0.63, -0.00003, 0.00553, -0.00917],
    [0.8, -0.00018, 0.00354, -0.00678],
    [0.92, -0.00039, 0.00161, -0.00351],
    [0.975, -0.00051, 0.00019, -0.00147],
    [1, -0.00054, -0.00054, -0.00054]
  ],
  // Shape the tubercle, receding lateral wings and lower frontal plane as
  // separate primary forms. Crest is measured from contact (0) to red border
  // (1); peakRatio is relative to the shared closing edge, not another shell.
  surfacePlanes: {upperCrestScale:.80,lowerCrestScale:.64,upperPeakScale:.97,
    redBorderUpper:.18,redBorderLower:.11,cornerStart:.70,cornerEnd:.84},
  sections: {
    upperTubercle: {crest:.29,peakRatio:1.44,width:.30,flatness:.18},
    upperWing: {crest:.48,peakRatio:1.48,centre:.48,width:.27,flatness:.58},
    lowerBody: {crest:.49,lateralCrest:.43,peakRatio:1.23,
      pairedGain:.25,pairedCentre:.30,pairedWidth:.20,flatness:.92},
    contact: {cornerM:.00016,bodyM:.00104,transverseShoulder:.60},
    commissure: {crest:.30,peakRatio:1.18,flatness:.12,blendStart:.78}
  }
};
function compactPerioralClamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
function compactPerioralSmooth(v){const t=compactPerioralClamp(v,0,1);return t*t*t*(t*(t*6-15)+10);}
function compactPerioralGaussian(x,y,cx,cy,rx,ry){
  const a=(x-cx)/rx,b=(y-cy)/ry;
  // The outer support vanishes smoothly and never changes unaffected cheeks.
  const radial=Math.hypot(a,b),fade=1-compactPerioralSmooth((radial-2)/1.2);
  return Math.exp(-.5*(a*a+b*b))*fade;
}
function compactPerioralRail(rows,x,column=1,freeEdgeSlope=false){
  const tangent=i=>{
    if(i===0)return freeEdgeSlope?(rows[1][column]-rows[0][column])/(rows[1][0]-rows[0][0]):0;
    if(i===rows.length-1)return 0;
    const p=rows[i-1],q=rows[i],r=rows[i+1],h0=q[0]-p[0],h1=r[0]-q[0],d0=(q[column]-p[column])/h0,d1=(r[column]-q[column])/h1;
    if(d0*d1<=0)return 0;
    const w0=2*h1+h0,w1=h1+2*h0;return (w0+w1)/(w0/d0+w1/d1);
  };
  if(x<=rows[0][0])return rows[0][column];
  if(x>=rows[rows.length-1][0])return rows[rows.length-1][column];
  let i=0;while(i<rows.length-2&&x>rows[i+1][0])i++;
  const a=rows[i],b=rows[i+1],h=b[0]-a[0],t=(x-a[0])/h,t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*a[column]+(t3-2*t2+t)*h*tangent(i)+(-2*t3+3*t2)*b[column]+(t3-t2)*h*tangent(i+1);
}
function compactMuzzleDepth(x,y){
  const s=COMPACT_PERIORAL_STRUCTURE,m=s.muzzle,p=s.philtrum,c=s.commissure,k=s.mentalis,n=s.nasolabialSupport,l=s.labiomental,o=s.cutaneous,xx=x-s.centreX;
  // The lips wrap a dental arc with a broad frontal plane. A single radial
  // Gaussian made the entire mouth sit on one circular, inflated mound. The
  // transverse arch and vertical support are independent authored controls.
  const transverse=Math.pow(Math.max(0,1-(xx/m.rx)**2),3);
  const vbed=(y-m.y)/m.ry,verticalBed=Math.exp(-.5*vbed*vbed)*(1-compactPerioralSmooth((Math.abs(vbed)-2)/1.2));
  let z=m.projection*transverse*verticalBed*(1+m.upperTilt*Math.tanh((y-m.y)/.012));
  // The upper cutaneous lip and the red body share a curved support. This is
  // wider than the vermilion and has no narrow rim or painted white outline.
  const outline=compactAnatomicalLipOutline(x),u=Math.abs((x-s.centreX)/s.halfWidth);
  const oralWidth=1-compactPerioralSmooth((u-.70)/.72);
  z+=o.upperHeightM*oralWidth*Math.exp(-.5*((y-outline.top-o.upperOffsetM)/o.upperWidthM)**2);
  // Two lower cutaneous pillars spread into a single broad bed below the lip.
  // Their overlap is intentional: they must not become two isolated bumps.
  const pillarY=o.lowerY-.0014*Math.min(1,(xx/.023)**2);
  const pillars=Math.exp(-.5*((xx-o.pillarX)/o.pillarWidthM)**2)+Math.exp(-.5*((xx+o.pillarX)/o.pillarWidthM)**2);
  z+=o.lowerHeightM*pillars*Math.exp(-.5*((y-pillarY)/o.lowerWidthM)**2);
  // Philtral columns widen and diverge towards Cupid's peaks. Each is a soft
  // boundary of the cutaneous upper lip, rather than an isolated vertical rod.
  const v=compactPerioralClamp((y-p.lowerY)/(p.upperY-p.lowerY),0,1);
  const columnX=p.lowerX+(p.upperX-p.lowerX)*compactPerioralSmooth(v);
  const columnWidth=p.lowerWidth+(p.upperWidth-p.lowerWidth)*v;
  const vertical=compactPerioralSmooth((y-(p.lowerY-.0021))/.0035)*(1-compactPerioralSmooth((y-(p.upperY-.0020))/.0034));
  const columns=Math.exp(-.5*((xx-columnX)/columnWidth)**2)+Math.exp(-.5*((xx+columnX)/columnWidth)**2);
  z+=p.columnHeight*vertical*columns;
  z-=p.grooveDepth*vertical*Math.exp(-.5*(xx/(columnX*.80))**2);
  // Modiolar support lies around the commissure. The small insertion hollow
  // sits inside a much broader cheek/lip transition and must not be black dots.
  for(const side of [-1,1]){
    z+=c.projectionM*compactPerioralGaussian(xx,y,side*c.supportX,c.supportY,c.supportWidthM,c.supportHeightM);
    z-=c.depth*compactPerioralGaussian(xx,y,side*c.x,c.y,c.rx,c.ry);
  }
  // The cheek-side volume follows a broad curved path from the alar base to
  // the commissure. This supports the oral cylinder without carving an aged
  // nasolabial line into a neutral young face.
  const cheekV=compactPerioralClamp((y-n.lowerY)/(n.upperY-n.lowerY),0,1);
  const cheekX=n.lowerX+(n.upperX-n.lowerX)*compactPerioralSmooth(cheekV);
  z+=n.projection*Math.sin(Math.PI*cheekV)**2*Math.exp(-.5*((Math.abs(xx)-cheekX)/n.width)**2);
  // The lower cutaneous lip turns inward before the convex mentalis/chin pad.
  // This is a broad transverse valley; it fades before either mouth corner.
  const sulcusY=l.y+.0010*(xx/.022)**2;
  z-=l.depth*compactPerioralGaussian(xx,y,0,sulcusY,l.rx,l.ry);
  z+=k.projection*compactPerioralGaussian(xx,y,0,k.y,k.rx,k.ry);
  z+=.00020*compactPerioralGaussian(xx,y,0,1.4285,.0260,.0065);
  return z;
}
function compactAnatomicalLipOutline(x){
  const s=COMPACT_PERIORAL_STRUCTURE,u=compactPerioralClamp((x-s.centreX)/s.halfWidth,-1,1),a=Math.abs(u),envelope=Math.max(0,1-u*u);
  // Controlled low-amplitude asymmetry: all rails and material boundaries share
  // the same shift, so asymmetry does not introduce surface/material mismatch.
  const offset=.00011*u*envelope+.000035*Math.sin(u*Math.PI)*envelope;
  return {u,envelope,seam:s.seamY+compactPerioralRail(s.outline,a,1)+offset,
    top:s.seamY+compactPerioralRail(s.outline,a,2)+offset,
    bottom:s.seamY+compactPerioralRail(s.outline,a,3)+offset};
}
function compactCommissureCap(angle,r){
  const s=COMPACT_PERIORAL_STRUCTURE,c=s.commissureCap,co=Math.cos(angle),si=Math.sin(angle);
  const distance=s.halfWidth*(1-Math.abs(co)),support=1-compactPerioralSmooth(distance/c.lengthM);
  if(!support||r>=s.attachmentRadius)return {x:0,y:0};
  r=Math.max(0,r);
  // Retiming only the last part of the free edge enlarges its end radius,
  // without increasing the slit height or moving the mouth's lateral extent.
  const contact=1-compactPerioralSmooth(r),outer=1-compactPerioralSmooth((r-1)/(s.attachmentRadius-1));
  const roll=r<.16?.16*(2*(r/.16)**2-(r/.16)**3):r;
  const side=co<0?-1:1;
  return {
    x:side*support*(distance*(1-c.contactCurvatureScale)*contact+c.lateralM*roll*outer),
    y:si*support*c.verticalTangentM*roll*outer
  };
}
function compactAnatomicalLipRelief(u,r,upper){
  const s=COMPACT_PERIORAL_STRUCTURE,a=Math.min(1,Math.abs(u)),shape=s.sections;
  if(r>=s.attachmentRadius)return 0;
  r=Math.max(0,r);
  // A finite corner thickness is shared by both lips. The body gradually
  // enters the commissure instead of collapsing all radial rails to a wedge.
  const transverse=(1-a*a)*(1+shape.contact.transverseShoulder*a*a);
  const contact=shape.contact.cornerM+shape.contact.bodyM*transverse;
  const tubercle=Math.exp(-.5*(u/shape.upperTubercle.width)**2);
  const upperWings=Math.exp(-.5*((u-shape.upperWing.centre)/shape.upperWing.width)**2)
    +Math.exp(-.5*((u+shape.upperWing.centre)/shape.upperWing.width)**2);
  // Partition the upper lip among three broad, overlapping bodies. Blending
  // their section controls produces one continuous surface, not three bumps
  // added above a ribbon. R21's isolated high central Gaussian became a bright
  // button; here the flanking bodies carry comparable, broader projection.
  const centralWeight=tubercle/(tubercle+upperWings);
  const paired=Math.exp(-.5*((u-shape.lowerBody.pairedCentre)/shape.lowerBody.pairedWidth)**2)
    +Math.exp(-.5*((u+shape.lowerBody.pairedCentre)/shape.lowerBody.pairedWidth)**2);
  // The upper central body turns forward near contact. Its wings retreat and
  // put their shallow crest farther from contact. The lower lip instead has a
  // broad frontal plane, with two low lobes flowing through its central span.
  const upperCrest=shape.upperWing.crest+(shape.upperTubercle.crest-shape.upperWing.crest)*centralWeight;
  const upperPeak=shape.upperWing.peakRatio+(shape.upperTubercle.peakRatio-shape.upperWing.peakRatio)*centralWeight;
  const upperFlatness=shape.upperWing.flatness+(shape.upperTubercle.flatness-shape.upperWing.flatness)*centralWeight;
  const lowerCrest=shape.lowerBody.crest+(shape.lowerBody.lateralCrest-shape.lowerBody.crest)*compactPerioralSmooth((a-.45)/.42);
  const lowerPeak=shape.lowerBody.peakRatio+shape.lowerBody.pairedGain*paired;
  // Both oral sides reach the same finite commissural section with zero first
  // and second blending derivatives. No upper/lower depth jump remains where
  // the closed annulus crosses the corners.
  const blend=compactPerioralSmooth((a-shape.commissure.blendStart)/(1-shape.commissure.blendStart));
  const crest=(upper?upperCrest:lowerCrest)*(1-blend)+shape.commissure.crest*blend;
  const peakRatio=(upper?upperPeak:lowerPeak)*(1-blend)+shape.commissure.peakRatio*blend;
  const flatness=(upper?upperFlatness:shape.lowerBody.flatness)*(1-blend)+shape.commissure.flatness*blend;
  // Authored section rails model different outward/downward turns rather than
  // one round radial swelling. The lower body returns into skin before the
  // cutaneous pillars; no thick raised rim follows the entire red boundary.
  // Keep the common free-edge depth and one crest; there is no central button.
  const roundedSection=()=>{
  const radius=s.attachmentRadius,radius2=radius*radius,crest2=crest*crest;
  // A quartic lower profile makes a broad frontal plane; the upper tubercle
  // keeps a tighter quadratic turn. Compensate the outer attachment so crest
  // and peak ratio stay exact while profile curvature changes independently.
  // d2(log z)/dr2 = -k[2(1-f)+12f(r-c)^2]
  //                 -6(R^2+r^2)/(R^2-r^2)^2 < 0 for k>0 and 0<=f<=1.
  // Thus every authored section has one crest, with no added lip-rim ridge.
  const slope=6*crest/(radius2-crest2);
  const shapeAtContact=(1-flatness)*crest2+flatness*crest2*crest2;
  const curvature=(Math.log(peakRatio)-slope*crest-3*Math.log1p(-crest2/radius2))/shapeAtContact;
  const distance2=(r-crest)**2,profile=(1-flatness)*distance2+flatness*distance2*distance2;
  const exponent=curvature*(shapeAtContact-profile)+slope*r;
  const attachment=Math.pow(Math.max(0,1-r*r/radius2),3);
  return contact*Math.exp(exponent)*attachment;

  };
  const plane=s.surfacePlanes,cornerBlend=compactPerioralSmooth((a-plane.cornerStart)/(plane.cornerEnd-plane.cornerStart));
  const planarCrest=crest*((upper?plane.upperCrestScale:plane.lowerCrestScale)*(1-cornerBlend)+cornerBlend);
  const planarPeak=peakRatio*((upper?plane.upperPeakScale:1)*(1-cornerBlend)+cornerBlend);
  const radius=s.attachmentRadius,redBorderRatio=(upper?plane.redBorderUpper:plane.redBorderLower)*(1-blend)+.15*blend;
  const shoulder=(upper?.60:.69)*(1-blend)+.68*blend,shoulderRatio=(upper?.60:.85)*(1-blend)+.72*blend;
  const profile=compactPerioralRail([[0,contact],[planarCrest,contact*planarPeak],
    [shoulder,contact*planarPeak*shoulderRatio],[1,contact*redBorderRatio],
    [1.35,contact*.015],[radius,0]],r,1,true);
  const attachment=1-compactPerioralSmooth((r-1.25)/(radius-1.25));
  return profile*attachment*(1-cornerBlend)+roundedSection()*cornerBlend;
}
