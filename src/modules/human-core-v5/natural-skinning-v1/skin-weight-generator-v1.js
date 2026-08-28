import { distance3, pointSegmentDistance } from './math-v1.js';

export const HRL_SKIN_WEIGHT_PROFILE_V1_SCHEMA = 'humanoid_rig/hrl_skin_weight_profile@1.0';
export const HRL_SKIN_WEIGHT_MAGIC_V1 = 'HRLSWGT1';
const QUANTIZATION = 65536;

export class HRLSkinWeightGeneratorV1 {
  constructor({ positions, indices, vertexSide, symmetryPartner, primaryRegionIds, deformationRegions, performanceRig }) {
    this.positions = positions; this.indices = indices; this.vertexSide = vertexSide; this.symmetryPartner = symmetryPartner; this.primaryRegionIds = primaryRegionIds;
    this.regionNames = deformationRegions.map((region) => region.id); this.performanceRig = performanceRig; this.palette = performanceRig.bonePaletteOrder; this.paletteIndex = performanceRig.paletteIndex;
    this.boneById = new Map(performanceRig.joints.map((joint) => [joint.id, joint])); this.children = childrenByParent(performanceRig.joints); this.adjacency = buildAdjacency(indices, positions.length / 3);
  }

  generate({ diffusionIterations = 10 } = {}) {
    const vertexCount = this.positions.length / 3; const candidateIds = new Array(vertexCount); let fields = new Array(vertexCount);
    for (let vertex = 0; vertex < vertexCount; vertex += 1) {
      const point = pointAt(this.positions, vertex); const zone = classifyZone(point, this.regionNames[this.primaryRegionIds[vertex]], this.vertexSide[vertex]);
      candidateIds[vertex] = this.candidatesFor(point, zone, this.vertexSide[vertex]); fields[vertex] = seedWeights(point, candidateIds[vertex], this.boneById, this.children, zone);
    }
    for (let iteration = 0; iteration < diffusionIterations; iteration += 1) fields = diffuse(fields, candidateIds, this.adjacency, 0.34);
    enforceNoOrphans(fields, candidateIds, this.positions, this.performanceRig, this.vertexSide);
    enforceBilateral(fields, this.vertexSide, this.symmetryPartner, this.paletteIndex);

    const joints0 = new Uint16Array(vertexCount * 4); const joints1 = new Uint16Array(vertexCount * 4); const weights0 = new Float32Array(vertexCount * 4); const weights1 = new Float32Array(vertexCount * 4); const hybridBlend = new Float32Array(vertexCount); const influenceCounts = new Uint8Array(vertexCount);
    for (let vertex = 0; vertex < vertexCount; vertex += 1) {
      const entries = quantizeWeights([...fields[vertex]].filter(([,weight]) => weight > 1e-12).sort((a,b) => b[1] - a[1] || this.paletteIndex[a[0]] - this.paletteIndex[b[0]]).slice(0,8)); influenceCounts[vertex] = entries.length;
      entries.forEach(([boneId, weight], slot) => { const targetJoints = slot < 4 ? joints0 : joints1; const targetWeights = slot < 4 ? weights0 : weights1; const offset = vertex * 4 + (slot % 4); targetJoints[offset] = this.paletteIndex[boneId]; targetWeights[offset] = weight; });
      hybridBlend[vertex] = hybridBlendFor(pointAt(this.positions, vertex), this.regionNames[this.primaryRegionIds[vertex]], entries.map(([id]) => id));
    }
    repairQuantizedOrphans({ joints0,weights0,joints1,weights1,influenceCounts,positions:this.positions,vertexSide:this.vertexSide,symmetryPartner:this.symmetryPartner,performanceRig:this.performanceRig });
    const data = { joints0, weights0, joints1, weights1, hybridBlend, influenceCounts }; const metrics = auditSkinWeightsV1({ ...data, vertexSide: this.vertexSide, symmetryPartner: this.symmetryPartner, performanceRig: this.performanceRig });
    return { schema: HRL_SKIN_WEIGHT_PROFILE_V1_SCHEMA, profileId: 'HRLSkinWeightGeneratorV1', vertexCount, influenceLimit: 8, bonePaletteOrder: this.performanceRig.bonePaletteOrder, method: ['semantic and anatomical region gates','surface-graph adjacency diffusion','bone-segment seed distance','bilateral partner constraint','centerline balance','binary-exact 1/65536 normalization','influence pruning capped before field construction'], diffusionIterations, data, metrics, externalSkinWeightAssetRequests: 0, externalRigAssetRequests: 0, externalSkinnedMeshUsed: false, weightTransferUsed: false };
  }

