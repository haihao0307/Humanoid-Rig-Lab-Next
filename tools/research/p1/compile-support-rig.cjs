'use strict';
// Joint parameters only: emit no body point coordinates, skin weights or
// face connections. This is a source-derived candidate, not a mother system.
const fs=require('fs'),crypto=require('crypto'),encode=require('../../body-packet-codec-r27.cjs');
const H=b=>crypto.createHash('sha256').update(b).digest('hex');
const full=require('../../program-r17.cjs')(),s=full.anny;
if(s.facialSupplement||s.facialActionLabels.length||s.metadata.pose_parameterization!=='local-ref')throw Error('Unexpected joint source schema');
const keys=['template_bone_heads','bone_heads_blendshapes','bone_template_orientation_matrices','bone_orientation_blendshapes','reference_bone_orientations','stacked_phenotype_blend_shapes_mask'];
const p={schema:'body-support-rig-functions-p1/1',sourceDerived:true,sourceProgramSHA256:H(fs.readFileSync('data/body-function-program-r17.json')),characterVertexArrays:false,characterFaces:false,measuredBoneLengths:false,sourceFidelityAccepted:false,completedMotherConversion:false,acceptanceTolerance:null,metadata:s.metadata,phenotypeLabels:s.phenotypeLabels,localChangeLabels:s.localChangeLabels,facialActionLabels:s.facialActionLabels,variations:s.variations,anchors:s.anchors,shapeCount:s.shapeCount,phenotypeShapeCount:s.phenotypeShapeCount,maskWidth:s.maskWidth,boneLabels:s.boneLabels,boneCount:s.boneCount,boneParents:Array.from(s.boneParents),boneOrder:Array.from(s.boneOrder),arrays:Object.fromEntries(keys.map(k=>[k,s.arrays[k]]))};
const packet=encode(p),file='data/body-support-rig-p1.gz';fs.writeFileSync(file,packet.compressed);
const manifest={schema:'body-support-rig-functions-p1/1',file,encoding:'gzip-typed-function-packet-r28',rawBytes:packet.raw.length,rawSHA256:packet.rawSHA256,compressedBytes:packet.compressed.length,compressedSHA256:packet.compressedSHA256,boneCount:p.boneCount,characterVertexArrays:false,characterFaces:false,measuredBoneLengths:false,sourceDerived:true,sourceProgramSHA256:p.sourceProgramSHA256,sourceFidelityAccepted:false,completedMotherConversion:false,acceptanceTolerance:null};
fs.writeFileSync('data/body-support-rig-p1.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({file,rawBytes:manifest.rawBytes,compressedBytes:manifest.compressedBytes,sha256:manifest.compressedSHA256,boneCount:manifest.boneCount}));
