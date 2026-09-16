// R2 hair rules evaluated against the same fitted head used by the body.
// Display segments exist only in the Worker and the transferred GPU buffer.
import {createHairBundleRulesR2} from './hair-rules-r2.mjs';
import {resolveHairProfile,hairSeed} from './hair-profile.mjs';
import {scalpBoundary,sampleScalpRegion} from './hair-zones.mjs';
import {createHairStyle,appendHairStyleCoverage} from './hair-styles.mjs';

export async function loadHairInputs(load){
 const json=async file=>JSON.parse(new TextDecoder().decode(await load(file))),appearance=await json('appearance.json');
 const [rules,scalp,domains,catalog]=await Promise.all([json(appearance.hair.rulesFile),json(appearance.hair.scalpFile),json(appearance.hair.domainsFile),json(appearance.hair.catalogFile)]);
 return {appearance,rules,scalp,domains,catalog};
}

// A thin, indexed undergrowth surface closes scalp gaps. It is sampled from the
// same head radius function at runtime, never stored as a mesh asset. All LODs
// share vertices; its bytes and triangles are deducted from the ribbon budget.
function scalpUndergrowth(scalp,radiusAt,quality,rules,style){
 const rows=quality==='economy'?24:quality==='closeup'?48:32,columns=quality==='closeup'?128:96;
 const positions=new Float32Array((rows+1)*(columns+1)*3),regionData=new Float32Array(positions.length),thetaMax=scalp.thetaMax;
 for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){
  const phi=x/columns*2*Math.PI,azimuth=Math.atan2(Math.abs(Math.cos(phi)),Math.sin(phi));
  const boundary=scalpBoundary(azimuth,Math.sign(Math.cos(phi)),rules),theta=y/rows*Math.min(thetaMax,boundary.theta);
  const n=[Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi)];
  const tuft=.85+.15*Math.sin(n[0]*17+n[2]*11+rules.seed%4093)*Math.sin(n[2]*19+n[1]*12);
  const radius=radiusAt(n)+.00065+(style?.0002:Math.min(.0035,rules.topLiftMetres*.55))*Math.max(0,n[1])**2*tuft+(style?style.baseVolume(n)*Math.min(1,(boundary.theta-theta)/.15):0);
  const offset=(y*(columns+1)+x)*3;
  positions.set(n.map((v,k)=>scalp.centre[k]+v*radius),offset);
  regionData.set([Math.max(0,(boundary.theta-theta)*radius-.002)/boundary.feather,phi,theta],offset);
 }
 const all=[],levels=[],radiusMaximum=Math.max(...scalp.radii)+.0042;let maxLOD=0;
 for(const step of [1,2,4,8]){
  const start=all.length;
  for(let y=0;y<rows;y+=step)for(let x=0;x<columns;x+=step){
   const a=y*(columns+1)+x,b=a+step,c=(y+step)*(columns+1)+x,d=c+step;
   if(y>0)all.push(a,c,b);all.push(b,c,d);
  }
  const thetaStep=thetaMax*step/rows,phiStep=2*Math.PI*step/columns;
  if(Math.max(thetaStep,phiStep)<=.3)maxLOD=levels.length;
  // Coarse chords otherwise fall into the head. Use a sub-pixel radial margin
  // and keep enough base rings even when the separate fibre LOD is very sparse.
  const inflation=Math.max(0,radiusMaximum*(1/Math.cos(thetaStep/2)/Math.cos(phiStep/2)-1)-.0004);
  levels.push({offsetBytes:start*2,count:all.length-start,triangles:(all.length-start)/3,inflation});
 }
 const indices=new Uint16Array(all);
 // The fitted radius is not spherical: an angular-spacing bound alone can
 // leave coarse chords inside local bumps, especially on the lower occiput.
 // Fit a conservative, sampled radial margin for every drawable base LOD.
 // This changes existing positions only; GPU bytes and triangle counts stay fixed.
 const corrections=new Float32Array(positions.length/3);
 for(const level of levels.slice(0,maxLOD+1))for(let i=level.offsetBytes/2;i<level.offsetBytes/2+level.count;i+=3){
  const ids=[indices[i],indices[i+1],indices[i+2]],directions=[],points=[];
  for(const id of ids){
   const p=[0,1,2].map(k=>positions[id*3+k]-scalp.centre[k]),r=Math.hypot(...p),n=p.map(v=>v/r);
   directions.push(n);points.push(p.map((v,k)=>v+n[k]*level.inflation));
  }
  for(let a=0;a<=4;a++)for(let b=0;b<=4-a;b++){
   const weights=[a/4,b/4,1-(a+b)/4],p=[0,1,2].map(k=>points.reduce((sum,q,j)=>sum+weights[j]*q[k],0)),r=Math.hypot(...p),n=p.map(v=>v/r);
   if(sampleScalpRegion(p.map((v,k)=>v+scalp.centre[k]),rules).border<-.002)continue;
   const projection=Math.min(...directions.map(q=>q.reduce((sum,v,k)=>sum+v*n[k],0)));
   const correction=Math.max(0,(radiusAt(n)+.0009-r)/Math.max(.5,projection));
   for(const id of ids)corrections[id]=Math.max(corrections[id],correction);
  }
 }
 for(let id=0;id<corrections.length;id++)if(corrections[id]>0){
  const p=[0,1,2].map(k=>positions[id*3+k]-scalp.centre[k]),r=Math.hypot(...p);
  for(let k=0;k<3;k++)positions[id*3+k]+=p[k]/r*corrections[id];
 }
 return {positions,regionData,indices,levels,maxLOD,rows,columns,geometryBytes:positions.byteLength+regionData.byteLength+indices.byteLength};
}