  candidatesFor(point, zone, sideValue) {
    if (sideValue === 0) return nearestBoneIds(point, ['pelvis','spineLower','spineMiddle','spineUpper','chest','neck','head'], this.boneById, this.children, 8);
    const side = sideValue === 1 ? 'left' : 'right';
    if (zone === 'head') return nearestBoneIds(point, ['head','neck','chest'], this.boneById, this.children, 8);
    if (zone === 'hand') return nearestBoneIds(point, [`${side}Hand`, ...this.palette.filter((id) => id.startsWith(side) && /Thumb|Index|Middle|Ring|Little/.test(id))], this.boneById, this.children, 8);
    if (zone === 'arm') return nearestBoneIds(point, ['chest',`${side}Clavicle`,`${side}Scapula`,`${side}UpperArm`,`${side}UpperArmTwist01`,`${side}UpperArmTwist02`,`${side}LowerArm`,`${side}ForearmTwist01`,`${side}ForearmTwist02`,`${side}Hand`], this.boneById, this.children, 8);
    if (zone === 'foot') return nearestBoneIds(point, [`${side}LowerLeg`,`${side}CalfTwist01`,`${side}Foot`,`${side}Toe`], this.boneById, this.children, 8);
    if (zone === 'leg') return nearestBoneIds(point, ['pelvis',`${side}UpperLeg`,`${side}ThighTwist01`,`${side}ThighTwist02`,`${side}LowerLeg`,`${side}CalfTwist01`,`${side}Foot`,`${side}Toe`], this.boneById, this.children, 8);
    if (zone === 'pelvis') return nearestBoneIds(point, ['pelvis','spineLower',`${side}UpperLeg`,`${side}ThighTwist01`,`${side}ThighTwist02`], this.boneById, this.children, 8);
    return nearestBoneIds(point, ['pelvis','spineLower','spineMiddle','spineUpper','chest','neck','head',`${side}Clavicle`], this.boneById, this.children, 8);
  }
}

export function encodeSkinWeightsV1(profile) {
  const chunks = [['joints0',profile.data.joints0],['weights0',profile.data.weights0],['joints1',profile.data.joints1],['weights1',profile.data.weights1],['hybridBlend',profile.data.hybridBlend],['influenceCounts',profile.data.influenceCounts]];
  let byteOffset = 0; const descriptors = {}; for (const [name,array] of chunks) { byteOffset = align(byteOffset, array.BYTES_PER_ELEMENT); descriptors[name] = { type: array.constructor.name, count: array.length, byteOffset, byteLength: array.byteLength }; byteOffset += array.byteLength; }
  const headerBytes = new TextEncoder().encode(JSON.stringify({ schema: 'humanoid_rig/hrl_skin_weights_binary@1.0', magic: HRL_SKIN_WEIGHT_MAGIC_V1, vertexCount: profile.vertexCount, influenceLimit: 8, bonePaletteOrder: profile.bonePaletteOrder ?? profile.performanceRig?.bonePaletteOrder, chunks: descriptors })); const dataOffset = align(16 + headerBytes.length,16); const output = new Uint8Array(dataOffset + byteOffset); output.set(new TextEncoder().encode(HRL_SKIN_WEIGHT_MAGIC_V1),0); const view = new DataView(output.buffer); view.setUint32(8,headerBytes.length,true); view.setUint32(12,dataOffset,true); output.set(headerBytes,16);
  for (const [name,array] of chunks) output.set(new Uint8Array(array.buffer,array.byteOffset,array.byteLength),dataOffset+descriptors[name].byteOffset); return output;
}

