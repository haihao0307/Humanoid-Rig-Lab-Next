/* Population references are priors, not a measurement of this character.
 * Density is hairs/cm², NOT follicular units/cm². Diameter is shaft diameter.
 * The Thai study's SD is between subjects; it is NOT used as shaft-level SD.
 * Follicular-unit grouping, regional interpolation and emergence angles are
 * explicitly separable from the hair-cut/groom and the rendering budget. */
const HAIR_FOLLICLE_SPEC=Object.freeze({
 schema:'jarvis/scalp_follicle_prior@1',
 densityReference:'https://pmc.ncbi.nlm.nih.gov/articles/PMC7035527/',
 groupingReference:'https://pmc.ncbi.nlm.nih.gov/articles/PMC11753574/',
 flowReference:'https://pubmed.ncbi.nlm.nih.gov/12859380/',
 cohort:'Density/diameter: 239 healthy Thai adults; FU proportions: separate study of 120 healthy Indian males. Mixed-cohort modeling prior, not universal anatomy.',
 regions:Object.freeze({
  frontal:{hairsPerCm2:154.3,diameterUm:81.1,unitProbabilities:[57.27,30.02,9.85,2.85]},
  vertex:{hairsPerCm2:162.9,diameterUm:80.8,unitProbabilities:[58.35,29.10,9.59,2.925]},
  temporal:{hairsPerCm2:133.7,diameterUm:80.1,unitProbabilities:[62.31,27.40,8.05,2.23]},
  occipital:{hairsPerCm2:160.2,diameterUm:80.3,unitProbabilities:[59.43,28.18,9.33,3.00]}
 }),
 // Unmeasured model parameters; whorl handedness is a style option only.
 assumptions:Object.freeze({whorlDirection:[.12,.91,-.40],whorlHandedness:1,emergenceDegrees:[12,32],hairlineTransitionM:.006,unitSpreadM:.00012,diameterVariationFraction:.15}),
 units:'metres; hairs/cm2; follicular units counted separately'
});
function hairRegionAt(d){
 const weights=[Math.max(0,d[2])**4,Math.max(0,d[1])**4,Math.abs(d[0])**4,Math.max(0,-d[2])**4];
 const names=['frontal','vertex','temporal','occipital'],sum=weights.reduce((a,b)=>a+b,0),prob=[0,0,0,0];let density=0,diameter=0;
 for(let i=0;i<4;i++){const w=weights[i]/sum,r=HAIR_FOLLICLE_SPEC.regions[names[i]];density+=r.hairsPerCm2*w;diameter+=r.diameterUm*w;for(let j=0;j<4;j++)prob[j]+=r.unitProbabilities[j]*w;}
 const ps=prob.reduce((a,b)=>a+b,0);for(let j=0;j<4;j++)prob[j]/=ps;
 return {density,diameterUm:diameter,prob,meanHairsPerUnit:prob.reduce((a,b,i)=>a+b*(i+1),0)};
}
function hairGrowthAt(d){
 const w=norm(HAIR_FOLLICLE_SPEC.assumptions.whorlDirection),radial=sub(mul(d,dot(d,w)),w),swirl=cross(w,d);
 if(len(radial)<1e-6)return norm(cross(d,[0,0,1]));
 const near=1-hairSmooth(.15,.95,Math.acos(clamp(dot(d,w),-1,1)));
 return norm(add(radial,mul(swirl,(.22+.50*near)*HAIR_FOLLICLE_SPEC.assumptions.whorlHandedness)));
}
class HairFollicleField{
 constructor(scalp){
  this.scalp=scalp;this.follicles=[];this.unitCount=0;this.areaCm2=0;this.expectedHairs=0;this.unitHistogram=[0,0,0,0];
  const rng=hairRandom(260923);let unitRemainder=0;
  for(let triangleId=0;triangleId<scalp.growthSurface.triangles.length;triangleId++){
   const triangle=scalp.growthSurface.triangles[triangleId],{a,b,c,n}=triangle;
   const area=len(cross(sub(b,a),sub(c,a)))*.5*1e4;
   const center=mul(add(add(a,b),c),1/3),region=hairRegionAt(norm(sub(center,scalp.center)));
   // Sample the actual triangle area, then clip by the semantic growth mask.
   unitRemainder+=area*region.density/region.meanHairsPerUnit;
   const count=Math.floor(unitRemainder);unitRemainder-=count;
   let accepted=0;
   for(let unitSample=0;unitSample<count;unitSample++){
    const u=Math.sqrt(rng()),v=rng(),weights=[1-u,u*(1-v),u*v];
    const point=add(mul(a,weights[0]),add(mul(b,weights[1]),mul(c,weights[2]))),edgeM=scalp.edgeDistance(point);
    if(!scalp.inGrowthRegion(point)||rng()>hairSmooth(0,.004,edgeM))continue;accepted++;
    const d=norm(sub(point,scalp.center)),regional=hairRegionAt(d);let choice=rng(),hairs=4;
    for(let k=0;k<4;k++){choice-=regional.prob[k];if(choice<=0){hairs=k+1;break;}}
    const unit=this.unitCount,firstMember=this.follicles.length;
    for(let member=0;member<hairs;member++){
     // Tiny barycentric variations stay ON the same skin triangle and retain ID.
     const jitter=weights.map(w=>Math.max(0,w+(rng()-.5)*.015)),sum=jitter.reduce((x,y)=>x+y,0),barycentric=jitter.map(w=>w/sum);
     const rootPoint=add(mul(a,barycentric[0]),add(mul(b,barycentric[1]),mul(c,barycentric[2])));
     if(!scalp.inGrowthRegion(rootPoint))continue;
     const rootDirection=norm(sub(rootPoint,scalp.center)),normal=norm(triangle.vertexNormals.reduce((sum,value,i)=>add(sum,mul(value,barycentric[i])),[0,0,0])),growth=hairGrowthAt(rootDirection),guide=hairGroomAt(rootDirection,scalp.bodySex);
     const edge=hairSmooth(0,.004,scalp.edgeDistance(rootPoint));
     this.follicles.push({d:rootDirection,unit,rootPoint,normal,attachment:{mesh:'skin',triangle:triangle.sourceTriangle,vertexIds:triangle.vertexIds,barycentric},
      diameterM:regional.diameterUm*1e-6*(.85+.30*rng())*(.5+.5*edge),lengthM:guide.length*(.85+.30*rng())*(.35+.65*edge),
      angleRad:(15+15*hairSmooth(0,.8,rootDirection[1]))*Math.PI/180,growth:norm(sub(growth,mul(normal,dot(normal,growth)))),guide,phase:rng()*Math.PI*2,edgeM,shade:.65+.35*rng()});
    }
    const actualMembers=this.follicles.length-firstMember;
    if(actualMembers){this.unitCount++;this.unitHistogram[actualMembers-1]++;}
   }
   const fraction=count?accepted/count:0;this.areaCm2+=area*fraction;this.expectedHairs+=area*fraction*region.density;
  }
 }
 select(count){
  // Stratified subset with unique indices; biological and displayed counts stay separate.
  const total=this.follicles.length,n=Math.min(count,total),chosen=[];
  for(let k=0;k<n;k++)chosen.push(Math.floor((k+.5)*total/n));return chosen;
 }
 report(){return {source:HAIR_FOLLICLE_SPEC.schema,scalpAreaCm2:this.areaCm2,expectedHairCount:this.expectedHairs,generatedHairCount:this.follicles.length,follicularUnits:this.unitCount,unitHistogram:this.unitHistogram,
  densityUnits:'hairs/cm2',diameterUnits:'m',populationPrior:true,subjectMeasured:false,emergenceAnglesMeasured:false,regionalInterpolationAssumed:true,vertexUnitProbabilitiesSource:'interpolated frontal-occipital; not sampled in FU study',areaMethod:'accepted triangle sampling estimate'};}
}
// Free-space chain: the root is attached, each accepted edge has fixed length.
// This is a groom construction with geometric constraints, not a DER solver.
function hairFollicleCurve(scalp,f,segments){
 const clearance=f.diameterM*.5+.00008,root=add(f.rootPoint,mul(f.normal,clearance)),centers=[root],directions=[f.d],restLength=f.lengthM/segments;
 let previousDirection=norm(add(mul(f.growth,Math.cos(f.angleRad)),mul(f.normal,Math.sin(f.angleRad))));
 for(let j=1;j<=segments;j++){
  const u=(j-.5)/segments,styled=norm(mix(f.guide.exit,f.guide.tip,hairSmooth(.15,.95,u))),
   emergence=norm(add(mul(f.growth,Math.cos(f.angleRad)),mul(f.normal,Math.sin(f.angleRad)))),
   desired=norm(add(mix(emergence,styled,hairSmooth(.05,.65,u)),[0,-.22*u*u,0]));
  const smoothDirection=norm(mix(previousDirection,desired,.40)),a=centers[j-1];
  let point=scalp.collider.advance(a,smoothDirection,restLength,clearance,f.normal);
  if(!point)return null;
  // Reject edges whose finite shaft radius intersects the skin, not just center.
  const gap=scalp.collider.segmentClearance(a,point,clearance+.001);
  if(gap<clearance*.85){
   point=scalp.collider.advance(a,add(smoothDirection,mul(f.normal,.5)),restLength,clearance,f.normal);
   if(!point||scalp.collider.segmentClearance(a,point,clearance+.001)<clearance*.85)return null;
  }
  previousDirection=norm(sub(point,a));centers.push(point);directions.push(norm(sub(point,scalp.center)));
 }
 let arcLength=0;for(let j=1;j<centers.length;j++)arcLength+=dist(centers[j-1],centers[j]);
 if(!Number.isFinite(arcLength)||Math.abs(arcLength-f.lengthM)>1e-7)return null;
 // A rigid bend about the first joint preserves ALL segment lengths. Bound its
 // angle by exact rest segment clearance, so the entire finite ribbon stays out.
 const pivot=centers[1];let maxAngle=.06;
 for(let j=1;j<segments;j++){
  const reach=Math.max(dist(pivot,centers[j]),dist(pivot,centers[j+1])),gap=scalp.collider.segmentClearance(centers[j],centers[j+1],.02);
  maxAngle=Math.min(maxAngle,Math.max(0,gap-f.diameterM*.55-.00002)/Math.max(reach+f.diameterM,.00001));
 }
 return {centers,directions,pivot,maxAngle:Math.max(0,maxAngle*.75),arcLength};
}
// Eyebrow placement follows the character's existing anatomical landmark mesh.
// Numeric density/length here are artist parameters, not measured anatomy.
// Direction reference: https://pmc.ncbi.nlm.nih.gov/articles/PMC8719974/
function appendHairEyebrows(human,scalp,P,N,T,UV,meta){
 const tissue=human.tissue,source=tissue.details.filter(d=>d.sourcePart==='FJ2812'),
  bind=tissue.bind.get('head'),iq=inv(bind.q),points=[],indices=[],replaced=[];
 for(const item of source)for(let k=0;k<item.g.p.length;k+=3)
  points.push(rotate(iq,sub(Array.from(item.g.p.slice(k,k+3)),bind.p)));
 const rng=hairRandom(260929);let shafts=0;
 for(const sign of [-1,1]){
  const sidePoints=points.filter(p=>p[0]*sign>0);if(!sidePoints.length)continue;
  const xs=sidePoints.map(p=>p[0]*sign),inner=Math.min(...xs),outer=Math.max(...xs);
  for(let strand=0;strand<240;strand++){
   const u=(strand+rng())/240,x=inner+(outer-inner)*u;
   const section=sidePoints.filter(p=>Math.abs(p[0]*sign-x)<.0018);if(!section.length)continue;
   const low=Math.min(...section.map(p=>p[1])),high=Math.max(...section.map(p=>p[1]));
   const row=rng(),y=low+(high-low)*(.1+.8*row),hit=scalp.collider.front(sign*x,y);if(!hit)continue;
   const root=add(hit.point,mul(hit.normal,.00008)),outward=hairSmooth(.05,.55,u),
    direction=norm([sign*(.15+.85*outward),(1-outward)*.9+outward*(.5-row)*.65-.25*hairSmooth(.7,1,u),0]),
    length=(.003+.003*rng())*(1-.35*u),width=.000065*(.8+.4*rng()),start=P.length/3;
   let previous=root;
   for(let j=0;j<=4;j++){
    const v=j/4,candidate=add(root,add(mul(direction,length*v),mul(hit.normal,.0003*Math.sin(Math.PI*v))));
    // Brow is on the face, outside the radial scalp envelope: use exact skin
    // projection in +Z, then test its short chord against the triangle BVH.
    const surface=scalp.collider.front(candidate[0],candidate[1]);
    let p=surface?add(surface.point,mul(surface.normal,.00008+.0003*Math.sin(Math.PI*v))):previous;
    const obstacle=j?scalp.collider.segment(previous,p):null;
    if(obstacle)p=add(previous,mul(norm(sub(p,previous)),Math.max(0,obstacle.distance-.00004)));
    const n=surface?.normal||hit.normal,tangent=norm(sub(direction,mul(n,dot(direction,n)))),across=norm(cross(n,tangent));
    for(const edge of [-1,1]){P.push(...add(p,mul(across,edge*width*.5*(1-.7*v))));N.push(...n);T.push(...tangent);UV.push(edge<0?0:1,v);meta.push(strand%4,4);}
    previous=p;
   }
   for(let j=0;j<4;j++){const a=start+j*2,b=a+2;indices.push(a,b,a+1,a+1,b,b+1);}shafts++;
  }
 }
 if(shafts){
  replaced.push(...source,...tissue.clayDetails.filter(d=>d.sourcePart==='FJ2812'));
  tissue.hairReplacedBrows=replaced;
  if(!tissue.hairOriginalVisibility){
   tissue.hairOriginalVisibility=tissue.visibility;
   tissue.visibility=function(...args){const result=this.hairOriginalVisibility(...args);for(const d of this.hairReplacedBrows||[])d.visible=false;return result;};
  }
  for(const d of replaced)d.visible=false;
 }
 return {indices,shafts,source:'FJ2812 anatomical eyebrow landmarks',measured:false};
}
