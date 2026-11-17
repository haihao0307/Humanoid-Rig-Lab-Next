// One entry point for the isolated skeleton + control experiment. It outputs
// original-space controls only; facial stages and display are not included.
import {createGrayActionSkeleton} from './gray-action-skeleton.mjs';
import {createGrayCpuControls} from './gray-cpu-controls.mjs';
const bytes=x=>x instanceof ArrayBuffer?x.slice(0):ArrayBuffer.isView(x)?x.buffer.slice(x.byteOffset,x.byteOffset+x.byteLength):null;
const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),n=>n.toString(16).padStart(2,'0')).join('');
export async function createGrayActionControls(o){
 const raw=bytes(o?.config);if(!raw||o.configMeta?.schema!=='gray-action-controls-config-build/1'||o.configMeta.releaseReady!==false||!/^[a-f0-9]{64}$/.test(o.expectedConfigSHA256||'')||o.configMeta.payloadSHA256!==o.expectedConfigSHA256||await digest(raw)!==o.expectedConfigSHA256)throw Error('人物动作配置版本不匹配');const c=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));if(c.schema!=='gray-action-controls-config-research/1'||c.sourceDerived!==true||c.releaseReady!==false||c.refinedSurfaceBound!==false||c.originalHeadControlsMigrated!==false||!Number.isFinite(c.headScale)||c.headScale<=0||c.referenceStateSHA256!==o.configMeta.referenceStateSHA256||c.sourceReferenceSHA256!==o.configMeta.sourceReferenceSHA256||c.rigPayloadSHA256!==o.rigExpected?.payloadSHA256||c.bodyPayloadSHA256!==o.bodyExpected?.rawSHA256||c.headPayloadSHA256!==o.headExpected?.payloadSHA256||c.neckOperatorSHA256!==o.operatorMeta?.rawSHA256||c.neckReferenceSHA256!==o.operatorMeta?.referenceSHA256)throw Error('人物动作依赖不一致');
 const rig=await createGrayActionSkeleton(o.rigPacket,o.rigMeta,o.rigExpected,o.state),controls=await createGrayCpuControls({...o,expectedOperatorReferenceSHA256:c.neckReferenceSHA256});return Object.freeze({schema:'gray-action-controls-research/1',originalHeadControlsMigrated:false,refinedSurfaceBound:false,visualAccepted:false,releaseReady:false,compute(pose){const motion=rig.compute(pose);return controls.update(motion.bodyMatrices,motion.neckMatrix,motion.headMatrix,c.headScale);}});
}

