/* Union independently fitted rest-neighbourhoods when distant body regions
 * meet in a pose. Physical proximity must not average their opposite sides
 * into a torn surface. Rest correspondence remains source-derived. */
(()=>{'use strict';
function apply(region,p){const g=region.dimensions,b=region.bounds,f=region.field,nf=region.normalField,pos=p.positions,ns=p.normals,rest=p.rest,variance=p.variance,limit2=(.08*p.bodyScale)**2;let repaired=0,maximum=0;
 function restDistance(a,b){const i=a*3,j=b*3;return(rest[i]-rest[j])**2+(rest[i+1]-rest[j+1])**2+(rest[i+2]-rest[j+2])**2;}
 function evaluate(x,y,z,ids,reference){const k=reference*3,nnx=ns[k],nny=ns[k+1],nnz=ns[k+2];let sum=0,value=0,nearest=Infinity,rx=0,ry=0,rz=0,nx=0,ny=0,nz=0;
  for(const i of ids){if(restDistance(i,reference)>limit2)continue;const j=i*3,dx=x-pos[j],dy=y-pos[j+1],dz=z-pos[j+2],d=dx*dx+dy*dy+dz*dz;if(d>variance*9)continue;if(ns[j]*nnx+ns[j+1]*nny+ns[j+2]*nnz<.35)continue;nearest=Math.min(nearest,d);const w=Math.exp(-d/variance),inverse=p.inverseSkins[i];sum+=w;value+=w*(ns[j]*dx+ns[j+1]*dy+ns[j+2]*dz+p.coefficients[i]);nx+=w*ns[j];ny+=w*ns[j+1];nz+=w*ns[j+2];rx+=w*(rest[j]+inverse[0]*dx+inverse[2]*dy-inverse[1]*dz);ry+=w*(rest[j+2]+inverse[8]*dx+inverse[10]*dy-inverse[9]*dz);rz+=w*(-rest[j+1]-inverse[4]*dx-inverse[6]*dy+inverse[5]*dz);}
  if(sum<1e-20)return null;const length=Math.hypot(nx,ny,nz)||1;return{d:Math.max(value/sum,Math.sqrt(nearest)-.035*p.bodyScale),material:[rx/sum,ry/sum,rz/sum],normal:[nx/length,ny/length,nz/length]};
 }
 for(let z=0;z<g[2];z++){const pz=b[2][0]+(z+.5)*(b[2][1]-b[2][0])/g[2];for(let y=0;y<g[1];y++){const py=b[1][0]+(y+.5)*(b[1][1]-b[1][0])/g[1];for(let x=0;x<g[0];x++){const index=x+g[0]*(y+g[1]*z),at=index*4;if(Math.abs(f[at])>.022*p.bodyScale)continue;const first=region.nearestSamples[index];if(first===65535)continue;const px=b[0][0]+(x+.5)*(b[0][1]-b[0][0])/g[0],j=first*3,d1=(px-pos[j])**2+(py-pos[j+1])**2+(pz-pos[j+2])**2,ids=p.candidates(px,py,pz);let second=-1,d2=d1+variance*4;for(const i of ids){if(restDistance(i,first)<=limit2)continue;const k=i*3,d=(px-pos[k])**2+(py-pos[k+1])**2+(pz-pos[k+2])**2;if(d<d2){second=i;d2=d;}}if(second<0)continue;const a=evaluate(px,py,pz,ids,first),c=evaluate(px,py,pz,ids,second);if(!a||!c)continue;const chosen=a.d<c.d?a:c,t=Math.max(0,Math.min(1,(d2-d1-variance*2)/(variance*2))),weight=1-t*t*(3-2*t),old=f[at],value=old*(1-weight)+chosen.d*weight;maximum=Math.max(maximum,Math.abs(value-old));f[at]=value;for(let k=0;k<3;k++){f[at+1+k]=f[at+1+k]*(1-weight)+chosen.material[k]*weight;if(nf)nf[at+k]=nf[at+k]*(1-weight)+chosen.normal[k]*weight;}repaired++;}}}
 region.contactUnion={method:'union of two separated rest-neighbourhood implicit fits at posed contact',correctedVoxels:repaired,maxScalarChangeMM:maximum*1000,allContactConfigurationsCertified:false};return region;
}
globalThis.BodyContactFieldR20={apply};
})();
