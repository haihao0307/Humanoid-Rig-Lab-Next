// Small synthetic surface strips exercise binding only; no full human or GPU.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCompactBinding} from '../reconstruction/binding.mjs';

const reference=JSON.parse(readFileSync(new URL('../reconstruction/rig-reference.json',import.meta.url)));
const frames=new Map(Object.entries(reference.nodes).map(([id,node])=>[id,{p:node.positionM,q:[0,0,0,1]}]));
const pos=id=>frames.get(id).p,segments=new Map();
for(const side of ['left','right']){
 const rays=kind=>Array.from({length:5},(_,i)=>{
  const ids=[side+'_'+(kind==='finger'?'metacarpal':'metatarsal')+'_'+(i+1),...Array.from({length:i===0?2:3},(_,j)=>side+'_'+kind+'_'+(i+1)+'_'+(j+1))];
  return {ids,points:[...ids.map(pos),reference.nodes[ids.at(-1)].tipM]};
 });
 segments.set(side,{shoulder:pos(side+'_upperArm'),elbow:pos(side+'_forearm'),wrist:pos(side+'_hand'),
  hip:pos(side+'_femur'),knee:pos(side+'_tibia'),ankle:pos(side+'_foot'),fingers:rays('finger'),toes:rays('toe'),
  shoulderRadius:reference.sphereFits[side+'_humerus'].radiusM,hipRadius:reference.sphereFits[side+'_femur'].radiusM});
}
const spine=['hips',...Array.from({length:5},(_,i)=>'L'+(5-i)),...Array.from({length:12},(_,i)=>'T'+(12-i)),...Array.from({length:7},(_,i)=>'C'+(7-i)),'head'];
const jointNames=[...frames.keys()],rig={frames,segments,jointNames,jointIds:new Map(jointNames.map((id,i)=>[id,i])),spine:spine.map(id=>[id,pos(id)[1]])};
const positions=[],masks=[],indices=[],strips=[];
const vertex=(p,mask)=>{const id=masks.length;positions.push(-p[0],p[1],p[2]);masks.push(mask);return id;};
for(const side of ['left','right']){
 const s=side==='left'?-1:1,arm=side==='left'?16:32,columns=[];
 for(let j=-40;j<=40;j++){
  const mask=j===0?arm|4:j>0?arm:4;
  columns.push([-.001,.001].map(z=>vertex([s*(.1652+j*.002),1.1921,.1075+z],mask)));
 }
 for(let j=0;j<columns.length-1;j++){const [a,b]=columns[j],[c,d]=columns[j+1];indices.push(a,c,b,b,c,d);}
 strips.push({side,columns});
}
// Same location as the left shoulder seam, but on a disconnected all-arm face.
const disconnected=[vertex([-.1652,1.1921,.1075],16),vertex([-.1653,1.1921,.1076],16),vertex([-.1652,1.1922,.1075],16)];
indices.push(...disconnected);
const count=masks.length,mesh={name:'skin',vertices:count,positions:Float32Array.from(positions),regionMasks:Uint16Array.from(masks),vertexIds:Uint32Array.from({length:count},(_,i)=>i),indices:Uint32Array.from(indices)};
const field=buildCompactBinding({meshes:[mesh],bindingRoots:Uint32Array.from({length:count},(_,i)=>i)},rig);
const weights=id=>{const at=field.vertexNodes[id]*8;return Array.from({length:8},(_,i)=>[jointNames[field.ids[at+i]],field.weights[at+i]/65535]).filter(([,w])=>w>0);};
const armWeight=(id,side)=>weights(id).filter(([name])=>name.startsWith(side+'_')).reduce((sum,[,w])=>sum+w,0);
let maximumAdjacentJump=0;
for(const {side,columns}of strips){
 for(const id of columns[40])assert(Math.abs(armWeight(id,side)-.5)<.05,'shared '+side+' seam must have a common half-arm prior');
 for(let j=1;j<columns.length;j++)for(let row=0;row<2;row++){
  const jump=Math.abs(armWeight(columns[j][row],side)-armWeight(columns[j-1][row],side));maximumAdjacentJump=Math.max(maximumAdjacentJump,jump);
  assert(jump<.06,'2 mm shoulder edges must not retain a mask-dependent weight jump');
 }
 for(const column of columns)for(const id of column)for(const [name]of weights(id)){
  assert(/^[CTL]\d+$/.test(name)||['SC','AC','upperArm','forearm','radiusRotation'].some(suffix=>name===side+'_'+suffix),'shoulder field must exclude head, digits and the other arm');
 }
 assert(armWeight(columns[0][0],side)<.001,'outer torso must retain its original prior');
 assert(armWeight(columns.at(-1)[0],side)>.999,'outer upper arm must retain its original prior');
}
for(const id of disconnected)assert(armWeight(id,'left')>.999,'a disconnected nearby arm face must not receive a geodesic shoulder blend');
assert.deepEqual(field.report.shoulderPrior.seeds,[2,2]);
assert(field.report.shoulderPrior.transitionNodes.every(n=>n>80&&n<140));
console.log(JSON.stringify({schema:'human/shoulder_geodesic_prior_regression@1',vertices:count,maximumAdjacentJump,
 shoulderPrior:field.report.shoulderPrior,ruleFunctionsExecuted:true,weightSolverExecuted:true,fullHumanGenerated:false,browserExecuted:false,gpuExecuted:false}));
