// Exercise the generated binding field, without storing a display mesh or
// starting a browser. The real captured poses are checked separately in QA.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAnatomyRules} from '../reconstruction/anatomy-rules.mjs';
import {buildCompactBinding} from '../reconstruction/binding.mjs';
const reference=JSON.parse(readFileSync(new URL('../reconstruction/rig-reference.json',import.meta.url)));
const frames=new Map(Object.entries(reference.nodes).map(([id,n])=>[id,{p:n.positionM}]));
const names=[...frames.keys()],jointIds=new Map(names.map((id,i)=>[id,i])),pos=id=>frames.get(id).p;
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const segments=new Map(['left','right'].map(side=>{
 const rays=kind=>Array.from({length:5},(_,digit)=>{
  const ids=[side+'_'+(kind==='finger'?'metacarpal_':'metatarsal_')+(digit+1),...Array.from({length:digit===0?2:3},(_,k)=>side+'_'+kind+'_'+(digit+1)+'_'+(k+1))];
  return {ids,points:[...ids.map(pos),reference.nodes[ids.at(-1)].tipM]};
 });
 return [side,{shoulder:pos(side+'_upperArm'),elbow:pos(side+'_forearm'),wrist:pos(side+'_hand'),
  hip:pos(side+'_femur'),knee:pos(side+'_tibia'),ankle:pos(side+'_foot'),fingers:rays('finger'),toes:rays('toe'),
  shoulderRadius:reference.sphereFits[side+'_humerus'].radiusM,hipRadius:reference.sphereFits[side+'_femur'].radiusM}];
}));
const spine=names.filter(id=>id==='hips'||/^[LTC]\d+$/.test(id)||id==='head').map(id=>[id,pos(id)[1]]).sort((a,b)=>a[1]-b[1]);
const rig={frames,segments,jointIds,jointNames:names,spine};
const rules=createAnatomyRules(pos,(side,kind)=>reference.sphereFits[side+'_'+kind].radiusM);
function bind(points,masks){
 const vertices=points.length,vertexIds=Uint32Array.from(points,(_,i)=>i);
 return buildCompactBinding({bindingRoots:vertexIds,meshes:[{name:'skin',vertices,vertexIds,
  positions:Float32Array.from(points.flatMap(p=>[-p[0],p[1],p[2]])),regionMasks:Uint16Array.from(masks),indices:new Uint32Array()}]},rig);
}
const points=[],masks=[],pairs=[],head=pos('head'),base=pos('C7'),oldRadius=distance(head,base)*.65;
// Cross the former hard spherical boundary from several lower skull/nape
// directions. A 0.1 mm step previously switched the whole head influence.
for(const height of [1.425,1.438,1.450,1.462])for(let angle=0;angle<16;angle++){
 const y=height-head[1],radius=Math.sqrt(Math.max(0,oldRadius**2-y*y));
 const a=angle*Math.PI/8,u=[Math.cos(a),Math.sin(a)];
 const first=points.length;
 for(const offset of [-.00005,.00005]){points.push([head[0]+(radius+offset)*u[0],height,head[2]+(radius+offset)*u[1]]);masks.push(1);}
 pairs.push([first,first+1]);
}
// Sample the actual new neck transition and both of its height endpoints,
// including masks used by the atlas on either side of the same interface.
for(const mask of [1,2,3,4,5,7])for(const radial of [.025,.040,.055,.070,.090])for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
 let previous=-1;
 for(let step=0;step<=800;step++){
  const index=points.length;points.push([head[0]+radial*Math.cos(a),1.40+step*.0001,head[2]+radial*Math.sin(a)]);masks.push(mask);
  if(previous>=0)pairs.push([previous,index]);previous=index;
 }
}
const field=bind(points,masks),dense=index=>{const values=new Float64Array(names.length);for(let k=0;k<8;k++)values[field.ids[index*8+k]]+=field.weights[index*8+k]/65535;return values;};
let maximumAdjacentWeightChange=0;
for(const [a,b]of pairs){const A=dense(a),B=dense(b);let change=0;for(let k=0;k<A.length;k++)change+=Math.abs(A[k]-B[k]);maximumAdjacentWeightChange=Math.max(maximumAdjacentWeightChange,change);}
assert(maximumAdjacentWeightChange<.045,'0.1 mm neck steps must not cross a hard ownership boundary');
for(let i=0;i<points.length;i++){
 const p=points[i],w=rules.cranialWeight(p),row=dense(i);
 assert(Number.isFinite(w)&&w>=0&&w<=1);
 assert(Math.abs(row.reduce((a,b)=>a+b,0)-1)<1e-12,'encoded rows must remain normalized');
 if(w===1)assert.equal(row[jointIds.get('head')],1,'rigid skull shell must not diffuse back into the neck');
}
// Facial overlays are head-bound. Their source envelope must therefore use
// the same rigid frame; no hidden second cervical pose at the face seam.
for(const y of [1.439,1.445,1.455,1.475,1.500,1.540])for(const x of [-.05,-.025,0,.025,.05]){
 if(Math.hypot((x+.0005)/.068,(y-1.506)/.067)>=1)continue;
 assert.equal(rules.cranialWeight([x,y,.145]),1,'lower facial shell retains head attachment');
}
for(const side of ['left','right'])for(const id of ['SC','AC','upperArm'])assert.equal(rules.cranialWeight(pos(side+'_'+id)),0,'head field must not bind the shoulder');
// Actual source chin witnesses from the sit-to-stand failure. The first three
// belong to torso mask 4, below the old C4 height cutoff. They must follow the
// closed jaw/head rigidly, including when the same surface crosses an atlas
// domain boundary. A continuous but half-cervical chin still makes a long flap.
const jawWitnesses=[
 [-.005542653147131205,1.4155030250549316,.17886285483837128],
 [.001859772950410843,1.4139022827148438,.17679716646671295],
 [-.0014017975190654397,1.4142764806747437,.17779308557510376],
 [.0015028765192255378,1.424639105796814,.18458999693393707]
];
const jawMasks=[1,2,3,4,5,7],jawPoints=jawWitnesses.flatMap(p=>jawMasks.map(()=>p));
const jawField=bind(jawPoints,jawWitnesses.flatMap(()=>jawMasks));
for(let i=0;i<jawPoints.length;i++){
 let headWeight=0;for(let k=0;k<8;k++)if(jawField.ids[i*8+k]===jointIds.get('head'))headWeight+=jawField.weights[i*8+k];
 assert.equal(headWeight,65535,'anterior source mandible must not retain cervical influence');
}
// The mandibular repair is directional: the nape and cervical core keep the
// previously checked field, rather than turning the entire neck into a block.
let posteriorSamples=0;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
for(let y=1.38;y<=1.49;y+=.001)for(const x of [-.05,-.025,0,.025,.05])for(const z of [.015,.045,.075,.105]){
 const p=[x,y,z],t=Math.max(0,Math.min(1,(y-base[1])/(head[1]-base[1]))),a=base.map((v,k)=>v+(head[k]-v)*t);
 const radial=Math.hypot(p[0]-a[0],p[2]-a[2]),shell=y+1.4*Math.max(0,radial-distance(head,base)*.3);
 const original=smooth((y-pos('C5')[1])/(pos('C4')[1]-pos('C5')[1]))*smooth((shell-pos('C2')[1])/(head[1]-pos('C2')[1]));
 assert(Math.abs(rules.cranialWeight(p)-original)<1e-14,'posterior/core neck field changed');posteriorSamples++;
}
assert.equal(field.report.ownershipFallbacks,0,'continuous priors must not rely on closest-joint fallback');
console.log(JSON.stringify({schema:'human/neck_binding_continuity@1',vertices:points.length,adjacentPairs:pairs.length,
 maximumAdjacentWeightChange,encodedWeightSum:65535,ownershipFallbacks:field.report.ownershipFallbacks,jawWitnesses:jawPoints.length,posteriorSamples,
 browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
