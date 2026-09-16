import {generateCompactHuman,generateCompactHair} from './assembly.mjs';
import {buildCompactBinding,bindCompactArrays} from './binding.mjs';
import {resolveCompactShape,attachHairStature,applyCompactStature} from './stature-transform.mjs';
import {sameCharacterShape} from './shape-contract.mjs';
self.onmessage=async({data})=>{
  try{
    const started=performance.now(),shape=resolveCompactShape(data.shape===undefined?data.rig?.shape:data.shape);let downloadedBytes=0;
    const progress=value=>self.postMessage({type:'progress',progress:{...value,elapsedMs:performance.now()-started}});
    const load=async file=>{progress({group:'parameters',file,domain:0,total:1});const url=new URL(file,import.meta.url);url.searchParams.set('v',data.revision||'1');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
        try{const response=await fetch(url,{cache:'force-cache',signal:controller.signal});if(!response.ok)throw Error('参数读取失败：'+file);const bytes=await response.arrayBuffer();downloadedBytes+=bytes.byteLength;progress({group:'parameters',file,domain:1,total:1,downloadedBytes});return bytes;}
        catch(error){throw Error((controller.signal.aborted?'参数读取超过 15 秒：':'参数读取失败：')+file+'；'+error.message);}finally{clearTimeout(timer);}};
    if(data.job==='hair'){
      const hair=attachHairStature(await generateCompactHair({load,progress,hairProfile:data.hairProfile}),shape);
      const hairTransfers=[hair.segments.buffer];if(hair.coverage)hairTransfers.push(hair.coverage.positions.buffer,hair.coverage.regionData.buffer,hair.coverage.indices.buffer);if(hair.coverage?.styleNormals)hairTransfers.push(hair.coverage.styleNormals.buffer);
      self.postMessage({type:'complete',shape,hair,report:{shape,workerMilliseconds:performance.now()-started,parameterBytes:downloadedBytes}},hairTransfers);return;
    }
    if(!(data.rig?.frames instanceof Map)||!Array.isArray(data.rig.jointNames))throw Error('缺少同源绑定骨架');
    if(data.rig.coordinateSpace!=='canonical-r2-reference-metres'||!sameCharacterShape(data.rig.shape,shape))throw Error('体型与参考绑定空间不匹配');
    const result=await generateCompactHuman({quality:data.quality||'preview',includeHair:data.includeHair===true,load,progress,hairProfile:data.hairProfile});
    const bindingStarted=performance.now(),field=buildCompactBinding(result,data.rig,progress);
    for(let i=0;i<result.meshes.length;i++){const mesh=result.meshes[i];mesh.binding=bindCompactArrays(mesh,data.rig,field);progress({group:'binding',phase:'chunks',domain:i+1,total:result.meshes.length});}
    result.bindingJointNames=data.rig.jointNames;result.report.binding=field.report;result.report.bindingMilliseconds=performance.now()-bindingStarted;
    applyCompactStature(result,shape,data.rig,progress);
    result.report.workerMilliseconds=performance.now()-started;result.report.parameterBytes=downloadedBytes;
    const transfers=result.meshes.flatMap(m=>[m.positions.buffer,m.canonicalPositions.buffer,m.normals.buffer,m.indices.buffer,m.regionMasks.buffer,m.vertexIds.buffer,m.binding.ids.buffer,m.binding.weights.buffer,m.binding.colors.buffer]);
    for(const mesh of result.meshes)if(mesh.axillaDelta)transfers.push(mesh.axillaDelta.buffer,mesh.axillaNormals.buffer);
    transfers.push(result.bindingRoots.buffer);
    if(result.hair){transfers.push(result.hair.segments.buffer);if(result.hair.coverage)transfers.push(result.hair.coverage.positions.buffer,result.hair.coverage.regionData.buffer,result.hair.coverage.indices.buffer);if(result.hair.coverage?.styleNormals)transfers.push(result.hair.coverage.styleNormals.buffer);}
    self.postMessage({type:'complete',...result},[...new Set(transfers)]);
  }catch(error){self.postMessage({type:'error',message:error.stack||error.message});}
};
