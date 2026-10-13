/* Deferred coupling boundary. This file validates identity and data readiness;
 * it does not simulate hair, compress a scalp mesh, or invent material constants. */
export const HAIR_CONTRACT='kaopu.hat-hair-contact/1';
const hashOK=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function hairContactPlan({headId,headHash,hatId,hatHash,sourceCommit,hasInnerWall,hasSweatband,construction}){
 if(!headId||!hatId||!hashOK(headHash)||!hashOK(hatHash))throw Error('接触接口必须绑定实际人物与帽体几何哈希');
 return {schema:HAIR_CONTRACT,state:'DEFERRED_NO_HAIR_SOLVER',stage:'fixed static bare-head seating candidate for tested fixtures; hair contact remains a separate stage',
  identity:{headId,headHash,hatId,hatHash,sourceCommit},units:'m',geometrySpace:'calibrated head-local; no additional scale',
  hat:{innerWall:!!hasInnerWall,sweatband:!!hasSweatband,construction},
  requiredHairInput:['scalp triangle ids and root barycentric coordinates','guide strand rest positions and segment lengths','strand radii, mass and measured bend/twist response','strand density/clump association and collision envelope','hair asset revision and same head hash'],
  requiredHatInput:['actual inner collision faces and normal orientation','sweatband contact region','fixed material thickness distinct from geometric gap','calibrated fabric response for flexible hats','time-resolved donning trajectory'],
  proposedSolveOrder:['validate head/hat/hair revisions','pin roots to unchanged scalp','advance hat trajectory with collision-safe substeps','solve strand bending/twist and segment-length constraints','resolve hair-hair, hair-hat and hair-scalp contact with friction','couple flexible hat response only where a calibrated material model exists','check penetration and strain, then detach and test recovery'],
  prohibitedShortcuts:['uniform scalp inflation relabeled physical hair compression','shortening guide lengths to fake flattened hair','deleting or hiding trapped hair as a successful solve','using final seated geometry as proof of a collision-free donning path'],
  readiness:{scalpIdentityKnown:true,hatInteriorRepresented:!!(hasInnerWall||hasSweatband),hairDataProvided:false,materialCalibrated:false,solverImplemented:false,physicalDonningVerified:false},
  nextMilestone:'short-hair guide bundle and one rigid hat; no long-hair style implementation is claimed'};
}
export function validateHairPacket(packet,plan){
 if(!packet||packet.schema!=='kaopu.hair-guides/1')throw Error('缺少版本化发束输入');
 if(packet.headHash!==plan.identity.headHash)throw Error('发根引用的不是当前人物，拒绝错头复用');
 if(packet.units!=='m'||packet.geometrySpace!=='calibrated-head-local')throw Error('发束单位或坐标系不匹配');
 if(!Array.isArray(packet.guides)||!packet.guides.length)throw Error('没有实际发束，不能启动压缩');
 for(const g of packet.guides){if(!Array.isArray(g.restPositions)||g.restPositions.length<6||g.restPositions.length%3||!g.restPositions.every(Number.isFinite)||!(g.radiusM>0)||!Number.isFinite(g.radiusM))throw Error('发束位置或物理半径无效');if(!Number.isInteger(g.rootTriangle)||g.rootTriangle<0||!Array.isArray(g.rootBarycentric)||g.rootBarycentric.length!==3||g.rootBarycentric.some(x=>!Number.isFinite(x)||x<0)||Math.abs(g.rootBarycentric.reduce((a,b)=>a+b,0)-1)>1e-6)throw Error('发根尚未有效绑定头皮');}
 return {inputStructureValid:true,state:'SOLVER_NOT_IMPLEMENTED',note:'Input validation is not a hair compression result. Root triangle range and geometric attachment still require the actual scalp mesh.'};
}
