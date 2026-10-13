const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const ds=(a,b,x)=>{const t=(x-a)/(b-a);return t<=0||t>=1?0:6*t*(1-t)/(b-a);};
/** One deformation applies to panels, holes, threads, binding and outsole.
 * Width is a forefoot envelope; instep is local and vanishes on the sole.
 * No change to the human rig, no global vertical stretching of a high heel. */
export function shapePoint(x,y,z,f){const w=smooth(-95,15,z),a=f.heel+(f.width-f.heel)*w,e=Math.exp(-Math.pow((z-2)/57,2)),v=smooth(38,85,y);return [x*a,y+f.instep*e*v,-128+(z+128)*f.length];}
export function shapeNormal(x,y,z,n,f){const a=f.heel+(f.width-f.heel)*smooth(-95,15,z),c=x*(f.width-f.heel)*ds(-95,15,z),e=Math.exp(-Math.pow((z-2)/57,2)),b=1+f.instep*e*ds(38,85,y),d=f.instep*e*(-2*(z-2)/(57*57))*smooth(38,85,y),nx=n[0]/a,ny=n[1]/b,nz=(n[2]-c*nx-d*ny)/f.length,l=Math.hypot(nx,ny,nz);return l>1e-12?[nx/l,ny/l,nz/l]:[0,1,0];}
export function deformGeometry(source,f){const g=source.clone(),P=source.attributes.position,N=source.attributes.normal,p=g.attributes.position.array,n=g.attributes.normal?.array;for(let i=0;i<P.count;i++){const j=i*3,x=P.array[j],y=P.array[j+1],z=P.array[j+2];p.set(shapePoint(x,y,z,f),j);if(n)n.set(shapeNormal(x,y,z,Array.from(N.array.subarray(j,j+3)),f),j);}g.attributes.position.needsUpdate=true;if(n)g.attributes.normal.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();return g;}