export function generateReconstructionHair(surface,inputs,progress=()=>{},profile={}){
 const {appearance,scalp,domains,catalog}=inputs,settings=appearance.hair;
 const resolved=resolveHairProfile(profile,0,catalog,inputs.rules),{rules,budget}=resolved;
 if(scalp.schema!=='function-derived-scalp-radius/v1'||domains.schema!=='reconstruction-hair-domains/v1')throw Error('Invalid R2 hair inputs');
 if(scalp.radii.length!==(scalp.nt+1)*scalp.np||scalp.radii.some(r=>!Number.isFinite(r)||r<=0))throw Error('Invalid scalp radius field');
 const charts=new Map();let evaluations=0,lastProgress=-Infinity;
 const report=value=>{const now=performance.now();if(now-lastProgress<200)return;lastProgress=now;progress({group:'hair',...value});};
 const adapter={evaluateDomain(id,u,v){
  evaluations++;if((evaluations&255)===0)report({phase:'roots',domainId:id,evaluations});
  let chart=charts.get(id);
  if(!chart){chart=surface.makeChart(id);charts.set(id,chart);if(charts.size>6)charts.delete(charts.keys().next().value);}
  if(!chart.inside(u,v))return null;
  const q=chart.evaluate(u,v);return {position:q.p,geometricNormal:q.n};
 }};
 function scalpRadius(n){
  const {nt,np,thetaMax,radii}=scalp,theta=Math.acos(Math.max(-1,Math.min(1,n[1]))),phi=(Math.atan2(n[2],n[0])+2*Math.PI)%(2*Math.PI);
  const u=Math.min(nt,theta/thetaMax*nt),v=phi/(2*Math.PI)*np,i=Math.min(nt-1,Math.floor(u)),j=Math.floor(v)%np,a=u-i,b=v-Math.floor(v);
  return (1-a)*((1-b)*radii[i*np+j]+b*radii[i*np+(j+1)%np])+a*((1-b)*radii[(i+1)*np+j]+b*radii[(i+1)*np+(j+1)%np]);
 }
 const style=createHairStyle(resolved,scalp,scalpRadius);
 const undergrowth=resolved.maximumStrands?scalpUndergrowth(scalp,scalpRadius,resolved.profile.quality,rules,style):null;
 if(style&&undergrowth)style.attachSupport(undergrowth);
 const coverage=undergrowth?appendHairStyleCoverage(undergrowth,style):null;
 const count=style?.segments||budget.segmentsPerStrand,maximumGeometryBytes=budget.maximumStrands*budget.segmentsPerStrand*36,maximumTriangles=budget.maximumStrands*budget.segmentsPerStrand*2;
 const maximumStrands=Math.floor(Math.min(resolved.maximumStrands,Math.floor((maximumGeometryBytes-(coverage?.geometryBytes||0))/(count*36)),Math.floor((maximumTriangles-(coverage?.levels[0].triangles||0))/(count*2)))*(style?Math.min(1,resolved.profile.density):1));
 const model=createHairBundleRulesR2({surface:adapter,domains:domains.domains,scalpRadius,rules});
 const storage=new Float32Array(maximumStrands*count*9);let offset=0;
 const hair=model.generate({maximumStrands,progress:report,onStrand(strand){
  // Coverage no longer depends on very broad ribbons. Narrow surface locks and
  // fine silhouette hairs can taper gently at the hairline without bald patches.
  const transition=1-Math.min(1,Math.max(0,strand.region.border)/.012);
  const fine=hairSeed(strand.id+'/layer')/4294967296<.12+.86*transition,edge=Math.sqrt(strand.coverage);
  const styleTop=style?Math.max(0,Math.min(1,(strand.point(0)[1]-scalp.centre[1])/.085)):0;
  const width=(fine?1:style?2.4+1.6*styleTop:12)*resolved.widthScale*(.25+.75*edge);
  const rootFade=t=>fine?1:.3+.7*Math.min(1,t/.18);
  const tone=strand.colourVariation*(fine?1:-1);
  const radiusAt=t=>strand.radius(t)*width*rootFade(t);
  const pointAt=style?style.curve(strand):t=>{
   const p=strand.point(t*(.4+.6*edge));
   if(t>0){
    const radial=p.map((v,i)=>v-scalp.centre[i]),length=Math.hypot(...radial),top=Math.max(0,radial[1]/length);
    const clearance=.0011*(1-Math.exp(-24*t));
    const lift=clearance+(rules.sideLiftMetres+(rules.topLiftMetres-rules.sideLiftMetres)*top)*.65*(fine?1.3:1)*Math.sin(Math.PI*t)*edge;
    for(let i=0;i<3;i++)p[i]+=radial[i]/length*lift;
   }
   return p;
  };
  let previous=pointAt(0),radius=radiusAt(0);
  for(let k=1;k<=count;k++){
   const next=pointAt(k/count),nextRadius=radiusAt(k/count);
   if(!previous.every(Number.isFinite)||!next.every(Number.isFinite)||!Number.isFinite(nextRadius)||Math.hypot(...next.map((v,i)=>v-previous[i]))>.045)throw Error('毛发曲线出现非有限值或异常长段');
   storage.set([...previous,...next,radius,nextRadius,tone],offset);offset+=9;previous=next;radius=nextRadius;
  }
 }});
 if(maximumStrands>0&&!hair.report.strands)throw Error('当前头皮未生成有效毛发');
 const segments=storage.subarray(0,offset);
 charts.clear();
 return {segments,coverage,report:{...hair.report,segmentsPerStrand:count,segments:segments.length/9,geometryBytes:segments.byteLength+(coverage?.geometryBytes||0),
  profile:resolved.profile,catalogRevision:catalog.revision,styleDesign:style?.design||'legacy',maximumStrands,allocatedSegmentBytes:storage.byteLength,
  representation:style?'layered tapered locks and fibre ribbons over continuous scalp coverage':'continuous temporal occipital scalp coverage and narrow fibre ribbons',coverageLocks:coverage?.lockCount||0,physicalStrandCount:null,scalpRegionRevision:'r17-continuous-temporal-occipital-1',
  maximumGeometryBytes,maximumTriangles,coverageBytes:coverage?.geometryBytes||0,coverageTriangles:coverage?.levels[0].triangles||0,drawCalls:maximumStrands?2:0,
  groom:{sweep:rules.sweep||0,part:rules.part||0,hairlineInset:rules.hairlineInset||0,seed:rules.seed},
  scalpCenter:scalp.centre.slice(),headDiameterMetres:2*Math.max(...scalp.radii),
  referenceScreenshotStrands:settings.referenceScreenshotStrands,sourceRuleModule:settings.ruleModule,
  generatedFromCurrentHead:true,storedDisplayVertices:false,poseAttachment:'shared reconstruction head joint delta',visualAcceptance:false}};
}
