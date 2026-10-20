/* Called by the evidence runner in the unchanged original R10 page.
 * No audit()/render()/getError()/physics stepping or state setters in this reader.
 * Result is a bounded observation, not a live session shared with the portal. */
(function captureGarmentRelations(native, grain, context) {
 'use strict';
 const clone=x=>x==null?null:JSON.parse(JSON.stringify(x));
 const own=(o,k)=>Object.getOwnPropertyDescriptor(o||{},k)?.value??null;
 const freeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(freeze);}return x;};
 function hash(a){const b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);let h=2166136261;for(const v of b){h^=v;h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
 function guard(){return JSON.stringify({rows:native.items.map(i=>({binding:i.packet.binding,materialID:i.materialID,info:i.info,uv:hash(i.mesh.geometry.attributes.uv.array),position:hash(i.mesh.geometry.attributes.position.array),index:hash(i.mesh.geometry.index.array)})),body:hash(native.model.positions),physicsGeneration:native.physics.generation,frame:native.physics.stats.frames,bodyRevision:native.physics.stats.bodyRevision,actorRevision:native.physics.actor.sourceRevision});}
 if(!native?.physics?.frame||native.items.length!==2||!native.viewer?.platformRuntime?.identity)throw Error('NATIVE_GARMENT_NOT_READY');
 const started=performance.now(),before=guard(),target=native.viewer.platformRuntime.identity;
 const pieces=native.items.map(it=>{
  const packet=it.packet,uv=it.mesh.geometry.attributes.uv.array;let offset=0;
  const panels=packet.spec.panels.map(p=>{
   const axes=grain.grainAxes(p.id);let error=0;
   for(let i=0;i<p.uvMm.length;i++){const expected=grain.mapPanelUV(p.id,...p.uvMm[i]);error=Math.max(error,Math.abs(expected[0]-uv[(offset+i)*2]),Math.abs(expected[1]-uv[(offset+i)*2+1]));}
   const edges=new Map();for(const t of p.triangles)for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);edges.set(key,(edges.get(key)||0)+1);}
   const boundary=[];for(const [edge,n]of edges)if(n===1){const [a,b]=edge.split(':').map(Number);boundary.push([p.uvMm[a],p.uvMm[b]]);}
   const result={id:p.id,vertexCount:p.uvMm.length,triangleCount:p.triangles.length,appearanceAxes:axes,appearanceUnit:'m',paperUnit:'mm',maxUVErrorM:error,boundaryMm:boundary,physicsGrain:own(p,'grain')??own(p,'grainDirection'),manufacturingGrain:null};offset+=p.uvMm.length;return result;
  });
  if(offset*2!==uv.length)throw Error('PANEL_VERTEX_ORDER_MISMATCH');
  return {role:it.mesh.userData.role,presetId:packet.binding.presetId,binding:clone(packet.binding),sourceTemplateBinding:clone(packet.sourceTemplate?.binding),materialID:it.materialID,material:clone(it.info),panels,mesh:{vertices:it.mesh.geometry.attributes.position.count,triangles:it.mesh.geometry.index.count/3,uvCount:it.mesh.geometry.attributes.uv.count},acceptance:{sourceStaticPassed:!!packet.sourceTemplate?.staticGate?.passed,targetStaticPassed:!!packet.record.staticGate?.passed,targetStaticReason:packet.record.staticGate?.reason||null},explicitProportionRevision:own(packet.binding,'proportion_revision')??own(packet.binding,'proportionRevision'),materialMeshHashPayload:{panels:packet.spec.panels.map(p=>({id:p.id,uvMm:p.uvMm,triangles:p.triangles})),seams:packet.spec.seams.map(s=>({id:s.id,a:s.a,b:s.b,stitchVertexPairs:s.stitchVertexPairs}))}};
 });
 const after=guard();if(before!==after)throw Error('READ_PRESERVATION_FAILED');
 return freeze({schema:'kaopu/garment-relations-observation@1',version:'RF01-S3.3',source:clone(context.source),capture:{capturedAt:new Date().toISOString(),elapsedMS:performance.now()-started,mode:'native_runtime_capture',lookId:native.physics.look,physicsGeneration:native.physics.generation,frame:native.physics.stats.frames,bodyRevision:native.physics.stats.bodyRevision,running:native.physics.running},person:{identity:clone(target),actorTargetIdentity:clone(native.physics.actor.targetIdentity),sourceRevision:native.physics.actor.sourceRevision,explicitProportionRevision:own(native.model.state,'proportion_revision')??own(native.model.state,'proportionRevision'),proportionFieldScope:'only explicit proportion_revision/proportionRevision in loaded model.state and packet.binding; no guessed alias'},pieces,preservation:{passed:true,before,after,scope:'synchronous read of material and binding records, complete garment UV/position/index arrays, native body position array and controller generations; not all GPU driver state'},authority:{sourceWriteAPI:false,repairAuthorized:false,productionInstalled:false,physicalCertification:false,manufacturingCertification:false,fitCertified:false}});
})
