/* Evaluated ONLY in the isolated, frozen original-data reference viewer.
 * These faces are offline QA evidence, never a new-runtime input. */
(()=>{
 const model=__IDENTITY_QA__.model(),viewer=__IDENTITY_QA__.viewer(),state=bodyWorkbenchR01.initialState(),driver=bodyWorkbenchR01.original();
 model.bodyDriver=driver;model.compute(structuredClone(state));viewer.update();viewer.render();
 const result=driver.evaluate(structuredClone(state)),count=model.bodyCount,faces=[];
 for(let k=0;k<model.faces.length;k+=3){const a=model.faces[k],b=model.faces[k+1],c=model.faces[k+2];if(a<count&&b<count&&c<count)faces.push(a,b,c);}
 const positions=Array.from(result.vertices),displayNormals=Array.from(viewer.geometry.attributes.normal.array.subarray(0,count*3)),displayPositions=Array.from(viewer.geometry.attributes.position.array.subarray(0,count*3));
 const weights=result.rig.weights,names=result.rig.names,regions=[];
 for(let i=0;i<count;i++){let maximum=-1,bone='';for(let k=weights.ptr[i];k<weights.ptr[i+1];k++)if(weights.values[k]>maximum){maximum=weights.values[k];bone=names[weights.joints[k]];}regions.push(bone);}
 return {schema:'body-offline-original-reference/1',referenceSHA256:'f63c538a548108f3f61657ddbec3c0c05fbb4f4456770ba7668c67b948247edd',offlineOnly:true,notRuntimeInput:true,sourceState:state,bodyCount:count,positionsZUp:positions,positionsYUp:displayPositions,normalsYUp:displayNormals,faces,dominantBones:regions,neckBoundary:Array.from(model.canonical.bodyRing),fullPersonStateRetained:true,headGeneratedByCandidate:false};
})()
