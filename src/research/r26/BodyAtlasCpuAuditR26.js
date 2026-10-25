/* Exact geometry with original unchanged interpolated normal/material inputs.
 * Shared-boundary ties are retained; lowest source function ID selects attributes
 * deterministically. Native raster boundary ownership remains a separate audit. */
(()=>{'use strict';
function createTracer(atlas){
 const p=atlas.exactDomain;if(!p||p.profile!==atlas.id||p.functionAxes?.length*12!==atlas.functionCoefficients.length)throw Error('Exact source-domain inputs missing');
 const tracer=BodyFilteredDomainR25.createTracer(p),axes=Uint8Array.from(p.functionAxes),fields=atlas.functionCoefficients,c=atlas.sourceSkinCoefficients,palms=atlas.sourcePalmCoefficients;
 function ray(ox,oy,oz,dx,dy,dz,detailed=true){const h=tracer.ray([ox,oy,oz],[dx,dy,dz],detailed);if(!h)return null;const field=h.fields[0],axis=axes[field],u=(axis+1)%3,v=(axis+2)%3,O=[ox,oy,oz],R=[dx,dy,dz],U=O[u]+h.t*R[u],V=O[v]+h.t*R[v],j=field*12,k=field*3;
  const n=[3,6,9].map(i=>fields[j+i]*U+fields[j+i+1]*V+fields[j+i+2]),length=Math.hypot(...n)||1,rest=[0,3,6].map(i=>c[j+i]*U+c[j+i+1]*V+c[j+i+2]);
  return{t:h.t,field,axis,rest,dry:Math.max(0,Math.min(1,c[j+9]*U+c[j+10]*V+c[j+11])),nx:n[0]/length,ny:n[1]/length,nz:n[2]/length,palm:Math.max(0,Math.min(1,palms[k]*U+palms[k+1]*V+palms[k+2])),exactParameter:h.exactParameter,firstHitTies:h.fields};
 }
 return{ray,report:tracer.report};
}
globalThis.BodyAtlasCpuR25={createTracer};globalThis.BodyAtlasCpuR21=globalThis.BodyAtlasCpuR25;
})();
