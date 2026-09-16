// Authored anatomical landmarks for the canonical R2 adult male scalp.
// Study references and the distinction from measured follicle density are in
// docs/HAIR_SCALP_COVERAGE_R17.md. Angles are radians, lengths are metres.
// [azimuth from the anterior midline, polar edge, relative root weight,
//  boundary lock length multiplier, transition width, anatomical landmark]
export const HAIR_SCALP_LANDMARKS=[
 [0,1.17,.84,1,.008,'midfrontal'],
 [.22,1.165,.84,1,.008,'frontal'],
 [.48,1.145,.80,.95,.009,'lateral-frontal'],
 [.76,1.08,.68,.75,.010,'frontotemporal-recess'],
 [.94,1.12,.65,.60,.010,'temporal-junction'],
 [1.08,1.53,.62,.43,.011,'temporal-point'],
 [1.18,1.50,.60,.36,.012,'infratemporal-recess'],
 [1.30,1.98,.74,.48,.006,'sideburn'],
 [1.44,1.73,.82,.58,.004,'preauricular-notch'],
 [1.62,1.57,.90,.72,.003,'supra-auricular'],
 [1.78,1.69,.94,.76,.004,'postauricular-top'],
 [1.97,2.05,.96,.48,.006,'retroauricular'],
 [2.18,2.40,1,.34,.009,'mastoid-scalp'],
 [2.45,2.52,1,.25,.012,'occipital'],
 [2.78,2.55,.94,.20,.014,'lateral-nape'],
 [3.02,2.53,.94,.18,.014,'paramedian-nape'],
 [Math.PI,2.49,.94,.18,.014,'midline-nape']
];
const zoneClamp=x=>Math.max(0,Math.min(1,x));
const zoneSmooth=x=>{x=zoneClamp(x);return x*x*(3-2*x);};
export function scalpBoundary(azimuth,side,rules){
 const a=Math.max(0,Math.min(Math.PI,azimuth));let i=1;
 while(i<HAIR_SCALP_LANDMARKS.length-1&&a>HAIR_SCALP_LANDMARKS[i][0])i++;
 const lo=HAIR_SCALP_LANDMARKS[i-1],hi=HAIR_SCALP_LANDMARKS[i],t=zoneSmooth((a-lo[0])/(hi[0]-lo[0]));
 const blend=k=>lo[k]+(hi[k]-lo[k])*t,phase=(rules.seed%4093)/4093*Math.PI*2;
 const frontal=1-zoneSmooth(a/1.05),asymmetry=.009*side*Math.sin(phase)*Math.sin(a);
 const irregular=.005*Math.sin(a*23+phase)+.003*Math.sin(a*47-phase);
 const theta=blend(1)-(rules.hairlineInset||0)*frontal+asymmetry+irregular;
 return {theta,weight:blend(2),lengthScale:blend(3),feather:blend(4),landmark:t<.5?lo[5]:hi[5]};
}
export function sampleScalpRegion(position,rules){
 const p=position.map((v,k)=>v-rules.scalpCenter[k]),radius=Math.hypot(...p);
 if(!(radius>1e-8))return {coverage:0,border:-1,weight:0,lengthScale:1,feather:.01,landmark:'outside'};
 const n=p.map(v=>v/radius),azimuth=Math.atan2(Math.abs(n[0]),n[2]);
 const boundary=scalpBoundary(azimuth,Math.sign(n[0]),rules),theta=Math.acos(Math.max(-1,Math.min(1,n[1])));
 const border=(boundary.theta-theta)*radius,top=zoneSmooth((n[1]-.2)/.65);
 const weight=boundary.weight+(1-boundary.weight)*top;
 // The growth footprint is independent of cutting length: hair above/behind
 // the ear stays present even when a preset crops the temporal area short.
 const follicleCoverage=zoneSmooth(border/boundary.feather);
 const interiorLength=zoneSmooth(Math.max(top,border/.028));
 return {...boundary,weight,border,follicleCoverage,coverage:follicleCoverage*weight,
  lengthScale:boundary.lengthScale+(1-boundary.lengthScale)*interiorLength};
}
