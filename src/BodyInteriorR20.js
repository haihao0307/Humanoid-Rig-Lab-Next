/* Conservative closed interior support for limb reconstruction under contact.
 * These are inscribed animation-support volumes, not measured internal bones.
 * They fill incorrectly positive interior pockets; exterior detail remains
 * governed by the calibrated surface functions. No polygon construction. */
(()=>{'use strict';const M=BodyMathR01;
const unit=M.unit,sub=M.sub,dot=M.dot,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),render=p=>[p[0],p[2],-p[1]];
function create(program,result){const f=result.calibration.anatomy.frame,w=program.annyWeights,names=program.anny.boneLabels,isA=result.owners.rig==='anny',out=[];
 for(const segment of f.segments){const suffix=segment.side===1?'L':'R',prefix=segment.side===1?'l':'r',labels={upperarm:['upperarm01','lowerarm01','uparm','lowarm'],forearm:['lowerarm01','wrist','lowarm','wrist'],thigh:['upperleg01','lowerleg01','upleg','lowleg'],calf:['lowerleg01','foot','lowleg','foot']}[segment.kind],pattern={upperarm:/^upperarm/,forearm:/^lowerarm/,thigh:/^upperleg/,calf:/^lowerleg/}[segment.kind],radii=[],length2=segment.length*segment.length;
  for(let i=0;i<program.bodyCount;i++){let total=0;for(let k=w.ptr[i];k<w.ptr[i+1];k++){const n=names[w.joints[k]];if(n.endsWith('.'+suffix)&&pattern.test(n))total+=w.values[k];}if(total<.45)continue;const p=[result.sharedRestVertices[i*3],result.sharedRestVertices[i*3+1],result.sharedRestVertices[i*3+2]],q=sub(p,segment.a),t=dot(q,segment.axis)/segment.length;if(t<.15||t>.85)continue;radii.push(M.norm(sub(q,M.scale(segment.axis,t*segment.length))));}
  radii.sort((a,b)=>a-b);const reference=radii[Math.floor(radii.length*.15)]||segment.length*.09,radius=clamp(reference*.72,segment.length*.027,segment.length*.14),aName=isA?labels[0]+'.'+suffix:prefix+'_'+labels[2],bName=isA?labels[1]+'.'+suffix:prefix+'_'+labels[3],a=render(M.position(result.rig.posedMatrices[result.rig.names.indexOf(aName)])),b=render(M.position(result.rig.posedMatrices[result.rig.names.indexOf(bName)])),v=sub(b,a),posedLength=M.norm(v),r=radius*posedLength/segment.length;
  out.push({a,b,v,length2:dot(v,v),radius:r,bounds:[0,1,2].map(k=>[Math.min(a[k],b[k])-r,Math.max(a[k],b[k])+r]),kind:segment.kind,side:suffix});
 }
 return out;
}
function valueXYZ(x,y,z,volumes){let distance=Infinity;for(const s of volumes){if(x<s.bounds[0][0]||x>s.bounds[0][1]||y<s.bounds[1][0]||y>s.bounds[1][1]||z<s.bounds[2][0]||z>s.bounds[2][1])continue;const dx=x-s.a[0],dy=y-s.a[1],dz=z-s.a[2],t=clamp((dx*s.v[0]+dy*s.v[1]+dz*s.v[2])/s.length2,0,1),d=Math.hypot(dx-t*s.v[0],dy-t*s.v[1],dz-t*s.v[2])-s.radius;distance=Math.min(distance,d);}return distance;}
function apply(region,volumes){const g=region.dimensions,b=region.bounds,f=region.field;let repaired=0;for(let z=0;z<g[2];z++){const pz=b[2][0]+(z+.5)*(b[2][1]-b[2][0])/g[2];for(let y=0;y<g[1];y++){const py=b[1][0]+(y+.5)*(b[1][1]-b[1][0])/g[1];for(let x=0;x<g[0];x++){const at=(x+g[0]*(y+g[1]*z))*4;if(f[at]<-.004)continue;const px=b[0][0]+(x+.5)*(b[0][1]-b[0][0])/g[0],d=valueXYZ(px,py,pz,volumes);if(d<0&&d<f[at]){if(f[at]>=0)repaired++;f[at]=d;}}}}region.interiorSupport={volumes:volumes.length,repairedPositiveVoxels:repaired,method:'union with conservative inscribed posed limb volumes',independentAnatomicalObservation:false};return region;}
globalThis.BodyInteriorR20={create,valueXYZ,apply};
})();
