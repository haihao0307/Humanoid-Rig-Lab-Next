/* Read-only observer of the original R10's prepared garment inputs.
 * Executed at one additive diagnostic hook before the unchanged physics init.
 * It neither advances physics nor claims a completed displayed garment. */
(function captureGarmentRelations(native, grain, context) {
 'use strict';
 const clone=x=>x==null?null:JSON.parse(JSON.stringify(x));
 const own=(o,k)=>Object.getOwnPropertyDescriptor(o||{},k)?.value??null;
 const freeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(freeze);}return x;};
 function hash(a){const b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);let h=2166136261;for(const v of b){h^=v;h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
 function guard(){return JSON.stringify({rows:native.items.map(i=>({binding:i.packet.binding,materialID:i.materialID,info:i.info,uv:hash(i.mesh.geometry.attributes.uv.array),position:hash(i.mesh.geometry.attributes.position.array),index:hash(i.mesh.geometry.index.array),sourceFrozen:{point:Object.isFrozen(i.packet.spec.panels[0].uvMm[0]),triangles:Object.isFrozen(i.packet.spec.panels[0].triangles),binding:Object.isFrozen(i.packet.binding)}})),body:hash(native.model.positions),request:native.request,actorRevision:native.actor.sourceRevision});}
 if(native.items.length!==2||!native.viewer?.platformRuntime?.identity||!native.actor)throw Error('PREPARED_BINDING_NOT_READY');
 const started=performance.now(),before=guard(),target=native.viewer.platformRuntime.identity;
 const pieces=native.items.map(it=>{
  const packet=it.packet,uv=it.mesh.geometry.attributes.uv.array;let offset=0;
  const panels=packet.spec.panels.map(p=>{
   const axes=grain.grainAxes(p.id);let error=0;
   for(let i=0;i<p.uvMm.length;i++){const expected=grain.mapPanelUV(p.id,...p.uvMm[i]);error=Math.max(error,Math.abs(expected[0]-uv[(offset+i)*2]),Math.abs(expected[1]-uv[(offset+i)*2+1]));}
   const edges=new Map();for(const t of p.triangles)for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);edges.set(key,(edges.get(key)||0)+1);}
   const boundary=[];for(const [edge,n]of edges)if(n===1){const [a,b]=edge.split(':').map(Number);boundary.push([Array.from(p.uvMm[a]),Array.from(p.uvMm[b])]);}
   const result={id:p.id,vertexCount:p.uvMm.length,triangleCount:p.triangles.length,appearanceAxes:axes,appearanceUnit:'m',paperUnit:'mm',maxUVErrorM:error,boundaryMm:boundary,physicsGrain:clone(own(p,'grain')??own(p,'grainDirection')),manufacturingGrain:null};offset+=p.uvMm.length;return result;
  });
  if(offset*2!==uv.length)throw Error('PANEL_VERTEX_ORDER_MISMATCH');
  return {role:it.mesh.userData.role,presetId:packet.binding.presetId,binding:clone(packet.binding),sourceTemplateBinding:clone(packet.sourceTemplate?.binding),materialID:it.materialID,material:clone(it.info),panels,mesh:{vertices:it.mesh.geometry.attributes.position.count,triangles:it.mesh.geometry.index.count/3,uvCount:it.mesh.geometry.attributes.uv.count},acceptance:{sourceStaticPassed:!!packet.sourceTemplate?.staticGate?.passed,targetStaticPassed:!!packet.record.staticGate?.passed,targetStaticReason:packet.record.staticGate?.reason||null},explicitProportionRevision:own(packet.binding,'proportion_revision')??own(packet.binding,'proportionRevision'),materialMeshHashPayload:clone({panels:packet.spec.panels.map(p=>({id:p.id,uvMm:p.uvMm,triangles:p.triangles})),seams:packet.spec.seams.map(s=>({id:s.id,a:s.a,b:s.b,stitchVertexPairs:s.stitchVertexPairs}))})};
 });
 const result={schema:'kaopu/garment-relations-observation@1',version:'RF01-S3.3',source:clone(context.source),capture:{capturedAt:new Date().toISOString(),elapsedMS:performance.now()-started,mode:'native_prephysics_binding_capture',lookId:native.look,requestGeneration:native.request,frame:null,physicsStartedByReader:false},person:{identity:clone(target),actorTargetIdentity:clone(native.actor.targetIdentity),sourceRevision:native.actor.sourceRevision,explicitProportionRevision:own(native.model.state,'proportion_revision')??own(native.model.state,'proportionRevision'),proportionFieldScope:'only explicit proportion_revision/proportionRevision in loaded model.state and packet.binding; no guessed alias'},pieces,preservation:{passed:false,before,after:null,scope:'synchronous prepared-binding read; complete garment UV/position/index and body arrays, source freeze flags; not a running-physics or complete-driver proof'},authority:{sourceWriteAPI:false,repairAuthorized:false,productionInstalled:false,physicalCertification:false,manufacturingCertification:false,fitCertified:false}};
 // Deep-freeze only copied output. Freeze source-alias regressions are included in the guard.
 freeze(result.pieces);freeze(result.person);const after=guard();if(before!==after)throw Error('READ_PRESERVATION_FAILED');result.preservation.after=after;result.preservation.passed=true;
 return freeze(result);
})
