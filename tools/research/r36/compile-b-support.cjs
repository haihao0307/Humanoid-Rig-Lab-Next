'use strict';
// Compile B-rig scalar influences and corrective response functions for the
// retained surface domains. No source point table or connectivity is emitted.
const fs=require('fs'),codec=require('../../body-packet-codec-r27.cjs');
const source=require('../../program-r17.cjs')(),m=source.mhr,d=m.engine.d;
const mapping=JSON.parse(fs.readFileSync('qa/p1-torso/offline/body-expanded-source-map-p1.json'));
const base=JSON.parse(fs.readFileSync('data/body-torso-continuous-p1.json'));
const pose=JSON.parse(fs.readFileSync('data/body-pose-functions-r29.json'));
const b=pose.profiles?.find?.(v=>Array.isArray(v.headBoundaryFunctions?.allowedPoseIndices));
const allowed=b?.headBoundaryFunctions?.allowedPoseIndices;
if(!Array.isArray(allowed))throw Error('Missing B body pose range');
const offsets=[0],joints=[],weights=[],bary=[],influenceOffsets=[0],influenceJoints=[],influenceWeights=[],functions=[],rows=new Map();
for(const domain of mapping){
 if(domain.bodyIndices.length!==3)throw Error('Invalid body function domain');
 for(const body of domain.bodyIndices){
  for(let k=m.weights.ptr[body];k<m.weights.ptr[body+1];k++){joints.push(m.weights.joints[k]);weights.push(m.weights.values[k]);}
  offsets.push(joints.length);
  for(let sample=0;sample<3;sample++){
   const ix=body*3+sample,native=m.mapIndices[ix];bary.push(m.mapBary[ix]/m.mapWeightSums[body]);
   for(let axis=0;axis<3;axis++){const key=native*3+axis;if(!rows.has(key))rows.set(key,rows.size);functions.push(rows.get(key));}
   for(const [joint,weight] of m.sourceInfluences[native]){influenceJoints.push(joint);influenceWeights.push(weight);}
   influenceOffsets.push(influenceJoints.length);
  }
 }
}
const responseOffsets=[0],responseIndices=[],responseValues=[];
for(const row of rows.keys()){for(let k=d.mlp2_ptr[row];k<d.mlp2_ptr[row+1];k++){responseIndices.push(d.mlp2_idx[k]);responseValues.push(d.mlp2_val[k]);}responseOffsets.push(responseIndices.length);}
const packet={schema:'body-b-domain-support-r36/1',sourceDerived:true,sourceBodyProgramSHA256:base.surface.compressedSHA256,domainCount:mapping.length,characterVertexArrays:false,characterFaces:false,originalConnectivityEmitted:false,
 names:m.names,parents:m.parents,sourceBind:m.sourceBind.map(x=>Array.from(x)),poseLimits:m.engine.meta.pose_limits,allowedPoseIndices:allowed,
 transform_ptr:d.transform_ptr,transform_idx:d.transform_idx,transform_val:d.transform_val,prerotation:d.prerotation,
 skinOffsets:Uint32Array.from(offsets),skinJoints:Uint16Array.from(joints),skinWeights:Float64Array.from(weights),
 mapBary:Float64Array.from(bary),mapFunctions:Uint32Array.from(functions),mapInfluenceOffsets:Uint32Array.from(influenceOffsets),mapInfluenceJoints:Uint16Array.from(influenceJoints),mapInfluenceWeights:Float64Array.from(influenceWeights),
 mlp0_ptr:d.mlp0_ptr,mlp0_idx:d.mlp0_idx,mlp0_val:d.mlp0_val,responseOffsets:Uint32Array.from(responseOffsets),responseIndices:Uint16Array.from(responseIndices),responseValues:Float32Array.from(responseValues),
 correctiveRounding:'Response values retain Float32 correction rounding; addition to unavailable source rest values is not reproduced.'};
const encoded=codec(packet);if(encoded.compressed.length>=90*1024*1024)throw Error('B support packet exceeds repository size');
const file='delivery/assets/body-dynamic-r36/'+encoded.compressedSHA256+'.gz';fs.writeFileSync(file,encoded.compressed);
const result={schema:'body-b-support-manifest-r36/1',sourceDerived:true,baseSurfaceSHA256:base.surface.compressedSHA256,domainCount:mapping.length,characterTriangleFaces:0,characterVertexArrays:false,allowedPoseIndices:allowed,file,url:'assets/body-dynamic-r36/'+encoded.compressedSHA256+'.gz',encoding:'gzip-typed-function-packet-r28',compressedBytes:encoded.compressed.length,compressedSHA256:encoded.compressedSHA256,rawBytes:encoded.raw.length,rawSHA256:encoded.rawSHA256,responseFunctions:rows.size,responseTerms:responseIndices.length};
fs.writeFileSync('data/body-b-support-r36.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