export function parseSkinWeightsV1(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input); const magic = new TextDecoder().decode(bytes.subarray(0,8)); if (magic !== HRL_SKIN_WEIGHT_MAGIC_V1) throw new Error(`Unexpected skin-weight magic ${magic}.`); const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength); const jsonLength=view.getUint32(8,true);const dataOffset=view.getUint32(12,true);const header=JSON.parse(new TextDecoder().decode(bytes.subarray(16,16+jsonLength))); const constructors={Uint16Array,Float32Array,Uint8Array};const data={};for(const [name,descriptor] of Object.entries(header.chunks)){const Constructor=constructors[descriptor.type];const copied=bytes.slice(dataOffset+descriptor.byteOffset,dataOffset+descriptor.byteOffset+descriptor.byteLength);data[name]=new Constructor(copied.buffer,copied.byteOffset,descriptor.count);}return {header,data,bytes};
}

export function auditSkinWeightsV1({ joints0,weights0,joints1,weights1,hybridBlend,influenceCounts,vertexSide,symmetryPartner,performanceRig }) {
  const vertexCount=vertexSide.length;let zero=0;let negative=0;let nan=0;let inf=0;let maximumSumError=0;let totalSumError=0;let maximumInfluences=0;let unknown=0;let leakage=0;let maximumBilateral=0;let centerlineBalance=0;const boneUse=new Uint32Array(performanceRig.bonePaletteOrder.length);
  const entries=(vertex)=>{const result=[];for(let slot=0;slot<8;slot+=1){const joints=slot<4?joints0:joints1;const weights=slot<4?weights0:weights1;const offset=vertex*4+(slot%4);if(weights[offset]>0)result.push([joints[offset],weights[offset]]);}return result;};
  for(let vertex=0;vertex<vertexCount;vertex+=1){const list=entries(vertex);const sum=list.reduce((value,[bone,weight])=>{if(!Number.isFinite(weight)){if(Number.isNaN(weight))nan+=1;else inf+=1;}if(weight<0)negative+=1;if(bone>=boneUse.length)unknown+=1;else boneUse[bone]+=1;const id=performanceRig.bonePaletteOrder[bone]??'';if(vertexSide[vertex]===1&&id.startsWith('right'))leakage+=1;if(vertexSide[vertex]===2&&id.startsWith('left'))leakage+=1;return value+weight;},0);if(sum===0)zero+=1;const error=Math.abs(1-sum);maximumSumError=Math.max(maximumSumError,error);totalSumError+=error;maximumInfluences=Math.max(maximumInfluences,list.length,influenceCounts[vertex]);if(!Number.isFinite(hybridBlend[vertex]))nan+=1;}
  const mirrorIndex=(index)=>{const id=performanceRig.bonePaletteOrder[index];const mirror=id.startsWith('left')?`right${id.slice(4)}`:id.startsWith('right')?`left${id.slice(5)}`:id;return performanceRig.paletteIndex[mirror];};
  for(let vertex=0;vertex<vertexCount;vertex+=1){const partner=symmetryPartner[vertex];if(partner<vertex)continue;const left=new Map(entries(vertex).map(([bone,weight])=>[mirrorIndex(bone),weight]));const right=new Map(entries(partner));for(const bone of new Set([...left.keys(),...right.keys()]))maximumBilateral=Math.max(maximumBilateral,Math.abs((left.get(bone)||0)-(right.get(bone)||0)));if(vertexSide[vertex]===0){const map=new Map(entries(vertex));for(let bone=0;bone<performanceRig.bonePaletteOrder.length;bone+=1){const id=performanceRig.bonePaletteOrder[bone];if(!id.startsWith('left'))continue;centerlineBalance=Math.max(centerlineBalance,Math.abs((map.get(bone)||0)-(map.get(mirrorIndex(bone))||0)));}}}
  const orphanBoneIds=performanceRig.bonePaletteOrder.filter((id,index)=>boneUse[index]===0);
  return {zeroWeightVertexCount:zero,negativeWeightCount:negative,NaNWeightCount:nan,InfWeightCount:inf,maximumWeightSumError:maximumSumError,meanWeightSumError:totalSumError/vertexCount,maximumInfluenceCount:maximumInfluences,orphanBoneCount:orphanBoneIds.length,orphanBoneIds,unknownBoneIndexCount:unknown,leftRightWeightLeakCount:leakage,maximumBilateralWeightError:maximumBilateral,centerlineBalanceError:centerlineBalance,maximumDiscardedWeight:0,hybridBlendMinimum:Math.min(...hybridBlend),hybridBlendMaximum:Math.max(...hybridBlend)};
}

