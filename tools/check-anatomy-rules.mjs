// Inspect source and reference metadata only; never import the rule functions.
export function checkAnatomyRuleSources({read,parse,runtime,assert}){
 let checks=0;const check=(ok,message)=>{assert(ok,'Anatomy rule file contract: '+message);checks++;};
 const rules=read('reconstruction/anatomy-rules.mjs'),binding=read('reconstruction/binding.mjs');
 const topology=read('reconstruction/topology.mjs'),assembly=read('reconstruction/assembly.mjs');
 const tree=parse(rules,{ecmaVersion:'latest',sourceType:'module'});
 const declaration=tree.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name==='createAnatomyRules');
 check(!!declaration,'shared rule factory exported');
 check(runtime.includes(rules.replace(/^export /gm,'')),'page contains the exact shared rule source');
 for(const source of [binding,topology])check(source.includes("import {createAnatomyRules} from './anatomy-rules.mjs';"),'worker modules import the same factory');
 check(assembly.includes("await load('rig-reference.json')")&&assembly.includes('new CanonicalTopology(anatomyReference)'),'generator supplies anatomical reference to topology');
 const rig=JSON.parse(read('reconstruction/rig-reference.json'));
 const required=['hips','head',...Array.from({length:5},(_,i)=>'L'+(i+1)),...Array.from({length:12},(_,i)=>'T'+(i+1)),...Array.from({length:7},(_,i)=>'C'+(i+1))];
 for(const side of ['left','right']){
  for(const name of ['SC','AC','upperArm','forearm','radiusRotation','hand','femur','tibia','foot','midfoot'])required.push(side+'_'+name);
  for(const [stem,kind]of [['metacarpal','finger'],['metatarsal','toe']])for(let f=1;f<=5;f++){
   required.push(side+'_'+stem+'_'+f);for(let k=1;k<=(f===1?2:3);k++)required.push(side+'_'+kind+'_'+f+'_'+k);
  }
  for(const kind of ['humerus','femur'])check(rig.sphereFits[side+'_'+kind].radiusM>0,'finite source joint radius '+side+' '+kind);
 }
 for(const id of required)check(rig.nodes[id]?.positionM?.length===3&&rig.nodes[id].positionM.every(Number.isFinite),'existing finite landmark '+id);
 check(rules.includes('if(maskA===maskB)return true'),'source-domain connectivity remains explicit');
 check(rules.includes('if(!adjacent(x,y,p)||!adjacent(x,y,q))return false'),'both ends of a shared identity obey adjacency');
 check(rules.includes("gate(p,s,'shoulder')>0"),'arm-to-torso attachment is confined to shoulder roots');
 check(rules.includes('mask&=~64')&&rules.includes('mask&=~128'),'mixed pelvis ownership removes the opposite leg');
 check(rules.includes('else{\n    let k=1;')&&rules.includes('add(ray.ids[k])'),'distal digits use one ray');
 check(rules.includes('k<ids.length;k++')&&rules.includes('pos(ids[k+1]):tip(ids[k])'),'ray identity includes the terminal source segment');
 check(binding.includes('id=>rayTips.get(id)')&&topology.includes('id=>reference.nodes[id]?.tipM'),'binding and topology supply source terminal tips');
 check(binding.includes('if(ownership&&!ownership.allowed.has(ray.ids[k]))continue;'),'digit candidates filtered before selection');
 check(binding.includes('storeRow(i,priorIds,priorWeights,ownership)')&&binding.includes('storeRow(i,nextIds,nextWeights)'),'both priors and every diffusion update pass through projection');
 const compactBinding=binding.replace(/\s+/g,'');
 check(compactBinding.includes('supportWords=Math.ceil(jointCount/32),anatomicalSupport=newUint32Array(count*supportWords)')&&compactBinding.includes('for(constnameofownership.allowed)')&&compactBinding.includes('anatomicalSupport[i*supportWords+(id>>>5)]|=1<<(id&31)'),'support bitset includes every legal joint, independently of its initial prior');
 check(compactBinding.includes('elsepermitted=!!(anatomicalSupport[node*supportWords+(id>>>5)]&(1<<(id&31)))')&&compactBinding.includes('if(!permitted){rejectedInfluenceMass+=scratch[id];scratch[id]=0;}'),'every diffusion projection rejects influences outside full anatomical support');
 check(binding.includes('classes[i]=mask&armBit?(mask&(2|4)?2:1):-1')&&binding.includes('seed(i,edgeLength[at]*.5)')&&binding.includes('next=d+edgeLength[at]'),'shoulder transition seeds and distance use connected source graph edges');
 check(binding.includes('shoulderSign[i]=classes[i]===2?0:classes[i]')&&binding.includes('shoulderBandAt(shoulderSides[sideIndex],positions[i*3+1])')&&binding.includes("method:'signed-surface-distance'")&&binding.includes('inferiorBandMetres:.06'),'signed shoulder distance retains its narrower inferior transition');
 check(binding.includes('for(const name of [\'SC\',\'AC\',\'upperArm\'])allowed.add(shoulder.side+\'_\'+name)')&&binding.includes("mode:'shoulder-surface-transition'")&&binding.includes('if(!shoulderJoint(id,shoulder.side))throw Error'),'shoulder graph priors expand only same-side local anatomical support');
 check(JSON.parse(read('reconstruction/binding-schema.json')).weightMethod.includes('full anatomical support'),'binding metadata describes complete anatomical projection support');
 check(binding.includes('pinned[i]=1;stableNodes++')&&binding.includes('if(!pinned[i]&&(seamDistance[i]<bandM||shoulder)&&degrees[i])active.push(i);'),'only unpinned connected seam or shoulder-transition rows enter diffusion');
 check(binding.includes('if(!touched.includes(id))touched.push(id);scratch[id]=1;ownershipFallbacks++'),'empty candidate fallback does not duplicate scratch entries');
 check(topology.includes("name==='skin'&&!this.canShare(this.masks[id],mask,p,q)")&&topology.includes('rejectedAnatomicalWelds++'),'weld checks occur before merging masks');
 check(topology.indexOf('if(a.some((id,k)=>!topology.canShare')<topology.indexOf('topology.shareBinding(a[k],b[k])'),'reject interfaces before pairing and triangulation');
 check(topology.includes('this.bindingMasks[x],this.bindingMasks[y]')&&topology.includes("throw Error('Rejected transitive anatomical interface')"),'transitive identity merges retain ownership guards');
 check(topology.includes('rejectedInterfaceIds.push(p.id)'),'rejected source strips remain identifiable');
 const contract=JSON.parse(read('body/HumanDNAContract.json'));
 check(contract.structureRecipes.some(r=>r.id==='anatomical-constraints'&&r.source==='reconstruction/anatomy-rules.mjs'),'DNA exports the rules recipe');
 check(contract.acceptance.runtimeVerified===false&&contract.acceptance.visualAcceptance===false&&contract.acceptance.productionReady===false,'no acceptance upgrade');
 check(read('docs/ANATOMICAL_CONNECTION_RULES_R1.md').includes('selfCollisionImplemented=false'),'documentation separates binding constraints and collision');
 return {checks,version:'r2/anatomical-constraints@1',landmarks:required.length,applicationExecuted:false,ruleFunctionsExecuted:false,geometryGenerated:false,weightSolverExecuted:false,visualAcceptance:false};
}
