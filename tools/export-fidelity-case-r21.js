/* Offline reference evaluator. Input is a complete original person state. */
(state=>{
 const m=__IDENTITY_QA__.model(),v=__IDENTITY_QA__.viewer();m.bodyDriver=bodyWorkbenchR01.original();
 const result=m.compute(structuredClone(state));v.update();
 return{schema:'body-offline-original-reference/1',referenceSHA256:'f63c538a548108f3f61657ddbec3c0c05fbb4f4456770ba7668c67b948247edd',offlineOnly:true,notRuntimeInput:true,sourceState:structuredClone(state),bodyCount:m.bodyCount,positionsZUp:Array.from(m.lastBodyDriver.vertices),positionsYUp:Array.from(v.geometry.attributes.position.array.subarray(0,m.bodyCount*3)),normalsYUp:Array.from(v.geometry.attributes.normal.array.subarray(0,m.bodyCount*3)),gnmRootRestMatrix:Array.from(m.activeGNMRootRestMatrix||[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),neckReport:{contour:m.neckContourMaxMM,fairing:m.neckFairingMaxMM,surface:m.neckSurface.maxDisplacementMM}};
})
