// Read-only numerical audit of the actual source charts and current balanced
// display sampler. Instrument a module in memory; never alter source assets.
import {readFileSync} from 'node:fs';
import {decodeCompactHuman} from '../reconstruction/codec.mjs';
import {CanonicalTopology} from '../reconstruction/topology.mjs';
import {createCompactNormalField} from '../reconstruction/normal-field.mjs';

const root=new URL('../reconstruction/',import.meta.url);
const load=async name=>(await decodeCompactHuman(readFileSync(new URL(name+'.chf.gz',root)))).data;
const [data,normalData]=await Promise.all([load('detail'),load('normal-field')]);
const normalField=createCompactNormalField(normalData),schema=JSON.parse(readFileSync(new URL('binding-schema.json',root)));
let source=readFileSync(new URL('mesher.mjs',root),'utf8').replaceAll(/from '(\.\/.+?)'/g,(_,path)=>"from '"+new URL(path,root).href+"'");
const replace=(from,to)=>{if(!source.includes(from))throw Error('Mesher audit hook changed: '+from);source=source.replace(from,to);};
replace('return {a,bb,c,depth,vertices,midpoints','return {shadeError,geometricNormalError,a,bb,c,depth,vertices,midpoints');
replace('const {vertices,midpoints,centre,lengths,errors','const {shadeError,geometricNormalError,vertices,midpoints,centre,lengths,errors');
replace('stats.acceptedTriangleProbes+=4;b.triangle(a,bb,c,orientation);',
  'stats.acceptedTriangleProbes+=4;if(centre.regionMask===1)(stats.headProbes??=[]).push({error,longest,shadeError:shadeError*180/Math.PI,geometricNormalError:geometricNormalError*180/Math.PI,limited:needsRefinement,p:centre.p});b.triangle(a,bb,c,orientation);');
const {sampleCompactGroup}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const {stats}=await sampleCompactGroup('detail',data,'balanced',()=>{},normalField,schema,new CanonicalTopology());
const exterior=p=>p[1]>1.43
  &&!(p[2]>.125&&Math.abs(p[0])<.050&&p[1]>1.445&&p[1]<1.535)
  &&!(Math.abs(p[0])>.072&&p[1]>1.46&&p[1]<1.548&&p[2]<.145);
const probes=stats.headProbes.filter(p=>exterior(p.p));
const distribution=key=>{const values=probes.map(p=>p[key]).sort((a,b)=>a-b);return {maximum:values.at(-1),p95:values[Math.floor(values.length*.95)],median:values[Math.floor(values.length*.5)]};};
const report={schema:'human/head_display_sampling_audit@1',quality:'balanced',exteriorTriangles:probes.length,
  limitedExteriorTriangles:probes.filter(p=>p.limited).length,positionErrorM:distribution('error'),edgeLengthM:distribution('longest'),
  shadingInterpolationErrorDegrees:distribution('shadeError'),geometricNormalErrorDegrees:distribution('geometricNormalError'),
  detailVertices:stats.vertices,detailTriangles:stats.triangles,detailRefinementBudget:stats.refinementBudget,
  usedRefinements:stats.adaptiveSplits,unusedRefinements:stats.unusedRefinementBudget,
  browserExecuted:false,visualAcceptance:false};
if(probes.length<10000||stats.adaptiveSplits>stats.refinementBudget)throw Error('Invalid actual-head audit coverage or refinement budget');
console.log(JSON.stringify(report,null,2));
