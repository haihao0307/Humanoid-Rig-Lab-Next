// R2.3b needs real cloth-to-cloth contact between the four active main panels.
// The uninstalled gusset and waistbands remain locked authoring pieces and must
// not act as invisible collision obstacles. This patch introduces an optional
// active contact domain without changing source paper, rendering topology,
// mass, seam ownership or the Human rig. Idempotent workflow patch.
import fs from 'node:fs';

const replaceOnce=(text,from,to,label)=>{
  const first=text.indexOf(from),last=text.lastIndexOf(from);
  if(first<0||first!==last)throw Error('Ambiguous R2.3b active-contact anchor: '+label);
  return text.replace(from,to);
};
const patchSection=(text,startMarker,endMarker,patch,label)=>{
  const start=text.indexOf(startMarker),end=text.indexOf(endMarker,start+startMarker.length);
  if(start<0||end<0||text.indexOf(startMarker,start+1)>=0)throw Error('Ambiguous R2.3b contact section: '+label);
  return text.slice(0,start)+patch(text.slice(start,end))+text.slice(end);
};

const dualPath='clothing/ShortsDualTubeR2.js';
let dual=fs.readFileSync(dualPath,'utf8');
if(!dual.includes('simulation.contactTriangleRecords=activeTriangleRecords')){
  const old=`  simulation.continuousContact=simulation.options.selfContact?createShortsContinuousContact(simulation.particles,simulation.triangleRecords,simulation.edges,{thickness:simulation.options.thickness,maxCandidates:simulation.options.maxSelfCandidates,dofs:simulation.dofs,motionLimit:true}):null;
  const activeTriangleRecords=simulation.triangleRecords.filter(record=>activePieces.has(record.pieceId));
  if(!activeTriangleRecords.length)fail('active dual-tube contact triangles are missing');`;
  const next=`  const activeTriangleRecords=simulation.triangleRecords.filter(record=>activePieces.has(record.pieceId));
  const activeEdges=simulation.edges.filter(edge=>activePieces.has(simulation.particles[edge.a].pieceId)&&activePieces.has(simulation.particles[edge.b].pieceId));
  const activeParticleIndices=[];for(let i=0;i<simulation.particles.length;i++)if(activePieces.has(simulation.particles[i].pieceId))activeParticleIndices.push(i);
  if(!activeTriangleRecords.length||!activeEdges.length||!activeParticleIndices.length)fail('active dual-tube contact domain is missing');
  simulation.contactTriangleRecords=activeTriangleRecords;
  simulation.contactEdges=activeEdges;
  simulation.contactParticleIndices=activeParticleIndices;
  simulation.continuousContact=simulation.options.selfContact?createShortsContinuousContact(simulation.particles,activeTriangleRecords,activeEdges,{thickness:simulation.options.thickness,maxCandidates:simulation.options.maxSelfCandidates,dofs:simulation.dofs,motionLimit:true}):null;`;
  dual=replaceOnce(dual,old,next,'active contact domain');
  dual=replaceOnce(dual,"bodyContactTriangleCount:activeTriangleRecords.length};","bodyContactTriangleCount:activeTriangleRecords.length,clothContactPieces:[...activePieces],clothContactTriangleCount:activeTriangleRecords.length,clothContactEdgeCount:activeEdges.length,clothContactParticleCount:activeParticleIndices.length};",'active contact report');
  fs.writeFileSync(dualPath,dual);
  console.log('Restricted R2.3b cloth contact to FL/BL/FR/BR.');
}else console.log('R2.3b active-panel contact domain is already canonical.');

const clothPath='clothing/ShortsCloth.js';
let cloth=fs.readFileSync(clothPath,'utf8');
if(!cloth.includes('const contactTriangles=this.contactTriangleRecords||this.triangleRecords;')){
  cloth=patchSection(cloth,'  _selfCandidates(){','  _selfEdgeContact(',section=>{
    section=section.replaceAll('this.triangleRecords','contactTriangles');
    section=section.replace('  _selfCandidates(){\n    const size=',"  _selfCandidates(){\n    const contactTriangles=this.contactTriangleRecords||this.triangleRecords;\n    const particleIndices=this.contactParticleIndices||Array.from({length:this.particles.length},(_,i)=>i);\n    const size=");
    section=section.replace('for(let i=0;i<this.particles.length;i++){','for(const i of particleIndices){');
    return section;
  },'vertex-face contact domain');
  cloth=patchSection(cloth,'  _selfEdgeContact(','  _selfContact(',section=>{
    section=section.replaceAll('this.edges','contactEdges');
    section=section.replace("  _selfEdgeContact(project,budget){\n    const cell=","  _selfEdgeContact(project,budget){\n    const contactEdges=this.contactEdges||this.edges;\n    const cell=");
    return section;
  },'edge-edge contact domain');
  cloth=patchSection(cloth,'  _selfContact(','  _sweptSelfContact(',section=>{
    section=section.replaceAll('this.triangleRecords','contactTriangles');
    section=section.replace("  _selfContact(project=true){\n    if(!this.options.selfContact)return;","  _selfContact(project=true){\n    if(!this.options.selfContact)return;const contactTriangles=this.contactTriangleRecords||this.triangleRecords;");
    return section;
  },'self-contact triangle domain');
  fs.writeFileSync(clothPath,cloth);
  console.log('Added optional active cloth-contact domains to ShortsCloth.');
}else console.log('ShortsCloth active contact domains are already canonical.');

const rendererPath='clothing/ClothShorts.js';
let renderer=fs.readFileSync(rendererPath,'utf8');
const oldOptions="const stagedOptions={...SHORTS_WEARING_OPTIONS,gravity:0,groundY:null,selfContact:false,triangleBodyContact:true,iterations:10,maxMaterialIterations:20,sewingSeconds:1000,handlingDamping:5};";
const newOptions="const stagedOptions={...SHORTS_WEARING_OPTIONS,gravity:0,groundY:null,selfContact:true,selfContactSweeps:2,maxSelfCandidates:30000,triangleBodyContact:true,iterations:10,maxMaterialIterations:20,sewingSeconds:1000,handlingDamping:5};";
if(renderer.includes(oldOptions)){
  renderer=replaceOnce(renderer,oldOptions,newOptions,'dual review self contact');
  fs.writeFileSync(rendererPath,renderer);
  console.log('Enabled active-panel continuous contact for R2.3b browser relaxation.');
}else if(renderer.includes(newOptions))console.log('R2.3b browser self contact is already canonical.');
else throw Error('R2.3b browser staged options not found');
