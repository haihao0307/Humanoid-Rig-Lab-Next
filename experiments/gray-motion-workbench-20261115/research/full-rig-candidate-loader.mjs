import {metadataSHA256} from './full-rig-metadata-digest.mjs';
// Strict reader for isolated research trajectories, not an accepted character.
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
export async function openFullRigCandidate(meta,input,expected){
 if(meta?.schema!=='full-rig-motion-candidate/1'||meta.quality!=='isolated-research-only'||meta.headAndNeckSurfaceBound!==false||meta.fingerSurfaceBound!==false||meta.visualAccepted!==false||!Number.isSafeInteger(meta.frames)||meta.frames<2||!Array.isArray(meta.joints)||!meta.joints.length||new Set(meta.joints).size!==meta.joints.length)throw Error('研究动作数据无效');
 if(!expected||['id','sourceSHA256','patchSHA256','targetRigSHA256','personPreviewSHA256','referenceSkeletonSHA256','scriptSHA256'].some(k=>typeof expected[k]!=='string'||expected[k]!==meta[k]))throw Error('研究动作与人物或来源版本不匹配');
 if(!/^[a-f0-9]{64}$/.test(expected.candidateMetadataSHA256||'')||await metadataSHA256(meta)!==expected.candidateMetadataSHA256)throw Error('动作元数据与可信清单不匹配');
 if(meta.encoding!=='little-endian-float64/frame/joint/xyz'||meta.units!=='Anny local-reference rotation vectors in degrees')throw Error('研究动作编码不受支持');
 if(meta.provider==='CMU'&&(meta.individualFingerTracksAvailable!==false||JSON.stringify(meta.joints)!==JSON.stringify(['neck01','neck02','head'])))throw Error('CMU 来源手指或头颈轨道声明无效');
 if(!['CMU','Mesh2Motion','Quaternius'].includes(meta.provider)||meta.provider!=='CMU'&&(meta.individualFingerTracksAvailable!==true||meta.joints.length!==32||!['head','neck02'].every(n=>meta.joints.includes(n))||meta.joints.filter(n=>/^finger[1-5]-[1-3]\.[LR]$/.test(n)).length!==30))throw Error('来源关节清单无效');
 const bytes=input instanceof ArrayBuffer?input:ArrayBuffer.isView(input)?input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength):null;if(!bytes||bytes.byteLength!==meta.frames*meta.joints.length*24||await digest(bytes)!==meta.payloadSHA256)throw Error('研究动作内容校验失败');
 const view=new DataView(bytes);
 return {metadata:structuredClone(meta),frame(index){if(!Number.isSafeInteger(index)||index<0||index>=meta.frames)throw Error('动作帧超出范围');const body={},head={};for(let j=0;j<meta.joints.length;j++){const k=(index*meta.joints.length+j)*24,rotation=[view.getFloat64(k,true),view.getFloat64(k+8,true),view.getFloat64(k+16,true)];if(rotation.some(v=>!Number.isFinite(v)))throw Error('关节旋转数据无效');(/^(head|neck)/.test(meta.joints[j])?head:body)[meta.joints[j]]=rotation;}return {body,head,individualFingerTracksAvailable:meta.individualFingerTracksAvailable,surfaceBindingComplete:false};}};
}