function classifyZone(point, regionName='', sideValue=0){if(sideValue===0)return point[1]>0.61?'head':point[1]<0.13?'pelvis':'torso';if(/^(eyes|eyelids|mouth|nasolabial|jaw|ear_boundary|hairline)$/.test(regionName)||point[1]>0.64)return'head';if(/palm|finger|wrist/.test(regionName)||Math.abs(point[0])>0.44&&point[1]>-0.02)return'hand';if(/clavicle|shoulder|deltoid|axilla|scapular|upper_arm|elbow|forearm/.test(regionName)||Math.abs(point[0])>0.245&&point[1]>0.08)return'arm';if(/heel|arch|forefoot|toe|ankle/.test(regionName)||point[1]<-0.67)return'foot';if(/hip|thigh|knee|patella|popliteal|calf/.test(regionName)||point[1]<0.03)return'leg';if(/pelvis|gluteal|groin/.test(regionName)||point[1]<0.16)return'pelvis';return'torso';}
function nearestBoneIds(point,ids,boneById,children,limit){return ids.map((id)=>[id,boneDistance(point,boneById.get(id),children,boneById)]).filter(([,distance])=>Number.isFinite(distance)).sort((a,b)=>a[1]-b[1]||a[0].localeCompare(b[0])).slice(0,limit).map(([id])=>id);}
function boneDistance(point,bone,children,boneById){if(!bone)return Infinity;const childIds=children.get(bone.id)||[];const child=childIds.length?boneById.get(childIds[0]):null;return child?pointSegmentDistance(point,bone.bindWorldPosition,child.bindWorldPosition).distance:distance3(point,bone.bindWorldPosition);}
function seedWeights(point,candidates,boneById,children,zone){const scale={hand:0.035,arm:0.055,foot:0.045,leg:0.065,pelvis:0.09,head:0.095,torso:0.11}[zone]??0.08;const raw=candidates.map((id)=>{const distance=boneDistance(point,boneById.get(id),children,boneById);return[id,Math.exp(-Math.pow(distance/scale,2))+1e-12];});return normalizeMap(new Map(raw));}
function diffuse(fields,candidateIds,adjacency,alpha){return fields.map((field,vertex)=>{const candidates=candidateIds[vertex];const neighbors=adjacency[vertex];const output=new Map();for(const id of candidates){let sum=0;for(const neighbor of neighbors)sum+=fields[neighbor].get(id)||0;const average=neighbors.length?sum/neighbors.length:field.get(id)||0;output.set(id,(field.get(id)||0)*(1-alpha)+average*alpha);}return normalizeMap(output);});}
function enforceNoOrphans(fields,candidateIds,positions,performanceRig,vertexSide){
  const use=new Map(performanceRig.bonePaletteOrder.map((id)=>[id,0]));
  fields.forEach((field)=>field.forEach((weight,id)=>use.set(id,(use.get(id)||0)+weight)));
  const reserved=new Set();
  for(const [boneId,total]of use){
    if(total>1e-12)continue;const bone=performanceRig.joints[performanceRig.paletteIndex[boneId]];let best=-1;let bestDistance=Infinity;
    for(let vertex=0;vertex<fields.length;vertex+=1){if(reserved.has(vertex))continue;if(boneId.startsWith('left')&&vertexSide[vertex]!==1)continue;if(boneId.startsWith('right')&&vertexSide[vertex]!==2)continue;if(!boneId.startsWith('left')&&!boneId.startsWith('right')&&vertexSide[vertex]!==0)continue;const distance=distance3(pointAt(positions,vertex),bone.bindWorldPosition);if(distance<bestDistance){bestDistance=distance;best=vertex;}}
    if(best>=0){reserved.add(best);candidateIds[best]=[...new Set([...candidateIds[best],boneId])].slice(-8);fields[best].set(boneId,0.02);fields[best]=normalizeMap(fields[best]);}
  }
}
function enforceBilateral(fields,vertexSide,symmetryPartner,paletteIndex){for(let vertex=0;vertex<fields.length;vertex+=1){if(vertexSide[vertex]!==1)continue;const partner=symmetryPartner[vertex];const mirrored=new Map();for(const[id,weight]of fields[vertex]){const mirror=id.startsWith('left')?`right${id.slice(4)}`:id.startsWith('right')?`left${id.slice(5)}`:id;mirrored.set(paletteIndex[mirror]==null?id:mirror,weight);}fields[partner]=mirrored;}for(let vertex=0;vertex<fields.length;vertex+=1)if(vertexSide[vertex]===0)fields[vertex]=new Map([...fields[vertex]].filter(([id])=>!id.startsWith('left')&&!id.startsWith('right')));}
function repairQuantizedOrphans({joints0,weights0,joints1,weights1,influenceCounts,positions,vertexSide,symmetryPartner,performanceRig}){
  const use=()=>{const counts=new Uint32Array(performanceRig.bonePaletteOrder.length);for(let offset=0;offset<weights0.length;offset+=1){if(weights0[offset]>0)counts[joints0[offset]]+=1;if(weights1[offset]>0)counts[joints1[offset]]+=1;}return counts;};
  const inject=(vertex,boneIndex)=>{const entries=[];for(let slot=0;slot<8;slot+=1){const joints=slot<4?joints0:joints1;const weights=slot<4?weights0:weights1;const offset=vertex*4+(slot%4);entries.push({slot,bone:joints[offset],weight:weights[offset]});}if(entries.some((entry)=>entry.bone===boneIndex&&entry.weight>0))return;let target=entries.find((entry)=>entry.weight===0);const largest=entries.reduce((a,b)=>a.weight>=b.weight?a:b);if(target){const amount=Math.min(1/65536,largest.weight/2);target.weight=amount;target.bone=boneIndex;largest.weight-=amount;}else{target=entries.reduce((a,b)=>a.weight<=b.weight?a:b);target.bone=boneIndex;}for(const entry of entries){const joints=entry.slot<4?joints0:joints1;const weights=entry.slot<4?weights0:weights1;const offset=vertex*4+(entry.slot%4);joints[offset]=entry.bone;weights[offset]=entry.weight;}influenceCounts[vertex]=entries.filter((entry)=>entry.weight>0).length;};
  const mirror=(leftVertex)=>{const rightVertex=symmetryPartner[leftVertex];for(let slot=0;slot<8;slot+=1){const sourceJoints=slot<4?joints0:joints1;const sourceWeights=slot<4?weights0:weights1;const sourceOffset=leftVertex*4+(slot%4);const targetOffset=rightVertex*4+(slot%4);const id=performanceRig.bonePaletteOrder[sourceJoints[sourceOffset]];const mirrored=id.startsWith('left')?`right${id.slice(4)}`:id.startsWith('right')?`left${id.slice(5)}`:id;sourceJoints[targetOffset]=performanceRig.paletteIndex[mirrored]??sourceJoints[sourceOffset];sourceWeights[targetOffset]=sourceWeights[sourceOffset];}influenceCounts[rightVertex]=influenceCounts[leftVertex];};
  const reserved=new Set();
  for(let pass=0;pass<3;pass+=1){const counts=use();const orphanIds=performanceRig.bonePaletteOrder.filter((id,index)=>counts[index]===0&&!id.startsWith('right'));if(!orphanIds.length)break;for(const id of orphanIds){const bone=performanceRig.joints[performanceRig.paletteIndex[id]];let best=-1;let bestDistance=Infinity;for(let vertex=0;vertex<vertexSide.length;vertex+=1){if(reserved.has(vertex))continue;if(id.startsWith('left')&&vertexSide[vertex]!==1)continue;if(!id.startsWith('left')&&vertexSide[vertex]!==0)continue;const distance=distance3(pointAt(positions,vertex),bone.bindWorldPosition);if(distance<bestDistance){best=vertex;bestDistance=distance;}}if(best>=0){reserved.add(best);reserved.add(symmetryPartner[best]);inject(best,performanceRig.paletteIndex[id]);if(id.startsWith('left'))mirror(best);}}}
}
function quantizeWeights(entries){if(!entries.length)return[];const normalized=normalizeMap(new Map(entries));const scaled=[...normalized].map(([id,weight])=>({id,base:Math.floor(weight*QUANTIZATION),fraction:weight*QUANTIZATION-Math.floor(weight*QUANTIZATION)}));let remaining=QUANTIZATION-scaled.reduce((sum,item)=>sum+item.base,0);scaled.sort((a,b)=>b.fraction-a.fraction||a.id.localeCompare(b.id));for(let index=0;index<remaining;index+=1)scaled[index%scaled.length].base+=1;return scaled.filter((item)=>item.base>0).map((item)=>[item.id,item.base/QUANTIZATION]).sort((a,b)=>b[1]-a[1]);}
function normalizeMap(map){const sum=[...map.values()].reduce((value,weight)=>value+Math.max(0,weight),0);if(sum<=1e-20){const first=map.keys().next().value;return new Map([[first,1]]);}return new Map([...map].map(([id,weight])=>[id,Math.max(0,weight)/sum]));}
function hybridBlendFor(point,regionName,boneIds){if(/finger|palm|toe/.test(regionName)||boneIds.some((id)=>/Thumb|Index|Middle|Ring|Little|Toe$/.test(id)))return 0.2;if(/shoulder|axilla|elbow|wrist|hip|groin|knee/.test(regionName))return 0.35;if(/twist|forearm|calf|thigh|upper_arm/.test(regionName)||boneIds.some((id)=>/Twist/.test(id)))return 0.9;if(point[1]>0.62)return 0.25;return 0.48;}
function childrenByParent(joints){const map=new Map();for(const joint of joints){if(!joint.parentId)continue;if(!map.has(joint.parentId))map.set(joint.parentId,[]);map.get(joint.parentId).push(joint.id);}return map;}
function buildAdjacency(indices,vertexCount){const sets=Array.from({length:vertexCount},()=>new Set());for(let offset=0;offset<indices.length;offset+=3){const a=indices[offset],b=indices[offset+1],c=indices[offset+2];sets[a].add(b).add(c);sets[b].add(a).add(c);sets[c].add(a).add(b);}return sets.map((set)=>[...set]);}
function pointAt(positions,vertex){const offset=vertex*3;return[positions[offset],positions[offset+1],positions[offset+2]];}
function align(value,alignment){return Math.ceil(value/alignment)*alignment;}
